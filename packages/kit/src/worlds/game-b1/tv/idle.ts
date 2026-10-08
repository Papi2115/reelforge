/**
 * What the TV shows on its own: the attract mode of an idle 2600 (low colour bands whose hues
 * step every 1.9 s; kept dim, it is never the subject) and the garbage frame of a cartridge being
 * rocked in its slot (seeded per frame).
 */
import type { IndexCanvas } from '../core/canvas.js';
import { hash } from '../core/math.js';
import { C } from '../palette.js';

const HUES = [
  [C.TEAL, C.TEAL_D],
  [C.DUSK, C.NIGHT],
  [C.RUST, C.WALNUT_D],
  [C.BLUE, C.NIGHT],
] as const;

export function attractPicture(
  cv: IndexCanvas,
  x: number,
  y: number,
  w: number,
  h: number,
  t: number,
): void {
  const [light, dark] = HUES[Math.floor(Math.max(0, t) / 1.9) % HUES.length] ?? HUES[0];
  cv.rect(x, y, w, h, C.TUBE);
  const bh = Math.max(2, Math.round(h / 18) & ~1);
  for (let i = 0; i < 5; i += 1)
    cv.rect(x, y + h - (i + 1) * bh * 2, w, bh, i === 0 ? light : dark);
  const bw = Math.round(w / 10);
  for (const [col, rows] of [
    [1, 3],
    [3, 5],
    [6, 2],
    [8, 4],
  ] as const)
    cv.rect(x + col * bw, y + h * 0.3, bw, rows * bh, dark);
  cv.rect(x + Math.round(w * 0.42), y + Math.round(h * 0.16), bw, bh * 2, light);
}

const GARBAGE = [
  C.ORANGE,
  C.TEAL,
  C.MAUVE,
  C.GOLD,
  C.BLUE,
  C.AVOCADO,
  C.TUBE,
  C.CREAM,
  C.GREY_D,
] as const;

export function garbage(
  cv: IndexCanvas,
  x: number,
  y0: number,
  w: number,
  h: number,
  frame: number,
  seed: number,
): void {
  let y = y0;
  let i = 0;
  while (y < y0 + h) {
    const bh = 2 * (1 + Math.floor(hash(seed, frame, i) * 9));
    const c = GARBAGE[Math.floor(hash(seed, frame, i + 99) * GARBAGE.length)] ?? C.TUBE;
    const rows = Math.min(bh, y0 + h - y);
    cv.rect(x, y, w, rows, c);
    // playfield-block glitches on some bands
    if (hash(seed, frame, i + 7) > 0.55)
      for (let b = 0; b < w / 16; b += 1)
        if (hash(seed, frame * 13 + b, i) > 0.6) cv.rect(x + b * 16, y, 16, rows, C.VOID);
    y += bh;
    i += 1;
  }
}
