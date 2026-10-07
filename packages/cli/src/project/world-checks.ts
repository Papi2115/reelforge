/**
 * The world variety checks in `reelforge validate` (real run Sketchbook 2): the storyboard of a
 * world project gets the same checks as the Storyboard stage's validator (`checkWorldVariety`:
 * moment catalog and looks, breakthrough quota, spacing, runs, distinct page transitions and, with
 * continuity links on, the film's link quota), so Claude sees a quota error before its turn ends.
 * The stage's test-only quota override is not known here; the natural quota applies.
 */
import { WORLD_TRANSITIONS } from '@reelforge/engine';
import { WORLDS, type World } from '@reelforge/kit';
import { checkWorldVariety, worldPromptText } from '@reelforge/prompts';
import { projectContinuityLinks, type ProjectFile, type StoryboardFile } from '@reelforge/shared';
import type { Problem } from './files.js';
import { PROJECT_PATHS } from './paths.js';

/** The fix line of a variety problem (the message says what to change). */
const FIX = 'change storyboard.json as the message says, then run reelforge validate again';

function worldTransitions(world: World) {
  return Object.values(WORLD_TRANSITIONS)
    .filter((style) => style.world === world.id)
    .map(({ id, type, duration, description }) => ({ id, type, duration, description }));
}

/**
 * Variety problems of a world project's storyboard; none outside a world, for a world that is
 * not usable here (`styleProblems` reports that) or one without a moment catalog.
 */
export function worldVarietyProblems(
  project: ProjectFile,
  storyboard: StoryboardFile,
  experimentalWorlds: boolean,
  worlds: readonly World[] = WORLDS,
): Problem[] {
  const world = worlds.find((entry) => entry.id === project.style);
  if (world === undefined || !world.wired || (world.experimental && !experimentalWorlds)) return [];
  const moments = worldPromptText(world.id)?.moments ?? [];
  if (moments.length === 0) return [];
  const issues = checkWorldVariety(storyboard.shots, {
    moments,
    transitions: worldTransitions(world),
    continuityLinks: projectContinuityLinks(project),
  });
  return issues.map((entry) => ({
    severity: entry.severity,
    file: PROJECT_PATHS.storyboard,
    at: entry.path ?? '',
    message: `${entry.code}: ${entry.message}`,
    fix: FIX,
  }));
}
