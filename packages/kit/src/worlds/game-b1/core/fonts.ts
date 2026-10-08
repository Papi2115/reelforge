/**
 * The Game B1 bitmap faces (own CC0 glyph tables from the showcase's fonts.js, docs/licenses.md):
 * - Joy 5x6: rounded menu caps, used at 2x for UI labels, the HUD and the dialogue box.
 * - Score Block: the 2600 score kernel on wide cells (year odometer, score, the boss's big digit).
 * - Box Art: Joy made bold, italic-sheared and extruded with a dark keyline (boss name plates).
 * Lower-case input is upper-cased by the callers; characters without a glyph are reported.
 */
import type { IndexCanvas } from './canvas.js';

const JOY: Readonly<Record<string, readonly string[]>> = {
  A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#'],
  B: ['####.', '#...#', '####.', '#...#', '#...#', '####.'],
  C: ['.####', '#....', '#....', '#....', '#....', '.####'],
  D: ['####.', '#...#', '#...#', '#...#', '#...#', '####.'],
  E: ['#####', '#....', '####.', '#....', '#....', '#####'],
  F: ['#####', '#....', '####.', '#....', '#....', '#....'],
  G: ['.####', '#....', '#..##', '#...#', '#...#', '.###.'],
  H: ['#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  I: ['###', '.#.', '.#.', '.#.', '.#.', '###'],
  J: ['..###', '...#.', '...#.', '...#.', '#..#.', '.##..'],
  K: ['#...#', '#..#.', '###..', '#..#.', '#...#', '#...#'],
  L: ['#....', '#....', '#....', '#....', '#....', '#####'],
  M: ['#...#', '##.##', '#.#.#', '#...#', '#...#', '#...#'],
  N: ['#...#', '##..#', '#.#.#', '#..##', '#...#', '#...#'],
  O: ['.###.', '#...#', '#...#', '#...#', '#...#', '.###.'],
  P: ['####.', '#...#', '#...#', '####.', '#....', '#....'],
  Q: ['.###.', '#...#', '#...#', '#...#', '#..#.', '.##.#'],
  R: ['####.', '#...#', '#...#', '####.', '#..#.', '#...#'],
  S: ['.####', '#....', '.###.', '....#', '....#', '####.'],
  T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..'],
  U: ['#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  V: ['#...#', '#...#', '#...#', '.#.#.', '.#.#.', '..#..'],
  W: ['#...#', '#...#', '#...#', '#.#.#', '##.##', '#...#'],
  X: ['#...#', '.#.#.', '..#..', '..#..', '.#.#.', '#...#'],
  Y: ['#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'],
  Z: ['#####', '...#.', '..#..', '.#...', '#....', '#####'],
  '0': ['.##.', '#..#', '#..#', '#..#', '#..#', '.##.'],
  '1': ['.#.', '##.', '.#.', '.#.', '.#.', '###'],
  '2': ['.##.', '#..#', '..#.', '.#..', '#...', '####'],
  '3': ['###.', '...#', '.##.', '...#', '...#', '###.'],
  '4': ['#..#', '#..#', '####', '...#', '...#', '...#'],
  '5': ['####', '#...', '###.', '...#', '...#', '###.'],
  '6': ['.##.', '#...', '###.', '#..#', '#..#', '.##.'],
  '7': ['####', '...#', '..#.', '.#..', '.#..', '.#..'],
  '8': ['.##.', '#..#', '.##.', '#..#', '#..#', '.##.'],
  '9': ['.##.', '#..#', '#..#', '.###', '...#', '.##.'],
  '.': ['.', '.', '.', '.', '.', '#'],
  ',': ['.', '.', '.', '.', '#', '#'],
  ':': ['.', '#', '.', '.', '#', '.'],
  "'": ['#', '#', '.', '.', '.', '.'],
  '-': ['...', '...', '###', '...', '...', '...'],
  '?': ['###.', '...#', '..#.', '.#..', '....', '.#..'],
  '!': ['#', '#', '#', '#', '.', '#'],
  '/': ['...#', '..#.', '..#.', '.#..', '.#..', '#...'],
  '·': ['.', '.', '#', '.', '.', '.'],
  '²': ['##.', '..#', '.#.', '###', '...', '...'],
  ' ': ['..', '..', '..', '..', '..', '..'],
};

const SCORE: Readonly<Record<string, readonly string[]>> = {
  '0': ['####', '#..#', '#..#', '#..#', '####'],
  '1': ['.##.', '..#.', '..#.', '..#.', '.###'],
  '2': ['####', '...#', '####', '#...', '####'],
  '3': ['####', '...#', '.###', '...#', '####'],
  '4': ['#..#', '#..#', '####', '...#', '...#'],
  '5': ['####', '#...', '####', '...#', '####'],
  '6': ['####', '#...', '####', '#..#', '####'],
  '7': ['####', '...#', '..#.', '..#.', '..#.'],
  '8': ['####', '#..#', '####', '#..#', '####'],
  '9': ['####', '#..#', '####', '...#', '####'],
  C: ['####', '#...', '#...', '#...', '####'],
  O: ['####', '#..#', '#..#', '#..#', '####'],
  N: ['#...#', '##..#', '#.#.#', '#..##', '#...#'],
  T: ['#####', '..#..', '..#..', '..#..', '..#..'],
  I: ['###', '.#.', '.#.', '.#.', '###'],
  U: ['#..#', '#..#', '#..#', '#..#', '####'],
  E: ['####', '#...', '###.', '#...', '####'],
  '?': ['####', '...#', '.##.', '....', '.#..'],
  ' ': ['..', '..', '..', '..', '..'],
};

export type FaceId = 'joy' | 'score';

/** Characters of `text` the face cannot draw (deduplicated, in order). */
export function missingGlyphs(text: string, face: FaceId): string[] {
  const table = face === 'joy' ? JOY : SCORE;
  const out: string[] = [];
  for (const ch of text)
    if (ch !== '\n' && table[ch] === undefined && !out.includes(ch)) out.push(ch);
  return out;
}

function joyGlyph(ch: string): readonly string[] {
  return JOY[ch] ?? JOY[' '] ?? [];
}

function scoreGlyphRows(ch: string): readonly string[] {
  return SCORE[ch] ?? SCORE[' '] ?? [];
}

/** Width in px of Joy text at scale s. */
export function joyWidth(text: string, s: number): number {
  let w = 0;
  for (const ch of text) w += ((joyGlyph(ch)[0]?.length ?? 2) + 1) * s;
  return w - s;
}

/** Joy text at integer scale s (top left x, y); `wobble` seeds a +-1 px baseline jitter. */
export function joy(
  cv: IndexCanvas,
  text: string,
  x: number,
  y: number,
  s: number,
  c: number,
  wobble?: number,
): number {
  let cx = Math.round(x);
  let i = 0;
  for (const ch of text) {
    const g = joyGlyph(ch);
    const dy = wobble === undefined ? 0 : Math.round((hashLite(wobble, i) - 0.5) * 2);
    for (let r = 0; r < 6; r += 1) {
      const row = g[r] ?? '';
      for (let k = 0; k < row.length; k += 1)
        if (row[k] === '#') cv.rect(cx + k * s, y + r * s + dy, s, s, c);
    }
    cx += ((g[0]?.length ?? 2) + 1) * s;
    i += 1;
  }
  return cx - s - x;
}

/** Calls `cell(x, y, s, s)` for every painted cell of Joy text (burn-in ghosts, masks). */
export function joyCells(
  text: string,
  x: number,
  y: number,
  s: number,
  cell: (x: number, y: number, w: number, h: number) => void,
): void {
  let cx = Math.round(x);
  for (const ch of text) {
    const g = joyGlyph(ch);
    for (let r = 0; r < 6; r += 1) {
      const row = g[r] ?? '';
      for (let k = 0; k < row.length; k += 1) if (row[k] === '#') cell(cx + k * s, y + r * s, s, s);
    }
    cx += ((g[0]?.length ?? 2) + 1) * s;
  }
}

function hashLite(seed: number, i: number): number {
  let h = Math.imul(seed ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(i + 11, 0xc2b2ae35);
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  return ((h ^ (h >>> 13)) >>> 0) / 4294967296;
}

/** Calls `cell(x, y, w, h)` for every painted cell of Score Block text; returns the width. */
export function scoreCells(
  text: string,
  x: number,
  y: number,
  cw: number,
  ch: number,
  cell: (x: number, y: number, w: number, h: number) => void,
): number {
  let cx = Math.round(x);
  for (const g0 of text) {
    const g = scoreGlyphRows(g0);
    for (let r = 0; r < 5; r += 1) {
      const row = g[r] ?? '';
      for (let k = 0; k < row.length; k += 1)
        if (row[k] === '#') cell(cx + k * cw, y + r * ch, cw, ch);
    }
    cx += ((g[0]?.length ?? 2) + 1) * cw;
  }
  return cx - cw - x;
}

/** Score Block text: wide cells (cw x ch px) like the console's double-wide pixels. */
export function score(
  cv: IndexCanvas,
  text: string,
  x: number,
  y: number,
  cw: number,
  ch: number,
  c: number,
): number {
  return scoreCells(text, x, y, cw, ch, (rx, ry, w, h) => {
    cv.rect(rx, ry, w, h, c);
  });
}

/** One Score Block glyph clipped to rows [y0, y1) (odometer rolls). */
export function scoreGlyph(
  cv: IndexCanvas,
  glyph: string,
  x: number,
  y: number,
  cell: readonly [number, number],
  c: number,
  window: readonly [number, number],
): void {
  const [cw, ch] = cell;
  const g = scoreGlyphRows(glyph);
  for (let r = 0; r < 5; r += 1) {
    const ry = y + r * ch;
    const a = Math.max(ry, window[0]);
    const b = Math.min(ry + ch, window[1]);
    if (b <= a) continue;
    const row = g[r] ?? '';
    for (let k = 0; k < row.length; k += 1)
      if (row[k] === '#') cv.rect(x + k * cw, a, cw, b - a, c);
  }
}

export interface Mask {
  readonly m: Uint8Array;
  readonly w: number;
  readonly h: number;
}

/** Box Art mask: bold Joy at scale s, sheared like italic box lettering. */
export function boxMask(text: string, s: number): Mask {
  const w0 = joyWidth(text, s) + text.length * Math.ceil(s / 2) + s + 4;
  const h = 6 * s;
  const w = w0 + Math.ceil(h / 4) + 4;
  const m = new Uint8Array(w * h);
  let cx = 0;
  for (const ch of text) {
    const g = joyGlyph(ch);
    for (let r = 0; r < 6; r += 1) {
      const row = g[r] ?? '';
      for (let k = 0; k < row.length; k += 1) {
        if (row[k] !== '#') continue;
        for (let yy = r * s; yy < r * s + s; yy += 1) {
          const shear = Math.floor((h - 1 - yy) / 4);
          for (let xx = cx + k * s; xx < cx + k * s + s + Math.ceil(s / 2); xx += 1)
            m[yy * w + xx + shear] = 1;
        }
      }
    }
    cx += ((g[0]?.length ?? 2) + 1) * s + Math.ceil(s / 2);
  }
  return { m, w, h };
}

/** Painted pixels of a Box Art word: [dx, dy, role] triples (0 key, 1 extrusion, 2 fill). */
interface BoxArtImage {
  readonly w: number;
  readonly cells: Int16Array;
}

const BOX_ART_CACHE = new Map<string, BoxArtImage>();

function boxArtImage(text: string, s: number): BoxArtImage {
  const cacheKey = `${String(s)}|${text}`;
  const cached = BOX_ART_CACHE.get(cacheKey);
  if (cached !== undefined) return cached;
  const { m, w, h } = boxMask(text, s);
  const ext = Math.max(2, Math.round(s * 0.7));
  const at = (sx: number, sy: number): boolean =>
    sx >= 0 && sy >= 0 && sx < w && sy < h && m[sy * w + sx] === 1;
  const cells: number[] = [];
  // Keyline: every pixel within 1 px of the mask or its extrusion.
  for (let yy = -1; yy <= h + ext; yy += 1) {
    for (let xx = -1; xx <= w + ext; xx += 1) {
      let key = false;
      for (let d = 0; d <= ext && !key; d += 1)
        for (let oy = -1; oy <= 1 && !key; oy += 1)
          for (let ox = -1; ox <= 1 && !key; ox += 1) key = at(xx - d - ox, yy - d - oy);
      if (key) cells.push(xx, yy, 0);
    }
  }
  for (let d = ext; d >= 1; d -= 1)
    for (let yy = 0; yy < h; yy += 1)
      for (let xx = 0; xx < w; xx += 1) if (m[yy * w + xx] === 1) cells.push(xx + d, yy + d, 1);
  for (let yy = 0; yy < h; yy += 1)
    for (let xx = 0; xx < w; xx += 1) if (m[yy * w + xx] === 1) cells.push(xx, yy, 2);
  const image = { w, cells: Int16Array.from(cells) };
  BOX_ART_CACHE.set(cacheKey, image);
  return image;
}

/** Box Art lettering: dark keyline, extrusion, fill. Returns the mask width. */
export function boxArt(
  cv: IndexCanvas,
  text: string,
  x: number,
  y: number,
  s: number,
  colours: { readonly fill: number; readonly extrude: number; readonly key: number },
): number {
  const { w, cells } = boxArtImage(text, s);
  const ox = Math.round(x);
  const oy = Math.round(y);
  const roles = [colours.key, colours.extrude, colours.fill];
  for (let i = 0; i < cells.length; i += 3)
    cv.px(ox + (cells[i] ?? 0), oy + (cells[i + 1] ?? 0), roles[cells[i + 2] ?? 0] ?? colours.fill);
  return w;
}
