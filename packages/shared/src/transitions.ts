/**
 * Transition kit metadata (PLAN.md#12.15, ADR-011): the pixel transitions a storyboard can name in
 * `transitionIn.style`. The engine owns the compositing (`packages/engine/src/transitions/`); this
 * table is what storyboards, the validator, the sound director and the picker share. Docs:
 * docs/transitions.md.
 */
import type { Roll } from './storyboard.js';

/** Wow transitions (ADR-028): rare showpieces, chosen by content. */
export const WOW_STYLE_IDS = [
  'enter-lens',
  'enter-binoculars',
  'enter-window',
  'enter-keyhole',
  'paper-roll',
  'cube-smash',
  'sponge-wipe',
  'page-turn',
  'shatter',
  'dive-in',
  'dive-out',
] as const;
export type WowStyleId = (typeof WOW_STYLE_IDS)[number];

export const TRANSITION_STYLE_IDS = [
  'pixel-wipe',
  'dither-dissolve',
  'glitch-cut',
  'iris',
  'scanline-sweep',
  'mosaic-reveal',
  'crt-zoom',
  'tile-flip',
  'draw-over',
  'pixel-sort-melt',
  ...WOW_STYLE_IDS,
] as const;
export type TransitionStyleId = (typeof TRANSITION_STYLE_IDS)[number];

/** Families of the wow transitions (ADR-028). */
export const WOW_FAMILIES = ['enter', 'texture', 'dive'] as const;
export type WowFamily = (typeof WOW_FAMILIES)[number];

/** Look id or `*` (any look). */
export type LookPattern = string;

/** A look pair a style suits: `from` -> `to`, `*` = any look; `rolls` = one side has one of them. */
export interface TransitionPair {
  readonly from: LookPattern;
  readonly to: LookPattern;
  readonly rolls?: readonly Roll[];
}

export interface TransitionDuration {
  readonly min: number;
  readonly max: number;
  /** What the picker writes. */
  readonly default: number;
}

export interface TransitionStyle {
  readonly id: TransitionStyleId;
  readonly label: string;
  /** One line for the storyboard prompt and the docs. */
  readonly description: string;
  /** Plain transition type it belongs to (sound, act detection, fallback rendering). */
  readonly type: 'crossfade' | 'glitch' | 'wipe';
  readonly duration: TransitionDuration;
  readonly pairs: readonly TransitionPair[];
  /** Look-change special: only where the look changes (validator error otherwise). */
  readonly lookChange: boolean;
  readonly vibe: readonly string[];
  /**
   * Wow transition (ADR-028): a rare showpiece chosen by content, with its own budget (about one
   * per 40–90 s, never two in a row except a scale sequence). Absent on the other styles.
   */
  readonly wow?: WowInfo;
}

export interface WowInfo {
  readonly family: WowFamily;
  /** What the shot is about when this style fits (the storyboard chooses by content). */
  readonly content: readonly string[];
  /** The style uses `transitionIn.focus` (the subject point it enters, breaks at or dives into). */
  readonly focus: boolean;
}

const ANY: readonly TransitionPair[] = [{ from: '*', to: '*' }];

const both = (look: string): readonly TransitionPair[] => [
  { from: '*', to: look },
  { from: look, to: '*' },
];

interface WowStyleSpec {
  readonly label: string;
  readonly description: string;
  readonly type: TransitionStyle['type'];
  readonly duration: TransitionDuration;
  readonly family: WowFamily;
  readonly content: readonly string[];
  readonly focus: boolean;
  readonly vibe: readonly string[];
}

const wowStyle = (id: WowStyleId, spec: WowStyleSpec): TransitionStyle => ({
  id,
  label: spec.label,
  description: spec.description,
  type: spec.type,
  duration: spec.duration,
  pairs: ANY,
  lookChange: false,
  vibe: spec.vibe,
  wow: { family: spec.family, content: spec.content, focus: spec.focus },
});

