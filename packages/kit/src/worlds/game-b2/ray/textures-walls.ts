/**
 * Wall textures of the Game B2 level format (ports of the showcase's corridor, office, warehouse
 * and returns walls). Uneven by design: damp streaks, cracks, offset cartons, worn paint, a taped
 * slip. Options: `label` (carton stencil / aisle sign), `chalk` (tally, arrow, cross), `pinned`
 * (calendar, poster) - all seeded, all palette indices.
 */
import { handStroke, type Bmp } from '../core/bitmap.js';
import { drawText } from '../core/font.js';
import { bayer, hash3, vnoise } from '../core/rand.js';
import { C } from '../palette.js';
import { blank, noisy, TEX, texture, type Texture } from './texture.js';

export interface WallDecor {
  readonly label?: string | undefined;
  readonly chalk?: 'tally' | 'arrow' | 'cross' | undefined;
  /** Strokes of a chalk tally (1-9: gates of five). */
  readonly count?: number | undefined;
  readonly pinned?: 'calendar' | 'poster' | undefined;
  /** Days crossed on a pinned calendar (0-35). */
  readonly crossed?: number | undefined;
}

function chalkMarks(b: Bmp, decor: WallDecor, seed: number): void {
  if (decor.chalk === 'tally') {
    const count = decor.count ?? 5;
    for (let i = 0; i < count; i += 1) {
      const gate = i % 5 === 4;
      const group = Math.floor(i / 5);
      const x = 12 + group * 26 + (i % 5) * 6 + (i % 2);
      if (gate) handStroke(b, [x - 26, 38 + group, x + 4, 25], C.PAPER, seed + 47 + i, 3, 1, true);
      else
        handStroke(
          b,
          [x, 22 + (i % 2), x + 1, 42 - (i === 2 ? 2 : 0)],
          C.PAPER,
          seed + 40 + i,
          2,
          1,
          true,
        );
    }
    b.px(44, 37, C.GREY);
    b.px(46, 38, C.GREY);
  } else if (decor.chalk === 'arrow') {
    handStroke(b, [10, 32, 50, 30], C.PAPER, seed + 51, 3, 1, true);
    handStroke(b, [42, 22, 52, 30, 42, 39], C.PAPER, seed + 52, 2, 1, true);
  } else if (decor.chalk === 'cross') {
    handStroke(b, [18, 18, 46, 44], C.PAPER, seed + 53, 3, 1, true);
    handStroke(b, [46, 17, 19, 45], C.PAPER, seed + 54, 3, 1, true);
  }
}

/** Damp concrete corridor wall (nobody looks after it). */
export function concrete(seed: number, decor: WallDecor): Texture {
  const b = blank();
  for (let y = 0; y < TEX; y += 1)
    for (let x = 0; x < TEX; x += 1) {
      const v = vnoise(x, y * 0.45, 20, seed);
      b.px(x, y, v < 0.3 || (v < 0.36 && bayer(x, y) < 0.5) ? C.CHAR : C.SLATE);
      if (hash3(x, y, seed + 3) < 0.012) b.px(x, y, C.GREY);
    }
  for (let x = 0; x < TEX; x += 1) {
    const top = 6 + vnoise(x, 0, 9, seed + 5) * 10;
    for (let y = 0; y < top; y += 1)
      b.px(x, y, y > top - 2 && bayer(x, y) < 0.5 ? C.SLATE : C.DIRT_D);
  }
  [9, 23, 44].forEach((x, i) => {
    const length = 10 + ((seed + i * 7) % 20);
    for (let y = 10; y < 10 + length; y += 1) b.px(x + (y > 20 ? 1 : 0), y, C.DIRT_D);
  });
  if (decor.chalk === undefined)
    handStroke(b, [36, 18, 38, 27, 34, 36, 39, 45], C.CHAR, seed + 1, 3);
  chalkMarks(b, decor, seed);
  b.rect(0, 0, 1, TEX, C.SHADOW);
  b.rect(0, 55, TEX, 1, C.SHADOW);
  b.rect(0, 56, TEX, 8, C.CHAR);
  b.rect(0, 56, TEX, 1, C.GREY);
  return texture(b);
}

