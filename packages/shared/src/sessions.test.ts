import { describe, expect, it } from 'vitest';
import { sessionsFileSchema } from './index.js';

const record = {
  sessionId: 'b70a331f-64a6-442a-83db-2903d0281723',
  model: 'opus',
  updatedAt: '2026-10-02T00:00:00.000Z',
  pendingTurn: {
    turnId: 't-1',
    stage: 'scene-build',
    model: 'opus',
    prompt: 'Build scene 3',
    startedAt: '2026-10-02T00:00:00.000Z',
    state: 'interrupted',
    reason: 'crashed',
  },
};

describe('sessionsFileSchema', () => {
  it('accepts per-purpose records with an optional pending turn', () => {
    const file = {
      version: 1,
      sessions: { main: record, qa: { model: 'haiku', updatedAt: record.updatedAt } },
    };
    expect(sessionsFileSchema.parse(file)).toEqual(file);
  });

  it('rejects unknown versions, purposes and pending states', () => {
    expect(sessionsFileSchema.safeParse({ version: 2, sessions: {} }).success).toBe(false);
    const badState = { ...record, pendingTurn: { ...record.pendingTurn, state: 'paused' } };
    expect(sessionsFileSchema.safeParse({ version: 1, sessions: { main: badState } }).success).toBe(
      false,
    );
    expect(
      sessionsFileSchema.safeParse({
        version: 1,
        sessions: { main: { ...record, updatedAt: 'x' } },
      }).success,
    ).toBe(false);
  });
});
