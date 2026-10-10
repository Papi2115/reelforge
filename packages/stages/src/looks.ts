/**
 * Look mode plumbing (ADR-009): what the storyboard prompt, its validator and the scene-build
 * prompt get from the project's `lookMode` and the kit's look registry. `voxel-only` (every
 * project made before 2.0) gets nothing, so its prompts and checks stay exactly as they were.
 */
import {
  getLook,
  isUnwiredWorldStyle,
  listLooks,
  LOOKS,
  voxelLook,
  type Look,
  type LookScope,
} from '@reelforge/kit';
import { DEFAULT_LOOK_RHYTHM_RULES, maxNonCutTransitions } from '@reelforge/prompts';
import {
  describePairs,
  shotLook,
  TRANSITION_STYLE_LIST,
  WOW_STYLE_LIST,
  wowBudget,
  type LookMode,
  type StoryboardShot,
  type TransitionStyle,
} from '@reelforge/shared';

/**
 * The kit scope of a project style: experimental looks only with `scope.experimental` and never
 * for a world that is not wired yet (its looks are render-only until it has prompts).
 */
export function styleLookScope(
  style: string | undefined,
  scope: { readonly experimental?: boolean | undefined } = {},
): LookScope {
  return scope.experimental === true && !isUnwiredWorldStyle(style)
    ? { style, experimental: true }
    : { style };
}

/**
 * The looks a project of this style offers (PLAN.md#13.1, ADR-029): for the built-in styles
 * exactly `listLooks()`; a world's style is exclusive, only that world's looks (an experimental
 * world's only with `scope.experimental`, a wired one only, worlds.ts).
 */
export function styleLooks(
  style: string | undefined,
  scope: { readonly experimental?: boolean | undefined } = {},
): Look[] {
  return listLooks(LOOKS, styleLookScope(style, scope));
}

/** A look as the app's settings list it (`project-settings` dialog). */
export interface StyleLookSummary {
  readonly id: string;
  readonly label: string;
  readonly description: string;
}

/** The looks a project of this style offers, as the app lists them (voxel first; ADR-029). */
export function styleLookSummaries(style: string | undefined): StyleLookSummary[] {
  return styleLooks(style).map(({ id, label, description }) => ({ id, label, description }));
}

/**
 * The look a shot builds and is judged in when its own is unknown or not offered: voxel wherever
 * it is offered (every built-in style), otherwise the first offered look (a world's A-roll look).
 */
export function fallbackLook(looks: readonly Look[] | undefined): Look {
  if (looks === undefined || looks.some((look) => look.id === voxelLook.id)) return voxelLook;
  return looks[0] ?? voxelLook;
}

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

/** One line per wow transition (ADR-028): duration range, whether it uses `focus`, content. */
export function wowTransitionLine(style: TransitionStyle): string {
  const { min, max } = style.duration;
  const focus = style.wow?.focus === true ? ', set focus' : '';
  return `- \`${style.id}\` (${style.type}, ${String(min)}–${String(max)} s${focus}): ${style.description}. Fits: ${(style.wow?.content ?? []).join(', ')}.`;
}

/**
 * Transition styles usable with these looks (wow transitions are listed on their own): a special
 * needs a pair of available looks.
 */
export function availableTransitionStyles(looks: readonly Look[]): TransitionStyle[] {
  const ids = new Set(looks.map((look) => look.id));
  const usable = (pattern: string): boolean => pattern === '*' || ids.has(pattern);
  return TRANSITION_STYLE_LIST.filter(
    (style) =>
      style.wow === undefined && style.pairs.some((pair) => usable(pair.from) && usable(pair.to)),
  );
}

/**
 * Storyboard prompt variables: none in `voxel-only`; transition styles and the wow transitions
 * (ADR-028) once 2+ looks exist, with the film's budget of non-cut and wow transitions when its
 * length (`durationS`) is known. A world (`world`, PLAN.md#13.6) brings its own transitions
 * (worlds.ts), so the transition kit's styles and the wow transitions are left out.
 */
