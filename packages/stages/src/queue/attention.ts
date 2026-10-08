/**
 * "Needs you" entries of a production queue (pure, for the inbox): scripts to approve, films
 * waiting for a voice-over or an asset review, failed films, and finished films whose ✓/⚠ report
 * has warnings the user has not looked at yet.
 */
import type { ProductionQueue, QueueItem, QueueStep } from '@reelforge/shared';
import { currentStep, derivedStatus } from './state.js';

export type QueueAttentionKind =
  'approve-script' | 'add-voice' | 'review-assets' | 'failed' | 'check-warnings';

export interface QueueAttention {
  readonly kind: QueueAttentionKind;
  readonly channelId: string;
  readonly itemId: string;
  readonly topic: string;
  readonly projectPath: string | undefined;
  readonly step: QueueStep | undefined;
  /** What to do / what went wrong, one line. */
  readonly message: string;
  /** ISO time the item reached this state. */
  readonly since: string;
}

const WAITING_KIND: Partial<Record<QueueStep, QueueAttentionKind>> = {
  approval: 'approve-script',
  voiceover: 'add-voice',
  assets: 'review-assets',
};

function entry(
  queue: ProductionQueue,
  item: QueueItem,
  kind: QueueAttentionKind,
  step: QueueStep | undefined,
  message: string,
  since: string,
): QueueAttention {
  return {
    kind,
    channelId: queue.channelId,
    itemId: item.id,
    topic: item.topic,
    projectPath: item.projectPath,
    step,
    message,
    since,
  };
}

function attentionOf(queue: ProductionQueue, item: QueueItem): QueueAttention | undefined {
  if (item.status === 'paused') return undefined;
  const status = derivedStatus(item.stageProgress);
  if (status === 'failed') {
    const step = item.error?.step;
    const state = step === undefined ? undefined : item.stageProgress[step];
    return entry(
      queue,
      item,
      'failed',
      step,
      item.error?.message ?? 'failed',
      state?.at ?? item.updatedAt,
    );
  }
  if (status === 'done') {
    if (item.warnings.length === 0 || item.reviewedAt !== undefined) return undefined;
    const count = item.warnings.length;
    const message = `${String(count)} warning${count === 1 ? '' : 's'} to check`;
    return entry(queue, item, 'check-warnings', undefined, message, item.updatedAt);
  }
  const step = currentStep(item);
  const state = step === undefined ? undefined : item.stageProgress[step];
  if (step === undefined || state?.state !== 'waiting') return undefined;
  const kind = WAITING_KIND[step] ?? 'approve-script';
  return entry(queue, item, kind, step, state.message ?? 'waiting for you', state.at);
}

/** The queue's "Needs you" entries in queue order. */
export function queueAttention(queue: ProductionQueue): QueueAttention[] {
  return queue.items
    .map((item) => attentionOf(queue, item))
    .filter((found): found is QueueAttention => found !== undefined);
}
