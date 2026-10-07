/**
 * Recently opened projects, kept in the app data folder (`recent-projects.json`, zod schema in
 * `@reelforge/shared`). Updates of one store file are serialized and written atomically.
 */
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import {
  RECENT_PROJECTS_FILE_VERSION,
  recentProjectsFileSchema,
  type RecentProjectRecord,
} from '@reelforge/shared';
import { z } from 'zod';
import { writeJsonAtomic } from './atomic.js';
import { lockKey, withLock } from './mutex.js';
import { describeUnknown, err, errorCode, ok, projectError, tryIo, type Result } from './result.js';

export const RECENT_PROJECTS_FILE = 'recent-projects.json';
export const MAX_RECENT_PROJECTS = 10;

export interface RecentProject extends RecentProjectRecord {
  /** False when the folder (or its project.json) is gone. */
  readonly exists: boolean;
}

async function readRecords(storeFile: string): Promise<Result<RecentProjectRecord[]>> {
  let text: string;
  try {
    text = await readFile(storeFile, 'utf8');
  } catch (error) {
    if (errorCode(error) === 'ENOENT') return ok([]);
    return err(projectError('io', `${storeFile}: ${describeUnknown(error)}`, { path: storeFile }));
  }
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch (error) {
    return err(
      projectError('corrupt', `${storeFile}: ${describeUnknown(error)}`, { path: storeFile }),
    );
  }
  const parsed = recentProjectsFileSchema.safeParse(json);
  if (!parsed.success) {
    return err(
      projectError('invalid', `${storeFile}: ${z.prettifyError(parsed.error)}`, {
        path: storeFile,
      }),
    );
  }
  return ok(parsed.data.projects);
}

function withExists(record: RecentProjectRecord): RecentProject {
  return { ...record, exists: existsSync(path.join(record.dir, 'project.json')) };
}

export async function listRecentProjects(storeFile: string): Promise<Result<RecentProject[]>> {
  const records = await readRecords(storeFile);
  return records.ok ? ok(records.value.map(withExists)) : records;
}

async function updateRecords(
  storeFile: string,
  change: (records: RecentProjectRecord[]) => RecentProjectRecord[],
): Promise<Result<RecentProject[]>> {
  return withLock(storeFile, async () => {
    const current = await readRecords(storeFile);
    // A corrupt list is replaced: it only holds shortcuts, never project data.
    const next = change(current.ok ? current.value : []).slice(0, MAX_RECENT_PROJECTS);
    const written = await tryIo(storeFile, () =>
      writeJsonAtomic(storeFile, { version: RECENT_PROJECTS_FILE_VERSION, projects: next }),
    );
    return written.ok ? ok(next.map(withExists)) : written;
  });
}

const sameDir = (first: string, second: string): boolean => lockKey(first) === lockKey(second);

/** Moves (or adds) the project to the top of the list. */
export function rememberRecentProject(
  storeFile: string,
  project: { readonly dir: string; readonly title: string; readonly channelId?: string },
  now: Date = new Date(),
): Promise<Result<RecentProject[]>> {
  const entry: RecentProjectRecord = {
    dir: path.resolve(project.dir),
    title: project.title,
    openedAt: now.toISOString(),
    ...(project.channelId === undefined ? {} : { channelId: project.channelId }),
  };
  return updateRecords(storeFile, (records) => [
    entry,
    ...records.filter((record) => !sameDir(record.dir, entry.dir)),
  ]);
}

export function forgetRecentProject(
  storeFile: string,
  dir: string,
): Promise<Result<RecentProject[]>> {
  return updateRecords(storeFile, (records) =>
    records.filter((record) => !sameDir(record.dir, dir)),
  );
}

/** The stored entry for `dir`, if it is in the list (used to confine "open recent" requests). */
export async function findRecentProject(
  storeFile: string,
  dir: string,
): Promise<Result<RecentProject | undefined>> {
  const list = await listRecentProjects(storeFile);
  return list.ok ? ok(list.value.find((record) => sameDir(record.dir, dir))) : list;
}
