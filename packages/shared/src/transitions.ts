/**
 * Transition kit metadata (PLAN.md#12.15, ADR-011): the pixel transitions a storyboard can name in
 * `transitionIn.style`. The engine owns the compositing (`packages/engine/src/transitions/`); this
 * table is what storyboards, the validator, the sound director and the picker share. Docs:
 * docs/transitions.md.
 */
import type { Roll } from './storyboard.js';

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
] as const;
export type TransitionStyleId = (typeof TRANSITION_STYLE_IDS)[number];

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
}

const ANY: readonly TransitionPair[] = [{ from: '*', to: '*' }];

const both = (look: string): readonly TransitionPair[] => [
  { from: '*', to: look },
  { from: look, to: '*' },
];

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