/** A grey panelled door (slides sideways in the cell's middle). */
export function door(): Texture {
  const [base, hi, lo] = [C.GREY, C.PUTTY, C.SLATE];
  const b = blank(base);
  b.rect(0, 0, TEX, 3, lo);
  b.rect(0, 0, 3, TEX, lo);
  b.rect(61, 0, 3, TEX, lo);
  for (const [x, y, w, h] of [
    [7, 6, 50, 22],
    [7, 34, 50, 18],
  ] as const) {
    b.rect(x, y, w, 1, hi);
    b.rect(x, y, 1, h, hi);
    b.rect(x, y + h - 1, w, 1, lo);
    b.rect(x + w - 1, y, 1, h, lo);
  }
  b.rect(54, 28, 4, 5, C.CHAR);
  b.rect(3, 56, 58, 6, lo);
  for (let i = 0; i < 6; i += 1)
    handStroke(b, [10 + i * 8, 52 + (i % 3), 15 + i * 8, 55], lo, 300 + i, 1);
  return texture(b);
}

function pinCalendar(b: Bmp, crossed: number): void {
  b.poly([17, 6, 47, 7, 46, 43, 16, 42], C.PAPER);
  b.rect(18, 8, 27, 6, C.BROWN);
  for (let r = 0; r < 5; r += 1)
    for (let k = 0; k < 7; k += 1) {
      const x = 18 + k * 4;
      const y = 17 + r * 5;
      b.px(x + 1, y + 1, C.SAND);
      if (r * 7 + k < crossed) {
        b.px(x + 1, y + 1, C.BROWN);
        b.px(x + 2, y + 2, C.BROWN);
        b.px(x + 2, y + 1, C.WOOD);
      }
    }
  b.rect(31, 4, 2, 3, C.CHAR);
  b.rect(40, 36, 8, 7, C.SAND_L);
}

function pinPoster(b: Bmp): void {
  b.rect(9, 7, 34, 40, C.NIGHT);
  b.frame(9, 7, 34, 40, C.PUTTY);
  for (let i = 0; i < 18; i += 1) b.px(11 + hash3(i, 1, 2) * 30, 9 + hash3(i, 2, 2) * 34, C.MOON);
  b.ellipse(29, 22, 8, 8, C.MOON);
  b.ellipse(32, 20, 6, 6.5, C.HAZE);
  b.poly([14, 40, 22, 30, 25, 40], C.PUTTY);
  b.rect(8, 6, 4, 3, C.SAND_L);
  b.rect(40, 45, 4, 3, C.SAND_L);
}

/** 1980s office wood panelling under tungsten light. */
export function woodPanel(seed: number, decor: WallDecor): Texture {
  const b = blank(C.WOOD);
  for (let x = 0; x < TEX; x += 1) {
    const board = x >> 3;
    const dark = hash3(board, seed, 1) < 0.3;
    for (let y = 0; y < TEX; y += 1) {
      const low = y > 40;
      const g = Math.sin((y + board * 13) * 0.33 + vnoise(x * 3, y, 9, board + seed) * 6);
      let c = dark || low ? C.BROWN : C.WOOD;
      if (g > 0.78) c = c === C.WOOD ? C.BROWN : C.UMBER;
      else if (g < -0.93 && !low) c = C.TAN;
      if ((x & 7) === 0) c = C.UMBER;
      b.px(x, y, c);
    }
  }
  b.rect(0, 38, TEX, 1, C.TAN);
  b.rect(0, 39, TEX, 2, C.UMBER);
  b.rect(0, 60, TEX, 4, C.UMBER);
  b.ellipse(13 + (seed % 30), 18 + (seed % 9), 2, 1.4, C.UMBER);
  if (decor.pinned === 'calendar') pinCalendar(b, decor.crossed ?? 23);
  if (decor.pinned === 'poster') pinPoster(b);
  return texture(b);
}

/** Low cubicle partition (fabric, a pinned memo). */
export function cubicle(): Texture {
  const b = blank(C.GREY);
  for (let y = 0; y < TEX; y += 1)
    for (let x = 0; x < TEX; x += 1)
      if ((x + y * 2) % 3 === 0 || hash3(x, y, 61) < 0.12) b.px(x, y, C.SLATE);
  b.rect(0, 0, TEX, 4, C.PUTTY);
  b.rect(0, 4, TEX, 1, C.CHAR);
  b.rect(38, 14, 11, 13, C.PAPER);
  b.rect(42, 13, 2, 2, C.CLAY);
  for (let i = 0; i < 4; i += 1) b.rect(40, 17 + i * 2, 4 + ((i * 3) % 5), 1, C.GREY);
  return texture(b);
}

