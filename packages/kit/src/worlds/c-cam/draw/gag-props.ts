/**
 * C-CAM gag props (PLAN.md#14.9): the held objects and suit hardware the Apollo film's small gags
 * are made of, ported call for call from `docs/concepts/c-cam-style/films/03-apollo-11/js/props.js`
 * (helmet, thumbs-up, checklist, mug, sandwich, sweat, gum bubble; `pores` lives in face.ts).
 * Flat shapes, crescents and hatching only; a pure function of the arguments (sweat drips on twos).
 * Divergences: explicit `BrushEnv` instead of the `ST.LW` global; `helmet`'s options are typed.
 *
 * Plus three small marks the generic gags (gags.ts) need, in the same grammar: `puff` (breath),
 * `ticks` (a tap / click / scratch mark), `watch` (a wristwatch face).
 *
 * Public API: `HelmetOptions`, `helmet`, `thumbsUp`, `checklist`, `mug`, `sandwich`, `sweat`,
 * `gumBubble`, `puff`, `ticks`, `watch`.
 */
import { C, hash, twos } from '../core.js';
import { brushStroke, curve, inkLine, tracePath, type BrushEnv } from './brushes.js';
import type { Paint2D } from './paint.js';
import { rect } from './scenery.js';
import { blob, ellipseRing, tube } from './shapes.js';

const RAD = Math.PI / 180;

export interface HelmetOptions {
  /** Gold sun visor pulled down. */
  readonly visor?: boolean;
  /** Visor x shift (head-local px; the films used 0 / 14 / 26 / 0 per view). */
  readonly vx?: number;
  readonly seed?: number;
}

/** Bubble helmet in head space: clear shell (flat light crescent, ink rim), optional gold visor. */
export function helmet(
  g: Paint2D,
  env: BrushEnv,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  o: HelmetOptions = {},
): void {
  const seed = o.seed || 5;
  const ring = ellipseRing(cx, cy, rx, ry, 16);
  if (o.visor) {
    const vx = o.vx || 0;
    // prettier-ignore
    blob(g, env, [cx - rx * 0.86 + vx, cy - ry * 0.5, cx + vx, cy - ry * 0.98, cx + rx * 0.86 + vx, cy - ry * 0.5, cx + rx * 0.8 + vx, cy + ry * 0.08, cx + vx, cy + ry * 0.2, cx - rx * 0.8 + vx, cy + ry * 0.08], C.GOLD, { lw: 6, seed: seed + 2, shade: [C.GOLD_D, -14, 10], light: ['rgba(240,220,160,0.45)', 10, -12], hatch: { c: 'rgba(60,40,10,0.35)', n: 3, len: 30, gap: 7, k: 2, ang: -30 } });
  }
  tracePath(g, curve(ring, true, 6), true);
  g.fillStyle = 'rgba(190,200,190,0.10)';
  g.fill();
  // prettier-ignore
  blob(g, env, [cx - rx * 0.72, cy - ry * 0.55, cx - rx * 0.4, cy - ry * 0.86, cx - rx * 0.2, cy - ry * 0.8, cx - rx * 0.52, cy - ry * 0.4], 'rgba(235,232,210,0.38)', { lw: 0, seed: seed + 1 });
  inkLine(g, env, curve(ring, true, 6), { w: 6, closed: true, seed });
}

/** A gloved (or bare) fist with the thumb up, wrist at (x, y) under it, thumb to screen-up. */
export function thumbsUp(
  g: Paint2D,
  env: BrushEnv,
  x: number,
  y: number,
  sz: number,
  col: string,
  colD: string,
  seed: number,
): void {
  // prettier-ignore
  blob(g, env, [x - sz * 0.5, y - sz * 0.92, x + sz * 0.46, y - sz * 0.96, x + sz * 0.5, y - sz * 0.1, x + sz * 0.1, y + sz * 0.12, x - sz * 0.46, y - sz * 0.08], col, { lw: 6, seed, shade: [colD, sz * 0.14, 4] });
  for (let i = 0; i < 3; i += 1) {
    // prettier-ignore
    brushStroke(g, env, [x + sz * 0.1, y - sz * (0.7 - i * 0.22), x + sz * 0.48, y - sz * (0.72 - i * 0.22)], { w: 3.5, seed: seed + 2 + i });
  }
  // prettier-ignore
  tube(g, env, [x - sz * 0.22, y - sz * 0.8, x - sz * 0.24, y - sz * 1.22, x - sz * 0.16, y - sz * 1.5], [sz * 0.36, sz * 0.32, sz * 0.27], col, { lw: 6, seed: seed + 6, shade: [colD, -4, 0] });
}

