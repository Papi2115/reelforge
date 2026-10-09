/**
 * Shorts (PLAN.md#13.18): creating the 30 s and 60 s shorts of a film, and running a short's
 * Claude stages. A short uses the regular pipeline; the Script and Storyboard stages switch to the
 * short's prompts and rules by `kind: 'short'` (films are unchanged), so `runShortStage` only
 * makes sure the project really is a short before it runs the stage.
 */
import { err, type Result } from '@reelforge/claude-bridge';
import { isShort, projectFileSchema } from '@reelforge/shared';
import { requireProjectJson } from '../files.js';
import { FILES } from '../paths.js';
import type { StageRunner } from '../runner.js';
import { stageError, type StageError, type StageSuccess } from '../types.js';

export {
  createShortsForFilm,
  shortTitle,
  type CreatedShort,
  type CreateShortsOptions,
  type CreateShortsRequest,
} from './create.js';
export { copyReusableAssets, reusableFolders } from './copy-assets.js';
export { END_CARD_SCENE_MARKER, endCardSceneSource } from './end-card-scene.js';
export { SHORT_MAX_STILL_S, type ShortSceneSetup } from './scene-checks.js';
export { endCardChannelName, parentFolder, SHORT_HOOKS_FILE } from './script-step.js';
export {
  appendShortEndCard,
  storyboardShortCheckOptions,
  storyboardShortPromptVars,
} from './storyboard-step.js';

/** The Claude stages a short adapts. */
export type ShortStage = 'script' | 'storyboard';

/** Runs the short's `stage` on `runner`'s project; refuses a film. */
export async function runShortStage(
  runner: StageRunner,
  stage: ShortStage,
): Promise<Result<StageSuccess, StageError>> {
  const project = await requireProjectJson(runner.projectDir, FILES.project, projectFileSchema);
  if (!project.ok) return project;
  if (!isShort(project.value)) {
    return err(stageError('invalid-input', 'this project is a film, not a short'));
  }
  return runner.run({ stage });
}