export function storyboardLookVars(
  mode: LookMode,
  looks: readonly Look[] = listLooks(),
  durationS?: number,
  world = false,
): Readonly<Record<string, string | boolean>> {
  if (mode === 'voxel-only') return {};
  const budget =
    durationS === undefined
      ? {}
      : {
          maxTransitions: String(
            maxNonCutTransitions(durationS, DEFAULT_LOOK_RHYTHM_RULES.transitionEveryS),
          ),
          wowBudget: String(wowBudget(durationS)),
        };
  return {
    looks: looks.map(lookLine).join('\n'),
    ...(looks.length >= 2
      ? {
          multiLook: true,
          ...(world
            ? {}
            : {
                transitions: availableTransitionStyles(looks).map(transitionLine).join('\n'),
                wowTransitions: WOW_STYLE_LIST.map(wowTransitionLine).join('\n'),
              }),
          ...budget,
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
 * look that is unknown or not offered, e.g. in a hand-edited storyboard, builds in `fallbackLook`:
 * voxel, or a world's first look).
 */
export function sceneLookVars(
  mode: LookMode,
  shot: StoryboardShot,
  looks?: readonly Look[],
): Readonly<Record<string, string>> {
  if (mode === 'voxel-only') return {};
  const look = getLook(shotLook(shot), looks) ?? fallbackLook(looks);
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
  // Sketchbook (PLAN.md#13.6); the world's craft checklist comes with criticWorldVars.
  'sketch-story':
    'Sketch story: one notebook page drawn by a visible hand with a felt-tip: crude stick people with props and reacting faces, the named thing, coloured-pencil fills out of the lines, hand-lettered words, one red correction on the point; the hand never covers the subject.',
  'sketch-graph':
    'Sketch graph: blue ballpoint maths and evidence on graph paper, a kraft envelope back or a clipped index card: sums worked line by line, ruled charts with labelled axes, boxes that fill, one red result; numbers whole and readable.',
  'sketch-loud':
    'Sketch loud: one huge hand-lettered marker word or number on a lined page, crooked and off-centre with empty paper around it, the red pen correcting it, a flipbook riffled in the corner or a sticky note slapped on; never two loud words.',
  // Comic (PLAN.md#13.3); the world's craft checklist comes with criticWorldVars.
  'comic-story':
    'Comic story: one printed comic page of 2-5 hand-ruled panels with uneven, leaning gutters (the panel that matters is the biggest), ink line art over off-register colour plates and halftone, speech balloons whose tails point at the speaker, yellow captions, at most one onomatopoeia; lettering whole and inside its balloon or caption.',
  'comic-info':
    'Comic info: an explainer that is still a comic page: a cutaway of the real object with its parts named by kinked leaders, a chart drawn as panel art with labelled axes, a hand-ticked checklist with a struck word and its correction, a worn stamp, a caption with the definition; one accent colour on the answer; numbers and labels whole and readable.',
  'comic-loud':
    'Comic loud: the page holds its breath, then hits: a near-empty pause panel with no lettering, ONE giant imperfect onomatopoeia breaking out of its panel, a slammed panel, or the one line lettered large with lots of empty paper; never two loud words at once.',
  // Game B2 (PLAN.md#13.4); the world's craft checklist comes with criticWorldVars.
  'rpg-explore':
    'RPG explore: a first-person walk through a raycast room of the place the narrator names (chunky walls, dithered tungsten or fluorescent light and fog), the hand taking or holding THE item (pink band), crude sprites, a woodgrain HUD (year compass, minimap, the narration box); the focal thing off-centre, a held look after the walk; HUD words whole and readable.',
  'rpg-menu':
    "RPG menu: the game's own screens over the dimmed level: a paused quest log or stat sheet with the inventory grid, the automap (walked rooms solid, the next dashed, room names in caps) or the end-of-chapter tally (counters on a smoked plate, a still beat, one stamp); real numbers and the narration's names only; text whole and readable.",
  'rpg-boss':
    'RPG boss: one pressure moment: a boss bar only for the central problem, numbers popping off the thing in danger, ONE stinger phrase slammed letter by letter, a shake with decay, or the held item thrown and landing with dust; never two loud things at once; HUD words whole and readable.',
  // Game B1 (PLAN.md#13.5); the world's craft checklist comes with criticWorldVars.
  'atari-story':
    "Atari story: the story inside the TV by 2600 rules (double-wide pixels, one colour per sprite row, flicker on a crowded line, colour bands, the CRT) or the room around the TV in square pixels (a room that fits the film), the camera pushing between them; a sticky note on the glass only with the narration's words; the focal thing off-centre, crimson only for the threat; HUD words and the narration box whole and readable.",
  'atari-menu':
    "Atari menu: the console's own screens: a menu painted in the TV with a cursor, the level-select map (the narration's places, dotted paths, a cursor), the attract-mode high-score table (rows in the order of events, one gold score, locked ??? rows) or the two-colour HOW TO PLAY manual page (numbered rules, FIG. 1, ONE red correction); real numbers and the narration's names only; text whole and readable.",
  'atari-boss':
    'Atari boss: one pressure moment: a boss card only for the central problem (BOSS n, the name slammed in, a bar in a real unit), a hit with hit-stop, a flash and a decaying shake, the crash draining the picture line by line, or the continue? screen with the card burned in; never two loud things at once; text whole and readable.',
  // Grim Ink (PLAN.md#14.10, not wired yet); the world's craft checklist comes with criticWorldVars.
  'ink-scene':
    "Ink scene: the film's own people acting in one specific grimy place, framed by a cut camera (wide, extreme close-up, close-up, over-the-shoulder): one uneven ink line over muddy flat colour, grime as flat shapes, one warm light pool behind the people, one accent object; the focal point off-centre, hands on what they hold, no edge of the place in the frame.",
  'ink-insert':
    'Ink insert: one object of the narration in extreme close-up, filling most of the frame off-centre, worn and specific (dents, stains, peeled paint as flat shapes), a foreground edge for depth, one accent on the detail that matters; any number or word hand-lettered in ink, whole and readable.',
  'ink-poster':
    'Ink poster: a hand-inked poster: one emblem of the narration on a flat mud field with a worn border, the line in fat ink capitals (bone fill, rust extrusion) landing letter by letter, two or three colours; the words exactly as narrated, whole and readable; never a typeset font.',
  'paper-cutout':
    'Paper cut-out: flat paper pieces with torn or cut edges on layered depth strips (sky bands, hills, city, a toy-theatre room) with soft dithered drop shadows, a jointed paper puppet, pixel-caps signs and title strips; seen straight on, no perspective close-ups; text whole and not over the puppet.',
};

/**
 * Critic prompt variables: none in `voxel-only` (the prompt stays as before looks); in `mixed`
 * the shot's look (unknown looks judge as `fallbackLook`), its roll when the storyboard gives one,
 * and the look's visual rules.
 */
export function criticLookVars(
  mode: LookMode,
  shot: StoryboardShot,
  looks?: readonly Look[],
): Readonly<Record<string, string>> {
  if (mode === 'voxel-only') return {};
  const look = getLook(shotLook(shot), looks) ?? fallbackLook(looks);
  const rules = CRITIC_LOOK_RULES[look.id] ?? `${look.label}: ${look.description}.`;
  // A planned source chip (PLAN.md#12.18) is not a watermark (real run 2.3: flagged off-intent).
  const chip = shot.annotations?.find((entry) => entry.kind === 'source-chip');
  return {
    lookId: look.id,
    lookRules: rules,
    ...(shot.roll === undefined ? {} : { roll: shot.roll }),
    ...(chip === undefined ? {} : { sourceChip: (chip.text ?? 'NAME').toUpperCase() }),
  };
}
