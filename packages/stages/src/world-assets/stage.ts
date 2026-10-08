/**
 * `{ stage: 'scenes', action: 'world-assets' }` (PLAN.md#13.15 phase 2): designs the world film's
 * own assets again on request (the production line and a later "Look assets" row of the app);
 * the scenes keep their status. A build runs the same step by itself once per storyboard.
 */
import { err, ok, type Result } from '@reelforge/claude-bridge';
import { WORLD_ASSETS_REPORT_FILE } from '@reelforge/shared';
import type { SceneJob } from '../scenes/job.js';
import { stageError, type StageError, type StageSummary } from '../types.js';
import { ensureWorldAssets, worldAssetsJob } from './builder.js';

export async function worldAssetsAction(job: SceneJob): Promise<Result<StageSummary, StageError>> {
  if (worldAssetsJob(job) === undefined) {
    return err(stageError('invalid-input', "world assets: this project's style is not a world"));
  }
  const outcome = await ensureWorldAssets(job, { force: true });
  if (!outcome.ok) return outcome;
  const { value } = outcome;
  return ok({
    message: value.message,
    outputs: [...value.outputs, WORLD_ASSETS_REPORT_FILE],
    changed: value.outputs.length > 0,
    warnings: [...value.warnings],
    metrics: { worldAssets: value.ids.length, status: value.status },
    commitMessage: `World assets: ${value.message}`,
    keepStatus: true,
  });
}