function carton(
  b: Bmp,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  seed: number,
): void {
  b.rect(x, y, w, h, C.TAN);
  b.rect(x + w - 3, y, 3, h, C.WOOD);
  b.rect(x, y + h - 1, w, 1, C.WOOD);
  b.rect(x + (w >> 1) - 1, y, 3, 4, C.SAND_L);
  b.rect(x, y, w - 3, 1, C.SAND_L);
  if (label !== '' && w > 18 && h > 11) drawText(b, label, x + 3 + (seed % 3), y + h - 9, C.BROWN);
}

/** Pallet racking with uneven cartons (stencil = `label`; one carton missing now and then). */
export function shelf(seed: number, decor: WallDecor): Texture {
  const b = blank(C.SHADOW);
  for (let y = 0; y < TEX; y += 1)
    for (let x = 0; x < TEX; x += 1) if (bayer(x, y) < 0.3) b.px(x, y, C.VOID);
  const label = decor.label ?? '';
  [19, 40, 60].forEach((bottom, level) => {
    let x = 4 + Math.floor(hash3(seed, level, 1) * 3);
    for (let k = 0; k < 2; k += 1) {
      const r = hash3(seed, level, k + 5);
      const w = r < 0.15 ? 15 : 25 + Math.floor(hash3(seed, level, k) * 3);
      const h = 13 + Math.floor(hash3(seed, k, level) * 4);
      if (!(r > 0.9 && k === 1)) carton(b, x, bottom - h, w, h, label, seed + level);
      x += w + 2 + Math.floor(hash3(seed, k, 9) * 3);
    }
  });
  for (const y of [0, 20, 41, 61]) {
    b.rect(0, y, TEX, 3, C.CLAY);
    b.rect(0, y, TEX, 1, C.TAN);
    b.rect(0, y + 2, TEX, 1, C.BROWN);
  }
  for (const x of [0, 61]) {
    b.rect(x, 0, 3, TEX, C.DUSK);
    b.rect(x + 1, 0, 1, TEX, C.HAZE);
    for (let y = 2; y < TEX; y += 4) b.px(x + 1, y, C.NIGHT);
  }
  return texture(b);
}

/** End frame of a rack; with `label` a hand-lettered aisle sign and arrow. */
export function shelfEnd(decor: WallDecor): Texture {
  const b = blank(C.SHADOW);
  for (let y = 0; y < TEX; y += 1)
    for (let x = 0; x < TEX; x += 1) if (bayer(x, y) < 0.4) b.px(x, y, C.VOID);
  for (let y = 4; y < TEX; y += 15) {
    b.line(4, y, 58, y + 13, C.DUSK);
    b.line(58, y, 4, y + 13, C.DUSK);
  }
  for (const [x, w] of [
    [2, 5],
    [56, 6],
  ] as const) {
    b.rect(x, 0, w, TEX, C.DUSK);
    b.rect(x + 1, 0, 1, TEX, C.HAZE);
  }
  if (decor.label !== undefined) {
    b.poly([16, 18, 46, 17, 47, 40, 17, 41], C.PAPER);
    b.rect(29, 16, 6, 3, C.SAND_L);
    drawText(b, decor.label, 21, 21, C.CHAR, 1, { bold: true });
    handStroke(b, [20, 33, 41, 33], C.CHAR, 81, 2);
    handStroke(b, [36, 29, 42, 33, 36, 37], C.CHAR, 82, 1);
  }
  return texture(b);
}

