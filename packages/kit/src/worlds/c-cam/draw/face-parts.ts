/**
 * C-CAM faces (PLAN.md#14.4), part 2: the eye, brow and mouth brushes. They read a `FaceState`
 * (face.ts) and draw in the caller's (head-local) space; characters place and size them per view.
 *
 * Port of `face.js` (`ST.eye`, `ST.brow`, `ST.mouth`) of film 3 (identical in films 1-2).
 * Divergences:
 *  - explicit `BrushEnv` instead of the `ST.LW` global (ink widths), no module state;
 *  - the pupil is `ellipse(px, py, pr, pr, 0, 0, TAU)`: `Paint2D` has no `arc` (same circle);
 *  - `eye` requires `skin` (the original painted lids with `fillStyle = undefined`, which a canvas
 *    ignores, i.e. it kept the previous fill: always pass the skin colour);
 *  - `mouth` shapes and teeth sets are typed, so the original's `[0, 0]` corner fallback for an
 *    unknown shape is unreachable and dropped.
 */
import { C, rnd } from '../core.js';
import { TAU, brushStroke, curve, inkLine, tracePath, type BrushEnv } from './brushes.js';
import type { FaceState, MouthShape, Pair } from './face.js';
import type { Paint2D } from './paint.js';
import { blob } from './shapes.js';

export interface EyeOptions {
  /** Lid colour (the character's skin). */
  readonly skin: string;
  readonly seed?: number;
  /** Eye white (default the dirty `C.EYE`). */
  readonly white?: string;
  /** 0 = left eye (reads `f.sq[0]`), 1 = right. */
  readonly side?: 0 | 1;
  /** Extra lid cover added to the expression's. */
  readonly lidAdd?: number;
  readonly lw?: number;
  /** false = no bag under the eye. */
  readonly bag?: boolean;
  /** 2 = a second, fainter bag. */
  readonly bags?: 1 | 2;
}

/** Egg-shaped dirty-white eye, tiny pupil, heavy upper lid in skin colour, double bag under it. */
export function eye(
  g: Paint2D,
  env: BrushEnv,
  x: number,
  y: number,
  radiusX: number,
  radiusY: number,
  f: FaceState,
  o: EyeOptions,
): void {
  const rx = radiusX * f.eye;
  const ry = radiusY * f.eye;
  const seed = o.seed || 3;
  const pts: number[] = [];
  for (let i = 0; i < 9; i += 1) {
    const a = (i / 9) * TAU - Math.PI / 2;
    const egg = Math.sin(a) > 0 ? 1.06 : 0.94;
    const j = 1 + rnd(-0.07, 0.07, seed, i);
    pts.push(x + Math.cos(a) * rx * j, y + Math.sin(a) * ry * egg * j);
  }
  const c = curve(pts, true, 3);
  tracePath(g, c, true);
  g.fillStyle = o.white || C.EYE;
  g.fill();
  g.save();
  tracePath(g, c, true);
  g.clip();
  const pr = Math.max(rx * 0.14 * f.pup, 2.2);
  const px = x + f.look[0] * rx * 0.55;
  const py = y + f.look[1] * ry * 0.42;
  g.fillStyle = C.INK;
  g.beginPath();
  g.ellipse(px, py, pr, pr, 0, 0, TAU);
  g.fill();
  const lid = Math.min(1, f.lid + (o.lidAdd || 0));
  const ly = y - ry * 1.1 + lid * 2.25 * ry;
  if (lid > 0.02) {
    g.fillStyle = o.skin;
    // prettier-ignore
    tracePath(g, [x - rx * 1.4, y - ry * 1.5, x + rx * 1.4, y - ry * 1.5, x + rx * 1.4, ly, x, ly + ry * 0.12, x - rx * 1.4, ly], true);
    g.fill();
  }
  const sq = f.sq[o.side || 0];
  if (sq > 0) {
    const sy = y + ry * 1.05 - sq * 2 * ry;
    g.fillStyle = o.skin;
    // prettier-ignore
    tracePath(g, [x - rx * 1.4, y + ry * 1.5, x - rx * 1.4, sy + ry * 0.1, x, sy - ry * 0.1, x + rx * 1.4, sy + ry * 0.1, x + rx * 1.4, y + ry * 1.5], true);
    g.fill();
  }
  g.restore();
  const lw = o.lw || 5;
  inkLine(g, env, c, { w: lw, closed: true, seed });
  if (lid > 0.02 && lid < 0.97) {
    const d = Math.max(0, 1 - Math.pow((ly - y) / (ry * 1.02), 2));
    const hw = rx * Math.sqrt(d) * 1.08;
    if (hw > 1) {
      brushStroke(g, env, [x - hw, ly, x, ly + ry * 0.1, x + hw, ly], {
        w: lw * 1.5,
        seed: seed + 1,
        taper: false,
      });
    }
  } else if (lid >= 0.97) {
    brushStroke(g, env, [x - rx, y + ry * 0.1, x, y + ry * 0.45, x + rx, y + ry * 0.1], {
      w: lw * 1.3,
      seed: seed + 2,
    });
  }
  if (o.bag !== false) {
    // prettier-ignore
    brushStroke(g, env, [x - rx * 0.85, y + ry * 1.12, x, y + ry * 1.42, x + rx * 0.95, y + ry * 1.1], { w: lw * 0.7, seed: seed + 4 });
    if (o.bags === 2) {
      // prettier-ignore
      brushStroke(g, env, [x - rx * 0.6, y + ry * 1.6, x + rx * 0.1, y + ry * 1.82, x + rx * 0.75, y + ry * 1.55], { w: lw * 0.5, seed: seed + 5 });
    }
  }
}

