/**
 * Generic printed-comic art the pen offers (so scenes spend their code on the subject): a
 * halftone ground under a curved horizon with seeded craters or pits, and seven-segment digits
 * (clocks, counters, displays). Both are ports of the showcase's art.js.
 */
import { clamp01 } from '../draw/math.js';
import type { ComicPen, PaintArg } from './pen.js';

export interface GroundOptions {
  readonly x0: number;
  readonly x1: number;
  /** Horizon y at `xc`. */
  readonly horizon: number;
  /** Bottom of the ground fill. */
  readonly bottom: number;
  readonly xc?: number | undefined;
  /** Horizon curvature radius (larger = flatter; default flat). */
  readonly radius?: number | undefined;
  /** Horizon slope (y per x). */
  readonly tilt?: number | undefined;
  readonly craters?: number | undefined;
  readonly craterScale?: number | undefined;
  /** Dot ink, paper-side ink and shadow ink of the ground. */
  readonly ink?: string | undefined;
  readonly on?: string | undefined;
  readonly shadow?: string | undefined;
  readonly cell?: number | undefined;
  readonly key?: string | undefined;
}

/** Bowl seen obliquely, sun from the left: shadowed left wall, lit floor, an inked lip. */
function crater(
  g: ComicPen,
  at: readonly [number, number, number],
  inks: { ink: string; on: string; shadow: string },
): void {
  const [x, y, r] = at;
  const strong = r > 11;
  const F = g.plate;
  const ry = r * 0.4;
  const lx = F.x(x + r * 0.36);
  const ly = F.y(y - ry * 0.1);
  const lr = r * F.s * 0.86;
  const lry = ry * F.s * 0.86;
  const floor = strong ? g.color(inks.on) : g.tone(inks.ink, 0.3, { on: inks.on });
  const shadow = g.color(strong ? inks.shadow : inks.ink);
  F.ellipse(x, y, r, ry, (sx, sy) => {
    const dx = (sx + 0.5 - lx) / lr;
    const dy = (sy + 0.5 - ly) / lry;
    if (dx * dx + dy * dy >= 1) return shadow;
    return typeof floor === 'number' ? floor : floor(sx, sy);
  });
  if (!strong || r * g.s <= 6) return;
  const lip: number[] = [];
  for (let i = 0; i <= 9; i += 1) {
    const a = Math.PI * (0.95 + i * 0.11);
    lip.push(x + Math.cos(a) * r, y + Math.sin(a) * ry);
  }
  g.polyline(lip, 'ink', { w: 1 });
}

/** Ground under a curved horizon: halftone thickening toward the viewer, craters, inked edge. */
export function ground(g: ComicPen, o: GroundOptions): (x: number) => number {
  const xc = o.xc ?? (o.x0 + o.x1) / 2;
  const radius = o.radius ?? 1e9;
  const tilt = o.tilt ?? 0;
  const key = o.key ?? 'ground';
  const horizonAt = (x: number) => o.horizon + ((x - xc) * (x - xc)) / (2 * radius) + tilt * x;
  const edge: number[] = [];
  for (let x = o.x0; x <= o.x1 + 0.1; x += (o.x1 - o.x0) / 24) edge.push(x, horizonAt(x));
  const inks = { ink: o.ink ?? 'greyMid', on: o.on ?? 'greyLight', shadow: o.shadow ?? 'greyDark' };
  const tone = (_lx: number, ly: number) =>
    0.12 + 0.33 * clamp01((ly - o.horizon) / (o.bottom - o.horizon));
  g.plate.poly(
    [...edge, o.x1, o.bottom, o.x0, o.bottom],
    g.tone(inks.ink, tone, { cell: o.cell ?? 4, angle: 0.78, on: inks.on }),
  );
  for (let i = 0; i < (o.craters ?? 14); i += 1) {
    const x = g.range(key, i, o.x0, o.x1);
    const depth = g.rnd(key, i + 50);
    const y = horizonAt(x) + 4 + depth * depth * (o.bottom - horizonAt(x) - 6);
    const r = (2 + depth * 22 * (o.craterScale ?? 1)) * (0.6 + g.rnd(key, i + 99) * 0.6);
    crater(g, [x, y, r], inks);
  }
  g.ink(edge, { closed: false, boil: 0.6, key: `${key}edge` });
  return horizonAt;
}

const SEGMENTS: Readonly<Record<string, string>> = {
  '0': 'abcdef',
  '1': 'bc',
  '2': 'abged',
  '3': 'abgcd',
  '4': 'fgbc',
  '5': 'afgcd',
  '6': 'afgedc',
  '7': 'abc',
  '8': 'abcdefg',
  '9': 'abcdfg',
  '-': 'g',
};

/** Seven-segment digits (top left at x, y; each digit w x h local units, 2 apart). */
export function digits(
  g: ComicPen,
  text: string,
  x: number,
  y: number,
  options: { w?: number; h?: number; color?: PaintArg } = {},
): void {
  const w = options.w ?? 6;
  const h = options.h ?? 10;
  const color = options.color ?? 'phosphor';
  const t = Math.max(1.2, w * 0.2);
  const m = h / 2;
  Array.from(text).forEach((char, i) => {
    const on = SEGMENTS[char];
    if (on === undefined) return;
    const dx = x + i * (w + 2);
    const bars: Readonly<Record<string, readonly [number, number, number, number]>> = {
      a: [dx + t * 0.6, y, w - t * 1.2, t],
      d: [dx + t * 0.6, y + h - t, w - t * 1.2, t],
      g: [dx + t * 0.6, y + m - t / 2, w - t * 1.2, t],
      f: [dx, y + t * 0.5, t, m - t * 0.6],
      b: [dx + w - t, y + t * 0.5, t, m - t * 0.6],
      e: [dx, y + m + t * 0.1, t, m - t * 0.6],
      c: [dx + w - t, y + m + t * 0.1, t, m - t * 0.6],
    };
    for (const segment of on) {
      const [bx, by, bw, bh] = bars[segment] ?? [0, 0, 0, 0];
      g.poly([bx + 0.4, by, bx + bw, by, bx + bw - 0.4, by + bh, bx, by + bh], color);
    }
  });
}