/** The wow transitions (ADR-028): any look pair, durations 0.5–1.4 s. */
const WOW_STYLES: Readonly<Record<WowStyleId, TransitionStyle>> = {
  'enter-lens': wowStyle('enter-lens', {
    label: 'Enter: lens',
    description:
      'a magnifying glass pops onto the focus point, the subject resolves into the new shot inside it, then the lens rushes at the camera',
    type: 'wipe',
    duration: { min: 0.7, max: 1.3, default: 1 },
    family: 'enter',
    content: ['surveillance', 'search', 'detail', 'investigation', 'evidence', 'clue'],
    focus: true,
    vibe: ['focus', 'curious'],
  }),
  'enter-binoculars': wowStyle('enter-binoculars', {
    label: 'Enter: binoculars',
    description:
      'a binocular mask closes on the focus point, the view zooms and refocuses on the new shot, then the mask opens',
    type: 'wipe',
    duration: { min: 0.8, max: 1.4, default: 1.1 },
    family: 'enter',
    content: ['watching', 'distance', 'spying', 'lookout', 'wildlife', 'horizon'],
    focus: true,
    vibe: ['tense', 'cinematic'],
  }),
  'enter-window': wowStyle('enter-window', {
    label: 'Enter: window',
    description:
      'a framed window opens on the focus point with the new shot behind the glass, then the camera flies through it',
    type: 'wipe',
    duration: { min: 0.6, max: 1.2, default: 0.9 },
    family: 'enter',
    content: ['place', 'people', 'home', 'building', 'inside', 'neighbourhood'],
    focus: true,
    vibe: ['warm', 'cinematic'],
  }),
  'enter-keyhole': wowStyle('enter-keyhole', {
    label: 'Enter: keyhole',
    description:
      'a dark door with a brass keyhole closes around the focus point, the new shot shows through the keyhole, then the camera pushes through',
    type: 'wipe',
    duration: { min: 0.8, max: 1.4, default: 1.1 },
    family: 'enter',
    content: ['secret', 'hidden', 'private', 'locked', 'conspiracy', 'mystery'],
    focus: true,
    vibe: ['mysterious', 'tense'],
  }),
  'paper-roll': wowStyle('paper-roll', {
    label: 'Paper roll',
    description:
      'the picture rolls up like a sheet of paper from one edge, revealing the new shot under it',
    type: 'wipe',
    duration: { min: 0.6, max: 1.2, default: 0.9 },
    family: 'texture',
    content: ['documents', 'records', 'archive', 'scroll', 'map', 'contract'],
    focus: false,
    vibe: ['tactile', 'calm'],
  }),
  'cube-smash': wowStyle('cube-smash', {
    label: 'Cube smash',
    description:
      'voxel cubes fly at the screen, cracks run along block seams and the picture falls apart in blocks onto the new shot',
    type: 'glitch',
    duration: { min: 0.8, max: 1.4, default: 1.1 },
    family: 'texture',
    content: ['games', 'digital', 'collapse', 'destruction', 'blocks', 'disruption'],
    focus: true,
    vibe: ['energetic', 'playful'],
  }),
  'sponge-wipe': wowStyle('sponge-wipe', {
    label: 'Sponge wipe',
    description:
      'a kitchen sponge scrubs back and forth across the picture, wiping it off like a whiteboard and leaving wet streaks',
    type: 'wipe',
    duration: { min: 0.8, max: 1.4, default: 1.1 },
    family: 'texture',
    content: ['correction', 'explanation', 'whiteboard', 'cleaning', 'reset', 'mistake'],
    focus: false,
    vibe: ['playful', 'tactile'],
  }),
  'page-turn': wowStyle('page-turn', {
    label: 'Page turn',
    description: 'the picture peels off from a corner like a book page, its back shaded in dither',
    type: 'wipe',
    duration: { min: 0.6, max: 1.2, default: 0.9 },
    family: 'texture',
    content: ['history', 'books', 'chapter', 'story', 'diary', 'past'],
    focus: false,
    vibe: ['calm', 'storybook'],
  }),
  shatter: wowStyle('shatter', {
    label: 'Shatter',
    description:
      'the picture cracks like glass from the focus point into a web of shards that drop away onto the new shot',
    type: 'glitch',
    duration: { min: 0.7, max: 1.3, default: 1 },
    family: 'texture',
    content: ['failure', 'crash', 'security', 'breach', 'shock', 'broken'],
    focus: true,
    vibe: ['dramatic', 'tense'],
  }),
  'dive-in': wowStyle('dive-in', {
    label: 'Dive in',
    description:
      'the camera dives into the focus point up to 8x, the pixels grow, and the new shot settles out of the same point',
    type: 'crossfade',
    duration: { min: 0.6, max: 1.2, default: 0.9 },
    family: 'dive',
    content: ['scale', 'zoom', 'micro', 'inside', 'cells', 'atoms'],
    focus: true,
    vibe: ['epic', 'energetic'],
  }),
  'dive-out': wowStyle('dive-out', {
    label: 'Dive out',
    description:
      'the camera pulls back: the picture shrinks into the focus point of the new shot, which sharpens around it',
    type: 'crossfade',
    duration: { min: 0.6, max: 1.2, default: 0.9 },
    family: 'dive',
    content: ['scale', 'space', 'zoom', 'city', 'planet', 'big picture'],
    focus: true,
    vibe: ['epic', 'calm'],
  }),
};

