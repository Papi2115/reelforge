/**
 * Which known projects name a channel (PLAN.md#13.13): the app has no global project index, so
 * the known projects are the recent list plus folders the caller adds (e.g. the open project).
 * A project counts when its project.json names the channel; unreadable or missing folders are
 * skipped (a project the app does not know about later falls back to the default channel).
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { lockKey } from './mutex.js';
import { PROJECT_JSON } from './paths.js';
import { listRecentProjects } from './recent.js';

async function projectChannelId(dir: string): Promise<string | undefined> {
  let raw: unknown;
  try {
    raw = JSON.parse(await readFile(path.join(dir, PROJECT_JSON), 'utf8'));
  } catch {
    // A missing or broken project.json is not a project of any channel here; opening it reports it.
    return undefined;
  }
  if (typeof raw !== 'object' || raw === null || !('channelId' in raw)) return undefined;
  return typeof raw.channelId === 'string' ? raw.channelId : undefined;
}

/** Folders (resolved, de-duplicated) of the known projects whose project.json names `channelId`. */
export async function projectsInChannel(
  recentFile: string,
  channelId: string,
  extraDirs: readonly string[] = [],
): Promise<string[]> {
  const recent = await listRecentProjects(recentFile);
  const dirs = [...(recent.ok ? recent.value.map((entry) => entry.dir) : []), ...extraDirs];
  const seen = new Set<string>();
  const found: string[] = [];
  for (const dir of dirs) {
    const key = lockKey(dir);
    if (seen.has(key)) continue;
    seen.add(key);
    if ((await projectChannelId(dir)) === channelId) found.push(path.resolve(dir));
  }
  return found;
}
