/**
 * Shot locks in the chat (PLAN.md#11.4): a Shot / Selection request on a locked shot is refused
 * before anything is sent ("Shot s03 is locked — unlock it to change it."); a Whole-video turn is
 * told which shots are locked; and every chat turn runs inside the lock guard, so a change Claude
 * made to a locked shot anyway is put back before the autocommit and reported in the turn.
 */
import {
  discardLockedChanges,
  lockViolationMessage,
  readLockedShots,
  snapshotLockedFiles,
} from '@reelforge/stages';
import type { ChatScope, ChatSelection, ChatStep } from '../../shared/chat-contract.js';

export interface ChatLocks {
  /** Why the request may not be sent (a target shot is locked), else null. */
  readonly refusal: string | null;
  /** Every locked shot of the project (for the Whole-video prompt). */
  readonly locked: readonly string[];
  /** locks.json could not be read (the turn still runs; the guard reports it again). */
  readonly problem: string | null;
}

export async function chatLocks(
  dir: string,
  scope: ChatScope,
  shotIds: readonly string[],
  selection: ChatSelection | null,
): Promise<ChatLocks> {
  const read = await readLockedShots(dir);
  if (!read.ok) return { refusal: null, locked: [], problem: read.error.message };
  const targets =
    scope === 'shot'
      ? shotIds
      : scope === 'selection' && selection !== null
        ? [selection.shotId]
        : [];
  const blocked = targets.filter((id) => read.value.has(id));
  const refusal =
    blocked.length === 0
      ? null
      : `${blocked.length === 1 ? 'Shot' : 'Shots'} ${blocked.join(', ')} ${blocked.length === 1 ? 'is' : 'are'} locked — unlock ${blocked.length === 1 ? 'it' : 'them'} to change ${blocked.length === 1 ? 'it' : 'them'}.`;
  return { refusal, locked: [...read.value].sort(), problem: null };
}

/** The Whole-video request's note about locked shots (empty when none). */
export function lockedShotsNote(locked: readonly string[]): string {
  if (locked.length === 0) return '';
  return `Locked shots (approved by the user): ${locked.join(', ')}. Do not edit their scene files or the kit-ext props they use; any change to them is discarded.`;
}

/** The discarded changes as the turn's last steps ("⚠ Claude tried to change locked shot s03; …"). */
export function lockSteps(notes: readonly string[]): ChatStep[] {
  return notes.map((text, index) => ({
    type: 'text',
    id: `locks-${String(index)}`,
    text: `⚠ ${text}`,
  }));
}

/** Started before a chat turn; `finish` (after the turn, before the commit) returns its notes. */
export interface ChatLockGuard {
  finish(): Promise<string[]>;
}

export async function startChatLockGuard(dir: string): Promise<ChatLockGuard> {
  const snapshot = await snapshotLockedFiles(dir);
  if (!snapshot.ok) {
    const note = `Shot locks were not checked for this turn: ${snapshot.error.message}`;
    return { finish: () => Promise.resolve([note]) };
  }
  return {
    finish: async () => {
      const discarded = await discardLockedChanges(snapshot.value);
      return discarded.ok ? discarded.value.map(lockViolationMessage) : [discarded.error.message];
    },
  };
}
