/**
 * Window-wide shortcuts of the workspace (PLAN.md#11.2): Ctrl+Shift+C shows / hides the chat and
 * `?` opens the keyboard shortcut sheet. Text fields keep their keys. Pure.
 */
import { isTextEntry, type TransportKey } from '../preview/transport-keys.js';

export type AppShortcut = 'toggle-chat' | 'shortcuts';

/** Shown in tooltips and in the shortcut sheet. */
export const TOGGLE_CHAT_KEYS = 'Ctrl+Shift+C';

export function appShortcut(event: TransportKey): AppShortcut | undefined {
  if (event.repeat || event.altKey || event.metaKey) return undefined;
  if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'c') return 'toggle-chat';
  if (event.ctrlKey) return undefined;
  if (event.target && isTextEntry(event.target)) return undefined;
  return event.key === '?' ? 'shortcuts' : undefined;
}
