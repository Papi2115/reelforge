/**
 * The production line as the renderer sees it (pure): a channel's queue as item views (current
 * step, its state and message, how far the film is, the live progress of the running step), the
 * line's status, the "Needs you" entries, "run until HH:MM" as an epoch and a running step's live
 * line from a pipeline stage event. Every status comes from the line's own state machine.
 */
import {
  DEFAULT_QUEUE_TARGET_MINUTES,
  QUEUE_STEPS,
  type ProductionQueue,
  type QueueItem,
} from '@reelforge/shared';
import {
  currentStep,
  parseClock,
  queueAttention,
  type LineEnd,
  type LineStatus,
  type StageEvent,
} from '@reelforge/stages';
import { projectKey } from '../stages/stage-service.js';
import type {
  ChannelQueueView,
  LiveProgress,
  LineView,
  QueueAttentionView,
  QueueItemView,
  RunUntilRequest,
  RunUntilView,
} from '../../shared/queue-contract.js';

/** `<channelId>/<itemId>`: the key of an item's live progress. */
export function liveKey(channelId: string, itemId: string): string {
  return `${channelId}/${itemId}`;
}

function stepsDone(item: QueueItem): number {
  return QUEUE_STEPS.filter((step) => {
    const state = item.stageProgress[step]?.state;
    return state === 'done' || state === 'skipped';
  }).length;
}

export function itemView(
  queue: Pick<ProductionQueue, 'defaultTargetMinutes'>,
  item: QueueItem,
  live: LiveProgress | undefined,
): QueueItemView {
  const step = currentStep(item) ?? null;
  const state = step === null ? undefined : item.stageProgress[step];
  const failed = item.error?.message;
  return {
    id: item.id,
    topic: item.topic,
    status: item.status,
    step,
    stepState: state?.state ?? null,
    message: failed ?? (state?.state === 'waiting' ? (state.message ?? null) : null),
    targetMinutes: item.targetMinutes ?? queue.defaultTargetMinutes,
    stepsDone: stepsDone(item),
    stepsTotal: QUEUE_STEPS.length,
    projectPath: item.projectPath ?? null,
    // The same ⚠ from two steps (a stage and the final review) shows once.
    warnings: [...new Set(item.warnings)],
    reviewed: item.reviewedAt !== undefined,
    live: live ?? null,
  };
}

export function channelView(
  channelId: string,
  queue: ProductionQueue | { readonly error: string },
  voiceReady: boolean,
  live: ReadonlyMap<string, LiveProgress>,
): ChannelQueueView {
  if ('error' in queue) {
    return {
      channelId,
      autoApproveScript: false,
      paused: false,
      defaultTargetMinutes: DEFAULT_QUEUE_TARGET_MINUTES,
      voiceReady,
      items: [],
      error: queue.error,
    };
  }
  return {
    channelId,
    autoApproveScript: queue.autoApproveScript,
    paused: queue.paused,
    defaultTargetMinutes: queue.defaultTargetMinutes,
    voiceReady,
    items: queue.items.map((item) => itemView(queue, item, live.get(liveKey(channelId, item.id)))),
    error: null,
  };
}

export function attentionViews(queues: readonly ProductionQueue[]): QueueAttentionView[] {
  return queues.flatMap((queue) =>
    queueAttention(queue).map((entry) => ({
      kind: entry.kind,
      channelId: entry.channelId,
      itemId: entry.itemId,
      topic: entry.topic,
      step: entry.step ?? null,
      message: entry.message,
      since: entry.since,
      projectPath: entry.projectPath ?? null,
    })),
  );
}

export interface LineFacts {
  readonly status: LineStatus;
  readonly wanted: boolean;
  readonly runUntil: RunUntilView;
  readonly lastEnd: LineEnd | null;
  readonly problem: string | null;
}

export function lineView(facts: LineFacts): LineView {
  const { status } = facts;
  return {
    activity: status.state,
    until: status.until ?? null,
    message: status.message ?? null,
    current: status.current ?? null,
    wanted: facts.wanted,
    runUntil: facts.runUntil,
    lastEnd: facts.lastEnd,
    problem: facts.problem,
  };
}

/**
 * "Run until 06:30": the next 06:30 after `now` (today, else tomorrow). `minuteOf` gives the
 * local minutes since midnight of an epoch (the system time zone in the app).
 */
export function runUntilView(
  request: RunUntilRequest,
  now: number,
  minuteOf: (epochMs: number) => number,
): RunUntilView {
  if (request.kind === 'idle') return { kind: 'idle' };
  const target = parseClock(request.at) ?? 0;
  const current = minuteOf(now);
  const startOfMinute = now - (now % 60_000);
  let minutes = target - current;
  if (minutes <= 0) minutes += 24 * 60;
  return { kind: 'time', at: startOfMinute + minutes * 60_000, text: request.at };
}

/**
 * A film of `queue` whose project folder (`projectKeyOf`, the app's comparable path key) is in
 * `keys` waits for you (script, voiceover or photos).
 */
export function filmWaitsIn(
  queue: ProductionQueue,
  keys: ReadonlySet<string>,
  projectKeyOf: (dir: string) => string = projectKey,
): boolean {
  return queue.items.some(
    (item) =>
      (item.status === 'needs-approval' || item.status === 'needs-voice') &&
      item.projectPath !== undefined &&
      keys.has(projectKeyOf(item.projectPath)),
  );
}

/** A running pipeline stage's progress as the item's live line (null: nothing new to show). */
export function stageLive(event: StageEvent): LiveProgress | null {
  switch (event.type) {
    case 'step':
      return { label: event.label, percent: event.percent ?? null };
    case 'paused':
      return { label: event.message, percent: null };
    case 'shot':
      return event.state === 'finished'
        ? { label: `Shot ${event.shotId} built`, percent: null }
        : event.state === 'started'
          ? { label: `Building shot ${event.shotId}`, percent: null }
          : null;
    default:
      return null;
  }
}
