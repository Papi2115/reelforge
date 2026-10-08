/**
 * "Dad Hand": the stroke font of the Game B1 world (own CC0 data from the showcase's fonts.js):
 * polylines on a 4x6 unit grid with seeded jitter, slant and rotation, drawn stroke by stroke so a
 * word can be written on (`reveal`). Used for the gift tag, masking tape and the sticky notes.
 * `handStroke` is the pen line between two points with a seeded bow (underline, strike, tick).
 */
import type { IndexCanvas } from './canvas.js';
import { hash } from './math.js';

const STROKES: Readonly<Record<string, string>> = {
  A: '0,6 2,0 4,6|1,4 3,4',
  B: '0,6 0,0 3,0 4,1 3,3 0,3|3,3 4,4 4,5 3,6 0,6',
  C: '4,1 3,0 1,0 0,1 0,5 1,6 3,6 4,5',
  D: '0,0 0,6 2,6 4,4 4,2 2,0 0,0',
  E: '4,0 0,0 0,6 4,6|0,3 3,3',
  F: '4,0 0,0 0,6|0,3 3,3',
  G: '4,1 3,0 1,0 0,1 0,5 1,6 3,6 4,5 4,3 2,3',
  H: '0,0 0,6|4,0 4,6|0,3 4,3',
  I: '2,0 2,6|1,0 3,0|1,6 3,6',
  J: '4,0 4,5 3,6 1,6 0,5',
  K: '0,0 0,6|4,0 0,4|1,3 4,6',
  L: '0,0 0,6 4,6',
  M: '0,6 0,0 2,3 4,0 4,6',
  N: '0,6 0,0 4,6 4,0',
  O: '2,0 0,1 0,5 2,6 4,5 4,1 2,0',
  P: '0,6 0,0 3,0 4,1 4,2 3,3 0,3',
  Q: '2,0 0,1 0,5 2,6 4,5 4,1 2,0|2,4 4,6',
  R: '0,6 0,0 3,0 4,1 4,2 3,3 0,3|2,3 4,6',
  S: '4,1 3,0 1,0 0,1 0,2 1,3 3,3 4,4 4,5 3,6 1,6 0,5',
  T: '0,0 4,0|2,0 2,6',
  U: '0,0 0,5 1,6 3,6 4,5 4,0',
  V: '0,0 2,6 4,0',
  W: '0,0 1,6 2,3 3,6 4,0',
  X: '0,0 4,6|4,0 0,6',
  Y: '0,0 2,3 4,0|2,3 2,6',
  Z: '0,0 4,0 0,6 4,6',
  '0': '2,0 0,1 0,5 2,6 4,5 4,1 2,0',
  '1': '1,1 2,0 2,6',
  '2': '0,1 1,0 3,0 4,1 4,2 0,6 4,6',
  '3': '0,0 4,0 2,2 3,2 4,3 4,5 3,6 1,6 0,5',
  '4': '3,6 3,0 0,4 4,4',
  '5': '4,0 0,0 0,3 3,2 4,3 4,5 3,6 0,6',
  '6': '4,0 2,0 0,2 0,5 1,6 3,6 4,5 4,4 3,3 0,3',
  '7': '0,0 4,0 1,6',
  '8': '2,3 0,2 0,1 1,0 3,0 4,1 4,2 2,3 0,4 0,5 1,6 3,6 4,5 4,4 2,3',
  '9': '4,3 1,3 0,2 0,1 1,0 3,0 4,1 4,4 3,6 1,6',
  ':': '2,1.6 2,2.2|2,4.8 2,5.4',
  '.': '2,5.4 2,6',
  "'": '2,0 1.6,1.6',
  '-': '1,3.2 3,3',
  '?': '0,1 1,0 3,0 4,1 4,2 2,3 2,4|2,5.5 2,6',
  '!': '2,0 2,4|2,5.5 2,6',
};

type Pt = readonly [number, number];

const PATHS: ReadonlyMap<string, readonly (readonly Pt[])[]> = new Map(
  Object.entries(STROKES).map(([ch, spec]) => [
    ch,
    spec.split('|').map((stroke) =>
      stroke.split(' ').map((pair) => {
        const [x, y] = pair.split(',').map(Number);
        return [x ?? 0, y ?? 0] as const;
      }),
    ),
  ]),
);

