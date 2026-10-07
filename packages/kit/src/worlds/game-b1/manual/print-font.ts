/**
 * "Rough Print": the condensed 4x7 caps face of the instruction manual's body type (own CC0 data
 * from the showcase's shots-manual.js, docs/licenses.md). Cheap letterpress: stems bold (+1 px ink
 * gain), now and then a letter a pixel off the baseline, a cell here and there worn away; `skew`
 * sets each glyph whole on the crooked baseline of a sheet fed at an angle (never split glyphs).
 */
import type { IndexCanvas } from '../core/canvas.js';
import { hash } from '../core/math.js';

const RAW: Readonly<Record<string, string>> = {
  A: '.##. #..# #..# #### #..# #..# #..#',
  B: '###. #..# #..# ###. #..# #..# ###.',
  C: '.##. #..# #... #... #... #..# .##.',
  D: '###. #..# #..# #..# #..# #..# ###.',
  E: '#### #... #... ###. #... #... ####',
  F: '#### #... #... ###. #... #... #...',
  G: '.##. #..# #... #.## #..# #..# .###',
  H: '#..# #..# #..# #### #..# #..# #..#',
  I: '### .#. .#. .#. .#. .#. ###',
  J: '...# ...# ...# ...# #..# #..# .##.',
  K: '#..# #..# #.#. ##.. #.#. #..# #..#',
  L: '#... #... #... #... #... #... ####',
  M: '#...# ##.## #.#.# #.#.# #...# #...# #...#',
  N: '#..# ##.# ##.# #.## #.## #..# #..#',
  O: '.##. #..# #..# #..# #..# #..# .##.',
  P: '###. #..# #..# ###. #... #... #...',
  Q: '.##. #..# #..# #..# #..# #.#. .#.#',
  R: '###. #..# #..# ###. #.#. #..# #..#',
  S: '.### #... #... .##. ...# ...# ###.',
  T: '##### ..#.. ..#.. ..#.. ..#.. ..#.. ..#..',
  U: '#..# #..# #..# #..# #..# #..# .##.',
  V: '#...# #...# #...# .#.#. .#.#. .#.#. ..#..',
  W: '#...# #...# #...# #.#.# #.#.# ##.## #...#',
  X: '#...# #...# .#.#. ..#.. .#.#. #...# #...#',
  Y: '#...# #...# .#.#. ..#.. ..#.. ..#.. ..#..',
  Z: '#### ...# ..#. ..#. .#.. #... ####',
  '0': '.##. #..# #..# #..# #..# #..# .##.',
  '1': '.#. ##. .#. .#. .#. .#. ###',
  '2': '.##. #..# ...# ..#. .#.. #... ####',
  '3': '###. ...# ...# .##. ...# ...# ###.',
  '4': '..#. .##. #.#. #### ..#. ..#. ..#.',
  '5': '#### #... ###. ...# ...# #..# .##.',
  '6': '.##. #... #... ###. #..# #..# .##.',
  '7': '#### ...# ..#. ..#. .#.. .#.. .#..',
  '8': '.##. #..# #..# .##. #..# #..# .##.',
  '9': '.##. #..# #..# .### ...# ...# .##.',
  '.': '. . . . . . #',
  ',': '.. .. .. .. .# .# #.',
  ':': '. . # . . # .',
  "'": '# # . . . . .',
  '-': '... ... ... ### ... ... ...',
  '!': '# # # # # . #',
  '?': '.##. #..# ...# ..#. .#.. .... .#..',
  ' ': '.. .. .. .. .. .. ..',
};

const GLYPHS: ReadonlyMap<string, readonly string[]> = new Map(
  Object.entries(RAW).map(([ch, rows]) => [ch, rows.split(' ')]),
);

function glyph(ch: string): readonly string[] {
  return GLYPHS.get(ch) ?? GLYPHS.get(' ') ?? [];
}

/** Characters Rough Print cannot set (deduplicated); new lines are fine. */
export function missingPrintGlyphs(text: string): string[] {
  const out: string[] = [];
  for (const ch of text) if (ch !== '\n' && !GLYPHS.has(ch) && !out.includes(ch)) out.push(ch);
  return out;
}

/** Width in px of `text` at scale s. */
export function printWidth(text: string, s: number): number {
  let w = 0;
  for (const ch of text) w += ((glyph(ch)[0]?.length ?? 2) + 1) * s;
  return w - s;
}

/** The crooked feed: a rotation about a pivot applied glyph by glyph. */
export interface Skew {
  readonly angle: number;
  readonly px: number;
  readonly py: number;
}

/**
 * Sets `text` at scale s with colour c (a key-buffer value); returns the x of each glyph and the
 * end (for marks on a word). `seed` places the worn cells and the jumpy baseline.
 */
export function print(
  cv: IndexCanvas,
  text: string,
  at: { readonly x: number; readonly y: number; readonly s: number },
  c: number,
  seed: number,
  skew?: Skew,
): number[] {
  const { y, s } = at;
  const sin = skew === undefined ? 0 : Math.sin(skew.angle);
  let cx = Math.round(at.x) + (skew === undefined ? 0 : Math.round(-(y - skew.py) * sin));
  const xs: number[] = [];
  let i = 0;
  for (const ch of text) {
    const g = glyph(ch);
    const jump = hash(seed, i, 1) < 0.16 ? (hash(seed, i, 2) < 0.5 ? -1 : 1) : 0;
    const dy = jump + (skew === undefined ? 0 : Math.round((cx - skew.px) * sin));
    xs.push(cx);
    for (let r = 0; r < 7; r += 1) {
      const row = g[r] ?? '';
      for (let k = 0; k < row.length; k += 1) {
        if (row[k] !== '#') continue;
        const bx = cx + k * s;
        const by = y + r * s + dy;
        cv.rect(bx, by, s + 1, s, c);
        if (hash(seed, i * 64 + r * 8 + k, 3) < 0.03)
          cv.rect(bx + (r & 1) * s, by + s - 1, 1, 1, 0);
      }
    }
    cx += ((g[0]?.length ?? 2) + 1) * s;
    i += 1;
  }
  xs.push(cx - s);
  return xs;
}
