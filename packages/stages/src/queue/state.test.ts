import {
  QUEUE_FILE_VERSION,
  productionQueueSchema,
  type ProductionQueue,
  type QueueItem,
  type QueueStep,
  type QueueStepStateName,
} from '@reelforge/shared';
import { describe, expect, it } from 'vitest';
import { queueAttention } from './attention.js';
import { nextLineStep, parseClock, quietRemainingMs, rotateQueues } from './schedule.js';
import {
  buildStarted,
  currentStep,
  derivedStatus,
  finishStep,
  holdItem,
  itemActivity,
  recoverItem,
  resumeItem,
  retryItem,
  startStep,
} from './state.js';

const AT = '2026-10-07T20:00:00.000Z';
const LATER = '2026-10-07T21:00:00.000Z';
const ORDER: readonly QueueStep[] = [
  'project',
  'brief',
  'script',
  'approval',
  'voiceover',
  'clean',
  'words',
  'storyboard',
  'assets',
  'scenes',
  'final-review',
  'sound-cues',
  'mix',
  'export',
  'publish',
];

/** Steps before `step` done, `step` in `state` (or pending). */
function itemAt(step: QueueStep | 'finished', state?: QueueStepStateName, id = 'a'): QueueItem {
  const index = step === 'finished' ? ORDER.length : ORDER.indexOf(step);
  const progress: QueueItem['stageProgress'] = {};
  for (const done of ORDER.slice(0, index)) progress[done] = { state: 'done', at: AT };
  if (step !== 'finished' && state !== undefined) progress[step] = { state, at: AT };
  return {
    id,
    topic: `Topic ${id}`,
    language: 'en',
    status: 'queued',
    stageProgress: progress,
    warnings: [],
    createdAt: AT,
    updatedAt: AT,
    history: [],
  };
}

function queue(channelId: string, items: QueueItem[], extra: Partial<ProductionQueue> = {}) {
  return productionQueueSchema.parse({ version: QUEUE_FILE_VERSION, channelId, items, ...extra });
}

describe('derived status', () => {
  it.each<[QueueStep | 'finished', QueueStepStateName | undefined, string]>([
    ['project', undefined, 'queued'],
    ['project', 'running', 'brief'],
    ['brief', undefined, 'brief'],
    ['script', 'running', 'scripting'],
    ['approval', undefined, 'scripting'],
    ['approval', 'waiting', 'needs-approval'],
    ['voiceover', 'waiting', 'needs-voice'],
    ['voiceover', undefined, 'building'],
    ['assets', 'waiting', 'needs-approval'],
    ['scenes', 'running', 'building'],
    ['mix', undefined, 'building'],
    ['export', 'running', 'exporting'],
    ['publish', undefined, 'exporting'],
    ['scenes', 'failed', 'failed'],
    ['finished', undefined, 'done'],
  ])('%s %s -> %s', (step, state, status) => {
    expect(derivedStatus(itemAt(step, state).stageProgress)).toBe(status);
  });

  it('skipped steps count as finished', () => {
    const item = itemAt('assets', 'skipped');
    expect(currentStep(item)).toBe('scenes');
    expect(buildStarted(item)).toBe(true);
    expect(buildStarted(itemAt('voiceover'))).toBe(false);
  });
});

describe('transitions', () => {
  it.each<[string, Parameters<typeof finishStep>[2], string, string | undefined]>([
    ['done', { kind: 'done', message: 'ok', warnings: ['⚠ x'] }, 'building', 'done'],
    ['waiting', { kind: 'waiting', message: 'record it' }, 'needs-voice', 'waiting'],
    ['skipped', { kind: 'skipped', message: 'n/a' }, 'building', 'skipped'],
    ['failed', { kind: 'failed', message: 'boom' }, 'failed', 'failed'],
    ['limit', { kind: 'limit', message: 'limit' }, 'building', undefined],
    ['blocked', { kind: 'blocked', message: 'login' }, 'building', undefined],
    ['cancelled', { kind: 'cancelled' }, 'building', undefined],
  ])('%s outcome', (_name, outcome, status, state) => {
    const started = startStep(itemAt('voiceover'), 'voiceover', AT);
    expect(started.stageProgress.voiceover?.state).toBe('running');
    const next = finishStep(started, 'voiceover', outcome, LATER);
    expect(next.status).toBe(status);
    expect(next.stageProgress.voiceover?.state).toBe(state);
    if (outcome.kind === 'failed')
      expect(next.error).toEqual({ step: 'voiceover', message: 'boom' });
    if (outcome.kind === 'done') expect(next.warnings).toEqual(['⚠ x']);
  });

  it('records status changes in the history only', () => {
    const item = finishStep(
      startStep(itemAt('project'), 'project', AT),
      'project',
      { kind: 'done' },
      AT,
    );
    const again = finishStep(startStep(item, 'brief', AT), 'brief', { kind: 'done' }, LATER);
    expect(item.history.map((entry) => entry.status)).toEqual(['brief']);
    expect(again.history.map((entry) => entry.status)).toEqual(['brief', 'scripting']);
  });

  it('recovers running steps, holds, resumes and retries', () => {
    const crashed = startStep(itemAt('scenes'), 'scenes', AT);
    const recovered = recoverItem(crashed, LATER);
    expect(recovered.stageProgress.scenes).toBeUndefined();
    expect(recovered.history.at(-1)).toMatchObject({ status: 'building', message: 'interrupted' });
    const held = holdItem(recovered, LATER);
    expect(held.status).toBe('paused');
    expect(itemActivity(held)).toBe('held');
    expect(resumeItem(held, LATER).status).toBe('building');
    const failed = finishStep(recovered, 'scenes', { kind: 'failed', message: 'x' }, LATER);
    const retried = retryItem(failed, LATER);
    expect(retried.status).toBe('building');
    expect(retried.error).toBeUndefined();
    expect(itemActivity(retried)).toBe('ready');
  });
});