/** Corrugated steel (warehouse shell) with rust streaks. */
export function corrugated(seed: number): Texture {
  const b = blank(C.GREY);
  for (let x = 0; x < TEX; x += 1) {
    const base = [C.PUTTY, C.GREY, C.GREY, C.SLATE, C.SLATE, C.GREY][x % 6] ?? C.GREY;
    const rust = hash3(x >> 1, 4, seed) > 0.82;
    for (let y = 0; y < TEX; y += 1) {
      let c = base;
      if (rust && y > 10 + hash3(x >> 1, 5, seed) * 20 && y < 54)
        c = hash3(x, y, 6) < 0.5 ? C.DIRT : C.CLAY;
      if (y === 9 && x % 8 === 3) c = C.CHAR;
      b.px(x, y, c);
    }
  }
  noisy(b, [C.SLATE, C.GREY, C.SLATE], 6, seed + 9, [0, 56, TEX, 8]);
  return texture(b);
}

/** Painted cinderblock with a clay stripe (back rooms). */
export function cinderblock(seed: number): Texture {
  const b = blank(C.PUTTY);
  for (let y = 0; y < TEX; y += 1)
    for (let x = 0; x < TEX; x += 1) {
      const row = y >> 3;
      const off = row & 1 ? 8 : 0;
      let c = hash3(x, y, seed + 21) < 0.18 ? C.GREY : C.PUTTY;
      if (hash3((x + off) >> 4, row, seed + 22) < 0.18 && hash3(x, y, 23) < 0.5) c = C.SAND;
      if ((y & 7) === 7 || ((x + off) & 15) === 0) c = C.GREY;
      if (y >= 44 && y < 48) c = C.CLAY;
      b.px(x, y, c);
    }
  handStroke(b, [6, 30, 20, 27, 31, 33], C.SLATE, seed + 91, 2);
  return texture(b);
}

/** Shop counter front (low wall, tan top) with a taped slip slightly off. */
export function counter(seed: number): Texture {
  const b = blank(C.WOOD);
  for (let x = 0; x < TEX; x += 1)
    for (let y = 0; y < TEX; y += 1)
      if (x % 11 === 0 || hash3(x, y >> 2, seed + 31) < 0.08) b.px(x, y, C.BROWN);
  b.rect(0, 0, TEX, 6, C.TAN);
  b.rect(0, 0, TEX, 1, C.SAND_L);
  b.rect(0, 6, TEX, 1, C.UMBER);
  b.rect(0, 54, TEX, 10, C.CHAR);
  b.rect(9, 22, 12, 9, C.PAPER);
  b.rect(14, 21, 2, 2, C.SAND_L);
  return texture(b);
}

const BOX_TONES = [C.GREEN, C.DUSK, C.CLAY, C.TUNGSTEN, C.SAGE, C.HAZE, C.PLUM, C.MOSS];

/**
 * Toy-store shelving of look-alike game boxes (the clone aisle): three boards, boxes standing
 * spine-out in uneven widths and tones, a light top edge each, a paper price strip along every
 * board, one box leaning, one gap.
 */
export function storeShelf(seed: number): Texture {
  const b = blank(C.SHADOW);
  for (const board of [0, 21, 42]) {
    let x = 1 + Math.floor(hash3(seed, board, 1) * 3);
    let k = 0;
    while (x < TEX - 3) {
      const w = 4 + Math.floor(hash3(seed, board + k, 2) * 4);
      const h = 13 + Math.floor(hash3(seed, k, board + 3) * 5);
      const tone = BOX_TONES[Math.floor(hash3(seed, k, board) * 7)] ?? C.DUSK;
      const gap = hash3(seed, board, k + 9) < 0.06;
      if (!gap) {
        const lean = hash3(seed, k, board + 5) < 0.08 ? 1 : 0;
        for (let yy = 0; yy < h; yy += 1)
          b.rect(x + (lean && yy < h / 2 ? 1 : 0), board + 19 - h + yy, w - 1, 1, tone);
        b.rect(x, board + 19 - h, w - 1, 1, C.PAPER);
        b.rect(x + w - 2, board + 20 - h, 1, h - 1, C.VOID);
        if (w > 5) b.rect(x + 1, board + 22 - h, w - 4, 2, C.PAPER);
      }
      x += w;
      k += 1;
    }
    b.rect(0, board + 19, TEX, 2, C.PUTTY);
    b.rect(0, board + 21, TEX, 1, C.GREY);
    for (let px = 3 + (board % 5); px < TEX; px += 13 + ((px * 7) % 5))
      b.rect(px, board + 19, 5, 2, C.PAPER);
  }
  b.rect(0, 63, TEX, 1, C.VOID);
  return texture(b);
}
