/**
 * Print textures of the Comic page: halftone screens (dots of one ink on a rotated grid), ordered
 * dither between two inks, layered paints. All are patterns of whole palette inks (a halftone dot
 * is ink or not), so the page stays palette-pure at any tone.
 */
import type { Paint } from './canvas.js';

const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5] as const;

/** A tone 0..1, constant or per pixel. */
export type Tone = number | ((x: number, y: number) => number);

export interface HalftoneOptions {
  /** Cell size in px (default 4). */
  readonly cell?: number | undefined;
  /** Screen angle in radians (default 0.26). */
  readonly angle?: number | undefined;
  /** Grid origin offset (a plate slipped by a pixel). */
  readonly ox?: number | undefined;
  readonly oy?: number | undefined;
  /** Colour between the dots (default -1 = transparent). */
  readonly bg?: number | undefined;
}

/**
 * The print screen in use: every halftone gets cell x cellMul and angle + angleAdd (an older print
 * job is screened coarser at another angle). Owned by the page, reset every frame.
 */
export interface Screen {
  cellMul: number;
  angleAdd: number;
}

export const DEFAULT_SCREEN: Readonly<Screen> = Object.freeze({ cellMul: 1, angleAdd: 0 });

function toneAt(tone: Tone, x: number, y: number): number {
  return typeof tone === 'number' ? tone : tone(x, y);
}

/** Dots of `ink` on a rotated grid; tone 0..1 (0 = none, ~1 = dots touching). */
export function halftone(
  ink: number,
  tone: Tone,
  options: HalftoneOptions = {},
  screen: Readonly<Screen> = DEFAULT_SCREEN,
): (x: number, y: number) => number {
  const cell = (options.cell ?? 4) * screen.cellMul;
  const angle = (options.angle ?? 0.26) + screen.angleAdd;
  const ca = Math.cos(angle);
  const sa = Math.sin(angle);
  const ox = options.ox ?? 0;
  const oy = options.oy ?? 0;
  const bg = options.bg ?? -1;
  return (x, y) => {
    const tx = x + 0.5 - ox;
    const ty = y + 0.5 - oy;
    const u = (tx * ca + ty * sa) / cell;
    const v = (-tx * sa + ty * ca) / cell;
    const fu = u - Math.floor(u) - 0.5;
    const fv = v - Math.floor(v) - 0.5;
    const level = toneAt(tone, x, y);
    if (level <= 0) return bg;
    return fu * fu + fv * fv < level * 0.32 ? ink : bg;
  };
}

/** Ordered dither between two inks: level 0 = all a, 1 = all b (-1 = transparent). */
export function dither(a: number, b: number, level: Tone): (x: number, y: number) => number {
  return (x, y) => ((BAYER4[(y & 3) * 4 + (x & 3)] ?? 0) < toneAt(level, x, y) * 16 ? b : a);
}

/** Layered paint: the first non-transparent one wins. */
export function layer(...paints: readonly Paint[]): (x: number, y: number) => number {
  return (x, y) => {
    for (const paint of paints) {
      const color = typeof paint === 'number' ? paint : paint(x, y);
      if (color >= 0) return color;
    }
    return -1;
  };
}
