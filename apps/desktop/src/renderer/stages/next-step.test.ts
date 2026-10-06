import { describe, expect, it } from 'vitest';
import {
  PIPELINE_STAGE_KEYS,
  type PipelineStageKey,
  type StageInfo,
  type StagesState,
} from '../../shared/stages-contract.js';
import { nextStep } from './next-step.js';
import { pipelineRows } from './pipeline-view.js';

function info(stage: PipelineStageKey, patch: Partial<StageInfo> = {}): StageInfo {
  return {
    stage,
    status: null,
    message: null,
    updatedAt: null,
    stale: false,
    staleReason: null,
    interrupted: false,
    approvedAt: null,
    hasOutput: false,
    registered: true,
    runnable: stage !== 'voiceover',
    ready: false,
    reasons: [],
    invalidates: [],
    error: null,
    warnings: [],
    ...patch,
  };
}

function state(
  patches: Partial<Record<PipelineStageKey, Partial<StageInfo>>>,
  extra: Partial<StagesState> = {},
): StagesState {
  return {
    projectDir: 'C:\\p',
    // Main reports Assets only when research is on and needed (PLAN.md#12.10).
    stages: PIPELINE_STAGE_KEYS.filter(
      (stage) => stage !== 'assets' || patches.assets !== undefined,
    ).map((stage) => info(stage, patches[stage])),
    running: null,
    queue: [],
    pause: null,
    ...extra,
  };
}

const DONE = { status: 'done', hasOutput: true } as const;
const APPROVED = { ...DONE, approvedAt: '2026-10-02T10:00:00.000Z' } as const;

describe('nextStep', () => {
  it('sends the user to the asset package when it waits for review (PLAN.md#12.10)', () => {
    const step = nextStep(
      pipelineRows(
        state({
          script: APPROVED,
          voiceover: DONE,
          clean: DONE,
          words: DONE,
          storyboard: DONE,
          assets: { ...DONE, awaitingReview: true },
        }),
      ),
    );
    expect(step).toMatchObject({
      rowId: 'assets',
      button: 'Review the assets',
      action: { kind: 'open', target: { kind: 'assets' } },
    });
  });

  it('starts a new project at the brief', () => {
    const step = nextStep(pipelineRows(state({ script: { ready: true } })));
    expect(step).toMatchObject({
      rowId: 'script',
      heading: 'Next',
      text: 'Describe the video in the brief, then write the script.',
      button: 'Open the brief',
      action: { kind: 'brief' },
    });
    expect(step?.why).toContain('read aloud');
  });

  it('asks for the voiceover once the script is approved', () => {
    const step = nextStep(pipelineRows(state({ script: APPROVED })));
    expect(step).toMatchObject({
      rowId: 'voiceover',
      text: 'Record or import your voiceover.',
      button: 'Add your voiceover',
      action: { kind: 'open', target: { kind: 'voiceover' } },
    });
  });

  it('names the step to run on the button (the example project: Sound design mixed)', () => {
    const rows = pipelineRows(
      state({
        script: APPROVED,
        voiceover: DONE,
        clean: DONE,
        words: DONE,
        storyboard: DONE,
        scenes: DONE,
        'sound-cues': DONE,
        mix: { ready: true },
      }),
    );
    expect(nextStep(rows)).toMatchObject({
      rowId: 'sound',
      text: 'Mix the voice, effects and ambience.',
      button: 'Run Sound design mixed',
      action: { kind: 'run', stages: ['mix'] },
    });
  });

  it('shows a step that cannot run yet instead of a dead Run button', () => {
    const rows = pipelineRows(state({ script: APPROVED, voiceover: DONE }));
    expect(nextStep(rows)).toMatchObject({
      rowId: 'clean',
      button: 'Show Audio cleaned',
      action: { kind: 'select' },
    });
  });

  it('says review, failed, stale and interrupted steps in their own words', () => {
    expect(nextStep(pipelineRows(state({ script: DONE })))).toMatchObject({
      text: 'Read the script and approve it.',
      button: 'Open the script',
      action: { kind: 'open', target: { kind: 'script' } },
    });
    const failed = pipelineRows(state({ script: APPROVED, voiceover: { status: 'failed' } }));
    expect(nextStep(failed)).toMatchObject({
      text: 'Voiceover added stopped with a problem.',
      button: 'See what went wrong',
      action: { kind: 'select' },
    });
    const stale = pipelineRows(state({ script: { ...APPROVED, stale: true, ready: true } }));
    expect(nextStep(stale)).toMatchObject({
      text: 'Script written is out of date: something it uses changed.',
      button: 'Rebuild Script written',
      action: { kind: 'run', stages: ['script'] },
    });
    const interrupted = pipelineRows(
      state({ script: APPROVED, voiceover: DONE, clean: { interrupted: true, ready: true } }),
    );
    expect(nextStep(interrupted)).toMatchObject({
      button: 'Resume Audio cleaned',
      action: { kind: 'run', stages: ['clean'] },
    });
  });

  it('stays quiet while a step is queued and says when everything is done', () => {
    const queued = state({ script: APPROVED }, { queue: ['clean'] });
    expect(nextStep(pipelineRows(queued))).toBeNull();
    const all = Object.fromEntries(PIPELINE_STAGE_KEYS.map((stage) => [stage, APPROVED]));
    expect(nextStep(pipelineRows(state(all)))).toMatchObject({
      rowId: 'export',
      heading: 'All done',
      text: 'Your video is exported.',
      button: 'Open the export',
      action: { kind: 'open', target: { kind: 'export' } },
    });
  });
});
