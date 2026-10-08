/**
 * The project's world asset files (`assets/<world>/*.json`, PLAN.md#13.15 phase 2): read once
 * per command for a project whose style is a world and inlined into every render manifest
 * (`worldAssets`), so `reelforge frames`, the app's render service, preview and export give the
 * scenes the same `ctx.worldAssets`. Validation is the engine's (`buildWorldAssets`, the world's
 * own parser): the same problems here, in `reelforge validate` and in the scene QA.
 */
import { existsSync, realpathSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { buildWorldAssets, type WorldAssetSet } from '@reelforge/engine';
import {
  isWorldAssetWorld,
  MAX_WORLD_ASSET_FILE_CHARS,
  MAX_WORLD_ASSET_FILES,
  WORLD_ASSET_FILE_PATTERN,
  worldAssetsDir,
  type ManifestWorldAssets,
  type WorldAssetSource,
  type WorldAssetWorld,
} from '@reelforge/shared';
import { describeUnknown, ProjectError } from '../errors.js';
import type { Problem } from './files.js';
import { isInside, projectPath } from './paths.js';

export interface IgnoredAssetFile {
  readonly file: string;
  readonly reason: string;
}

export interface WorldAssetFiles {
  readonly world: WorldAssetWorld;
  /** Readable `.json` files, sorted by name. */
  readonly files: readonly WorldAssetSource[];
  /** Files that are not loaded at all (name, size, count). */
  readonly ignored: readonly IgnoredAssetFile[];
}

const FIX =
  'fix the asset file as the message says (reelforge world-assets check lists every problem)';

function guardInside(root: string, directory: string, folder: string): void {
  if (!isInside(realpathSync(root), realpathSync(directory))) {
    throw new ProjectError(
      `${folder} points outside the project folder`,
      `make ${folder} a normal folder inside the project`,
    );
  }
}

async function readSource(directory: string, file: string, name: string): Promise<string> {
  try {
    return await readFile(path.join(directory, name), 'utf8');
  } catch (error) {
    throw new ProjectError(`cannot read ${file}: ${describeUnknown(error)}`, 'check the file');
  }
}

/** The asset files of `style`'s world; undefined for a style that is not a world. */
export async function readWorldAssetFiles(
  root: string,
  style: string | undefined,
): Promise<WorldAssetFiles | undefined> {
  if (!isWorldAssetWorld(style)) return undefined;
  const folder = worldAssetsDir(style);
  const directory = projectPath(root, folder);
  if (!existsSync(directory)) return { world: style, files: [], ignored: [] };
  guardInside(root, directory, folder);
  const entries = await readdir(directory, { withFileTypes: true });
  const names = entries
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.json'))
    .map((entry) => entry.name)
    .sort();
  const files: WorldAssetSource[] = [];
  const ignored: IgnoredAssetFile[] = [];
  for (const name of names) {
    const file = `${folder}/${name}`;
    if (!WORLD_ASSET_FILE_PATTERN.test(name)) {
      ignored.push({
        file,
        reason: 'the name is not kebab case (e.g. forest.json, red-deer.json)',
      });
      continue;
    }
    if (files.length >= MAX_WORLD_ASSET_FILES) {
      ignored.push({ file, reason: `more than ${String(MAX_WORLD_ASSET_FILES)} asset files` });
      continue;
    }
    const source = await readSource(directory, file, name);
    if (source.length > MAX_WORLD_ASSET_FILE_CHARS) {
      ignored.push({
        file,
        reason: `larger than ${String(MAX_WORLD_ASSET_FILE_CHARS)} characters`,
      });
      continue;
    }
    if (source.trim() !== '') files.push({ file, source });
  }
  return { world: style, files, ignored };
}

/** The manifest field, or undefined without any file (manifests stay byte-identical). */
export function manifestWorldAssets(
  files: WorldAssetFiles | undefined,
): ManifestWorldAssets | undefined {
  if (files === undefined || files.files.length === 0) return undefined;
  return { world: files.world, files: files.files.map((entry) => ({ ...entry })) };
}

/** The validated set the scenes see (the engine's own parse). */
export function worldAssetSet(files: WorldAssetFiles): WorldAssetSet {
  return buildWorldAssets(files.world, files.files);
}

/** Every problem of the asset files as `reelforge validate` problems (errors). */
export function worldAssetFileProblems(files: WorldAssetFiles | undefined): Problem[] {
  if (files === undefined) return [];
  const ignored = files.ignored.map((entry): Problem => ({
    severity: 'error',
    file: entry.file,
    at: '',
    message: `not loaded: ${entry.reason}`,
    fix: FIX,
  }));
  const parsed = worldAssetSet(files).problems.map((problem): Problem => ({
    severity: 'error',
    file: problem.file,
    at: '',
    message: problem.message,
    fix: FIX,
  }));
  return [...ignored, ...parsed];
}
