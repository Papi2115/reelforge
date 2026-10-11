/**
 * The direction step in the pipeline (PLAN.md#14.16): the Storyboard stage of a Grim Ink film plans
 * (or keeps) `direction.json` first and hands it to its prompt and its checks; the sub-action
 * `{ stage: 'storyboard', action: 'direction' }` plans again on request (the storyboard keeps its
 * status; the next Storyboard run follows the new plan); the scenes read the plan of their shots.
 * Every other project: nothing changes.
 */
import { err, ok, type Result } from '@reelforge/claude-bridge';
import { C_CAM_ID, type World } from '@reelforge/kit';
import { storyboardDirectionVars } from '@reelforge/prompts';
import {
  DIRECTION_FILE,
  isShort,
  wordsFileSchema,
  type DirectionFile,
  type ProjectFile,
  type WordsFile,
} from '@reelforge/shared';
import { requireProjectJson } from '../files.js';
import { FILES } from '../paths.js';
import { stageError, type StageContext, type StageError, type StageSummary } from '../types.js';
import {
  directionSummary,
  ensureDirection,
  isCCamProject,
  readDirection,
  requireCCam,
} from './direction.js';

export interface StoryboardDirection {
  /** The plan the storyboard is checked against (undefined: none). */
  readonly file: DirectionFile | undefined;
  /** Storyboard prompt variables (`worldDirection`); empty without a plan. */
  readonly vars: Readonly<Record<string, string>>;
  readonly warnings: readonly string[];
  readonly outputs: readonly string[];
}

const NONE: StoryboardDirection = { file: undefined, vars: {}, warnings: [], outputs: [] };

/** The plan a storyboard run follows: planned or kept for a Grim Ink film, none otherwise. */
export async function storyboardDirection(
  ctx: StageContext,
  project: ProjectFile,
  words: WordsFile,
): Promise<Result<StoryboardDirection, StageError>> {
  if (!isCCamProject(project, ctx)) return ok(NONE);
  const outcome = await ensureDirection(ctx, project, words, { force: false });
  if (!outcome.ok) return outcome;
  const { file, warnings, outputs } = outcome.value;
  return ok({ file, vars: storyboardDirectionVars(file), warnings, outputs });
}

/** Storyboard action `direction`: a new plan from Claude (or the minimal one), status kept. */
export async function runDirectionAction(
  ctx: StageContext,
): Promise<Result<StageSummary, StageError>> {
  const { project } = ctx.snapshot;
  if (project.status !== 'ok') return err(stageError('not-ready', 'project.json is invalid'));
  const guard = requireCCam(project.value, ctx);
  if (!guard.ok) return guard;
  const words = await requireProjectJson(ctx.projectDir, FILES.words, wordsFileSchema);
  if (!words.ok) return words;
  const outcome = await ensureDirection(ctx, project.value, words.value, { force: true });
  if (!outcome.ok) return outcome;
  const { value } = outcome;
  if (value.file === undefined) {
    return err(stageError('validation', 'no direction plan was made', [...value.warnings]));
  }
  const summary = directionSummary(value);
  return ok({
    message: `direction planned: ${summary}`,
    outputs: [DIRECTION_FILE],
    changed: false,
    keepStatus: true,
    warnings: [...value.warnings],
    metrics: {
      beats: value.file.beats.length,
      people: value.file.cast.length,
      fallback: value.status === 'fallback',
      repairs: value.repairs,
    },
    commitMessage: `Direction: ${summary}`,
  });
}

/** The plan the scenes of a Grim Ink film follow; undefined elsewhere or when it is unusable. */
export async function loadSceneDirection(
  projectDir: string,
  project: ProjectFile,
  world: World | undefined,
): Promise<DirectionFile | undefined> {
  if (world?.id !== C_CAM_ID || isShort(project)) return undefined;
  const state = await readDirection(projectDir);
  return state.ok && state.value.status === 'ok' ? state.value.file : undefined;
}
