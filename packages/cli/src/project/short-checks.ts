/**
 * A SHORT's cut rules in `reelforge validate` (PLAN.md#13.18): the storyboard of a short project
 * gets the same short checks as the Storyboard stage's validator (`checkShortCuts`: shot lengths
 * of 0.8–3.5 s, a hook shot of at most 2.5 s, a cut every 1.5–3 s on average, the overall length,
 * the end card last), so Claude sees them before its turn ends. The app's end card is exempt and
 * never reported as a scene to write. A film: nothing (its checks exactly as before).
 */
import { checkShortCuts } from '@reelforge/prompts';
import {
  isEndCardShot,
  isShort,
  type ProjectFile,
  type StoryboardFile,
  type StoryboardShot,
} from '@reelforge/shared';
import type { Problem } from './files.js';
import { PROJECT_PATHS } from './paths.js';

/** The fix line of a short's cut problem (the message says what to change). */
const FIX =
  'change storyboard.json as the message says (never add or edit the end card: the app adds it), then run reelforge validate again';

/** Cut rule problems of a short's storyboard; none for a film. */
export function shortCutProblems(project: ProjectFile, storyboard: StoryboardFile): Problem[] {
  if (!isShort(project)) return [];
  return checkShortCuts(storyboard.shots, { lengthS: project.short.lengthS }).map((entry) => ({
    severity: entry.severity,
    file: PROJECT_PATHS.storyboard,
    at: entry.path ?? '',
    message: `${entry.code}: ${entry.message}`,
    fix: FIX,
  }));
}

/** Whether the scene of `shot` is the app's to write (a short's end card), never Claude's. */
export function appWrittenScene(project: ProjectFile | undefined, shot: StoryboardShot): boolean {
  return project !== undefined && isShort(project) && isEndCardShot(shot);
}