const PAGE_HATCH = { c: 'rgba(40,34,20,0.5)', n: 4, gap: 9, k: 3, ang: 0, bend: 0 } as const;

/** Flight checklist: a ring-bound card book centred at (x, y), width w; page in [0, 1) mid-flip. */
export function checklist(
  g: Paint2D,
  env: BrushEnv,
  x: number,
  y: number,
  w: number,
  page: number,
  seed: number,
): void {
  const h = w * 0.7;
  const hw = w / 2;
  const sheet = { ...PAGE_HATCH, len: hw * 0.6 };
  rect(g, env, x - hw - 6, y - h / 2 - 6, w + 12, h + 12, C.OLIVE_D, { seed, lw: 6 });
  rect(g, env, x - hw, y - h / 2, hw - 3, h, '#bdb393', { seed: seed + 1, lw: 4, hatch: sheet });
  rect(g, env, x + 3, y - h / 2, hw - 3, h, '#bdb393', { seed: seed + 2, lw: 4, hatch: sheet });
  rect(g, env, x + hw - 2, y - h * 0.38, 16, h * 0.18, C.MUSTARD, { seed: seed + 3, lw: 3 });
  if (page > 0.02) {
    const ex = x + hw * Math.cos(page * Math.PI);
    const lift = Math.sin(page * Math.PI) * h * 0.18;
    // prettier-ignore
    blob(g, env, [x, y - h / 2, ex, y - h / 2 - lift, ex, y + h / 2 - lift, x, y + h / 2], '#cfc6a6', { sharp: true, lw: 4, seed: seed + 4, shade: ['rgba(80,70,40,0.4)', page < 0.5 ? -10 : 10, 0] });
  }
  for (let i = 0; i < 4; i += 1) {
    const ring = ellipseRing(x, y - h * 0.36 + i * h * 0.24, 5, 9, 6);
    blob(g, env, ring, C.STONE_D, { lw: 3, seed: seed + 5 + i });
  }
}

/** Coffee mug gripped at (x, y), tilted `tilt` degrees; `steam` (0 none) curls above it. */
export function mug(
  g: Paint2D,
  env: BrushEnv,
  x: number,
  y: number,
  tilt: number,
  seed: number,
  steam: number,
): void {
  g.save();
  g.translate(x, y);
  g.rotate(tilt * RAD);
  tube(g, env, [30, -26, 50, -10, 30, 12], [12, 12, 12], C.MUSTARD_D, { lw: 5, seed: seed + 1 });
  // prettier-ignore
  blob(g, env, [-30, -44, 32, -44, 30, 30, 0, 36, -28, 30], C.MUSTARD, { sharp: true, lw: 6, seed, shade: [C.MUSTARD_D, -10, 0], mottle: ['rgba(60,40,10,0.3)', 2, 8] });
  blob(g, env, ellipseRing(1, -44, 31, 8, 10), '#2e2014', { lw: 5, seed: seed + 2 });
  g.restore();
  if (!steam) return;
  for (const i of [0, 1]) {
    // prettier-ignore
    brushStroke(g, env, [x - 8 + i * 16, y - 60, x + 4 + i * 16 + steam * 8, y - 92, x - 6 + i * 16, y - 126], { w: 3, color: 'rgba(200,195,170,0.6)', seed: seed + 3 + i });
  }
}

