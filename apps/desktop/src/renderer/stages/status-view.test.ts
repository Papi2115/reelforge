import { describe, expect, it } from 'vitest';
import {
  PIPELINE_STAGE_KEYS,
  type PipelineStageKey,
  type StageInfo,
  type StagesState,
} from '../../shared/stages-contract.js';
import { pipelineRows } from './pipeline-view.js';
import { stations } from './stations-view.js';
import { foldDoneRows, foldText, pipelineSummary, STATUS_LEGEND } from './status-view.js';

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

describe('STATUS_LEGEND', () => {
  it('explains the seven statuses, Kept from before and Failed, each with its dot colour', () => {
    expect(STATUS_LEGEND.map((entry) => entry.label)).toEqual([
      'Not started',
      'Ready',
      'Working',
      'Needs you',
      'Done',
      'Kept from before',
      'Built with problems',
      'Out of date',
      'Failed',
    ]);
    for (const entry of STATUS_LEGEND) {
      expect(entry.css).not.toBe('');
      expect(entry.meaning).not.toMatch(/Waiting for/);
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
    const written = state({ script: DONE, voiceover: DONE });
    const rows = pipelineRows(written);
    expect(pipelineSummary(rows, stations(rows, written))).toBe(
      '1 of 8 steps done · Script written: Needs you',
    );
    const approved = state({ script: APPROVED });
    const approvedRows = pipelineRows(approved);
    expect(pipelineSummary(approvedRows, stations(approvedRows, approved))).toBe(
      '1 of 8 steps done',
    );
  });
});