describe('next line step', () => {
  const none = new Set<string>();
  const pick = (queues: ProductionQueue[], checked = none, last?: string) =>
    nextLineStep(queues, { maxPendingApprovals: 2, checkedGates: checked, lastChannelId: last });

  it('re-checks waiting gates first, once per change', () => {
    const queues = [
      queue('a', [itemAt('approval', 'waiting', 'w'), itemAt('script', undefined, 's')]),
    ];
    expect(pick(queues)).toMatchObject({ kind: 'gate', step: 'approval' });
    expect(pick(queues, new Set(['a/w']))).toMatchObject({ kind: 'work', step: 'script' });
  });

  it('scripts before builds, the building film before a new one, waiting films never block', () => {
    const building = itemAt('mix', undefined, 'b');
    const fresh = itemAt('voiceover', undefined, 'n');
    const scripting = itemAt('brief', undefined, 's');
    const checked = new Set(['a/v']);
    const waiting = itemAt('voiceover', 'waiting', 'v');
    expect(pick([queue('a', [waiting, fresh, building, scripting])], checked)).toMatchObject({
      step: 'brief',
    });
    expect(pick([queue('a', [waiting, fresh, building])], checked)).toMatchObject({
      item: { id: 'b' },
    });
    expect(pick([queue('a', [waiting, fresh])], checked)).toMatchObject({ item: { id: 'n' } });
    expect(pick([queue('a', [waiting])], checked)).toBeUndefined();
  });

  it('stops writing scripts while too many wait for approval, paused queues are skipped', () => {
    const waiting = [itemAt('approval', 'waiting', 'w1'), itemAt('approval', 'waiting', 'w2')];
    const checked = new Set(['a/w1', 'a/w2']);
    expect(
      pick([queue('a', [...waiting, itemAt('project', undefined, 'p')])], checked),
    ).toBeUndefined();
    expect(pick([queue('a', [itemAt('project')], { paused: true })])).toBeUndefined();
  });

  it('channels take turns for new work', () => {
    const queues = [
      queue('a', [itemAt('project', undefined, 'x')]),
      queue('b', [itemAt('project', undefined, 'y')]),
    ];
    expect(pick(queues)).toMatchObject({ channelId: 'a' });
    expect(pick(queues, none, 'a')).toMatchObject({ channelId: 'b' });
    expect(rotateQueues(queues, 'b').map((entry) => entry.channelId)).toEqual(['a', 'b']);
  });
});

describe('quiet hours', () => {
  it('parses HH:MM and measures the time left, across midnight too', () => {
    expect(parseClock('7:05')).toBe(425);
    expect(parseClock('24:00')).toBeUndefined();
    const quiet = { start: '22:00', end: '07:00' };
    expect(quietRemainingMs(quiet, 23 * 60, 0)).toBe(8 * 60 * 60_000);
    expect(quietRemainingMs(quiet, 6 * 60 + 59, 30_000)).toBe(30_000);
    expect(quietRemainingMs(quiet, 12 * 60, 0)).toBe(0);
    expect(quietRemainingMs({ start: '09:00', end: '17:00' }, 10 * 60, 0)).toBe(7 * 60 * 60_000);
    expect(quietRemainingMs(undefined, 0, 0)).toBe(0);
  });
});

describe('needs you', () => {
  it('collects approvals, voice, asset reviews, failures and unchecked warnings', () => {
    const failed = finishStep(
      itemAt('scenes', undefined, 'f'),
      'scenes',
      { kind: 'failed', message: 'x' },
      LATER,
    );
    const warned = { ...itemAt('finished', undefined, 'd'), warnings: ['⚠ blank frame'] };
    const items = [
      itemAt('approval', 'waiting', 'a'),
      itemAt('voiceover', 'waiting', 'v'),
      itemAt('assets', 'waiting', 'r'),
      failed,
      warned,
      { ...warned, id: 'seen', reviewedAt: LATER },
      itemAt('finished', undefined, 'clean'),
      holdItem(itemAt('approval', 'waiting', 'held'), LATER),
      itemAt('scenes', 'running', 'busy'),
    ];
    expect(queueAttention(queue('c', items)).map((entry) => [entry.itemId, entry.kind])).toEqual([
      ['a', 'approve-script'],
      ['v', 'add-voice'],
      ['r', 'review-assets'],
      ['f', 'failed'],
      ['d', 'check-warnings'],
    ]);
  });
});
