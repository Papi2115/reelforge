/**
 * What the production line does next (pure): re-check the gates of waiting films (cheap, no
 * Claude), then pre-approval work (brief, script) so the user gets scripts to approve early, then
 * the film that is building, then the next film to build. One step at a time, so at most one
 * film is ever building; channels take turns (round-robin) for new work. Quiet hours too.
 */
import type { ProductionQueue, QueueItem, QueueStep } from '@reelforge/shared';
import { buildStarted, currentStep, isBuildStep, itemActivity } from './state.js';
import type { QuietHours } from './types.js';

export interface LineCandidate {
  readonly channelId: string;
  readonly item: QueueItem;
  readonly step: QueueStep;
  /** `gate`: re-ask a waiting step (no work happens while it stays closed). */
  readonly kind: 'gate' | 'work';
}

export interface PickOptions {
  /** Channel served last: the turn passes to the next one. */
  readonly lastChannelId?: string | undefined;
  /** No new script is written while this many films wait for their approval. */
  readonly maxPendingApprovals: number;
  /** `<channelId>/<itemId>` of gates already re-asked since the last change. */
  readonly checkedGates: ReadonlySet<string>;
}

export function queueItemKey(channelId: string, itemId: string): string {
  return `${channelId}/${itemId}`;
}

/** Queues in round-robin order: the one after `lastChannelId` first. */
export function rotateQueues(
  queues: readonly ProductionQueue[],
  lastChannelId: string | undefined,
): ProductionQueue[] {
  const index = queues.findIndex((queue) => queue.channelId === lastChannelId);
  if (index < 0) return [...queues];
  return [...queues.slice(index + 1), ...queues.slice(0, index + 1)];
}

interface Entry {
  readonly channelId: string;
  readonly item: QueueItem;
  readonly step: QueueStep;
}

function entries(queues: readonly ProductionQueue[], activity: 'ready' | 'waiting'): Entry[] {
  const found: Entry[] = [];
  for (const queue of queues) {
    if (queue.paused) continue;
    for (const item of queue.items) {
      const step = currentStep(item);
      if (step === undefined || itemActivity(item) !== activity) continue;
      found.push({ channelId: queue.channelId, item, step });
    }
  }
  return found;
}

function pendingApprovals(queues: readonly ProductionQueue[]): number {
  return entries(queues, 'waiting').filter((entry) => entry.step === 'approval').length;
}

export function nextLineStep(
  queues: readonly ProductionQueue[],
  options: PickOptions,
): LineCandidate | undefined {
  const ordered = rotateQueues(queues, options.lastChannelId);
  const gate = entries(ordered, 'waiting').find(
    (entry) => !options.checkedGates.has(queueItemKey(entry.channelId, entry.item.id)),
  );
  if (gate !== undefined) return { ...gate, kind: 'gate' };
  const ready = entries(ordered, 'ready');
  const roomForScripts = pendingApprovals(queues) < options.maxPendingApprovals;
  const scripting = ready.find(
    (entry) => !isBuildStep(entry.step) && (entry.step === 'approval' || roomForScripts),
  );
  if (scripting !== undefined) return { ...scripting, kind: 'work' };
  // The film that is building goes on first (queue order, not round-robin: it keeps its turn).
  const building = entries(queues, 'ready').find(
    (entry) => isBuildStep(entry.step) && buildStarted(entry.item),
  );
  if (building !== undefined) return { ...building, kind: 'work' };
  const next = ready.find((entry) => isBuildStep(entry.step));
  return next === undefined ? undefined : { ...next, kind: 'work' };
}

const MINUTES_PER_DAY = 24 * 60;

/** Minutes since midnight of "HH:MM" (24 h), undefined when malformed. */
export function parseClock(text: string): number | undefined {
  const match = /^(\d{1,2}):(\d{2})$/.exec(text.trim());
  if (match === null) return undefined;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return undefined;
  return hours * 60 + minutes;
}

/**
 * Milliseconds until the quiet hours end (0 = not in quiet hours). `localMinute` = minutes since
 * local midnight now; `nowMs` gives the seconds within the minute.
 */
export function quietRemainingMs(
  quiet: QuietHours | undefined,
  localMinute: number,
  nowMs: number,
): number {
  if (quiet === undefined) return 0;
  const start = parseClock(quiet.start);
  const end = parseClock(quiet.end);
  if (start === undefined || end === undefined || start === end) return 0;
  const inside =
    start < end
      ? localMinute >= start && localMinute < end
      : localMinute >= start || localMinute < end;
  if (!inside) return 0;
  const minutes = (end - localMinute + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  return Math.max(1, minutes * 60_000 - (nowMs % 60_000));
}

/** Minutes since local midnight (the system time zone). */
export function systemLocalMinute(epochMs: number): number {
  const date = new Date(epochMs);
  return date.getHours() * 60 + date.getMinutes();
}
