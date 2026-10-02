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
    stages: PIPELINE_STAGE_KEYS.map((stage) => info(stage, patches[stage])),
    running: null,
    queue: [],
    pause: null,
    ...extra,
  };
}

const DONE = { status: 'done', hasOutput: true } as const;
const APPROVED = { ...DONE, approvedAt: '2026-10-02T10:00:00.000Z' } as const;

describe('nextStep', () => {
  it('starts a new project at the brief', () => {
    expect(nextStep(pipelineRows(state({ script: { ready: true } })))).toEqual({
      rowId: 'script',
      text: 'Next: fill in the brief, then run Script written.',
    });
  });

  it('asks for the voiceover once the script is approved', () => {
    const rows = pipelineRows(state({ script: APPROVED }));
    expect(nextStep(rows)).toEqual({
      rowId: 'voiceover',
      text: 'Next: add your voiceover (Voiceover added → Replace to import or record it).',
    });
  });

  it('points the example project (Script → Scenes done) at the sound design', () => {
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
    expect(nextStep(rows)?.rowId).toBe('sound');
    expect(nextStep(rows)?.text).toContain('run Sound design mixed');
  });

  it('says review, failed and stale rows in their own words', () => {
    expect(nextStep(pipelineRows(state({ script: DONE })))?.text).toBe(
      'Next: open Script written and approve it.',
    );
    const failed = pipelineRows(state({ script: APPROVED, voiceover: { status: 'failed' } }));
    expect(nextStep(failed)?.text).toBe('Next: Voiceover added failed: select it to see why.');
    const stale = pipelineRows(state({ script: { ...APPROVED, stale: true } }));
    expect(nextStep(stale)?.text).toBe('Next: run Script written again.');
  });

  it('stays quiet while a stage is queued and congratulates at the end', () => {
    const queued = state({ script: APPROVED }, { queue: ['clean'] });
    expect(nextStep(pipelineRows(queued))).toBeNull();
    const all = Object.fromEntries(PIPELINE_STAGE_KEYS.map((stage) => [stage, APPROVED]));
    expect(nextStep(pipelineRows(state(all)))).toEqual({
      rowId: 'export',
      text: 'Done: open Video exported to find your MP4.',
    });
  });
});
