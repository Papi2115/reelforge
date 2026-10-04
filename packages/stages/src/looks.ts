/**
 * Look mode plumbing (ADR-009): what the storyboard prompt, its validator and the scene-build
 * prompt get from the project's `lookMode` and the kit's look registry. `voxel-only` (every
 * project made before 2.0) gets nothing, so its prompts and checks stay exactly as they were.
 */
import { getLook, listLooks, voxelLook, type Look } from '@reelforge/kit';
import {
  describePairs,
  shotLook,
  TRANSITION_STYLE_LIST,
  type LookMode,
  type StoryboardShot,
  type TransitionStyle,
} from '@reelforge/shared';

/** One line per look in the storyboard prompt. */
export function lookLine(look: Look): string {
  return `- \`${look.id}\` (${look.label}): ${look.description}. Rolls: ${look.rolls.join(', ')}. Treatments: ${look.treatments.join(', ')}.`;
}

/** One line per transition style in the storyboard prompt (PLAN.md#12.15). */
export function transitionLine(style: TransitionStyle): string {
  const { min, max } = style.duration;
  const pairs = style.lookChange ? `; look changes only: ${describePairs(style)}` : '';
  return `- \`${style.id}\` (${style.type}, ${String(min)}–${String(max)} s${pairs}): ${style.description}.`;
}

/** Transition styles usable with these looks: a special needs a pair of available looks. */
export function availableTransitionStyles(looks: readonly Look[]): TransitionStyle[] {
  const ids = new Set(looks.map((look) => look.id));
  const usable = (pattern: string): boolean => pattern === '*' || ids.has(pattern);
  return TRANSITION_STYLE_LIST.filter((style) =>
    style.pairs.some((pair) => usable(pair.from) && usable(pair.to)),
  );
}

/** Storyboard prompt variables: none in `voxel-only`; transition styles once 2+ looks exist. */
export function storyboardLookVars(
  mode: LookMode,
  looks: readonly Look[] = listLooks(),
): Readonly<Record<string, string | boolean>> {
  if (mode === 'voxel-only') return {};
  return {
    looks: looks.map(lookLine).join('\n'),
    ...(looks.length >= 2
      ? {
          multiLook: true,
          transitions: availableTransitionStyles(looks).map(transitionLine).join('\n'),
        }
      : { singleLook: true }),
  };
}

/** Storyboard validator options: none in `voxel-only`. */
export function storyboardLookOptions(
  mode: LookMode,
  looks: readonly Look[] = listLooks(),
): { readonly lookMode?: LookMode; readonly looks?: readonly string[] } {
  return mode === 'voxel-only' ? {} : { lookMode: mode, looks: looks.map((look) => look.id) };
}

/**
 * Scene-build prompt variables: none in `voxel-only`; in `mixed` the shot's look and its docs (a
 * look that is unknown or not available, e.g. in a hand-edited storyboard, builds as voxel).
 */
export function sceneLookVars(
  mode: LookMode,
  shot: StoryboardShot,
  looks?: readonly Look[],
): Readonly<Record<string, string>> {
  if (mode === 'voxel-only') return {};
  const look = getLook(shotLook(shot), looks) ?? voxelLook;
  return { lookId: look.id, lookDocs: look.docs };
}

/**
 * What a frame of each look must look like, for the frame critic (Haiku reads one contact sheet:
 * a few sentences, not the build docs). Real run v2.0: told nothing, it called blueprint and
 * retro-ui frames "voxel style" and passed every crop.
 */
export const CRITIC_LOOK_RULES: Readonly<Record<string, string>> = {
  voxel:
    'Voxel: a chunky voxel 3D world (blocks, hard pixel edges, flat lighting) with pixel-font cards inside the safe margin.',
  'retro-ui':
    'Retro UI: flat pixel-art retro-OS windows, terminals, browsers, documents or CRT screens seen straight on over a desktop; the window title bar and the headline stay whole and readable in every frame.',
  diorama:
    'Diorama: an isometric cut-away room, office or city block seen from the fixed iso camera (no perspective close-ups); pins and labels sit clear of each other.',
  blueprint:
    'Blueprint: a flat 2D blueprint board (grid paper, line drawings, charts, maps, counters in pixel text); titles, labels, axis values and numbers are whole and do not collide.',
  'flat-2d':
    'Flat 2D: clean flat motion graphics on a solid or patterned field (shapes, pixel icons on badges, cards, bars, gauges, bold pixel-caps words); at most ~6 elements, all inside the safe margin, nothing overlapping or cut off.',
  whiteboard:
    'Whiteboard: hand-drawn marker lines, doodles and handwritten pixel caps on a framed off-white whiteboard (a hand may be drawing); drawings stay inside the board clear of the tray, labels whole and not crossing each other.',
  'paper-cutout':
    'Paper cut-out: flat paper pieces with torn or cut edges on layered depth strips (sky bands, hills, city, a toy-theatre room) with soft dithered drop shadows, a jointed paper puppet, pixel-caps signs and title strips; seen straight on, no perspective close-ups; text whole and not over the puppet.',
};

/**
 * Critic prompt variables: none in `voxel-only` (the prompt stays as before looks); in `mixed`
 * the shot's look (unknown looks judge as voxel), its roll when the storyboard gives one, and the
 * look's visual rules.
 */
export function criticLookVars(
  mode: LookMode,
  shot: StoryboardShot,
  looks?: readonly Look[],
): Readonly<Record<string, string>> {
  if (mode === 'voxel-only') return {};
  const look = getLook(shotLook(shot), looks) ?? voxelLook;
  const rules = CRITIC_LOOK_RULES[look.id] ?? `${look.label}: ${look.description}.`;
  return {
    lookId: look.id,
    lookRules: rules,
    ...(shot.roll === undefined ? {} : { roll: shot.roll }),
  };
}
