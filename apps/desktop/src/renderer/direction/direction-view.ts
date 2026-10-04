/**
 * View model of the live co-direction command bar (PLAN.md#12.14): the session's command history
 * with undo/redo (each entry knows the shot's direction before and after), hint chips, the
 * "Directions" indicator text and the slash shortcut. Pure; the hook does the IPC.
 */
import type { DirectionWord, ShotDirection } from '@reelforge/shared';

export interface HistoryEntry {
  readonly id: number;
  readonly command: string;
  readonly shotId: string;
  readonly confirmation: string;
  readonly before: ShotDirection | undefined;
  readonly after: ShotDirection | undefined;
  /** Undone in this session (redo brings it back). */
  readonly undone: boolean;
}

export interface DirectionSession {
  readonly entries: readonly HistoryEntry[];
  readonly nextId: number;
}

export const EMPTY_SESSION: DirectionSession = { entries: [], nextId: 1 };
/** Entries kept in the session history (older ones stay in the project history). */
export const MAX_HISTORY = 50;

/** Adds an applied command; undone entries (the redo branch) are dropped. */
export function pushEntry(
  session: DirectionSession,
  entry: Omit<HistoryEntry, 'id' | 'undone'>,
): DirectionSession {
  const kept = session.entries.filter((candidate) => !candidate.undone);
  const entries = [...kept, { ...entry, id: session.nextId, undone: false }].slice(-MAX_HISTORY);
  return { entries, nextId: session.nextId + 1 };
}

/** The entry "undo" reverts: the newest one still applied. */
export function undoTarget(session: DirectionSession): HistoryEntry | undefined {
  return session.entries.findLast((entry) => !entry.undone);
}

/** The entry "redo" re-applies: the oldest undone one. */
export function redoTarget(session: DirectionSession): HistoryEntry | undefined {
  return session.entries.find((entry) => entry.undone);
}

export function markUndone(
  session: DirectionSession,
  id: number,
  undone: boolean,
): DirectionSession {
  return {
    ...session,
    entries: session.entries.map((entry) => (entry.id === id ? { ...entry, undone } : entry)),
  };
}

/** Example commands under the bar; `…` is replaced by the word at the playhead. */
export const HINT_CHIPS = [
  'slower',
  'darker',
  'zoom in',
  'arrow on the word …',
  'highlight this',
  'undo',
] as const;

/** The command a hint chip types (the word at the playhead fills `…`). */
export function hintCommand(chip: string, word: DirectionWord | undefined): string {
  if (!chip.includes('…')) return chip;
  const text = word?.text.replace(/[^\p{L}\p{N}'-]+/gu, '') ?? '';
  return chip.replace('…', text === '' ? '' : text).trim();
}

/** Short summary of a shot's overrides ("0.8x · darker · zoom 1.2x · 2 marks"). */
export function directionSummary(direction: ShotDirection | undefined): string {
  if (direction === undefined) return 'No directions';
  const parts: string[] = [];
  if (direction.rate !== undefined) {
    parts.push(`${direction.rate < 1 ? 'slower' : 'faster'} ${direction.rate.toFixed(1)}x`);
  }
  if (direction.dim !== undefined) {
    parts.push(
      `${direction.dim < 0 ? 'darker' : 'brighter'} ${Math.abs(direction.dim).toFixed(2)}`,
    );
  }
  if (direction.zoom !== undefined) parts.push(`zoom ${direction.zoom.toFixed(1)}x`);
  const marks = direction.overlays?.length ?? 0;
  if (marks > 0) parts.push(`${String(marks)} mark${marks === 1 ? '' : 's'}`);
  return parts.length === 0 ? 'No directions' : parts.join(' · ');
}

/** Status line of the bar. */
export type BarStatus =
  | { readonly kind: 'idle' }
  | { readonly kind: 'applied'; readonly text: string; readonly ms: number }
  | { readonly kind: 'error'; readonly text: string }
  | { readonly kind: 'locked'; readonly text: string; readonly shotId: string }
  | {
      readonly kind: 'claude';
      readonly text: string;
      readonly shotId: string;
      readonly request: string;
    }
  | { readonly kind: 'sent'; readonly text: string };

export function statusText(status: BarStatus): string {
  switch (status.kind) {
    case 'idle':
      return '';
    case 'applied':
      return `${status.text} (${String(Math.round(status.ms))} ms)`;
    default:
      return status.text;
  }
}

export function claudeOffer(shotId: string, request: string): BarStatus {
  return {
    kind: 'claude',
    shotId,
    request,
    text: `"${request}" needs Claude: rebuild ${shotId} as 2 variants to compare (uses your Claude plan).`,
  };
}

export function lockedStatus(shotId: string, message?: string): BarStatus {
  return {
    kind: 'locked',
    shotId,
    text: message ?? `${shotId} is locked: unlock this shot to direct it`,
  };
}

interface KeyLike {
  readonly key: string;
  readonly ctrlKey: boolean;
  readonly metaKey: boolean;
  readonly altKey: boolean;
  /** Tag name of the focused element (INPUT, TEXTAREA, …) and whether it is editable. */
  readonly targetTag: string;
  readonly targetEditable: boolean;
}

/** `/` focuses the command bar unless the user is typing somewhere else. */
export function isCommandBarKey(event: KeyLike): boolean {
  if (event.key !== '/' || event.ctrlKey || event.metaKey || event.altKey) return false;
  if (event.targetEditable) return false;
  return !['INPUT', 'TEXTAREA', 'SELECT'].includes(event.targetTag.toUpperCase());
}
