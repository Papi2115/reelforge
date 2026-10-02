import { describe, expect, it } from 'vitest';
import {
  addUsageTotals,
  emptyUsageTotals,
  pipelineStateSchema,
  usageFileSchema,
  type PipelineState,
  type UsageFile,
} from './index.js';

const at = '2026-10-02T00:00:00.000Z';

const state: PipelineState = {
  version: 1,
  updatedAt: at,
  stages: { 'scene-build': { status: 'paused', updatedAt: at, message: 'usage limit' } },
  queue: [
    {
      id: 'shot-01',
      stage: 'scene-build',
      prompt: 'Build shot 1',
      status: 'done',
      attempts: 1,
      limitHits: 0,
      sessionId: 'abc',
      createdAt: at,
      updatedAt: at,
      finishedAt: at,
    },
    {
      id: 'shot-02',
      stage: 'scene-build',
      prompt: 'Build shot 2',
      purpose: 'main',
      status: 'pending',
      attempts: 0,
      limitHits: 1,
      createdAt: at,
      updatedAt: at,
    },
  ],
  pause: {
    reason: 'limit',
    pausedAt: at,
    pausedUntil: '2026-10-02T05:01:00.000Z',
    untilSource: 'reset-time',
    consecutiveLimits: 1,
    concurrency: 1,
    rateLimitType: 'five_hour',
  },
};

describe('pipelineStateSchema', () => {
  it('round-trips stages, the work queue and a pause', () => {
    expect(pipelineStateSchema.parse(state)).toEqual(state);
  });

  it('rejects unknown statuses, negative counters and other versions', () => {
    const [first] = state.queue;
    if (first === undefined) throw new Error('fixture');
    const bad = (queue: unknown): boolean =>
      pipelineStateSchema.safeParse({ ...state, queue: [queue] }).success;
    expect(bad({ ...first, status: 'paused' })).toBe(false);
    expect(bad({ ...first, attempts: -1 })).toBe(false);
    expect(bad({ ...first, attempts: 1.5 })).toBe(false);
    expect(pipelineStateSchema.safeParse({ ...state, version: 2 }).success).toBe(false);
  });
});

describe('usageFileSchema', () => {
  it('accepts per-stage/per-model totals and budget warnings', () => {
    const totals = { ...emptyUsageTotals(), turns: 2, inputTokens: 10, costUsd: 0.5 };
    const file: UsageFile = {
      version: 1,
      updatedAt: at,
      totals,
      stages: { 'scene-build': { opus: totals } },
      budgetWarnings: [{ percent: 50, costUsd: 0.5, budgetUsd: 1, at }],
    };
    expect(usageFileSchema.parse(file)).toEqual(file);
    expect(usageFileSchema.safeParse({ ...file, totals: { ...totals, turns: -1 } }).success).toBe(
      false,
    );
  });

  it('adds totals field by field', () => {
    const one = { ...emptyUsageTotals(), turns: 1, outputTokens: 5, costUsd: 0.25 };
    expect(addUsageTotals(one, one)).toEqual({
      ...emptyUsageTotals(),
      turns: 2,
      outputTokens: 10,
      costUsd: 0.5,
    });
  });
});
