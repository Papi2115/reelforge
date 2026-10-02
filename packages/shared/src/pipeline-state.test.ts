import { describe, expect, it } from 'vitest';
import { pipelineStateSchema, stageStateSchema } from './index.js';

const STAMP = '2026-10-02T10:00:00.000Z';

describe('stageStateSchema', () => {
  it('reads states written before the interrupted / approval fields existed', () => {
    expect(stageStateSchema.parse({ status: 'done', updatedAt: STAMP })).toEqual({
      status: 'done',
      updatedAt: STAMP,
    });
  });

  it('keeps the interrupted flag and the approval time', () => {
    const state = { status: 'failed', updatedAt: STAMP, interrupted: true, approvedAt: STAMP };
    expect(stageStateSchema.parse(state)).toEqual(state);
    expect(stageStateSchema.safeParse({ ...state, approvedAt: 'yesterday' }).success).toBe(false);
  });

  it('is part of pipeline.json', () => {
    const file = {
      version: 1,
      updatedAt: STAMP,
      stages: { script: { status: 'done', updatedAt: STAMP, approvedAt: STAMP } },
      queue: [],
    };
    expect(pipelineStateSchema.parse(file).stages['script']?.approvedAt).toBe(STAMP);
  });
});
