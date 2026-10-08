/**
 * What the production line tells you through a system notification (pure): a film finished, a
 * film needs you (script, voiceover, photos), a film failed, the usage-limit pause, and the line
 * stopping (blocked, its time is up, or nothing more it can do after it worked). Resumes, gate
 * re-checks and the line's own bookkeeping stay quiet.
 */
import type { LineEnd, QueueNotification } from '@reelforge/stages';
import type { QueueItemRef } from '../../shared/queue-contract.js';
import { plural } from '../../shared/plural.js';

export interface LineNotice {
  readonly title: string;
  readonly body: string;
  /** The film a click shows (none: the dialog opens as it is). */
  readonly ref?: QueueItemRef | undefined;
}

const MAX_TOPIC = 80;

function topicOf(notification: QueueNotification): string {
  const topic = notification.topic ?? 'A film';
  return topic.length <= MAX_TOPIC ? topic : `${topic.slice(0, MAX_TOPIC - 1)}…`;
}

function refOf(notification: QueueNotification): QueueItemRef | undefined {
  const { channelId, itemId } = notification;
  return channelId === undefined || itemId === undefined ? undefined : { channelId, itemId };
}

/** The notification of a line event; undefined = nothing to show. */
export function lineNotice(notification: QueueNotification): LineNotice | undefined {
  const ref = refOf(notification);
  const topic = topicOf(notification);
  switch (notification.kind) {
    case 'done':
      return { title: 'Film ready', body: `${topic}: ${notification.message}`, ref };
    case 'needs-approval':
      return { title: 'Script to approve', body: `${topic}: the script is written.`, ref };
    case 'needs-voice':
      return { title: 'Voiceover needed', body: `${topic}: record or import the voiceover.`, ref };
    case 'needs-review':
      return { title: 'Photos to review', body: `${topic}: an asset package waits for you.`, ref };
    case 'failed':
      // Bookkeeping failures without a film (a lock, an unreadable file) go to the log only.
      return ref === undefined
        ? undefined
        : { title: 'Film stopped with a problem', body: `${topic}: ${notification.message}`, ref };
    case 'line-paused':
      return { title: 'Production line paused', body: notification.message };
    case 'line-blocked':
      return { title: 'Production line stopped', body: notification.message };
    case 'line-resumed':
    case 'line-idle':
      return undefined;
  }
}

export interface LineEndFacts {
  readonly end: LineEnd;
  /** A step did work in this run (gate re-checks do not count). */
  readonly didWork: boolean;
  /** Films waiting for you across the channels. */
  readonly waiting: number;
  /** `HH:MM` of the planned stop. */
  readonly until?: string | undefined;
}

/** The "line stopped" notification at the end of a run (blocked is the runner's own notice). */
export function lineEndNotice(facts: LineEndFacts): LineNotice | undefined {
  if (facts.end === 'time') {
    const at = facts.until === undefined ? '' : ` at ${facts.until}`;
    return { title: 'Production line stopped', body: `Stopped${at} as planned.` };
  }
  if (facts.end !== 'idle' || !facts.didWork) return undefined;
  if (facts.waiting === 0) {
    return { title: 'Production line finished', body: 'Every film in the queues is done.' };
  }
  return {
    title: 'Production line waits for you',
    body: `Nothing more it can do alone: ${plural(facts.waiting, 'film')} ${facts.waiting === 1 ? 'waits' : 'wait'} for you.`,
  };
}
