/**
 * Finding a film of the production line on disk: its project folder (from main's own queue
 * file, never from the renderer), the folder "Open video folder" / "Open publish kit" shows, and
 * whether a film in one of some project folders waits for you.
 */
import path from 'node:path';
import { PUBLISH_DIR } from '@reelforge/pipeline';
import type { QueueStore } from '@reelforge/stages';
import type { QueueFolder, QueueItemRef } from '../../shared/queue-contract.js';
import { filmWaitsIn } from './queue-views.js';

export async function filmProject(
  store: Pick<QueueStore, 'read'>,
  ref: QueueItemRef,
): Promise<string | undefined> {
  const queue = await store.read(ref.channelId);
  if (!queue.ok) return undefined;
  return queue.value.items.find((item) => item.id === ref.itemId)?.projectPath;
}

export function filmFolder(
  projectDir: string,
  folder: QueueFolder,
  videoFolder: (projectDir: string) => string,
): string {
  if (folder === 'project') return projectDir;
  return folder === 'video' ? videoFolder(projectDir) : path.join(projectDir, PUBLISH_DIR);
}

export async function anyFilmWaitsIn(
  store: Pick<QueueStore, 'read'>,
  channelIds: readonly string[],
  keys: ReadonlySet<string>,
): Promise<boolean> {
  for (const channelId of channelIds) {
    const queue = await store.read(channelId);
    if (queue.ok && filmWaitsIn(queue.value, keys)) return true;
  }
  return false;
}
