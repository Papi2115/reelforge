/**
 * C-CAM grime (PLAN.md#14.4): everything dirty is a drawn flat shape or hatching, never a texture,
 * gradient, noise field or blur. Stain, peel (plaster fallen off to show brick), crack, cobbles, a
 * crooked half-timbered house, a leaded window with a shutter, puddle, flies. All placement comes
 * from the integer hash of a seed.
 *
 * Port of `docs/concepts/c-cam-style/films/03-apollo-11/js/grime.js` (md5-identical in films 1-3).
 * Divergences:
 *  - explicit `BrushEnv` instead of the `ST.LW` global (ink widths), no module state;
 *  - `ST.window` is `windowPane` (the identifier `window` is forbidden in scene code);
 *  - `house` options default to `{}` (the original threw without an options object) and its
 *    return value is typed (`HouseFrame`);
 *  - `flies` reads the acting clock through `twos` and `ANIM` (= the original's literal 12).
 * Engine leftovers kept as they are (08-KNOWN_ISSUES #16: `house`, `windowPane`, `cobbles` were
 * only used by film 2); no bug needed fixing: the tests compare every function call by call with
 * the original loaded in `node:vm`.
 */
import { ANIM, C, hash, rnd, twos } from '../core.js';
import { inkLine, tracePath, type BrushEnv } from './brushes.js';
import type { Paint2D } from './paint.js';
import { beam, bricks, rect, rough, wobble } from './scenery.js';
import { blob, ellipseRing } from './shapes.js';

/** Flat irregular stain (damp, soot, piss, wine) that drips downward; no outline. */
export function stain(
  g: Paint2D,
  env: BrushEnv,
  x: number,
  y: number,
  w: number,
  h: number,
  seed: number,
  col?: string,
): void {
  const pts: number[] = [];
  for (let i = 0; i < 9; i += 1) {
    const a = (i / 9) * Math.PI * 2;
    const r = 0.6 + 0.45 * hash(seed, i, 1);
    const drip = Math.sin(a) > 0 ? h * 0.25 * hash(seed, i, 2) : 0;
    pts.push(x + Math.cos(a) * w * 0.5 * r, y + Math.sin(a) * h * 0.5 * r + drip);
  }
  blob(g, env, pts, col || 'rgba(40,30,15,0.22)', { lw: 0, seed });
}

/** Peeled plaster: a jagged hole in the render showing brick courses, ink edge. */
export function peel(
  g: Paint2D,
  env: BrushEnv,
  x: number,
  y: number,
  w: number,
  h: number,
  seed: number,
): void {
  // prettier-ignore
  const pts = wobble([x, y, x + w * 0.6, y - h * 0.1, x + w, y + h * 0.3, x + w * 0.8, y + h, x + w * 0.2, y + h * 0.85], Math.min(w, h) * 0.12, seed, 26);
  blob(g, env, pts, '#7a4e3a', { sharp: true, lw: 0, seed });
  g.save();
  tracePath(g, pts, true);
  g.clip();
  bricks(g, env, x - 4, y - h * 0.2, w + 8, h * 1.3, {
    bh: 16,
    bw: 38,
    seed,
    line: 'rgba(30,18,12,0.55)',
    tone: 'rgba(0,0,0,0.18)',
    density: 0.3,
  });
  g.restore();
  inkLine(g, env, pts, { w: 4, closed: true, seed });
}

/** A crack: a 5-point ink polyline wandering from (x, y) along `ang` radians (default 1.2). */
export function crack(
  g: Paint2D,
  env: BrushEnv,
  x: number,
  y: number,
  len: number,
  seed: number,
  ang = 1.2,
): void {
  const pts = [x, y];
  let cx = x;
  let cy = y;
  for (let i = 1; i < 5; i += 1) {
    const a = ang + rnd(-0.6, 0.6, seed, i);
    cx += (Math.cos(a) * len) / 4;
    cy += (Math.sin(a) * len) / 4;
    pts.push(cx, cy);
  }
  inkLine(g, env, pts, { w: 3.5, seed });
}

