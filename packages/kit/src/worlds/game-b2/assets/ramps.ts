/**
 * The Game B2 palette as RAMPS (dark -> light), the vocabulary of the open authoring layer: a
 * sprite or texture legend names a ramp step (`leaf.2`) or a swatch (`sage`), never a hex, so
 * every project-made asset stays inside the world's 32 colours and shades like the showcase
 * (light from the upper left, one or two steps per form, Bayer dither between steps).
 */
import { bayer } from '../core/rand.js';
import { B2_SWATCHES, C, colorOfSwatch } from '../palette.js';

/** Named ramps of the 32 colours, darkest first. */
export const RAMPS = {
  warm: [C.UMBER, C.BROWN, C.WOOD, C.TAN, C.TUNGSTEN, C.BULB],
  leaf: [C.MOSS_D, C.MOSS, C.GREEN, C.SAGE, C.FLUO, C.TUBE],
  sky: [C.NIGHT_D, C.NIGHT, C.DUSK, C.HAZE, C.MOON],
  earth: [C.DIRT_D, C.DIRT, C.SAND, C.SAND_L, C.PAPER],
  stone: [C.VOID, C.CHAR, C.SLATE, C.GREY, C.PUTTY, C.PAPER],
  rust: [C.UMBER, C.BROWN, C.CLAY, C.TUNGSTEN, C.BULB],
  plum: [C.VOID, C.SHADOW, C.PLUM, C.DUSK],
  accent: [C.ACCENT_D, C.ACCENT],
} as const satisfies Readonly<Record<string, readonly number[]>>;

export type RampName = keyof typeof RAMPS;
export const RAMP_NAMES = Object.keys(RAMPS) as readonly RampName[];
export type Ramp = readonly number[];

/** One line for errors and docs: `warm 0-5, leaf 0-5, ...`. */
export const RAMP_HELP = RAMP_NAMES.map(
  (name) => `${name} 0-${String(RAMPS[name].length - 1)}`,
).join(', ');

export function rampOf(name: RampName): Ramp {
  return RAMPS[name];
}

export function isRampName(value: string): value is RampName {
  return (RAMP_NAMES as readonly string[]).includes(value);
}

/**
 * A colour reference of the authoring layer -> palette index: a swatch name (`sage`, `pink`) or a
 * ramp step (`leaf.3`); undefined when it is neither.
 */
export function colourRef(ref: string): number | undefined {
  const dot = /^([a-z]+)\.(\d)$/.exec(ref);
  if (dot !== null) {
    const name = dot[1] ?? '';
    const step = Number(dot[2]);
    return isRampName(name) ? RAMPS[name][step] : undefined;
  }
  return colorOfSwatch(ref);
}

export function colourRefHelp(ref: string): string {
  return `"${ref}" is not a game-b2 colour: use a swatch (${B2_SWATCHES.slice(0, 6).join(', ')}, ...) or a ramp step like leaf.2 (ramps: ${RAMP_HELP})`;
}

/**
 * The ramp colour of a shade value (0 = darkest .. 1 = lightest of [lo, hi] steps), dithered
 * between the two nearest steps with the 4x4 Bayer matrix at (x, y): the showcase's shading.
 */
export function rampAt(
  ramp: Ramp,
  value: number,
  x: number,
  y: number,
  lo = 0,
  hi?: number,
): number {
  const top = Math.min(ramp.length - 1, hi ?? ramp.length - 1);
  const span = Math.max(0, top - lo);
  const v = Math.max(0, Math.min(1, value)) * span;
  const base = Math.floor(v);
  const step = v - base > bayer(x, y) ? base + 1 : base;
  return ramp[lo + Math.min(span, step)] ?? ramp[0] ?? C.VOID;
}