export interface BrowOptions {
  /** Eye height unit (default 20): raise/knit distances scale with it. */
  readonly u?: number;
  /** Stroke width (default 14). */
  readonly thick?: number;
  readonly color?: string;
  readonly seed?: number;
  /** Arch height factor (default 1). */
  readonly arch?: number;
  /** Outer end drop in px. */
  readonly droop?: number;
}

/** Heavy brow: one tapered brush stroke. side -1 = screen-left brow (`f.bl`), +1 = screen-right. */
export function brow(
  g: Paint2D,
  env: BrushEnv,
  x: number,
  y: number,
  w: number,
  side: -1 | 1,
  f: FaceState,
  o: BrowOptions = {},
): void {
  const [raise, knit] = side < 0 ? f.bl : f.br;
  const u = o.u || 20;
  const yy = y - raise * u * 0.6;
  const ix = x - (side * w) / 2;
  const ox = x + (side * w) / 2;
  const iy = yy + knit * u * 0.5;
  const oy = yy - knit * u * 0.12 + (o.droop || 0);
  const mx = (ix + ox) / 2;
  const my = (iy + oy) / 2 - u * 0.28 * (o.arch === undefined ? 1 : o.arch);
  brushStroke(g, env, [ox, oy, mx, my, ix, iy], {
    w: o.thick || 14,
    seed: o.seed || 9,
    ...(o.color === undefined ? {} : { color: o.color }),
  });
}

export type TeethSet = 'few' | 'snag' | 'gap' | 'row' | 'none';

export interface MouthOptions {
  readonly seed?: number;
  readonly lw?: number;
  /** Opening at jaw 1 (default 0.6 w). */
  readonly open?: number;
  readonly teeth?: TeethSet;
  /** `[u, h]` lower teeth jutting over the lip even when closed (u in half-widths). */
  readonly under?: readonly Pair[];
}

const CORNERS: Readonly<Record<MouthShape, Pair>> = {
  flat: [0.05, -0.04],
  smirk: [0.12, -0.3],
  frown: [0.3, 0.3],
  grin: [-0.16, -0.22],
  twist: [-0.16, 0.2],
  wavy: [0.08, 0.1],
  open: [0.08, 0.08],
  yell: [0.1, 0.06],
  snarl: [0.04, -0.12],
};

/** `[u, width]` per tooth, u and width in half-widths of the mouth. */
// prettier-ignore
const TEETH: Readonly<Record<TeethSet, readonly Pair[]>> = {
  few: [[-0.5, 0.2], [-0.12, 0.24], [0.38, 0.17]],
  snag: [[0.15, 0.24]],
  gap: [[-0.55, 0.18], [-0.3, 0.2], [0.3, 0.2], [0.55, 0.15]],
  row: [[-0.6, 0.2], [-0.36, 0.22], [-0.12, 0.22], [0.14, 0.2], [0.38, 0.21], [0.6, 0.17]],
  none: [],
};