/** Sandwich (two slices, a lettuce edge) at (x, y) rotated `rot` degrees; bite = corner bitten. */
export function sandwich(
  g: Paint2D,
  env: BrushEnv,
  x: number,
  y: number,
  rot: number,
  seed: number,
  bite: number | boolean,
): void {
  g.save();
  g.translate(x, y);
  g.rotate(rot * RAD);
  const corner = bite ? [40, -6, 30, 4, 34, 14] : [46, 12];
  // prettier-ignore
  blob(g, env, [-46, 12, -44, 26, 44, 28, ...corner], '#b39a62', { sharp: true, lw: 5, seed: seed + 1, shade: ['#8a7344', -6, 4] });
  // prettier-ignore
  brushStroke(g, env, [-46, 8, -20, 14, 6, 6, 30, 14], { w: 8, color: C.OLIVE, seed: seed + 2, taper: false });
  // prettier-ignore
  blob(g, env, [-48, 6, -40, -14, 0, -20, 40, -14, 46, 6, ...(bite ? [32, 8, 26, -2] : [])], '#b9a068', { lw: 6, seed, shade: ['#8a7344', -8, 6], mottle: ['rgba(90,60,20,0.35)', 3, 6] });
  g.restore();
}

/** Sweat drops (head space): each spawn point `[x, y]` drips down and restarts, on twos. */
export function sweat(
  g: Paint2D,
  env: BrushEnv,
  pts: readonly (readonly [number, number])[],
  t: number,
  seed: number,
): void {
  const tt = twos(t);
  pts.forEach(([x, y], i) => {
    const dy = ((tt * 0.9 + hash(seed, i)) % 1) * 24;
    const r = 4 + 1.5 * hash(seed, i, 2);
    // prettier-ignore
    blob(g, env, [x, y + dy - r * 2.2, x + r, y + dy, x, y + dy + r, x - r, y + dy], '#c4c6b4', { lw: 3, seed: seed + i, light: ['rgba(255,255,240,0.5)', 2, -2] });
  });
}

/** Gum bubble at the lips: dull rose, flat highlight, ink rim; r < 2 draws nothing. */
export function gumBubble(
  g: Paint2D,
  env: BrushEnv,
  x: number,
  y: number,
  r: number,
  seed: number,
): void {
  if (r < 2) return;
  // prettier-ignore
  blob(g, env, ellipseRing(x + r * 0.15, y, r, r * 0.94, 14), '#9c5d63', { lw: 6, seed, shade: ['#7a434a', -r * 0.2, r * 0.2], light: ['rgba(230,200,190,0.35)', r * 0.25, -r * 0.25] });
}

/** A breath puff: three pale lumps with a faint rim drifting +x from (x, y); k in [0, 1] = how far gone. */
export function puff(g: Paint2D, env: BrushEnv, x: number, y: number, k: number, seed: number) {
  if (k <= 0 || k >= 1) return;
  const fade = 1 - k * 0.7;
  const fill = `rgba(214,210,190,${(0.8 * fade).toFixed(2)})`;
  const rim = `rgba(22,18,14,${(0.55 * fade).toFixed(2)})`;
  for (let i = 0; i < 3; i += 1) {
    const r = (8 + i * 5) * (0.7 + k);
    const ring = ellipseRing(x + (12 + i * 22) * (0.5 + k), y - i * 8 * k, r, r * 0.8, 8);
    blob(g, env, ring, fill, { lw: 2.5, lineColor: rim, seed: seed + i });
  }
}

/** Two or three short ink ticks radiating from (x, y) at angle `ang` degrees (0 = screen-up). */
export function ticks(
  g: Paint2D,
  env: BrushEnv,
  x: number,
  y: number,
  len: number,
  ang: number,
  seed: number,
): void {
  for (let i = -1; i <= 1; i += 1) {
    const a = (ang + i * 28) * RAD;
    const s = Math.sin(a);
    const c = -Math.cos(a);
    // prettier-ignore
    brushStroke(g, env, [x + s * len * 0.5, y + c * len * 0.5, x + s * len * 1.3, y + c * len * 1.3], { w: 3, seed: seed + i, taper: false });
  }
}

/** A wristwatch face at (x, y), radius r; the second hand steps once per second. */
export function watch(
  g: Paint2D,
  env: BrushEnv,
  x: number,
  y: number,
  r: number,
  t: number,
  seed: number,
): void {
  blob(g, env, ellipseRing(x, y, r, r, 10), '#c2b996', { lw: 4, seed, shade: ['#9a9174', -2, 2] });
  const a = Math.floor(t) * 6 * RAD;
  // prettier-ignore
  brushStroke(g, env, [x, y, x + Math.sin(a) * r * 0.8, y - Math.cos(a) * r * 0.8], { w: 2.5, seed: seed + 1, taper: false });
}
