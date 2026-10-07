/**
 * Lettering built into the picture (showcase art-spread.js): block letters standing in the
 * ground, lit by the scene's low sun from the left, extruded to the unlit side, casting long
 * shadows to the right, ground drifted against their bases. A spread's title, never a caption.
 * Also the torn outline of a cutaway (showcase shot 4). Both are generic, every topic needs them.
 */
import { INK } from '../inks.js';
import { FONTS } from '../draw/fonts.js';
import { clamp01, lerp, rnd, rndRange } from '../draw/math.js';
import type { ComicCanvas } from '../draw/canvas.js';
import { dither, halftone, layer, type Screen } from '../draw/paint.js';
import type { ComicPen } from './pen.js';

export interface StandingOptions {
  /** Left of the first letter and the baselines of the first and last letter (local units). */
  readonly x: number;
  readonly y0: number;
  readonly y1?: number | undefined;
  /** Cap heights of the first and last letter (they recede). */
  readonly h0?: number | undefined;
  readonly h1?: number | undefined;
  /** Face, side and shadow inks (palette indices; `g.standing` takes swatch names). */
  readonly face?: number | undefined;
  readonly side?: number | undefined;
  readonly shadow?: number | undefined;
  readonly key?: string | undefined;
}

/** `g.standing` options: inks by swatch name or palette index. */
export type StandingArgs = Omit<StandingOptions, 'face' | 'side' | 'shadow'> & {
  readonly face?: string | number;
  readonly side?: string | number;
  readonly shadow?: string | number;
};

interface Letter {
  readonly char: string;
  readonly bx: number;
  readonly by: number;
  readonly h: number;
  readonly lean: number;
}

/** One block letter on its base centre (bx, by) in screen px. */
function blockLetter(
  canvas: ComicCanvas,
  screen: Readonly<Screen>,
  L: Letter,
  o: Readonly<Record<'face' | 'side' | 'shadow', number>>,
  key: string,
): void {
  const glyph = FONTS.display.glyphs.get(L.char);
  if (glyph === undefined) return;
  const cw = (L.h / 7) * 0.7;
  const w = Math.round(glyph.w * cw);
  const hh = Math.round(L.h);
  const x0 = Math.round(L.bx - w / 2);
  const y0 = Math.round(L.by - hh);
  const bit = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= w || y >= hh) return false;
    const gx = Math.min(glyph.w - 1, Math.floor(x / cw));
    const gy = Math.min(glyph.h - 1, Math.floor(y / (L.h / glyph.h)));
    return glyph.bits[gy * glyph.w + gx] === 1;
  };
  const sx = (x: number, y: number) => x0 + x + Math.round(L.lean * (hh - y));
  const ex = Math.round(2 + L.h / 16);
  const ey = -Math.round(1 + L.h / 24);
  const steps = Math.max(Math.abs(ex), Math.abs(ey));
  const shadow = dither(-1, o.shadow, 0.75);
  for (let y = 0; y < hh; y += 1) {
    const up = hh - y;
    for (let x = 0; x < w; x += 1) {
      if (!bit(x, y)) continue;
      canvas.plot(x0 + x + Math.round(up * 1.5), L.by - Math.round(up * 0.16), shadow);
      canvas.plot(x0 + x + Math.round(up * 1.5) + 1, L.by - Math.round(up * 0.16), shadow);
    }
  }
  for (let k = 0; k <= steps; k += 1) {
    const dx = Math.round((ex * k) / steps);
    const dy = Math.round((ey * k) / steps);
    for (let y = 0; y < hh; y += 1) {
      for (let x = 0; x < w; x += 1)
        if (bit(x, y)) canvas.rect(sx(x, y) + dx - 1, y0 + y + dy - 1, 3, 3, INK.INK);
    }
  }
  for (let k = steps; k >= 1; k -= 1) {
    const dx = Math.round((ex * k) / steps);
    const dy = Math.round((ey * k) / steps);
    for (let y = 0; y < hh; y += 1) {
      for (let x = 0; x < w; x += 1)
        if (bit(x, y)) canvas.plot(sx(x, y) + dx, y0 + y + dy, k === steps ? INK.INK : o.side);
    }
  }
  const face = layer(
    halftone(
      o.side,
      (_px, py) => 0.45 * clamp01((py - y0 - hh * 0.8) / (hh * 0.2)),
      { cell: 3, angle: 0.78 },
      screen,
    ),
    o.face,
  );
  for (let y = 0; y < hh; y += 1) {
    for (let x = 0; x < w; x += 1) {
      if (!bit(x, y)) continue;
      canvas.plot(sx(x, y), y0 + y, y > 0 && !bit(x, y - 1) ? INK.GREY_L : face);
    }
  }
  const drift: number[] = [];
  for (let i = 0; i <= 8; i += 1) {
    drift.push(
      x0 - 4 + (i / 8) * (w + 10),
      L.by + 1 - Math.sin((i / 8) * Math.PI) * (1 + rnd(key, i) * 1.5),
    );
  }
  canvas.poly(
    [...drift, x0 + w + 6, L.by + 3, x0 - 4, L.by + 3],
    layer(halftone(INK.GREY_M, 0.25, { cell: 3, angle: 0.78 }, screen), INK.GREY_L),
  );
  canvas.polyline(drift, INK.INK, 1, false);
}

