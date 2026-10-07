/**
 * The production line in the "Needs you" inbox (PLAN.md#13.9): a script to approve, a voiceover
 * to add, photos to review, a failed film and a finished film's ⚠ report become inbox items whose
 * button shows the film in the Production line dialog; they are merged with the open project's
 * items in the inbox order (decisions, problems, checks, out-of-date steps). Pure.
 */
import type { QueueAttentionView } from '../../shared/queue-contract.js';
import type { AttentionGroup, AttentionItem } from '../stages/attention-view.js';

export const SHOW_IN_LINE = 'Show in Production line';

const GROUP_ORDER: readonly AttentionGroup[] = ['decision', 'problem', 'check', 'out-of-date'];

const MAX_TOPIC = 60;

function quoted(topic: string): string {
  const short = topic.length <= MAX_TOPIC ? topic : `${topic.slice(0, MAX_TOPIC - 1)}…`;
  return `“${short}”`;
}

function text(entry: QueueAttentionView): { group: AttentionGroup; text: string } {
  const topic = quoted(entry.topic);
  switch (entry.kind) {
    case 'approve-script':
      return {
        group: 'decision',
        text: `${topic}: the script is written. Read it and approve it.`,
      };
    case 'add-voice':
      return { group: 'decision', text: `${topic}: record or import the voiceover.` };
    case 'review-assets':
      return { group: 'decision', text: `${topic}: an asset package waits for your review.` };
    case 'failed':
      return { group: 'problem', text: `${topic} stopped with a problem: ${entry.message}` };
    case 'check-warnings':
      return { group: 'check', text: `${topic} is done: ${entry.message}.` };
  }
}

/** A comparable folder key (Windows paths: case and slashes do not matter). */
function folderKey(dir: string): string {
  return dir.replaceAll('\\', '/').replace(/\/+$/, '').toLowerCase();
}

/**
 * `openProjectDir`: the project open in the app; its film's script / voiceover / photos are
 * already the project's own items, so the line does not list them twice.
 */
export function lineAttentionItems(
  attention: readonly QueueAttentionView[],
  nameOf: (channelId: string) => string,
  openProjectDir?: string,
): AttentionItem[] {
  const open = openProjectDir === undefined ? undefined : folderKey(openProjectDir);
  const shown = attention.filter(
    (entry) =>
      open === undefined ||
      entry.projectPath === null ||
      folderKey(entry.projectPath) !== open ||
      (entry.kind !== 'approve-script' &&
        entry.kind !== 'add-voice' &&
        entry.kind !== 'review-assets'),
  );
  return shown.map((entry) => ({
    id: `line:${entry.channelId}:${entry.itemId}`,
    subject: `Production line · ${nameOf(entry.channelId)}`,
    ...text(entry),
    button: SHOW_IN_LINE,
    target: { kind: 'line', channelId: entry.channelId, itemId: entry.itemId },
  }));
}

/** The project's items and the line's, in the inbox order (the project's first in a group). */
export function mergeAttention(
  project: readonly AttentionItem[],
  line: readonly AttentionItem[],
): AttentionItem[] {
  return GROUP_ORDER.flatMap((group) => [
    ...project.filter((item) => item.group === group),
    ...line.filter((item) => item.group === group),
  ]);
}
