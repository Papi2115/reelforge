/**
 * C-CAM brushes (PLAN.md#14.3), part 3: scenery. Hand-wobbled architecture (wobble, rough, rect,
 * beam), flat sky bands, stars, stepped light pools, gloom, brick courses. Everything draws
 * through `Paint2D`; ink widths come from the explicit `BrushEnv` (see brushes.ts for the list of
 * divergences from the original `brushes.js`, which apply here too: no `ST.LW` global).
 *
 * Moved out of brushes.ts only to keep both files under the 400-line limit.
 */
import { C, hash, rnd } from '../core.js';
import { TAU, tracePath, type BrushEnv, type Pts } from './brushes.js';
import { blob, tube, type BlobOptions } from './shapes.js';
import type { Paint2D } from './paint.js';

const num = (values: Pts, index: number): number => values[index] ?? 0;

/** Architecture: polygon with hand-wobbled edges (corners stay sharp). */
export function wobble(pts: Pts, amp: number, seed: number, step = 0): number[] {
  const n = pts.length >> 1;
  const out: number[] = [];
  for (let i = 0; i < n; i += 1) {
    const ax = num(pts, 2 * i);
    const ay = num(pts, 2 * i + 1);
    const bx = num(pts, (2 * i + 2) % pts.length);
    const by = num(pts, (2 * i + 3) % pts.length);
    const m = Math.max(1, Math.round(Math.hypot(bx - ax, by - ay) / (step || 80)));
    for (let k = 0; k < m; k += 1) {
      const j = k === 0 ? 0 : amp;
      out.push(
        ax + ((bx - ax) * k) / m + rnd(-j, j, seed, i, k, 1),
        ay + ((by - ay) * k) / m + rnd(-j, j, seed, i, k, 2),
      );
    }
  }
  return out;
}

export interface RoughOptions extends BlobOptions {
  /** Edge wobble amplitude in px (default 3). */
  readonly amp?: number;
}

/** A sharp-cornered, hand-wobbled polygon, filled like a blob (outline 5 by default). */
export function rough(
  g: Paint2D,
  env: BrushEnv,
  pts: Pts,
  fill: string,
  o: RoughOptions = {},
): number[] {
  return blob(g, env, wobble(pts, o.amp || 3, o.seed || 5), fill, { sharp: true, lw: 5, ...o });
}

export function rect(
  g: Paint2D,
  env: BrushEnv,
  x: number,
  y: number,
  w: number,
  h: number,
  fill: string,
  o: RoughOptions = {},
): number[] {
  return rough(g, env, [x, y, x + w, y, x + w, y + h, x, y + h], fill, o);
}

/** A heavy timber beam between two points (half-timbering, rafters, posts). */
export function beam(
  g: Paint2D,
  env: BrushEnv,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  w: number,
  seed: number,
  col?: string,
): number[] {
  return tube(g, env, [x0, y0, x1, y1], [w, w * 0.92], col || C.TIMBER, {
    lw: 4,
    seed,
    hatch: {
      c: 'rgba(10,8,6,0.5)',
      n: 2,
      len: 26,
      gap: 5,
      k: 2,
      ang: (Math.atan2(y1 - y0, x1 - x0) * 180) / Math.PI,
      bend: 0.04,
    },
  });
}

/** Flat poster sky: horizontal bands with gently wavy seams (no gradients). */
export function bands(
  g: Paint2D,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  cols: readonly string[],
  seed: number,
): void {
  const bh = (y1 - y0) / cols.length;
  cols.forEach((col, i) => {
    const top = y0 + i * bh;
    const pts: number[] = [];
    for (let x = x0; x <= x1 + 1; x += (x1 - x0) / 12) {
      pts.push(x, top + (i ? Math.sin(x / 210 + i * 1.7 + seed) * bh * 0.18 : 0));
    }
    pts.push(x1, y1, x0, y1);
    g.fillStyle = col;
    tracePath(g, pts, true);
    g.fill();
  });
}