/** Block letters standing in the ground, receding from (x, y0) to y1; far letters drawn first. */
export function standing(
  g: ComicPen,
  canvas: ComicCanvas,
  screen: Readonly<Screen>,
  text: string,
  o: StandingOptions,
): void {
  const key = o.key ?? `standing:${text}`;
  const chars = Array.from(text.toUpperCase());
  const n = Math.max(2, chars.length);
  const inks = {
    face: o.face ?? INK.PAPER,
    side: o.side ?? INK.GREY_D,
    shadow: o.shadow ?? INK.GREY_D,
  };
  let x = g.x(o.x);
  const letters: Letter[] = [];
  chars.forEach((char, i) => {
    const p = i / (n - 1);
    const h = lerp(o.h0 ?? 30, o.h1 ?? o.h0 ?? 30, p) * g.s;
    const by = lerp(g.y(o.y0), g.y(o.y1 ?? o.y0), p) + Math.round(rndRange(key, i, -1.5, 1.5));
    const glyph = FONTS.display.glyphs.get(char);
    if (char === ' ' || glyph === undefined) {
      x += h * 0.55;
      return;
    }
    const w = Math.round(glyph.w * (h / 7) * 0.7);
    letters.push({ char, bx: x + w / 2, by, h, lean: rndRange(key, i + 50, -0.025, 0.025) });
    x += w + Math.max(6, h * 0.36);
  });
  for (let i = letters.length - 1; i >= 0; i -= 1) {
    const letter = letters[i];
    if (letter !== undefined) blockLetter(canvas, screen, letter, inks, `${key}${String(i)}`);
  }
}

/** A cutaway opening: a rectangle whose edges are torn metal (alternating seeded notches). */
export function torn(x0: number, y0: number, x1: number, y1: number, key = 'torn'): number[] {
  const pts: number[] = [];
  const edge = (
    ax: number,
    ay: number,
    bx: number,
    by: number,
    nx: number,
    ny: number,
    base: number,
  ) => {
    const n = Math.max(2, Math.round(Math.hypot(bx - ax, by - ay) / 11));
    for (let i = 0; i < n; i += 1) {
      const d = (i % 2 === 1 ? 4 : -2) + rndRange(key, base + i, -2.5, 2.5);
      pts.push(lerp(ax, bx, i / n) + nx * d, lerp(ay, by, i / n) + ny * d);
    }
  };
  edge(x0, y0, x1, y0, 0, 1, 0);
  edge(x1, y0, x1, y1, -1, 0, 100);
  edge(x1, y1, x0, y1, 0, -1, 200);
  edge(x0, y1, x0, y0, 1, 0, 300);
  return pts;
}