export const TRANSITION_STYLES: Readonly<Record<TransitionStyleId, TransitionStyle>> = {
  'pixel-wipe': {
    id: 'pixel-wipe',
    label: 'Pixel wipe',
    description:
      'a blocky stair-stepped edge with a dithered fringe sweeps across (direction from the seed)',
    type: 'wipe',
    duration: { min: 0.25, max: 0.6, default: 0.4 },
    pairs: ANY,
    lookChange: false,
    vibe: ['clean', 'brisk'],
  },
  'dither-dissolve': {
    id: 'dither-dissolve',
    label: 'Dither dissolve',
    description: 'an ordered (Bayer) dissolve in 2x2 pixel cells: the retro crossfade',
    type: 'crossfade',
    duration: { min: 0.3, max: 0.8, default: 0.5 },
    pairs: ANY,
    lookChange: false,
    vibe: ['calm', 'soft'],
  },
  'glitch-cut': {
    id: 'glitch-cut',
    label: 'Glitch cut',
    description: 'displaced rows and blocks with palette tone swaps, then a hard cut',
    type: 'glitch',
    duration: { min: 0.2, max: 0.45, default: 0.3 },
    pairs: ANY,
    lookChange: false,
    vibe: ['energetic', 'tense'],
  },
  iris: {
    id: 'iris',
    label: 'Iris',
    description: 'a stair-stepped pixel circle opens from the centre with a bright rim',
    type: 'wipe',
    duration: { min: 0.3, max: 0.7, default: 0.5 },
    pairs: ANY,
    lookChange: false,
    vibe: ['playful', 'focus'],
  },
  'scanline-sweep': {
    id: 'scanline-sweep',
    label: 'Scanline sweep',
    description:
      'the new shot is drawn in interlaced lines, top to bottom, behind a bright scan line',
    type: 'wipe',
    duration: { min: 0.3, max: 0.6, default: 0.45 },
    pairs: ANY,
    lookChange: false,
    vibe: ['tech', 'retro'],
  },
  'mosaic-reveal': {
    id: 'mosaic-reveal',
    label: 'Mosaic reveal',
    description:
      'the picture breaks into growing pixel blocks that flip tile by tile, then sharpen',
    type: 'crossfade',
    duration: { min: 0.3, max: 0.7, default: 0.5 },
    pairs: ANY,
    lookChange: false,
    vibe: ['playful', 'data'],
  },
  'crt-zoom': {
    id: 'crt-zoom',
    label: 'CRT zoom',
    description:
      'zoom into the screen centre, the tube powers off to a line, the new shot powers on',
    type: 'glitch',
    duration: { min: 0.5, max: 0.8, default: 0.7 },
    pairs: both('retro-ui'),
    lookChange: true,
    vibe: ['retro', 'tech'],
  },
  'tile-flip': {
    id: 'tile-flip',
    label: 'Tile flip',
    description: 'a diagonal wave of tiles flips over in a checker (diorama tiles)',
    type: 'wipe',
    duration: { min: 0.5, max: 0.8, default: 0.7 },
    pairs: both('diorama'),
    lookChange: true,
    vibe: ['playful', 'structured'],
  },
  'draw-over': {
    id: 'draw-over',
    label: 'Draw over',
    description:
      'a blueprint pen line sweeps across, construction lines ahead, the new shot drawn behind',
    type: 'wipe',
    duration: { min: 0.4, max: 0.8, default: 0.6 },
    pairs: both('blueprint'),
    lookChange: true,
    vibe: ['data', 'precise'],
  },
  'pixel-sort-melt': {
    id: 'pixel-sort-melt',
    label: 'Pixel-sort melt',
    description: 'columns melt down with luma-sorted streaks, revealing the new shot (C-rolls)',
    type: 'glitch',
    duration: { min: 0.4, max: 0.8, default: 0.6 },
    pairs: [{ from: '*', to: '*', rolls: ['C'] }],
    lookChange: true,
    vibe: ['dreamy', 'atmosphere'],
  },
  ...WOW_STYLES,
};