/** `n` square stars (1.6 px, a few 3.2 px) hashed into the box. */
export function stars(
  g: Paint2D,
  x0: number,
  y0: number,
  w: number,
  h: number,
  n: number,
  seed: number,
  col?: string,
): void {
  g.fillStyle = col || '#b9b39a';
  for (let i = 0; i < n; i += 1) {
    const r = hash(seed, i, 3) < 0.12 ? 3.2 : 1.6;
    g.fillRect(x0 + hash(seed, i, 1) * w - r / 2, y0 + hash(seed, i, 2) * h - r / 2, r, r);
  }
}

/** Stepped light pool / lamp halo: 3 flat concentric ellipses (posterised, never a soft gradient). */
export function pool(
  g: Paint2D,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  col: string,
  alpha: number,
): void {
  g.fillStyle = col;
  for (const k of [1, 0.66, 0.36]) {
    g.globalAlpha = alpha;
    g.beginPath();
    g.ellipse(cx, cy, rx * k, ry * k, 0, 0, TAU);
    g.fill();
  }
  g.globalAlpha = 1;
}

/** Darkness: one flat translucent shape over the whole frame except a stepped hole around the warm source. */
export function gloom(
  g: Paint2D,
  x0: number,
  y0: number,
  w: number,
  h: number,
  cx: number,
  cy: number,
  r: number,
  col: string,
  alpha: number,
): void {
  g.fillStyle = col;
  [1, 0.72, 0.5].forEach((k, i) => {
    g.globalAlpha = alpha * (i === 0 ? 1 : 0.55);
    g.beginPath();
    g.rect(x0, y0, w, h);
    g.ellipse(cx, cy, r / k, (r * 0.8) / k, 0, 0, TAU, true);
    g.fill();
  });
  g.globalAlpha = 1;
}

export interface BrickOptions {
  /** Brick height / width (defaults 22 / 56). */
  readonly bh?: number;
  readonly bw?: number;
  readonly seed?: number;
  /** Share of blocks in the second tone (default 0.18). */
  readonly density?: number;
  readonly tone?: string;
  readonly line?: string;
  readonly lw?: number;
}

/** Brick / stone courses: mortar lines + a few blocks in a second flat tone (drawn on top of a filled wall). */
export function bricks(
  g: Paint2D,
  env: BrushEnv,
  x0: number,
  y0: number,
  w: number,
  h: number,
  o: BrickOptions = {},
): void {
  const bh = o.bh || 22;
  const bw = o.bw || 56;
  const seed = o.seed || 7;
  g.save();
  g.beginPath();
  g.rect(x0, y0, w, h);
  g.clip();
  g.fillStyle = o.tone || 'rgba(0,0,0,0.13)';
  for (let r = 0; r * bh < h; r += 1) {
    for (let c = -1; c * bw < w; c += 1) {
      if (hash(seed, r, c) > (o.density || 0.18)) continue;
      g.fillRect(x0 + c * bw + (r % 2) * bw * 0.5, y0 + r * bh, bw - 3, bh - 3);
    }
  }
  g.strokeStyle = o.line || 'rgba(22,18,14,0.5)';
  g.lineWidth = (o.lw || 2.2) * env.lw;
  g.beginPath();
  for (let r = 0; r * bh < h; r += 1) {
    const y = y0 + r * bh;
    g.moveTo(x0, y + rnd(-1.5, 1.5, seed, r));
    g.lineTo(x0 + w, y + rnd(-1.5, 1.5, seed, r, 1));
    for (let c = -1; c * bw < w; c += 1) {
      const x = x0 + c * bw + (r % 2) * bw * 0.5;
      g.moveTo(x, y);
      g.lineTo(x + rnd(-2, 2, seed, r, c), y + bh);
    }
  }
  g.stroke();
  g.restore();
}
