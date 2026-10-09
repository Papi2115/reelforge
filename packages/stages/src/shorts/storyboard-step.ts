/**
 * Storyboard of a SHORT (PLAN.md#13.18): the storyboard prompt's short section (retention editing,
 * vertical framing, no end card from Claude), the short's validator rules, and the fixed end card
 * shot appended after the validated narration shots (`endCard: true`, 2 s; its scene is built by
 * the app, not by Claude). A film gets none of it: no variables, no options, no write.
 */
import { ok, type Result } from '@reelforge/claude-bridge';
import {
  storyboardOutputSchema,
  storyboardShortVars,
  type ShortStoryboardOptions,
  type StoryboardOutput,
} from '@reelforge/prompts';
import { endCardShot, isShort, withoutEndCard, type ProjectFile } from '@reelforge/shared';
import { writeProjectJson } from '../files.js';
import { FILES } from '../paths.js';
import type { StageContext, StageError } from '../types.js';

/** Storyboard prompt variables of a short; a film: none (the prompt is exactly as before). */
export function storyboardShortPromptVars(project: ProjectFile): Record<string, unknown> {
  if (!isShort(project)) return {};
  return storyboardShortVars({
    lengthS: project.short.lengthS,
    parentTitle: project.parentProject?.title ?? project.title,
    endCardText: project.short.endCardText,
  });
}

/** Validator options of a short; a film: none (the checks exactly as before). */
export function storyboardShortCheckOptions(project: ProjectFile): {
  short?: ShortStoryboardOptions;
} {
  return isShort(project) ? { short: { lengthS: project.short.lengthS } } : {};
}

/**
 * A short's storyboard with its end card appended (an end card Claude wrote anyway is replaced),
 * written back to storyboard.json; a film's storyboard is returned untouched.
 */
export async function appendShortEndCard(
  ctx: Pick<StageContext, 'projectDir'>,
  project: ProjectFile,
  storyboard: StoryboardOutput,
): Promise<Result<StoryboardOutput, StageError>> {
  if (!isShort(project)) return ok(storyboard);
  const shots = withoutEndCard(storyboard.shots);
  const lastT1 = shots.at(-1)?.t1 ?? 0;
  return writeProjectJson(ctx.projectDir, FILES.storyboard, storyboardOutputSchema, {
    ...storyboard,
    shots: [...shots, endCardShot(lastT1, project.short.endCardText)],
  });
}