/** Every style in declaration order. */
export const TRANSITION_STYLE_LIST: readonly TransitionStyle[] = TRANSITION_STYLE_IDS.map(
  (id) => TRANSITION_STYLES[id],
);

export function isTransitionStyleId(id: string): id is TransitionStyleId {
  return (TRANSITION_STYLE_IDS as readonly string[]).includes(id);
}

export function getTransitionStyle(id: string | undefined): TransitionStyle | undefined {
  return id !== undefined && isTransitionStyleId(id) ? TRANSITION_STYLES[id] : undefined;
}

/** The wow transitions in declaration order. */
export const WOW_STYLE_LIST: readonly TransitionStyle[] = WOW_STYLE_IDS.map(
  (id) => TRANSITION_STYLES[id],
);

/** The wow info of a style id (undefined: not a wow transition or unknown). */
export function wowInfo(style: string | undefined): WowInfo | undefined {
  return getTransitionStyle(style)?.wow;
}

export function isWowStyle(style: string | undefined): style is WowStyleId {
  return wowInfo(style) !== undefined;
}

/** Rolls of the two shots a transition joins (absent = untagged). */
export interface TransitionRolls {
  readonly from?: Roll | undefined;
  readonly to?: Roll | undefined;
}

const lookMatches = (pattern: LookPattern, look: string): boolean =>
  pattern === '*' || pattern === look;

/** True when `style` may join a `fromLook` shot to a `toLook` shot. */
export function transitionSuits(
  style: TransitionStyle,
  fromLook: string,
  toLook: string,
  rolls: TransitionRolls = {},
): boolean {
  if (style.lookChange && fromLook === toLook) return false;
  return style.pairs.some(
    (pair) =>
      lookMatches(pair.from, fromLook) &&
      lookMatches(pair.to, toLook) &&
      (pair.rolls === undefined ||
        pair.rolls.some((roll) => roll === rolls.from || roll === rolls.to)),
  );
}

/** `* -> retro-ui, retro-ui -> *` (with `, C-roll` where rolls are required). */
export function describePairs(style: TransitionStyle): string {
  return style.pairs
    .map((pair) => {
      const rolls = pair.rolls === undefined ? '' : ` (a ${pair.rolls.join('/')}-roll side)`;
      return `${pair.from} -> ${pair.to}${rolls}`;
    })
    .join(', ');
}
