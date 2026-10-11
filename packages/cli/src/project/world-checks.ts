/**
 * The world variety checks in `reelforge validate` (real run Sketchbook 2): the storyboard of a
 * world project gets the same checks as the Storyboard stage's validator (`checkWorldVariety`:
 * moment catalog and looks, breakthrough quota, spacing, runs, distinct page transitions and, with
 * continuity links on, the film's link quota; a world's film grammar), so Claude sees a quota
 * error before its turn ends.
 * The stage's test-only quota override is not known here; the natural quota applies.
 * A world whose looks are optional (Grim Ink, PLAN.md#14.12) is checked for the looks the project
 * keeps on (project.json `worldLooks`): a shot in a look that is off is an error, and the moments
 * only such a look can host are not asked for.
 */
import { WORLD_TRANSITIONS } from '@reelforge/engine';
import { WORLDS, type World } from '@reelforge/kit';
import { checkWorldVariety, worldPromptText, worldTextForLooks } from '@reelforge/prompts';
import {
  enabledWorldLooks,
  projectContinuityLinks,
  shotLook,
  withoutEndCard,
  type ProjectFile,
  type StoryboardFile,
} from '@reelforge/shared';
import type { Problem } from './files.js';
import { PROJECT_PATHS } from './paths.js';

/** The fix line of a variety problem (the message says what to change). */
const FIX = 'change storyboard.json as the message says, then run reelforge validate again';

function worldTransitions(world: World) {
  return Object.values(WORLD_TRANSITIONS)
    .filter((style) => style.world === world.id)
    .map(({ id, type, duration, description }) => ({ id, type, duration, description }));
}

/** The world's prompt text for the looks the project keeps on (as the Storyboard stage uses it). */
function worldText(world: World, project: ProjectFile) {
  const text = worldPromptText(world.id);
  if (text === undefined || world.optionalLooks !== true) return text;
  const kept = enabledWorldLooks(world.looks, project.worldLooks).map((look) => look.id);
  return worldTextForLooks(
    text,
    world.looks.map((look) => look.id),
    kept,
  );
}

/** Shots in a look the project turned off (a world with optional looks only). */
function lookOffProblems(
  world: World,
  project: ProjectFile,
  storyboard: StoryboardFile,
): Problem[] {
  if (world.optionalLooks !== true) return [];
  const all = world.looks.map((look) => look.id);
  const kept = enabledWorldLooks(world.looks, project.worldLooks).map((look) => look.id);
  return storyboard.shots.flatMap((shot, index) => {
    const look = shotLook(shot);
    if (!all.includes(look) || kept.includes(look)) return [];
    return [
      {
        severity: 'error' as const,
        file: PROJECT_PATHS.storyboard,
        at: `shots[${String(index)}].look`,
        message: `look-off: ${shot.id} uses look "${look}", which is turned off in this project (Project settings → Looks of this world); looks in use: ${kept.join(', ')}`,
        fix: 'move the shot to a look in use (its roll letter follows the looks in use: A, B, C), then run reelforge validate again',
      },
    ];
  });
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
  const lookOff = lookOffProblems(world, project, storyboard);
  const text = worldText(world, project);
  const moments = text?.moments ?? [];
  if (moments.length === 0) return lookOff;
  // A short's end card (PLAN.md#13.18) is the app's; the stage's validator skips it too.
  const issues = checkWorldVariety(withoutEndCard(storyboard.shots), {
    moments,
    transitions: worldTransitions(world),
    continuityLinks: projectContinuityLinks(project),
    // the world's film grammar (Game B1 rework: views, game share, crossings, transitions)
    grammar: text?.grammar,
  });
  return [
    ...lookOff,
    ...issues.map((entry) => ({
      severity: entry.severity,
      file: PROJECT_PATHS.storyboard,
      at: entry.path ?? '',
      message: `${entry.code}: ${entry.message}`,
      fix: FIX,
    })),
  ];
}