/**
 * Mouth: closed shapes (jaw opening < 4 px) are crooked brush lines; open shapes are a dark hole
 * with a tongue and yellow, uneven, crooked teeth. Returns the y of the lower lip.
 */
export function mouth(
  g: Paint2D,
  env: BrushEnv,
  x: number,
  y: number,
  w: number,
  f: FaceState,
  o: MouthOptions = {},
): number {
  const kind = f.mouth;
  const seed = o.seed || 17;
  const hw = w / 2;
  const lw = o.lw || 5;
  const h = f.jaw * (o.open || w * 0.6);
  const corner = CORNERS[kind];
  const lx = x - hw;
  const rx = x + hw;
  const ly = y + corner[0] * w;
  const ry = y + corner[1] * w;
  const under = (): void => {
    (o.under || []).forEach(([u, th], i) => {
      const tx = x + u * hw;
      const top = y - th + (h >= 4 ? h * 0.9 : 0);
      // prettier-ignore
      blob(g, env, [tx - 5, top + th + 2, tx - 4, top + 3, tx + 2, top - 1, tx + 6, top + th + 2], C.TOOTH, { sharp: true, lw: lw * 0.55, seed: seed + 30 + i, shade: [C.TOOTH_D, -2, 0] });
    });
  };
  if (h < 4) {
    const mid = kind === 'frown' ? -0.1 : kind === 'grin' || kind === 'smirk' ? 0.12 : 0.03;
    const pts =
      kind === 'wavy'
        ? [lx, ly, x - hw * 0.5, y - 4, x, y + 4, x + hw * 0.5, y - 4, rx, ry]
        : [lx, ly, x - hw * 0.2, y + mid * w + 3, x + hw * 0.35, y + mid * w - 1, rx, ry];
    brushStroke(g, env, pts, { w: lw * 1.3, seed, taper: false });
    brushStroke(g, env, [rx - 2, ry - 8, rx + 5, ry + 4], { w: lw * 0.6, seed: seed + 1 });
    brushStroke(g, env, [lx + 3, ly - 6, lx - 4, ly + 5], { w: lw * 0.5, seed: seed + 2 });
    under();
    return y;
  }
  const top = kind === 'snarl' ? y - h * 0.25 : kind === 'grin' ? y - h * 0.05 : y - h * 0.1;
  const wide = kind === 'open' ? 0.72 : kind === 'yell' ? 1.08 : 1;
  const L = x - hw * wide;
  const R = x + hw * wide;
  // prettier-ignore
  const pts =
    kind === 'yell'
      ? [L, ly, x - hw * 0.4, top, x + hw * 0.45, top - 3, R, ry, x + hw * 0.6, y + h, x - hw * 0.5, y + h * 1.04]
      : [L, ly, x - hw * 0.45, top + (kind === 'snarl' ? h * 0.2 : 0), x + hw * 0.3, top, R, ry, x + hw * 0.25, y + h, x - hw * 0.35, y + h * 0.92];
  const c = curve(pts, true, 3);
  tracePath(g, c, true);
  g.fillStyle = C.MOUTH;
  g.fill();
  g.save();
  tracePath(g, c, true);
  g.clip();
  g.fillStyle = C.TONGUE;
  g.beginPath();
  g.ellipse(x + hw * 0.1, y + h * 1.0, hw * 0.55, h * 0.38, 0, 0, TAU);
  g.fill();
  const th = Math.min(h * 0.5, w * 0.22);
  TEETH[o.teeth || 'few'].forEach(([u, tw], i) => {
    const tx = x + u * hw * wide;
    const tw2 = tw * hw;
    const ty = top - 4 + rnd(-3, 3, seed, i);
    const sk = rnd(-0.3, 0.3, seed, i, 2) * tw2;
    // prettier-ignore
    blob(g, env, [tx - tw2 / 2, ty, tx + tw2 / 2, ty, tx + tw2 / 2 - 1 + sk, ty + th * rnd(0.7, 1.2, seed, i, 1), tx - tw2 / 2 + 1 + sk, ty + th], C.TOOTH, { sharp: true, lw: lw * 0.5, seed: seed + i, shade: [C.TOOTH_D, -2, 0] });
  });
  g.restore();
  inkLine(g, env, c, { w: lw * 1.2, closed: true, seed });
  under();
  return y + h;
}