/** Cobbled ground in perspective rows: flat stones with ink edges, smaller toward the horizon. */
export function cobbles(
  g: Paint2D,
  env: BrushEnv,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  seed: number,
  col?: string,
  colD?: string,
): void {
  rect(g, env, x0, y0, x1 - x0, y1 - y0, colD || '#4b4538', { seed, lw: 0 });
  for (let r = 0, y = y0; y < y1; r += 1) {
    const k = 0.35 + 0.65 * ((y - y0) / (y1 - y0));
    const h = 26 * k + 6;
    const w = 70 * k + 14;
    for (let x = x0 - hash(seed, r) * w; x < x1; x += w) {
      const j = hash(seed, r, x | 0);
      // prettier-ignore
      blob(g, env, ellipseRing(x + w / 2, y + h / 2, w * 0.44, h * 0.4, 7), j < 0.2 ? '#5f574a' : col || '#6c6455', { lw: 3, seed: seed + r * 31 + (x | 0) });
    }
    y += h;
  }
}

export interface HouseOptions {
  readonly seed?: number;
  /** Px the top drifts sideways. */
  readonly lean?: number;
  readonly floors?: number;
  readonly plaster?: string;
  /** Px each upper floor overhangs (default 14). */
  readonly jetty?: number;
  /** false = no peeled patches. */
  readonly peel?: boolean;
  /** Beam width (default 18). */
  readonly beam?: number;
  /** Warmly lit windows. */
  readonly lit?: boolean;
  /** Roof height (default 0.45 h). */
  readonly roof?: number;
  readonly roofLean?: number;
  readonly roofCol?: string;
}

/** The house outline: left/right wall x at a given y, wall top and roof ridge y. */
export interface HouseFrame {
  readonly left: (y: number) => number;
  readonly right: (y: number) => number;
  readonly top: number;
  readonly roofTop: number;
}

/**
 * Crooked half-timbered house: plaster panels, heavy dark beams (posts, rails, braces), jettied
 * upper floors that overhang and lean, small leaded windows with shutters, a steep roof.
 */
export function house(
  g: Paint2D,
  env: BrushEnv,
  x: number,
  base: number,
  w: number,
  h: number,
  o: HouseOptions = {},
): HouseFrame {
  const seed = o.seed || 1;
  const lean = o.lean || 0;
  const floors = o.floors || 3;
  const fh = h / floors;
  const plaster = o.plaster || '#857a5c';
  const L = (y: number): number => x + lean * ((base - y) / h);
  const Rr = (y: number): number =>
    x + w + lean * ((base - y) / h) + (o.jetty || 14) * Math.floor((base - y) / fh);
  const top = base - h;
  // prettier-ignore
  rough(g, env, [L(base), base, Rr(base), base, Rr(top), top, L(top), top], plaster, { seed, lw: 6, shade: ['rgba(0,0,0,0.2)', -24, 0], mottle: ['rgba(60,50,30,0.22)', 6, 40], hatch: { c: 'rgba(30,24,12,0.35)', n: 8, len: 40, gap: 8, k: 3, ang: 80 } });
  const splash = base - fh * 0.35;
  // prettier-ignore
  rough(g, env, [L(base), base, Rr(base), base, Rr(splash), splash, L(splash), splash], 'rgba(40,32,18,0.3)', { seed: seed + 5, lw: 0 });
  for (let i = 0; i < 5; i += 1) {
    // prettier-ignore
    stain(g, env, L(base) + w * rnd(0.1, 0.9, seed, i), base - h * rnd(0.1, 0.8, seed, i, 1), 60 + 50 * hash(seed, i, 2), 40 + 40 * hash(seed, i, 3), seed + i);
  }
  if (o.peel !== false) {
    [0, 1].forEach((k) => {
      // prettier-ignore
      peel(g, env, L(base) + w * rnd(0.1, 0.75, seed, 7, k), base - fh * (k + rnd(0.3, 0.7, seed, 8, k)), 60 + 40 * k, 44 + 20 * k, seed + 9 + k);
    });
  }
  const bw = o.beam || 18;
  for (let f = 0; f < floors; f += 1) {
    const yb = base - f * fh;
    const yt = yb - fh;
    beam(g, env, L(yb) - 6, yb, Rr(yb) + 6, yb, bw, seed + 20 + f);
    const posts = Math.max(2, Math.round(w / 110));
    for (let k = 0; k <= posts; k += 1) {
      const u = k / posts;
      const xb = L(yb) + (Rr(yb) - L(yb)) * u;
      const xt = L(yt) + (Rr(yt) - L(yt)) * u;
      beam(g, env, xb, yb, xt, yt, bw * 0.85, seed + 30 + f * 10 + k);
      if (k < posts && hash(seed, f, k) < 0.28) {
        // prettier-ignore
        beam(g, env, xb + 8, yb - 6, L(yt) + (Rr(yt) - L(yt)) * ((k + 1) / posts) - 8, yt + 8, bw * 0.6, seed + 60 + f * 10 + k);
      } else if (k < posts && f > 0) {
        // prettier-ignore
        windowPane(g, env, (xb + L(yt) + (Rr(yt) - L(yt)) * ((k + 0.5) / posts)) / 2 + (Rr(yb) - L(yb)) / posts / 4, yb - fh * 0.62, Math.min(60, (w / posts) * 0.45), fh * 0.38, seed + 70 + f * 10 + k, o.lit);
      }
    }
  }
  beam(g, env, L(top) - 10, top, Rr(top) + 10, top, bw * 1.2, seed + 90);
  const rh = o.roof || h * 0.45;
  const rx = (L(top) + Rr(top)) / 2 + (o.roofLean || 0);
  // prettier-ignore
  rough(g, env, [L(top) - 30, top, rx, top - rh, Rr(top) + 30, top], o.roofCol || '#5a3c30', { seed: seed + 91, lw: 6, shade: ['rgba(0,0,0,0.25)', -20, 0], hatch: { c: 'rgba(20,10,6,0.5)', n: 8, len: 40, gap: 9, k: 3, ang: 15, bend: 0.02 } });
  return { left: L, right: Rr, top, roofTop: top - rh };
}

