/**
 * How the automap opens and closes against the HUD minimap (the continuity): the unfold rect
 * growing from the minimap's inner rect to the full screen, the wipe's radial dither out of the
 * minimap, the fold (the frozen map squeezed in held steps onto the minimap at its 3 px per cell
 * around the arrow, then dithered into the real one), and the copies onto the screen. Pure.
 */
import type { Bmp } from '../core/bitmap.js';
import { bayer, EASES, lerp, seg } from '../core/rand.js';
import { C } from '../palette.js';
import { SCREEN_H, SCREEN_W } from '../view/output.js';
import { SCREEN_CX, SCREEN_CY } from './automap-plan.js';

/** The HUD minimap's inner rect (plate 538,12,86,66 inset by 4) and its 3 px per cell. */
export const MINI = { x: 542, y: 16, w: 78, h: 58, cell: 3 } as const;

/** What the map covers on screen at t: the HUD clears its persistent elements there. */
export interface MapCover {
  readonly x0: number;
  readonly y0: number;
  readonly x1: number;
  readonly y1: number;
  /** True where the map (not the view under it) is on screen. */
  shows(x: number, y: number): boolean;
}

export interface FoldState {
  readonly sx: number;
  readonly sy: number;
  readonly sw: number;
  readonly sh: number;
  readonly dx: number;
  readonly dy: number;
  readonly dw: number;
  readonly dh: number;
  readonly mix: number;
}

export function fullCover(shows: (x: number, y: number) => boolean): MapCover {
  return { x0: 0, y0: 0, x1: SCREEN_W, y1: SCREEN_H, shows };
}

/** The unfold rect at progress e (0 = the minimap, 1 = the full screen). */
export function unfoldRect(e: number): { x: number; y: number; w: number; h: number } {
  return {
    x: lerp(MINI.x, 0, e),
    y: lerp(MINI.y, 0, e),
    w: lerp(MINI.w, SCREEN_W, e),
    h: lerp(MINI.h, SCREEN_H, e),
  };
}

export function unfoldCover(e: number): MapCover {
  const r = unfoldRect(e);
  return {
    x0: Math.floor(r.x),
    y0: Math.floor(r.y),
    x1: Math.ceil(r.x + r.w),
    y1: Math.ceil(r.y + r.h),
    shows: () => true,
  };
}

/** The wipe at progress p: the map dithers in radially out of the minimap. */
export function wipeCover(p: number): MapCover {
  const mcx = MINI.x + MINI.w / 2;
  const mcy = MINI.y + MINI.h / 2;
  const far = Math.hypot(mcx, SCREEN_H - mcy);
  return fullCover((x, y) => (0.7 * Math.hypot(x - mcx, y - mcy)) / far + 0.3 * bayer(x, y) < p);
}

/**
 * The fold at t (it starts at foldAt): a tiny swell, the shrink in held steps (~13 fps) onto the
 * minimap around the arrow (`arrow` = its screen px in the frozen map), then the dither.
 */
export function foldState(
  t: number,
  foldAt: number,
  scale: number,
  arrow: readonly [number, number],
): FoldState {
  const steps = Math.floor(seg(t, foldAt + 0.1, foldAt + 0.7) * 8) / 8;
  const e =
    t < foldAt + 0.1
      ? -0.018 * Math.sin(Math.PI * seg(t, foldAt, foldAt + 0.1))
      : EASES.inOut(steps);
  const cw = (MINI.w * scale) / MINI.cell;
  const ch = (MINI.h * scale) / MINI.cell;
  return {
    sx: lerp(0, arrow[0] - cw / 2, e),
    sy: lerp(0, arrow[1] - ch / 2, e),
    sw: lerp(SCREEN_W, cw, e),
    sh: lerp(SCREEN_H, ch, e),
    dx: Math.round(lerp(0, MINI.x, e)),
    dy: Math.round(lerp(0, MINI.y, e)),
    dw: Math.round(lerp(SCREEN_W, MINI.w, e)),
    dh: Math.round(lerp(SCREEN_H, MINI.h, e)),
    mix: seg(t, foldAt + 0.72, foldAt + 0.97),
  };
}

export function foldCover(f: FoldState): MapCover {
  return {
    x0: Math.max(0, f.dx - 1),
    y0: Math.max(0, f.dy - 1),
    x1: Math.min(SCREEN_W, f.dx + f.dw + 1),
    y1: Math.min(SCREEN_H, f.dy + f.dh + 1),
    shows: (x, y) => !(f.mix > 0 && bayer(x, y) < f.mix),
  };
}

/** Screen px of a map point (cells) under a camera centre. */
export function onMap(
  point: { readonly x: number; readonly y: number },
  centre: { readonly x: number; readonly y: number },
  scale: number,
): readonly [number, number] {
  return [SCREEN_CX + (point.x - centre.x) * scale, SCREEN_CY + (point.y - centre.y) * scale];
}

/** Copies the composed map where the cover shows it; `rim` = a VOID frame on its edge. */
export function copyCover(screen: Uint8Array, map: Bmp, cover: MapCover, rim: boolean): void {
  const src = map.d;
  for (let y = cover.y0; y < cover.y1; y += 1)
    for (let x = cover.x0; x < cover.x1; x += 1) {
      if (!cover.shows(x, y)) continue;
      const i = y * SCREEN_W + x;
      const edge =
        rim && (x === cover.x0 || y === cover.y0 || x === cover.x1 - 1 || y === cover.y1 - 1);
      screen[i] = edge ? C.VOID : (src[i] ?? C.VOID);
    }
}

/** The frozen map squeezed into the fold's rect; outside it a VOID rim until the dither. */
export function blitFold(screen: Uint8Array, frozen: Bmp, f: FoldState): void {
  const src = frozen.d;
  for (let y = Math.max(0, f.dy - 1); y < Math.min(SCREEN_H, f.dy + f.dh + 1); y += 1)
    for (let x = Math.max(0, f.dx - 1); x < Math.min(SCREEN_W, f.dx + f.dw + 1); x += 1) {
      const i = y * SCREEN_W + x;
      const inside = x >= f.dx && y >= f.dy && x < f.dx + f.dw && y < f.dy + f.dh;
      if (!inside) {
        if (f.mix === 0) screen[i] = C.VOID;
        continue;
      }
      if (f.mix > 0 && bayer(x, y) < f.mix) continue;
      const qx = Math.floor(f.sx + ((x - f.dx + 0.5) * f.sw) / f.dw);
      const qy = Math.floor(f.sy + ((y - f.dy + 0.5) * f.sh) / f.dh);
      screen[i] =
        qx >= 0 && qy >= 0 && qx < SCREEN_W && qy < SCREEN_H
          ? (src[qy * SCREEN_W + qx] ?? C.VOID)
          : C.VOID;
    }
}
