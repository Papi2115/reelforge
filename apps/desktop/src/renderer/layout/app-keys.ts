/**
 * Window-wide shortcuts of the workspace (PLAN.md#11.2, docs/ux/redesign-2.4.md U12), matched from
 * the shortcut table (shortcut-table.ts APP_SHORTCUTS): Ctrl+Shift+C shows / hides the chat,
 * Ctrl+Shift+N opens / closes the "Needs you" inbox, Ctrl+Shift+L the Production line dialog,
 * Ctrl+. stops Claude and `?` opens the Keyboard shortcuts dialog. Text fields keep their keys
 * except for the shortcuts marked `inText`. Pure.
 */
import { isTextEntry, type TransportKey } from '../preview/transport-keys.js';
import { APP_SHORTCUTS, appShortcutKeys, type AppShortcut, type Chord } from './shortcut-table.js';

export type { AppShortcut } from './shortcut-table.js';

/** Shown in tooltips ("Hide chat (Ctrl+Shift+C)"). */
export const TOGGLE_CHAT_KEYS = appShortcutKeys('toggle-chat');
export const NEEDS_YOU_KEYS = appShortcutKeys('needs-you');
export const PRODUCTION_LINE_KEYS = appShortcutKeys('production-line');
export const STOP_CLAUDE_KEYS = appShortcutKeys('stop-claude');

/** Whether `event` is the press `chord` describes. */
export function matchesChord(event: TransportKey, chord: Chord): boolean {
  if (event.ctrlKey !== (chord.ctrl === true)) return false;
  if (chord.shift !== undefined && event.shiftKey !== chord.shift) return false;
  return event.key.toLowerCase() === chord.key.toLowerCase();
}

const ENTRIES = Object.entries(APP_SHORTCUTS) as [
  AppShortcut,
  (typeof APP_SHORTCUTS)[AppShortcut],
][];

export function appShortcut(event: TransportKey): AppShortcut | undefined {
  if (event.repeat || event.altKey || event.metaKey) return undefined;
  const typing = event.target !== undefined && isTextEntry(event.target);
  for (const [id, shortcut] of ENTRIES) {
    if (typing && !('inText' in shortcut)) continue;
    if (shortcut.chords.some((chord: Chord) => matchesChord(event, chord))) return id;
  }
  return undefined;
}