/** Small leaded window centred at (cx, cy): dark (or warmly lit) panes, lead cross, a shutter. */
export function windowPane(
  g: Paint2D,
  env: BrushEnv,
  cx: number,
  cy: number,
  w: number,
  h: number,
  seed: number,
  lit?: boolean,
): void {
  // prettier-ignore
  rect(g, env, cx - w / 2 - w * 0.5, cy - h / 2, w * 0.45, h, C.OLIVE_D, { seed: seed + 1, lw: 4, hatch: { c: 'rgba(10,10,4,0.5)', n: 2, len: h * 0.6, gap: 6, k: 3, ang: 90, bend: 0 } });
  rect(g, env, cx - w / 2, cy - h / 2, w, h, lit ? '#c98f3e' : '#2b2a25', {
    seed,
    lw: 5,
    amp: 1.5,
  });
  g.strokeStyle = lit ? '#6b4a20' : '#4b4a40';
  g.lineWidth = 2.5 * env.lw;
  g.beginPath();
  for (let i = 1; i < 3; i += 1) {
    g.moveTo(cx - w / 2 + (w * i) / 3, cy - h / 2);
    g.lineTo(cx - w / 2 + (w * i) / 3, cy + h / 2);
  }
  g.moveTo(cx - w / 2, cy);
  g.lineTo(cx + w / 2, cy);
  g.stroke();
}

/** Puddle: a flat wobbly ellipse in the sky colour with a pale rim light. */
export function puddle(
  g: Paint2D,
  env: BrushEnv,
  x: number,
  y: number,
  w: number,
  seed: number,
  sky?: string,
): void {
  // prettier-ignore
  blob(g, env, wobble(ellipseRing(x, y, w, w * 0.18, 10), w * 0.06, seed, 20), sky || '#6f7268', { lw: 4, seed, light: ['rgba(220,215,190,0.25)', 6, -2] });
}

/** A cluster of 6 flies over muck: tiny dashes jittering on twos (a pure function of t). */
export function flies(g: Paint2D, x: number, y: number, t: number, seed: number): void {
  g.fillStyle = C.INK;
  const tt = Math.floor(twos(t) * ANIM);
  for (let i = 0; i < 6; i += 1) {
    g.fillRect(x + rnd(-40, 40, seed, i, tt), y + rnd(-30, 30, seed, i, tt + 7), 4, 3);
  }
}
