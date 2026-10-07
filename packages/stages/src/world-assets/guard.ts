/**
 * The world-assets turn may write only `assets/<world>/*.json` and `assets/cast.json`
 * (PLAN.md#13.15 phase 2). The turn runs with the scene builder's permissions (project edits),
 * so the rule is enforced in code like the shot locks: the bytes of every other project file are
 * taken before the turn, and afterwards a changed or deleted one is put back and a new one is
 * removed ("the world-assets turn changed scenes/s01.js; change discarded"). App state, media and
 * git are not watched.
 */
import { readdir, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { err, ok, type Result } from '@reelforge/claude-bridge';
import { writeAtomic } from '@reelforge/project';
import { WORLD_CAST_FILE, worldAssetsDir, type WorldAssetWorld } from '@reelforge/shared';
import { inProject } from '../paths.js';
import { stageError, type StageError } from '../types.js';

/** Top-level folders never watched (git, app state, heavy media, exports, dependencies). */
const SKIPPED = new Set(['.git', '.reelforge', 'audio', 'out', 'node_modules']);

export interface WriteSnapshot {
  readonly projectDir: string;
  readonly world: WorldAssetWorld;
  readonly files: ReadonlyMap<string, Buffer>;
}

const describe = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

/** True for the files the turn may write. */
export function writableByWorldAssets(file: string, world: WorldAssetWorld): boolean {
  return file === WORLD_CAST_FILE || file.startsWith(`${worldAssetsDir(world)}/`);
}

async function listFiles(projectDir: string, relative = ''): Promise<string[]> {
  const entries = await readdir(path.join(projectDir, ...relative.split('/').filter(Boolean)), {
    withFileTypes: true,
  });
  const files: string[] = [];
  for (const entry of entries) {
    const child = relative === '' ? entry.name : `${relative}/${entry.name}`;
    if (entry.isDirectory()) {
      if (relative === '' && SKIPPED.has(entry.name)) continue;
      files.push(...(await listFiles(projectDir, child)));
    } else if (entry.isFile()) files.push(child);
  }
  return files;
}

/** The bytes of every watched file the turn must not write. */
export async function snapshotProject(
  projectDir: string,
  world: WorldAssetWorld,
): Promise<Result<WriteSnapshot, StageError>> {
  try {
    const files = new Map<string, Buffer>();
    for (const file of await listFiles(projectDir)) {
      if (writableByWorldAssets(file, world)) continue;
      files.set(file, await readFile(inProject(projectDir, file)));
    }
    return ok({ projectDir, world, files });
  } catch (error) {
    return err(
      stageError('io', `cannot read the project before the world-assets turn: ${describe(error)}`),
    );
  }
}

/** Puts back what the turn changed outside its files; returns the discarded paths. */
export async function discardOutsideWrites(
  snapshot: WriteSnapshot,
): Promise<Result<string[], StageError>> {
  const { projectDir, world } = snapshot;
  const discarded: string[] = [];
  try {
    const now = await listFiles(projectDir);
    for (const file of now) {
      if (writableByWorldAssets(file, world)) continue;
      const before = snapshot.files.get(file);
      if (before === undefined) {
        await rm(inProject(projectDir, file), { force: true });
        discarded.push(file);
      } else if (!before.equals(await readFile(inProject(projectDir, file)))) {
        await writeAtomic(inProject(projectDir, file), before);
        discarded.push(file);
      }
    }
    const present = new Set(now);
    for (const [file, content] of snapshot.files) {
      if (present.has(file)) continue;
      await writeAtomic(inProject(projectDir, file), content);
      discarded.push(file);
    }
    return ok(discarded.sort());
  } catch (error) {
    return err(
      stageError(
        'io',
        `cannot restore the project after the world-assets turn: ${describe(error)}`,
      ),
    );
  }
}
