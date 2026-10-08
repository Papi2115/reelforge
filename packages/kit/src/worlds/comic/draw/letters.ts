/**
 * Onomatopoeia and big numbers of the Comic page (the showcase's bigLetter): one display glyph
 * scaled `size` px per cell, rotated, warped by a seeded low-frequency wobble (a cut-paper edge),
 * an ink outline and an extruded block behind it, the fill printed a pixel or two out of register
 * (paper shows along one edge).
 */
import { INK } from '../inks.js';
import type { ComicCanvas, Paint } from './canvas.js';
import { FONTS } from './fonts.js';
import { rnd } from './math.js';

export interface BigLetterOptions {
  /** Outline radius in px (0 = none). */
  readonly outline?: number | undefined;
  /** Extrusion [dx, dy] in px (ink block behind the letter). */
  readonly extrude?: readonly [number, number] | undefined;
  /** Fill plate offset [dx, dy] in px. */
  readonly mis?: readonly [number, number] | undefined;
  /** Colour of the edge where the fill plate slipped (default paper). */
  readonly gap?: number | undefined;
  readonly key?: string | undefined;
  /** false = no ink outline/extrusion block (a rubber stamp prints only its letters). */
  readonly block?: boolean | undefined;
}

/** Draws `char` centred on (cx, cy). */
export function bigLetter(
  canvas: ComicCanvas,
  char: string,
  cx: number,
  cy: number,
  size: number,
  angle: number,
  fill: Paint,
  options: BigLetterOptions = {},
): void {
  const glyph = FONTS.display.glyphs.get(char);
  if (glyph === undefined || size <= 0.2) return;
  const key = options.key ?? char;
  const ow = options.outline ?? 2;
  const [ex, ey] = options.extrude ?? [3, 3];
  const [mx, my] = options.mis ?? [1, -1];
  const gap = options.gap ?? INK.PAPER;
  const half = Math.hypot(glyph.w, glyph.h) * size * 0.5 + ow + 6;
  const x0 = Math.floor(cx - half);
  const y0 = Math.floor(cy - half);
  const side = Math.ceil(half * 2) + 8;
  const mask = new Uint8Array(side * side);
  const ca = Math.cos(-angle);
  const sa = Math.sin(-angle);
  const ph1 = rnd(key, 1) * 6.28;
  const ph2 = rnd(key, 2) * 6.28;
  for (let yy = 0; yy < side; yy += 1) {
    for (let xx = 0; xx < side; xx += 1) {
      const dx = x0 + xx + 0.5 - cx;
      const dy = y0 + yy + 0.5 - cy;
      let lx = (dx * ca - dy * sa) / size + glyph.w / 2;
      let ly = (dx * sa + dy * ca) / size + glyph.h / 2;
      lx += 0.08 * Math.sin(ly * 1.3 + ph1);
      ly += 0.06 * Math.sin(lx * 1.1 + ph2);
      const gx = Math.floor(lx);
      const gy = Math.floor(ly);
      if (gx >= 0 && gy >= 0 && gx < glyph.w && gy < glyph.h && glyph.bits[gy * glyph.w + gx] === 1)
        mask[yy * side + xx] = 1;
    }
  }
  const inside = (xx: number, yy: number) =>
    xx >= 0 && yy >= 0 && xx < side && yy < side && mask[yy * side + xx] === 1;
  const grown = new Uint8Array(side * side);
  for (let yy = 0; yy < side; yy += 1) {
    for (let xx = 0; xx < side; xx += 1) {
      if (!inside(xx, yy)) continue;
      for (let a = -ow; a <= ow; a += 1) {
        for (let b = -ow; b <= ow; b += 1) {
          const X = xx + a;
          const Y = yy + b;
          if (a * a + b * b <= ow * ow + 1 && X >= 0 && Y >= 0 && X < side && Y < side)
            grown[Y * side + X] = 1;
        }
      }
    }
  }
  // Extrusion (a solid ink block behind, down-right), then the outline, then the slipped fill.
  const steps = Math.max(Math.abs(ex), Math.abs(ey), 1);
  for (let yy = 0; yy < side && options.block !== false; yy += 1) {
    for (let xx = 0; xx < side; xx += 1) {
      for (let k = 0; k <= steps; k += 1) {
        const X = xx - Math.round((ex * k) / steps);
        const Y = yy - Math.round((ey * k) / steps);
        if (X >= 0 && Y >= 0 && X < side && Y < side && grown[Y * side + X] === 1) {
          canvas.plot(x0 + xx, y0 + yy, INK.INK);
          break;
        }
      }
    }
  }
  for (let yy = 0; yy < side; yy += 1) {
    for (let xx = 0; xx < side; xx += 1) {
      if (!inside(xx, yy)) continue;
      canvas.plot(x0 + xx, y0 + yy, inside(xx - mx, yy - my) ? fill : gap);
    }
  }
}
