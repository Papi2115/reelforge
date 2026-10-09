/**
 * What the Projects view remembers on this computer (PLAN.md#13.16): grid or list, the order and
 * the folded channel sections. localStorage, validated with zod; anything unreadable falls back
 * to the defaults.
 */
import { z } from 'zod';
import { errorMessage, rendererLog } from '../log.js';

const log = rendererLog('home');

export const HOME_PREFS_KEY = 'reelforge.home.v1';

const homePrefsSchema = z.object({
  layout: z.enum(['grid', 'list']).catch('grid'),
  order: z.enum(['edited', 'opened', 'title']).catch('edited'),
  /** Channel ids of folded sections ('' = "No channel"). */
  collapsed: z.array(z.string().max(64)).max(100).catch([]),
});
export type HomePrefs = z.infer<typeof homePrefsSchema>;

export const DEFAULT_HOME_PREFS: HomePrefs = { layout: 'grid', order: 'edited', collapsed: [] };

export function parseHomePrefs(text: string | null): HomePrefs {
  if (text === null) return DEFAULT_HOME_PREFS;
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    // A damaged value only holds view preferences: start over.
    return DEFAULT_HOME_PREFS;
  }
  const parsed = homePrefsSchema.safeParse(json);
  return parsed.success ? parsed.data : DEFAULT_HOME_PREFS;
}

export function loadHomePrefs(): HomePrefs {
  try {
    return parseHomePrefs(window.localStorage.getItem(HOME_PREFS_KEY));
  } catch (error) {
    log.warn(`home preferences not readable: ${errorMessage(error)}`);
    return DEFAULT_HOME_PREFS;
  }
}

export function saveHomePrefs(prefs: HomePrefs): void {
  try {
    window.localStorage.setItem(HOME_PREFS_KEY, JSON.stringify(prefs));
  } catch (error) {
    log.warn(`home preferences not saved: ${errorMessage(error)}`);
  }
}
