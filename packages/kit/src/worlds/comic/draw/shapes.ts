/** Point-list shapes of the Comic page: wobbly ellipses, capsules, rotations, line boil. */
import type { Pts } from './canvas.js';
import { rnd } from './math.js';

/** Ellipse outline with `steps` points; an optional seeded low-frequency wobble (hand-cut). */
export function ellipsePts(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  steps: number,
  wobbleKey?: string,
  wobble = 0,
): number[] {
  const pts: number[] = [];
  const p1 = wobbleKey === undefined ? 0 : rnd(wobbleKey, 1) * 6.28;
  const p2 = wobbleKey === undefined ? 0 : rnd(wobbleKey, 2) * 6.28;
  for (let i = 0; i < steps; i += 1) {
    const a = (i / steps) * Math.PI * 2;
    const k =
      wobbleKey === undefined
        ? 1
        : 1 + wobble * Math.sin(a * 3 + p1) + wobble * 0.6 * Math.sin(a * 5 + p2);
    pts.push(cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k);
  }
  return pts;
}

/** A stadium from (x0, y0) to (x1, y1) of radius r (fingers, limbs). */
export function capsulePts(x0: number, y0: number, x1: number, y1: number, r: number): number[] {
  const a = Math.atan2(y1 - y0, x1 - x0);
  const pts: number[] = [];
  for (let i = 0; i <= 8; i += 1) {
    const t = a + Math.PI / 2 + (i / 8) * Math.PI;
    pts.push(x0 + Math.cos(t) * r, y0 + Math.sin(t) * r);
  }
  for (let i = 0; i <= 8; i += 1) {
    const t = a - Math.PI / 2 + (i / 8) * Math.PI;
    pts.push(x1 + Math.cos(t) * r, y1 + Math.sin(t) * r);
  }
  return pts;
}

/** Points rotated by `angle` (radians) about (cx, cy). */
export function rotPts(pts: Pts, cx: number, cy: number, angle: number): number[] {
  const ca = Math.cos(angle);
  const sa = Math.sin(angle);
  const out: number[] = [];
  for (let i = 0; i < pts.length; i += 2) {
    const x = (pts[i] ?? 0) - cx;
    const y = (pts[i + 1] ?? 0) - cy;
    out.push(cx + x * ca - y * sa, cy + x * sa + y * ca);
  }
  return out;
}

/** Line boil: a seeded +-amp px wobble of every coordinate, re-rolled per boil frame. */
export function boil(pts: Pts, key: string, amp: number, boilFrame: number): number[] {
  return pts.map(
    (value, i) => value + Math.round((rnd(key, boilFrame * 97 + i) * 2 - 1) * amp * 0.75),
  );
}
