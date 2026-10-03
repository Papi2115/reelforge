/**
 * Where shot variants live (PLAN.md#11.3). The runtime Claude may not edit `.reelforge/`, so a
 * variant is built in a work file `.variants/<shot>/v<n>.js` (git-excluded through
 * `.git/info/exclude`, so no autocommit picks it up) and moved to
 * `.reelforge/variants/<shot>/v<n>.js` when its QA is done. `variants.json` next to it records
 * the set; it is stale (and removed) once the shot's scene or storyboard entry changes.
 */
import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { JsonFileStore, err, ok, type Result } from '@reelforge/claude-bridge';
import {
  SHOT_VARIANTS_DIR,
  shotIdSchema,
  shotVariantSetSchema,
  shotVariantsDir,
  shotVariantsFile,
  type ShotVariantSet,
  type StoryboardShot,
  type VariantBase,
} from '@reelforge/shared';
import { readProjectText } from '../files.js';
import { inProject } from '../paths.js';
import { stageError, type StageError } from '../types.js';

/** Work folder of variant builds (project root, git-excluded; Claude may write here). */
export const VARIANT_WORK_DIR = '.variants';
const EXCLUDE_LINE = `/${VARIANT_WORK_DIR}/`;

export function variantWorkFile(shotId: string, index: number): string {
  return `${VARIANT_WORK_DIR}/${shotId}/v${String(index)}.js`;
}

const describe = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const sets = new JsonFileStore<ShotVariantSet | null>(shotVariantSetSchema.nullable(), () => null);

/** Adds the work folder to `.git/info/exclude` (local to the repo, never committed). */
export async function excludeVariantWork(projectDir: string): Promise<Result<void, StageError>> {
  const info = path.join(projectDir, '.git', 'info');
  const file = path.join(info, 'exclude');
  try {
    let current = '';
    try {
      current = await readFile(file, 'utf8');
    } catch (error) {
      if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error;
    }
    if (current.split(/\r?\n/).some((line) => line.trim() === EXCLUDE_LINE)) return ok(undefined);
    await mkdir(info, { recursive: true });
    const separator = current === '' || current.endsWith('\n') ? '' : '\n';
    await writeFile(file, `${current}${separator}${EXCLUDE_LINE}\n`, 'utf8');
    return ok(undefined);
  } catch (error) {
    return err(
      stageError('io', `cannot exclude ${VARIANT_WORK_DIR}/ from git: ${describe(error)}`),
    );
  }
}

function sha256(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}

/** What a new set is built against: the shot's scene source and its storyboard entry. */
export async function variantBase(
  projectDir: string,
  shot: StoryboardShot,
): Promise<Result<VariantBase, StageError>> {
  const source = await readProjectText(projectDir, shot.scene);
  if (!source.ok) return source;
  const { id, t0, t1, treatment, intent, scene } = shot;
  return ok({
    scene: shot.scene,
    sceneHash: source.value === undefined ? '' : sha256(source.value),
    shotHash: sha256(JSON.stringify({ id, t0, t1, treatment, intent, scene })),
  });
}

export function sameBase(first: VariantBase, second: VariantBase): boolean {
  return (
    first.scene === second.scene &&
    first.sceneHash === second.sceneHash &&
    first.shotHash === second.shotHash
  );
}

/** The stored set of a shot (undefined: none). */
export async function readVariantSet(
  projectDir: string,
  shotId: string,
): Promise<Result<ShotVariantSet | undefined, StageError>> {
  const read = await sets.read(inProject(projectDir, shotVariantsFile(shotId)));
  if (!read.ok) return err(stageError('io', `${shotVariantsFile(shotId)}: ${read.error.message}`));
  return ok(read.value ?? undefined);
}

/** Serialized read-modify-write of a shot's set (parallel variant jobs update one file). */
export async function updateVariantSet(
  projectDir: string,
  shotId: string,
  change: (current: ShotVariantSet | undefined) => ShotVariantSet,
): Promise<Result<ShotVariantSet, StageError>> {
  const written = await sets.update(inProject(projectDir, shotVariantsFile(shotId)), (current) =>
    change(current ?? undefined),
  );
  if (!written.ok) {
    return err(stageError('io', `${shotVariantsFile(shotId)}: ${written.error.message}`));
  }
  if (written.value === null) return err(stageError('io', 'variant set was not written'));
  return ok(written.value);
}

/** Removes a shot's variants (set file, stored scenes and work files). */
export async function removeVariantSet(
  projectDir: string,
  shotId: string,
): Promise<Result<void, StageError>> {
  try {
    await rm(inProject(projectDir, shotVariantsDir(shotId)), { recursive: true, force: true });
    await removeWorkDir(projectDir, shotId);
    return ok(undefined);
  } catch (error) {
    return err(stageError('io', `cannot remove the variants of ${shotId}: ${describe(error)}`));
  }
}

/** Moves a finished work file to its stored place; false when Claude never wrote it. */
export async function storeVariantFile(
  projectDir: string,
  work: string,
  stored: string,
): Promise<Result<boolean, StageError>> {
  const source = await readProjectText(projectDir, work);
  if (!source.ok) return source;
  if (source.value === undefined) return ok(false);
  try {
    await mkdir(path.dirname(inProject(projectDir, stored)), { recursive: true });
    await rename(inProject(projectDir, work), inProject(projectDir, stored));
    return ok(true);
  } catch (error) {
    return err(stageError('io', `cannot store ${stored}: ${describe(error)}`));
  }
}

export async function removeWorkFile(projectDir: string, work: string): Promise<void> {
  await rm(inProject(projectDir, work), { force: true });
}

/** Removes a shot's work folder (after its variant builds). */
export async function removeWorkDir(projectDir: string, shotId: string): Promise<void> {
  await rm(inProject(projectDir, `${VARIANT_WORK_DIR}/${shotId}`), {
    recursive: true,
    force: true,
  });
}

/** Shot ids that have a variant folder. */
export async function variantShotIds(projectDir: string): Promise<Result<string[], StageError>> {
  try {
    const entries = await readdir(inProject(projectDir, SHOT_VARIANTS_DIR), {
      withFileTypes: true,
    });
    return ok(
      entries
        .filter((entry) => entry.isDirectory() && shotIdSchema.safeParse(entry.name).success)
        .map((entry) => entry.name)
        .sort(),
    );
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return ok([]);
    return err(stageError('io', `cannot list ${SHOT_VARIANTS_DIR}: ${describe(error)}`));
  }
}
