/**
 * Keys of the Home screen (PLAN.md#13.16; listed in layout/shortcut-table.ts): Ctrl+N starts a new
 * project (also while typing), / jumps to the search (not while typing). Pure.
 */
import { isTextEntry, type TransportKey } from '../preview/transport-keys.js';

export type HomeKeyAction = 'new-project' | 'search';

export function homeKeyAction(event: TransportKey): HomeKeyAction | undefined {
  if (event.altKey || event.metaKey || event.repeat) return undefined;
  if (event.ctrlKey && !event.shiftKey && event.key.toLowerCase() === 'n') return 'new-project';
  if (event.ctrlKey || event.key !== '/') return undefined;
  return event.target !== undefined && isTextEntry(event.target) ? undefined : 'search';
}
