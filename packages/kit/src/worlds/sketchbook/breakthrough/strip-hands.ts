/**
 * The other hand of the accordion strip (docs/worlds/sketchbook-v2/js/accordion-strip.js): the
 * left hand flat on the strip, two fingers pressing, that drags it (arrives, presses, drags with
 * the strip, lifts off or slides on to the next grip), and the graphite thumbprint it leaves.
 */
import type { InkCanvas } from '../draw/canvas.js';
import { at, ease, hash, seg } from '../draw/math.js';
import { ellipsePts, pixelPath, type Point, type Pts } from '../draw/paths.js';
import { INK, SOFT } from '../inks.js';
import { capsule } from './shapes.js';
import type { Pull } from './strip-plan.js';

export interface DragHand {
  /** Fingertip (page px). */
  readonly tip: Point;
  /** 0 = pressing .. 1 = in the air. */
  readonly lift: number;
}

const lerp2 = (a: Point, z: Point, k: number): Point => [
  a[0] + (z[0] - a[0]) * k,
  a[1] + (z[1] - a[1]) * k,
];

/** Where the left hand is at t (null = off the page); `grip(p, t)` = the pull's grip in page px. */
export function dragHandAt(
  pulls: readonly Pull[],
  t: number,
  grip: (p: Pull, t: number) => Point,
): DragHand | null {
  for (let i = 0; i < pulls.length; i += 1) {
    const p = pulls[i];
    if (!p) continue;
    const next = pulls[i + 1];
    const chained = next !== undefined && next.g0 === undefined;
    if (p.g0 !== undefined && t >= p.g0 && t < p.p0) {
      const k = ease('out', seg(t, p.g0, p.p0));
      const g = grip(p, p.p0);
      return { tip: lerp2([g[0] - 110, g[1] + 300], g, k), lift: 1 - 0.8 * k };
    }
    if (t >= p.p0 && t < p.d1) return { tip: grip(p, t), lift: 0.2 * (1 - seg(t, p.p0, p.d0)) };
    if (t >= p.d1 && chained && t < next.p0) {
      const k = seg(t, p.d1, next.p0);
      return {
        tip: lerp2(grip(p, p.d1), grip(next, next.p0), ease('inOut', k)),
        lift: 0.9 * Math.sin(Math.PI * k),
      };
    }
    if (t >= p.d1 && !chained && t < p.d1 + 0.22) {
      const k = ease('in', seg(t, p.d1, p.d1 + 0.22));
      const g = grip(p, p.d1);
      return { tip: lerp2(g, [g[0] - 80, g[1] + 320], k), lift: k };
    }
  }
  return null;
}

/** The left hand flat on the strip at its fingertip (page px), its shadow growing with the lift. */
export function paintDragHand(canvas: InkCanvas, hand: DragHand): void {
  const s = canvas.width / 960;
  const angle = (-62 * Math.PI) / 180;
  const [ca, sa] = [Math.cos(angle), Math.sin(angle)];
  const frame =
    (ox: number, oy: number) =>
    (u: number, v: number): Point => [
      (hand.tip[0] + ox + u * ca - v * sa) * s,
      (hand.tip[1] + oy + u * sa + v * ca) * s,
    ];
  const parts = (f: (u: number, v: number) => Point): Pts[] => [
    capsule(-142, 2, -480, 12, 29, f), // forearm
    capsule(-76, -3, -122, 1, 33, f), // palm
    capsule(-78, -24, -50, -27, 7, f), // ring finger, curled under
    capsule(-100, 31, -56, 36, 8.5, f), // thumb
    capsule(-72, -9, -8, -7, 7.5, f), // middle
    capsule(-70, 8, -12, 9, 7, f), // index
  ];
  const offset = 5 + 14 * hand.lift;
  canvas.remapped(SOFT, () => {
    for (const part of parts(frame(offset, offset * 1.1))) canvas.fillPoly(part, 0);
  });
  const f0 = frame(0, 0);
  for (const part of parts(f0)) {
    canvas.fillPoly(part, INK.COFFEE_L);
    canvas.outline(part, INK.COFFEE);
  }
  for (const [u, v] of [
    [-13, -7],
    [-16, 9],
  ] as const) {
    const nail = ellipsePts(0, 0, 3.4, 2.5, 10);
    const pts: Pts = [];
    for (let i = 0; i < nail.length; i += 2) pts.push(...f0(u + at(nail, i), v + at(nail, i + 1)));
    canvas.fillPoly(pts, INK.FIBRE);
  }
  // Knuckle creases.
  for (const v of [-9, 9]) {
    const pix = pixelPath([...f0(-44, v - 3), ...f0(-44, v + 3)], true);
    for (let i = 0; i < pix.length; i += 2) canvas.put(at(pix, i), at(pix, i + 1), INK.COFFEE);
  }
}

/** A graphite thumbprint where a finger pressed: broken concentric ridges, mapped onto the strip. */
export function paintThumbprint(
  canvas: InkCanvas,
  xf: (u: number, v: number) => Point,
  u: number,
  v: number,
  deg: number,
  seed: number,
): void {
  const s = canvas.width / 960;
  const a = (deg * Math.PI) / 180;
  const [ca, sa] = [Math.cos(a), Math.sin(a)];
  for (let r = 0; r < 5; r += 1) {
    const [rx, ry, n] = [2.2 + r * 1.9, 3 + r * 2.4, 10 + r * 6];
    for (let i = 0; i < n; i += 1) {
      if (hash(seed, r, i) < 0.3) continue;
      const t = (i / n) * Math.PI * 2;
      const [x, y] = [Math.cos(t) * rx, Math.sin(t) * ry];
      const p = xf(u + x * ca - y * sa, v + x * sa + y * ca);
      canvas.put(
        Math.round(p[0] * s),
        Math.round(p[1] * s),
        r === 4 && hash(seed, i, 7) < 0.5 ? INK.FIBRE : INK.GRAPH_L,
      );
    }
  }
}
