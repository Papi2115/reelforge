/**
 * The generators' sketch pad (PLAN.md#13.15a): a seeded builder of doodle parts in local units,
 * so a generator reads like a person drawing (`d.blob(...)`, `d.line(...)`), and every number it
 * nudges with `d.r(...)` comes from the drawing's seed (two pines are never the same pine).
 */
import { rnd } from '../../draw/math.js';
import type { SwatchName } from '../../inks.js';
import type { DoodleInput, NibName, PartInput, Shade } from '../spec.js';

export interface Style {
  readonly nib?: NibName;
  readonly color?: SwatchName;
  readonly width?: number;
  readonly fill?: SwatchName | undefined;
  readonly shade?: Shade;
  readonly dir?: 1 | -1;
  readonly outline?: boolean;
  readonly wobble?: number;
}

type Flat = readonly number[];

export class Draft {
  readonly seed: number;
  readonly parts: PartInput[] = [];
  private salt = 0;

  constructor(seed: number) {
    this.seed = seed;
  }

  /** A seeded number in [lo, hi) (each call its own). */
  r(lo: number, hi: number): number {
    this.salt += 1;
    return rnd(lo, hi, this.seed, this.salt, 55);
  }

  /** A seeded choice. */
  pick<T>(items: readonly T[]): T {
    const item = items[Math.floor(this.r(0, items.length))] ?? items[0];
    if (item === undefined) throw new RangeError('pick: empty list');
    return item;
  }

  private add(part: PartInput): this {
    this.parts.push(part);
    return this;
  }

  private styled(style: Style): Style {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(style)) if (value !== undefined) out[key] = value;
    return out;
  }

  blob(
    cx: number,
    cy: number,
    rx: number,
    ry: number,
    s: Style & { lumps?: number; rot?: number } = {},
  ): this {
    return this.add({ blob: [cx, cy, rx, ry], ...this.styled(s) });
  }
  circle(cx: number, cy: number, r: number, s: Style = {}): this {
    return this.add({ circle: [cx, cy, r], ...this.styled(s) });
  }
  rect(x: number, y: number, w: number, h: number, s: Style = {}): this {
    return this.add({ rect: [x, y, w, h], ...this.styled(s) });
  }
  poly(points: Flat, s: Style = {}): this {
    return this.add({ poly: [...points], ...this.styled(s) });
  }
  line(points: Flat, s: Style & { arrow?: boolean } = {}): this {
    return this.add({ line: [...points], ...this.styled(s) });
  }
  sharp(points: Flat, s: Style = {}): this {
    return this.add({ line: [...points], sharp: true, ...this.styled(s) });
  }
  arc(cx: number, cy: number, r: number, from: number, to: number, s: Style = {}): this {
    return this.add({ arc: [cx, cy, r, from, to], ...this.styled(s) });
  }
  dots(points: Flat, size = 2, s: Style = {}): this {
    if (points.length < 2) return this;
    return this.add({ dots: [...points], size, ...this.styled(s) });
  }
  rays(
    cx: number,
    cy: number,
    r0: number,
    r1: number,
    count: number,
    s: Style & { from?: number; to?: number } = {},
  ): this {
    return this.add({ rays: [cx, cy, r0, r1], count, ...this.styled(s) });
  }
  hatch(points: Flat, color: SwatchName, s: Style = {}): this {
    return this.add({ hatch: [...points], color, ...this.styled(s) });
  }
  scribble(points: Flat, s: Style & { spacing?: number; angle?: number } = {}): this {
    return this.add({ scribble: [...points], ...this.styled(s) });
  }
  zigzag(
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    teeth: number,
    amp: number,
    s: Style = {},
  ): this {
    return this.add({ zigzag: [x0, y0, x1, y1], teeth, amp, ...this.styled(s) });
  }
  wave(x0: number, y: number, x1: number, count: number, amp: number, s: Style = {}): this {
    return this.add({ wave: [x0, y, x1], count, amp, ...this.styled(s) });
  }

  done(box: readonly [number, number], grip?: readonly [number, number]): DoodleInput {
    return { box, parts: this.parts, ...(grip ? { grip } : {}) };
  }
}

/** Fill shorthands (a crayon fill in an ink). */
export const fill = (color: SwatchName | undefined, shade: Shade = 'hatch'): Style => ({
  fill: color,
  shade,
});
export const pale: Style = { nib: 'pencil' };
export const thin: Style = { nib: 'fine' };
