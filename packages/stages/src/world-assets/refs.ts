/**
 * Missing world assets in the scene QA (PLAN.md#13.15 phase 2): an asset id a world scene uses
 * that neither the project's `assets/<world>/` nor the scene defines is a QA error before any
 * render ("asset X is not defined: define it in assets/<world>/… or use a built-in"); it feeds
 * the usual fix turn. The files are read at every round (a fix turn may add an asset).
 */
import { unknownWorldAssetRefs, worldAssetSet } from '@reelforge/cli/service';
import { ok, type Result } from '@reelforge/claude-bridge';
import { isWorldAssetWorld, type QaFinding } from '@reelforge/shared';
import type { SceneJob } from '../scenes/job.js';
import { finding } from '../scenes/checks.js';
import type { StageError } from '../types.js';
import { readAssetFiles } from './qa.js';

export async function worldAssetRefFindings(
  job: Pick<SceneJob, 'ctx' | 'world'>,
  source: string,
  scene: string,
): Promise<Result<QaFinding[], StageError>> {
  const id = job.world?.id;
  if (!isWorldAssetWorld(id)) return ok([]);
  const files = await readAssetFiles(job.ctx.projectDir, id);
  if (!files.ok) return files;
  const refs = unknownWorldAssetRefs(source, worldAssetSet(files.value));
  return ok(
    refs.map((ref) => finding('scene', 'error', `${scene}: ${ref.message}`, { fatal: true })),
  );
}
