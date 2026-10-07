/**
 * "Bezel 5x7": the proportional caps face of the Game B2 world (CC0, drawn for the showcase,
 * docs/licenses.md): rounded early-80s terminal letters, dotted zero, flat-topped A. Plus the
 * seeded irregular typewriter (punctuation holds, word bursts, one thinking stall per line).
 */
import type { Bmp } from './bitmap.js';
import { hash3, rng } from './rand.js';

const ROWS: Readonly<Record<string, readonly string[]>> = {
  A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  B: ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'],
  C: ['.###.', '#...#', '#....', '#....', '#....', '#...#', '.###.'],
  D: ['###..', '#..#.', '#...#', '#...#', '#...#', '#..#.', '###..'],
  E: ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
  F: ['#####', '#....', '#....', '####.', '#....', '#....', '#....'],
  G: ['.###.', '#...#', '#....', '#.###', '#...#', '#...#', '.####'],
  H: ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  I: ['###', '.#.', '.#.', '.#.', '.#.', '.#.', '###'],
  J: ['..###', '...#.', '...#.', '...#.', '...#.', '#..#.', '.##..'],
  K: ['#...#', '#..#.', '#.#..', '##...', '#.#..', '#..#.', '#...#'],
  L: ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
  M: ['#...#', '##.##', '#.#.#', '#.#.#', '#...#', '#...#', '#...#'],
  N: ['#...#', '#...#', '##..#', '#.#.#', '#..##', '#...#', '#...#'],
  O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  P: ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
  Q: ['.###.', '#...#', '#...#', '#...#', '#.#.#', '#..#.', '.##.#'],
  R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
  S: ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
  T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
  U: ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  V: ['#...#', '#...#', '#...#', '#...#', '#...#', '.#.#.', '..#..'],
  W: ['#...#', '#...#', '#...#', '#.#.#', '#.#.#', '##.##', '#...#'],
  X: ['#...#', '#...#', '.#.#.', '..#..', '.#.#.', '#...#', '#...#'],
  Y: ['#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'],
  Z: ['#####', '....#', '...#.', '..#..', '.#...', '#....', '#####'],
  0: ['.###.', '#...#', '#...#', '#.#.#', '#...#', '#...#', '.###.'],
  1: ['.#.', '##.', '.#.', '.#.', '.#.', '.#.', '###'],
  2: ['.###.', '#...#', '....#', '..##.', '.#...', '#....', '#####'],
  3: ['####.', '....#', '....#', '.###.', '....#', '....#', '####.'],
  4: ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'],
  5: ['#####', '#....', '####.', '....#', '....#', '#...#', '.###.'],
  6: ['..##.', '.#...', '#....', '####.', '#...#', '#...#', '.###.'],
  7: ['#####', '....#', '...#.', '..#..', '..#..', '..#..', '..#..'],
  8: ['.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'],
  9: ['.###.', '#...#', '#...#', '.####', '....#', '...#.', '.##..'],
  '.': ['.', '.', '.', '.', '.', '.', '#'],
  ',': ['..', '..', '..', '..', '..', '.#', '#.'],
  ':': ['.', '.', '#', '.', '.', '#', '.'],
  "'": ['#', '#', '.', '.', '.', '.', '.'],
  '!': ['#', '#', '#', '#', '#', '.', '#'],
  '?': ['.###.', '#...#', '....#', '..##.', '..#..', '.....', '..#..'],
  '-': ['....', '....', '....', '####', '....', '....', '....'],
  '+': ['.....', '..#..', '..#..', '#####', '..#..', '..#..', '.....'],
  '/': ['....#', '....#', '...#.', '..#..', '.#...', '#....', '#....'],
  '>': ['#...', '.#..', '..#.', '...#', '..#.', '.#..', '#...'],
  '~': ['.....', '.....', '.#...', '#.#.#', '...#.', '.....', '.....'],
  '%': ['##..#', '##..#', '...#.', '..#..', '.#...', '#..##', '#..##'],
  $: ['..#..', '.####', '#.#..', '.###.', '..#.#', '####.', '..#..'],
  '#': ['.#.#.', '#####', '.#.#.', '.#.#.', '.#.#.', '#####', '.#.#.'],
  '&': ['.##..', '#..#.', '.##..', '.#...', '#.#.#', '#..#.', '.##.#'],
  '(': ['.#', '#.', '#.', '#.', '#.', '#.', '.#'],
  ')': ['#.', '.#', '.#', '.#', '.#', '.#', '#.'],
  '[': ['##', '#.', '#.', '#.', '#.', '#.', '##'],
  ']': ['##', '.#', '.#', '.#', '.#', '.#', '##'],
  '·': ['.', '.', '.', '#', '.', '.', '.'],
};

