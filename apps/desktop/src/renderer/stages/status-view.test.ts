import { describe, expect, it } from 'vitest';
import {
  PIPELINE_STAGE_KEYS,
  type PipelineStageKey,
  type StageInfo,
  type StageRunView,
  type StagesState,
} from '../../shared/stages-contract.js';
import { pipelineRows, type RowView } from './pipeline-view.js';
import {
  foldDoneRows,
  foldText,
  pipelineSummary,
  statusLabel,
  STATUS_LEGEND,
} from './status-view.js';

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

function labels(rows: readonly RowView[]): Record<string, string> {
  return Object.fromEntries(rows.map((row) => [row.spec.id, statusLabel(row, rows)]));
}

describe('statusLabel', () => {
  it('names what a waiting step waits for and says ready steps can run', () => {
    const rows = pipelineRows(state({ script: { ready: false } }));
    expect(labels(rows)).toMatchObject({
      script: 'Waiting for the brief',
      voiceover: 'Waiting for Script',
      clean: 'Waiting for Voiceover',
      export: 'Waiting for Sound mix',
    });
    const approved = pipelineRows(
      state({ script: APPROVED, voiceover: DONE, clean: { ready: true } }),
    );
    expect(labels(approved)).toMatchObject({
      script: 'Done',
      voiceover: 'Done',
      clean: 'Ready to run',
      words: 'Waiting for Cleanup',
    });
    expect(labels(pipelineRows(state({ script: APPROVED })))['voiceover']).toBe(
      'Needs your recording',
    );
  });

  it('says what a step waits for from its own gating reasons, not only the nearest step', () => {
    // Cleanup is not done, but Scenes waits on the asset package review (real run v2.3).
    const rows = pipelineRows(
      state({
        script: APPROVED,
        voiceover: DONE,
        clean: { reasons: ['No voice-over imported yet: run Voiceover first.'] },
        storyboard: DONE,
        assets: { ...DONE, awaitingReview: true },
        scenes: {
          reasons: [
            'An asset package is waiting for your review: open Assets and approve or reject it.',
          ],
        },
        'sound-cues': {
          reasons: ['Storyboard is out of date (script changed): run it again first.'],
        },
        mix: { reasons: ['vo/vo_clean.wav is missing: run Audio cleaned first.'] },
        words: { reasons: ['Approve the script first (Script written → Open → Approve script).'] },
      }),
    );
    expect(labels(rows)).toMatchObject({
      clean: 'Waiting for Voiceover',
      scenes: 'Waiting for your review of the asset package',
      sound: 'Waiting for Storyboard (out of date)',
      words: 'Waiting for your script approval',
    });
    const running = pipelineRows(
      state({ script: APPROVED, export: { reasons: ['Scenes built is still running.'] } }),
    );
    expect(labels(running)['export']).toBe('Waiting for Scenes');
    // Unknown reasons fall back to the nearest unfinished step.
    const odd = pipelineRows(state({ script: APPROVED, export: { reasons: ['Something else.'] } }));
    expect(labels(odd)['export']).toBe('Waiting for Sound mix');
  });

  it('says review, out of date, failed and interrupted as actions', () => {
    const rows = pipelineRows(
      state({
        script: DONE,
        voiceover: { ...DONE, stale: true },
        clean: { status: 'failed' },
        words: { interrupted: true },
      }),
    );
    expect(labels(rows)).toMatchObject({
      script: 'Review & approve',
      voiceover: 'Out of date — rebuild',
      clean: 'Failed — see details',
      words: 'Interrupted — Resume',
    });
  });

  it('shows the percent while running and when a paused step resumes', () => {
    const running: StageRunView = {
      stage: 'words',
      label: 'Transcribing',
      percent: 42.4,
      startedAt: 0,
      paused: null,
      steps: [],
      shots: {},
      action: null,
      targets: null,
    };
    const rows = pipelineRows(state({ script: APPROVED }, { running }));
    expect(labels(rows)['words']).toBe('Running… 42 %');
    const until = new Date(2026, 9, 3, 14, 5).getTime();
    const paused = pipelineRows(
      state({ script: APPROVED }, { running: { ...running, paused: { until, message: 'limit' } } }),
    );
    // The clock follows the locale: 24 h ("14:05") or 12 h ("02:05 PM" on en-US CI runners).
    expect(labels(paused)['words']).toMatch(
      /^Paused \(usage limit\) — resumes (?:\S*14.05|0?2.05\s?PM)/i,
    );
  });

  it('has a legend entry for every status the rows show', () => {
    const statuses = STATUS_LEGEND.map((entry) => entry.status);
    for (const status of ['done', 'ready', 'review', 'running', 'waiting', 'stale', 'failed']) {
      expect(statuses).toContain(status);
    }
  });
});

describe('foldDoneRows', () => {
  it('folds three or more finished steps at the top, keeping the current one', () => {
    const rows = pipelineRows(
      state({ script: APPROVED, voiceover: DONE, clean: DONE, words: { ready: true } }),
    );
    const folded = foldDoneRows(rows);
    expect(folded.done.map((row) => row.spec.id)).toEqual(['script', 'voiceover', 'clean']);
    expect(folded.rest[0]?.spec.id).toBe('words');
    expect(foldText(folded.done)).toBe('3 steps done');
  });

  it('does not fold fewer than three, or steps after an unfinished one', () => {
    expect(foldDoneRows(pipelineRows(state({ script: APPROVED, voiceover: DONE }))).done).toEqual(
      [],
    );
    const gap = pipelineRows(state({ script: DONE, words: DONE, storyboard: DONE, scenes: DONE }));
    expect(foldDoneRows(gap).done).toEqual([]);
  });

  it('keeps the last step visible when everything is done', () => {
    // Every stage done, the optional Assets step included (8 rows before the export).
    const all = Object.fromEntries(PIPELINE_STAGE_KEYS.map((stage) => [stage, APPROVED]));
    const folded = foldDoneRows(pipelineRows(state(all)));
    expect(folded.done).toHaveLength(8);
    expect(folded.rest.map((row) => row.spec.id)).toEqual(['export']);
  });
});

describe('pipelineSummary', () => {
  it('counts the finished steps and names what needs attention', () => {
    const rows = pipelineRows(state({ script: DONE, voiceover: DONE }));
    expect(pipelineSummary(rows)).toBe('1 of 8 steps done · Script written: Review & approve');
    expect(pipelineSummary(pipelineRows(state({ script: APPROVED })))).toBe('1 of 8 steps done');
  });
});
