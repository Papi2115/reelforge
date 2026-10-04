/**
 * Character and mascot variables of the storyboard, scene-build and critic prompts (PLAN.md#12.20,
 * ADR-025). A project with the classic hero and no mascot gets none, so its prompts render byte
 * for byte as before 2.3.5. `pack` adds the cast rules; a chosen mascot (pack only) adds its
 * screen-time rules to the storyboard, its directive to the scene build of shots with
 * `shot.mascot` (and "do not show it" to the others) and a mascot check to the frame critic.
 */
import {
  CAST_PERSON_IDS,
  MASCOT_PROFILES,
  shotMascot,
  type CharacterMode,
  type MascotChoice,
  type StoryboardShot,
} from '@reelforge/shared';

export interface CharacterSettings {
  readonly characters: CharacterMode;
  /** The mascot in effect (`projectMascot`: `none` with the classic hero). */
  readonly mascot: MascotChoice;
  /** Roles already built for this project (in the pack's style), by id. */
  readonly builtRoles?: readonly string[];
}

type Vars = Readonly<Record<string, string | boolean>>;

/**
 * Mascot poses and expressions (= `POSES` / `auto` + `EXPRESSIONS` of packages/kit; the sync test
 * is packages/stages/src/characters.test.ts).
 */
export const MASCOT_POSES = [
  'calm',
  'wave',
  'think',
  'point',
  'shrug',
  'joy',
  'walk',
  'eureka',
] as const;
export const MASCOT_EXPRESSIONS = [
  'auto',
  'neutral',
  'joy',
  'curious',
  'surprised',
  'thinking',
  'sceptical',
  'alarm',
] as const;

const code = (ids: readonly string[]): string => ids.map((id) => `\`${id}\``).join(', ');

function packVars(settings: CharacterSettings): Vars {
  if (settings.characters !== 'pack') return {};
  const built = settings.builtRoles ?? [];
  return {
    castPack: true,
    castList: code(CAST_PERSON_IDS),
    ...(built.length === 0 ? {} : { builtRoles: code(built) }),
  };
}

function mascotVars(mascot: MascotChoice): Vars {
  if (mascot === 'none') return {};
  const profile = MASCOT_PROFILES[mascot];
  return {
    mascotId: mascot,
    mascotName: profile.label,
    mascotPersonality: profile.personality,
  };
}

/** Storyboard prompt: the cast rules (pack) and the mascot's screen-time rules (chosen). */
export function storyboardCharacterVars(settings: CharacterSettings): Vars {
  return { ...packVars(settings), ...mascotVars(settings.mascot) };
}

/**
 * Scene-build prompt of one shot: the cast rules (pack); with a mascot, its directive when the
 * shot has `shot.mascot`, else the line that keeps it out of the shot.
 */
export function sceneCharacterVars(settings: CharacterSettings, shot: StoryboardShot): Vars {
  const vars = packVars(settings);
  if (settings.mascot === 'none') return vars;
  const planned = shotMascot(shot, settings.mascot);
  if (planned === undefined) return { ...vars, mascotAbsent: settings.mascot };
  return {
    ...vars,
    ...mascotVars(settings.mascot),
    mascotRole: planned.role,
    mascotAction: planned.action,
    mascotPoses: MASCOT_POSES.join(', '),
    mascotExpressions: MASCOT_EXPRESSIONS.join(', '),
  };
}

/** Critic prompt: the mascot check of a shot that shows the mascot; nothing otherwise. */
export function criticCharacterVars(
  settings: CharacterSettings,
  shot: StoryboardShot,
): Readonly<Record<string, string>> {
  const planned = shotMascot(shot, settings.mascot);
  if (planned === undefined) return {};
  return { mascotCheck: `${MASCOT_PROFILES[planned.id].label}, as the ${planned.role}` };
}