/** Characters the hand cannot write (deduplicated); spaces are fine. */
export function missingHandGlyphs(text: string): string[] {
  const out: string[] = [];
  for (const ch of text) if (ch !== ' ' && !PATHS.has(ch) && !out.includes(ch)) out.push(ch);
  return out;
}

export interface HandOptions {
  readonly x: number;
  readonly y: number;
  /** Unit size in px (a letter is ~4 x 6 units). */
  readonly size: number;
  readonly angle?: number;
  readonly slant?: number;
  readonly seed: number;
  readonly colour: number;
  readonly brush?: number;
  /** 0..1 of the strokes drawn in pen order (undefined = all). */
  readonly reveal?: number;
}

function handPaths(text: string, o: HandOptions): { paths: Pt[][]; width: number } {
  const slant = o.slant ?? 0.18;
  const co = Math.cos(o.angle ?? 0);
  const si = Math.sin(o.angle ?? 0);
  const paths: Pt[][] = [];
  let cx = 0;
  let i = 0;
  for (const ch of text) {
    const strokes = PATHS.get(ch);
    if (ch === ' ' || strokes === undefined) {
      cx += ch === ' ' ? 3.2 + hash(o.seed, i, 5) * 0.8 : 0;
      i += 1;
      continue;
    }
    const squeeze = 0.86 + hash(o.seed, i, 6) * 0.22;
    const base = (hash(o.seed, i, 8) - 0.5) * 0.7;
    strokes.forEach((stroke, si2) => {
      paths.push(
        stroke.map(([px, py], pi) => {
          const jx = (hash(o.seed, i * 31 + si2 * 7 + pi, 1) - 0.5) * 0.5;
          const jy = (hash(o.seed, i * 31 + si2 * 7 + pi, 2) - 0.5) * 0.5;
          const lx = cx + px * squeeze + jx + (6 - py) * slant;
          const ly = py + jy + base;
          return [o.x + (lx * co - ly * si) * o.size, o.y + (lx * si + ly * co) * o.size] as const;
        }),
      );
    });
    cx += 4 * squeeze + 1.5 + hash(o.seed, i, 9) * 0.5;
    i += 1;
  }
  return { paths, width: cx * o.size };
}

/** Writes `text` by hand; returns its width in px. */
export function hand(cv: IndexCanvas, text: string, o: HandOptions): number {
  const { paths, width } = handPaths(text, o);
  const total = paths.reduce((sum, path) => sum + path.length - 1, 0);
  const limit = o.reveal === undefined ? total : Math.floor(total * o.reveal + 0.0001);
  let n = 0;
  for (const path of paths) {
    for (let k = 0; k + 1 < path.length; k += 1) {
      if (n >= limit) return width;
      const a = path[k] ?? [0, 0];
      const b = path[k + 1] ?? a;
      cv.line(a[0], a[1], b[0], b[1], o.colour, o.brush ?? 2);
      n += 1;
    }
  }
  return width;
}

/** A pen stroke from a to b with a seeded mid-bow (underline, strike, tick), drawn to `reveal`. */
export function handStroke(
  cv: IndexCanvas,
  a: Pt,
  b: Pt,
  o: { colour: number; seed: number; reveal?: number; bow?: number; brush?: number },
): void {
  const bow = (hash(o.seed, 1, 1) - 0.5) * (o.bow ?? 3);
  const steps = 8;
  const reveal = o.reveal ?? 1;
  const nx = -(b[1] - a[1]);
  const ny = b[0] - a[0];
  const len = Math.hypot(nx, ny) || 1;
  let px = a[0];
  let py = a[1];
  for (let i = 1; i <= Math.ceil(steps * reveal); i += 1) {
    const k = Math.min(1, i / steps);
    const bend = Math.sin(k * Math.PI) * bow;
    const qx = a[0] + (b[0] - a[0]) * k + (nx / len) * bend;
    const qy = a[1] + (b[1] - a[1]) * k + (ny / len) * bend;
    cv.line(px, py, qx, qy, o.colour, o.brush ?? 2);
    px = qx;
    py = qy;
  }
}
