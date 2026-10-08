/**
 * Junk in the world's asset folder (real run Game B2 #2, docs/real-run-game-b2-2.md §7): the
 * world-assets turn cannot delete files, so a probe it writes to try generator options stays in
 * `assets/<world>/` and a later commit takes it into the film. Before QA, files that hold nothing
 * (empty or whitespace only, or valid JSON that defines no asset) are removed; once the turns are
 * done, files whose name is not an asset file name (kebab-case `.json`, never loaded) go too. A
 * file with problems is kept: it is a QA finding for the fix turn, not junk.
 */
import { readdir, readFile, rm } from 'node:fs/promises';
import { buildWorldAssets } from '@reelforge/engine';
import { err, ok, type Result } from '@reelforge/claude-bridge';
import {
  MAX_WORLD_ASSET_FILE_CHARS,
  WORLD_ASSET_FILE_PATTERN,
  worldAssetsDir,
  type WorldAssetWorld,
} from '@reelforge/shared';
import { inProject } from '../paths.js';
import { stageError, type StageError } from '../types.js';

export interface DroppedAssetFile {
  /** Project-relative path. */
  readonly file: string;
  readonly reason: string;
}

export interface JunkOptions {
  /** Also remove files whose name is not an asset file name (after the last turn). */
  readonly badNames: boolean;
}

const describe = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

/** Why a correctly named file is junk, or undefined when it is an asset file (or a finding). */
function emptyReason(world: WorldAssetWorld, file: string, source: string): string | undefined {
  if (source.trim() === '') return 'empty file';
  if (source.length > MAX_WORLD_ASSET_FILE_CHARS) return undefined;
  const alone = buildWorldAssets(world, [{ file, source }]);
  return alone.problems.length === 0 && alone.ids.all.length === 0 ? 'defines no asset' : undefined;
}

async function junkReason(
  world: WorldAssetWorld,
  absolute: string,
  file: string,
  name: string,
  options: JunkOptions,
): Promise<string | undefined> {
  if (!WORLD_ASSET_FILE_PATTERN.test(name)) {
    return options.badNames ? 'not an asset file name (kebab-case .json), never loaded' : undefined;
  }
  return emptyReason(world, file, await readFile(absolute, 'utf8'));
}

/** Removes the junk files of the world's asset folder; returns them sorted by path. */
export async function dropJunkAssetFiles(
  projectDir: string,
  world: WorldAssetWorld,
  options: JunkOptions,
): Promise<Result<DroppedAssetFile[], StageError>> {
  const folder = worldAssetsDir(world);
  const directory = inProject(projectDir, folder);
  try {
    const entries = await readdir(directory, { withFileTypes: true }).catch((error: unknown) => {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return [];
      throw error;
    });
    const dropped: DroppedAssetFile[] = [];
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      const file = `${folder}/${entry.name}`;
      const absolute = inProject(projectDir, file);
      const reason = await junkReason(world, absolute, file, entry.name, options);
      if (reason === undefined) continue;
      await rm(absolute, { force: true });
      dropped.push({ file, reason });
    }
    return ok(dropped.sort((a, b) => (a.file < b.file ? -1 : a.file > b.file ? 1 : 0)));
  } catch (error) {
    return err(stageError('io', `cannot clean ${folder}: ${describe(error)}`));
  }
}

/** The stage-summary line of a removed file. */
export function droppedNote(entry: DroppedAssetFile): string {
  return `world assets: removed ${entry.file} (${entry.reason}); it is not part of the set`;
}
