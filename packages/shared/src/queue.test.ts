import { describe, expect, it } from 'vitest';
import {
  DEFAULT_QUEUE_TARGET_MINUTES,
  QUEUE_FILE_VERSION,
  emptyLineState,
  emptyProductionQueue,
  lineStateSchema,
  productionQueueSchema,
  queueFileName,
  queueTopicInputSchema,
} from './queue.js';

const AT = '2026-10-07T20:00:00.000Z';

function item(id: string): Record<string, unknown> {
  return { id, topic: 'Why the sky is blue', status: 'queued', createdAt: AT, updatedAt: AT };
}

describe('production queue schema', () => {
  it('fills defaults: gate on, not paused, 8-minute films, empty progress/history', () => {
    const queue = productionQueueSchema.parse({
      version: QUEUE_FILE_VERSION,
      channelId: 'voxplain',
      items: [item('a1')],
    });
    expect(queue).toMatchObject({
      autoApproveScript: false,
      paused: false,
      defaultTargetMinutes: DEFAULT_QUEUE_TARGET_MINUTES,
    });
    expect(queue.items[0]).toMatchObject({
      language: 'en',
      stageProgress: {},
      warnings: [],
      history: [],
    });
    expect(emptyProductionQueue('voxplain').items).toEqual([]);
    expect(queueFileName('voxplain')).toBe('voxplain.json');
  });

  it('keeps step states and refuses unknown steps, duplicate ids and newer versions', () => {
    const withProgress = {
      ...item('a1'),
      stageProgress: { script: { state: 'done', at: AT }, approval: { state: 'waiting', at: AT } },
    };
    const base = { version: QUEUE_FILE_VERSION, channelId: 'voxplain' };
    expect(productionQueueSchema.safeParse({ ...base, items: [withProgress] }).success).toBe(true);
    const unknownStep = { ...item('a1'), stageProgress: { upload: { state: 'done', at: AT } } };
    expect(productionQueueSchema.safeParse({ ...base, items: [unknownStep] }).success).toBe(false);
    expect(
      productionQueueSchema.safeParse({ ...base, items: [item('a1'), item('a1')] }).success,
    ).toBe(false);
    expect(productionQueueSchema.safeParse({ ...base, version: 2 }).success).toBe(false);
  });

  it('topic input is strict (no ids or statuses from the outside)', () => {
    expect(queueTopicInputSchema.safeParse({ topic: 'Doom on a calculator' }).success).toBe(true);
    expect(queueTopicInputSchema.safeParse({ topic: '  ' }).success).toBe(false);
    expect(queueTopicInputSchema.safeParse({ topic: 'x', status: 'done' }).success).toBe(false);
  });

  it('line state keeps the usage-limit pause', () => {
    const state = lineStateSchema.parse({
      ...emptyLineState(),
      limitPause: { since: AT, until: '2026-10-08T01:00:00.000Z', message: 'limit' },
    });
    expect(state.limitPause?.until).toBe('2026-10-08T01:00:00.000Z');
  });
});
