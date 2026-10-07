/**
 * The world-asset problems of a project (PLAN.md#13.15 phase 2), shared by `reelforge validate`
 * and `reelforge world-assets check`: asset files left out of `ctx.worldAssets` (invalid JSON,
 * the world's own format errors, duplicate ids, caps), asset ids the storyboard's scenes use
 * that nobody defines, and `assets/cast.json` entries that point at nothing. Nothing outside a
 * world (legacy projects get no new problem).
 */
import { readFile } from 'node:fs/promises';
import type { WorldAssetSet } from '@reelforge/engine';
import { WORLD_CAST_FILE, worldCastFileSchema } from '@reelforge/shared';
import { describeUnknown } from '../errors.js';
import type { Problem, ProjectFiles } from './files.js';
import { projectPath } from './paths.js';
import { unknownWorldAssetRefs } from './world-asset-refs.js';
import { worldAssetFileProblems, worldAssetSet, type WorldAssetFiles } from './world-assets.js';

const SCENE_FIX =
  'define the asset in the world asset folder (reelforge kit-docs world-assets), define it in the scene, or use a built-in';

async function readOptional(root: string, file: string): Promise<string | undefined> {
  try {
    return await readFile(projectPath(root, file), 'utf8');
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return undefined;
    throw error;
  }
}

/** Unknown asset ids per storyboard scene (scenes not written yet are skipped). */
export async function sceneAssetRefProblems(
  files: ProjectFiles,
  set: WorldAssetSet,
): Promise<Problem[]> {
  if (files.storyboard.status !== 'ok') return [];
  const scenes = [...new Set(files.storyboard.data.shots.map((shot) => shot.scene))];
  const problems: Problem[] = [];
  for (const scene of scenes) {
    const source = await readOptional(files.root, scene);
    if (source === undefined) continue;
    for (const ref of unknownWorldAssetRefs(source, set)) {
      problems.push({
        severity: 'error',
        file: scene,
        at: '',
        message: ref.message,
        fix: SCENE_FIX,
      });
    }
  }
  return problems;
}

/** `assets/cast.json`: valid, and every entry names an asset the files define. */
export async function worldCastProblems(root: string, set: WorldAssetSet): Promise<Problem[]> {
  const text = await readOptional(root, WORLD_CAST_FILE);
  if (text === undefined) return [];
  const problem = (message: string, severity: Problem['severity'] = 'error'): Problem => ({
    severity,
    file: WORLD_CAST_FILE,
    at: '',
    message,
    fix: 'list each recurring thing once: { version: 1, world, entries: [{ id, kind, name, file, shots }] }',
  });
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch (error) {
    return [problem(`not valid JSON: ${describeUnknown(error)}`)];
  }
  const parsed = worldCastFileSchema.safeParse(value);
  if (!parsed.success) {
    return parsed.error.issues.map((issue) =>
      problem(`${issue.path.join('.') || '(file)'}: ${issue.message}`),
    );
  }
  const known = new Set(set.ids.all);
  return parsed.data.entries
    .filter((entry) => !known.has(entry.id))
    .map((entry) =>
      problem(`entry "${entry.id}" is not defined by any asset file of ${set.world}`, 'warning'),
    );
}

/** Every world-asset problem of the project; none outside a world. */
export async function worldAssetProblems(files: ProjectFiles): Promise<Problem[]> {
  const assets: WorldAssetFiles | undefined = files.worldAssets;
  if (assets === undefined) return [];
  const set = worldAssetSet(assets);
  return [
    ...worldAssetFileProblems(assets),
    ...(await worldCastProblems(files.root, set)),
    ...(await sceneAssetRefProblems(files, set)),
  ];
}
