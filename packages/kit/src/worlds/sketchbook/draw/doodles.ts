/**
 * Hand marks as stroke recipes (page px): an arrow in two strokes (curved shaft, then a V head), a
 * loose loop that never closes neatly, an underline with a hook, a ruler-straight line, a
 * cross-out (careful X, one sloppy strike, an impatient zigzag) and a sun doodle. Each recipe is a
 * list of strokes played one after another; the page turns them into timed marks.
 */
import type { EaseName } from './math.js';
import { at, rnd } from './math.js';
import { ellipsePts, type Pts } from './paths.js';

export interface StrokeRecipe {
  readonly pts: Pts;
  readonly corners?: readonly boolean[] | null;
  /** Pause after the previous stroke ends (s). */
  readonly gap: number;
  /** Fixed duration (s); undefined = from the length and the pen's speed. */
  readonly dur?: number | undefined;
  /** Added to the call's seed. */
  readonly seed: number;
  readonly smooth?: boolean;
  readonly ease?: EaseName;
  readonly boil?: number;
}

export function arrowRecipe(
  pts: Pts,
  head = 12,
  spread = 0.5,
  headGap = 0.06,
  shaftEase: EaseName = 'hand',
): StrokeRecipe[] {
  const n = pts.length;
  const x = at(pts, n - 2);
  const y = at(pts, n - 1);
  const a = Math.atan2(y - at(pts, n - 3), x - at(pts, n - 4));
  const tip = [
    x + Math.cos(a + Math.PI - spread) * head,
    y + Math.sin(a + Math.PI - spread) * head,
    x + 1,
    y,
    x + Math.cos(a + Math.PI + spread * 0.85) * head * 0.9,
    y + Math.sin(a + Math.PI + spread * 0.85) * head * 0.9,
  ];
  return [
    { pts, gap: 0, seed: 0, ease: shaftEase },
    { pts: tip, corners: [false, true, false], gap: headGap, dur: 0.09, seed: 5 },
  ];
}

export function loopRecipe(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  seed: number,
  turns = 1.12,
  a0 = -2.4,
  grow = 0.08,
): StrokeRecipe[] {
  const n = 20;
  const pts: Pts = [];
  for (let i = 0; i <= n; i += 1) {
    const a = a0 + (i / n) * Math.PI * 2 * turns;
    const k = 1 + (i / n) * grow;
    pts.push(
      cx + Math.cos(a) * rx * k + rnd(-1.5, 1.5, seed, i, 1),
      cy + Math.sin(a) * ry * k + rnd(-1.5, 1.5, seed, i, 2),
    );
  }
  return [{ pts, gap: 0, seed: 0 }];
}

export function underlineRecipe(
  x0: number,
  x1: number,
  y: number,
  hook = true,
  sag = 0,
): StrokeRecipe[] {
  const pts = [x0, y + 1, (x0 + x1) / 2, y - 1 + sag, x1, y - 2];
  if (hook) pts.push(x1 - 6, y + 2);
  return [{ pts, corners: hook ? [false, false, true, false] : null, gap: 0, seed: 0 }];
}

export function ruledRecipe(x0: number, y0: number, x1: number, y1: number): StrokeRecipe[] {
  return [{ pts: [x0, y0, x1, y1], gap: 0, seed: 0, smooth: false, boil: 0.4, ease: 'lin' }];
}

export const CROSS_STYLES = ['x', 'strike', 'zigzag'] as const;
export type CrossStyle = (typeof CROSS_STYLES)[number];

/** Crosses out the box [x, y, w, h]: never exactly corner to corner. */
export function crossOutRecipe(
  x: number,
  y: number,
  w: number,
  h: number,
  style: CrossStyle,
  seed: number,
): StrokeRecipe[] {
  const j = (i: number, k: number): number => rnd(-2, 2, seed, i, k);
  if (style === 'x') {
    return [
      {
        pts: [x + j(0, 1), y + j(0, 2), x + w + j(0, 3), y + h + 1 + j(0, 4)],
        gap: 0,
        dur: 0.07,
        seed: 0,
      },
      {
        pts: [x + w + j(1, 1), y - 1 + j(1, 2), x + 1 + j(1, 3), y + h + j(1, 4)],
        gap: 0.03,
        dur: 0.06,
        seed: 10,
      },
    ];
  }
  if (style === 'strike') {
    const mid = y + h / 2;
    return [
      {
        pts: [x - 4, mid + 2 + j(2, 1), x + w / 2, mid - 1 + j(2, 2), x + w + 5, mid - 3 + j(2, 3)],
        gap: 0,
        seed: 0,
      },
    ];
  }
  const teeth = Math.max(2, Math.round(w / Math.max(8, h * 0.8)));
  const pts: Pts = [];
  for (let i = 0; i <= teeth; i += 1) {
    pts.push(x + (i / teeth) * w + j(i, 5), (i % 2 === 0 ? y + h * 0.15 : y + h * 0.85) + j(i, 6));
  }
  return [{ pts, gap: 0, seed: 0, smooth: false, ease: 'lin' }];
}

/** Sun doodle: one loop, then uneven rays (the hatch fill is added by the page). */
export function sunRecipe(
  cx: number,
  cy: number,
  r: number,
  seed: number,
  rays = 9,
  rayScale = 1,
): StrokeRecipe[] {
  const ring = ellipsePts(cx, cy, r, r * 0.97, 16, 0, (200 * Math.PI) / 180);
  ring.push(at(ring, 0) + 3, at(ring, 1) + 2);
  const out: StrokeRecipe[] = [{ pts: ring, gap: 0, seed: 0 }];
  let gap = 0.08;
  for (let i = 0; i < rays; i += 1) {
    const a = (i / rays) * Math.PI * 2 + rnd(-0.14, 0.14, seed, i, 1) + 0.3;
    const r0 = r + rnd(5, 9, seed, i, 2);
    const r1 = r0 + rnd(9, 20, seed, i, 3) * rayScale;
    const pts = [
      cx + Math.cos(a) * r0,
      cy + Math.sin(a) * r0,
      cx + Math.cos(a) * r1,
      cy + Math.sin(a) * r1,
    ];
    const dur = rnd(0.04, 0.08, seed, i, 4);
    out.push({ pts, gap, dur, seed: i * 3 });
    // The next ray starts this long after this one started (showcase pacing).
    gap = Math.max(0, rnd(0.05, 0.12, seed, i, 5) - dur);
  }
  return out;
}