interface Glyph {
  readonly w: number;
  readonly bits: readonly (readonly boolean[])[];
}

const GLYPHS = new Map<string, Glyph>(
  Object.entries(ROWS).map(([ch, rows]) => [
    ch,
    {
      w: rows[0]?.length ?? 1,
      bits: rows.map((row) => Array.from({ length: row.length }, (_, i) => row.charAt(i) === '#')),
    },
  ]),
);

const SPACE = 3;
export const FONT_HEIGHT = 7;

/** Characters the face can draw (validators reject the rest with a readable error). */
export function unsupportedChars(text: string): string[] {
  const out = new Set<string>();
  for (const ch of text) if (ch !== ' ' && ch !== '\n' && !GLYPHS.has(ch)) out.add(ch);
  return [...out];
}

function advance(ch: string): number {
  return (GLYPHS.get(ch)?.w ?? SPACE) + 1;
}

export function textWidth(text: string, scale = 1): number {
  let w = 0;
  for (const ch of text) w += advance(ch);
  return Math.max(0, w - 1) * scale;
}

export interface TextOptions {
  /** Characters to show (typewriter). */
  readonly count?: number;
  /** Seed of a ±1 px baseline wobble (hand-set type). */
  readonly jitter?: number;
  /** Colour of a 1-step drop shadow. */
  readonly shadow?: number;
  readonly bold?: boolean;
}

/** Draws one line; returns the x after the last character. */
export function drawText(
  bmp: Bmp,
  text: string,
  x: number,
  y: number,
  c: number,
  scale = 1,
  options: TextOptions = {},
): number {
  const count = options.count ?? Number.POSITIVE_INFINITY;
  let cx = Math.round(x);
  let i = 0;
  for (const ch of text) {
    if (i >= count) break;
    i += 1;
    const glyph = GLYPHS.get(ch);
    if (glyph) {
      const jy =
        options.jitter === undefined ? 0 : Math.round((hash3(options.jitter, i, 7) - 0.5) * 2);
      for (let gy = 0; gy < FONT_HEIGHT; gy += 1)
        for (let gx = 0; gx < glyph.w; gx += 1) {
          if (glyph.bits[gy]?.[gx] !== true) continue;
          const px = cx + gx * scale;
          const py = Math.round(y) + gy * scale + jy;
          if (options.shadow !== undefined)
            bmp.rect(px + scale, py + scale, scale, scale, options.shadow);
          bmp.rect(px, py, scale + (options.bold === true ? 1 : 0), scale, c);
        }
    }
    cx += advance(ch) * scale;
  }
  return cx;
}

/** Multi-line text with a total character budget (typewriter); returns the caret. */
export function drawLines(
  bmp: Bmp,
  text: string,
  x: number,
  y: number,
  c: number,
  scale: number,
  lineGap: number,
  count: number,
): { x: number; y: number } {
  let left = count;
  let caret = { x, y };
  text.split('\n').forEach((line, index) => {
    const ly = y + index * lineGap;
    const n = Math.max(0, Math.min(line.length, left));
    if (n > 0) drawText(bmp, line, x, ly, c, scale, { count: n });
    if (left >= 0)
      caret = { x: x + (n > 0 ? textWidth(line.slice(0, n), scale) + scale : 0), y: ly };
    left -= line.length + 1;
  });
  return caret;
}

/**
 * Irregular typewriter: per-character reveal times (seeded). Punctuation holds, spaces linger,
 * a line break is a beat, one "thinking" stall per text. Never uniform.
 */
export function typeTimes(text: string, seed: number, t0: number, rate = 0.036): number[] {
  const random = rng(seed);
  const out: number[] = [];
  let t = t0;
  const stallAt = Math.floor(text.length * (0.35 + random() * 0.3));
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i] ?? '';
    const previous = i > 0 ? (text[i - 1] ?? '') : '';
    let d = rate * (0.55 + random() * 0.9);
    if (ch === ' ') d *= 1.6;
    if (ch === '\n') d = 0.16 + random() * 0.08;
    if ('.,:'.includes(previous) && previous !== '')
      d += previous === ',' ? 0.1 : 0.2 + random() * 0.08;
    if (i === stallAt && ch === ' ') d += 0.12;
    t += d;
    out.push(t);
  }
  return out;
}

/** Characters revealed at t. */
export function typedCount(times: readonly number[], t: number): number {
  let lo = 0;
  let hi = times.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if ((times[mid] ?? 0) <= t) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}
