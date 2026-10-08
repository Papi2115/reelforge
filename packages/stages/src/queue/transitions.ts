/** What the user hears about a finished step (pure): needs-you, failures and finished films. */
import type { QueueItem, QueueStep } from '@reelforge/shared';
import type { QueueNotification, QueueNotificationKind, QueueStepOutcome } from './types.js';

const WAITING_NOTIFICATION: Partial<Record<QueueStep, QueueNotificationKind>> = {
  approval: 'needs-approval',
  voiceover: 'needs-voice',
  assets: 'needs-review',
};

export function stepNotification(
  channelId: string,
  before: QueueItem,
  after: QueueItem,
  step: QueueStep,
  outcome: QueueStepOutcome,
): QueueNotification | undefined {
  const base = { channelId, itemId: after.id, topic: after.topic };
  if (outcome.kind === 'waiting' && before.stageProgress[step]?.state !== 'waiting') {
    const kind = WAITING_NOTIFICATION[step] ?? 'needs-approval';
    return { ...base, kind, message: outcome.message };
  }
  if (outcome.kind === 'failed') {
    return { ...base, kind: 'failed', message: `${step}: ${outcome.message}` };
  }
  if (after.status === 'done' && before.status !== 'done') {
    const count = after.warnings.length;
    const report = count === 0 ? '✓' : `⚠ ${String(count)} warning${count === 1 ? '' : 's'}`;
    return { ...base, kind: 'done', message: `Film finished (${report}).` };
  }
  return undefined;
}

export function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
