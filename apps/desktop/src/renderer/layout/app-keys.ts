/**
 * Window-wide shortcuts of the workspace (PLAN.md#11.2): Ctrl+Shift+C shows / hides the chat,
 * Ctrl+Shift+N opens / closes the "Needs you" inbox, Ctrl+Shift+L the Production line dialog and
 * `?` opens the keyboard shortcut sheet.
 * Text fields keep their keys. Pure.
 */
import { isTextEntry, type TransportKey } from '../preview/transport-keys.js';

export type AppShortcut = 'toggle-chat' | 'needs-you' | 'production-line' | 'shortcuts';

/** Shown in tooltips and in the shortcut sheet. */
export const TOGGLE_CHAT_KEYS = 'Ctrl+Shift+C';
export const NEEDS_YOU_KEYS = 'Ctrl+Shift+N';
export const PRODUCTION_LINE_KEYS = 'Ctrl+Shift+L';

export function appShortcut(event: TransportKey): AppShortcut | undefined {
  if (event.repeat || event.altKey || event.metaKey) return undefined;
  if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'c') return 'toggle-chat';
  if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'n') return 'needs-you';
  if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'l') return 'production-line';
  if (event.ctrlKey) return undefined;
  if (event.target && isTextEntry(event.target)) return undefined;
  return event.key === '?' ? 'shortcuts' : undefined;
}
