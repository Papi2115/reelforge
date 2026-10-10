/**
 * C-CAM set coverage (PLAN.md#14.6, camera guide §6.3): a framing must never show the undrawn edge
 * of a set. `coverage` checks every cut of a table against the set's drawn bounds and lists the
 * framings whose visible frame (zoom and Dutch roll included, after the runtime clamp) leaves them.
 * Pure; meant for lint / QA validators.
 *
 * Moves are checked at their start, at `to` and at sampled in-between steps (at least one per
 * 24 fps frame, the real easing, so a `back` overshoot is caught). Conservative on purpose: `to` is
 * checked even when the next cut starts before `end` (an unreachable endpoint is still a smell).
 */
import { FPS } from '../core.js';
import {
  FRAME,
  clampFraming,
  cutFramingAt,
  visibleRect,
  type Cut,
  type FrameSize,
  type Rect,
} from './camera.js';

export type CoverageSide = 'left' | 'top' | 'right' | 'bottom';

/** Drawn extent of a set in world units. */
export type SetBounds = Rect;

/** The film sets span roughly x -300..2300, y -300..1300 (film 1 `sets-a.js`). */
export const DEFAULT_SET_BOUNDS: SetBounds = { x0: -300, y0: -300, x1: 2300, y1: 1300 };

export interface CoverageIssue {
  /** Position of the cut in the table. */
  readonly index: number;
  readonly at: number;
  readonly name?: string;
  /** Sides where the frame leaves the set, in left/top/right/bottom order. */
  readonly sides: readonly CoverageSide[];
  /** Worst overflow per side in world px over every checked sample (0 = covered). */
  readonly overflow: Readonly<Record<CoverageSide, number>>;
  /** Shot time of the sample with the largest single-side overflow. */
  readonly worstAt: number;
}

const SIDES: readonly CoverageSide[] = ['left', 'top', 'right', 'bottom'];
/** Minimum samples across a move. */
const MOVE_SAMPLES = 8;
/** Floating-point slack: a frame that exactly touches the bounds is covered. */
const EPSILON = 1e-9;

function sampleTimes(cut: Cut): number[] {
  const { to, end } = cut;
  const moves = to !== undefined && end !== undefined && end > cut.at && cut.ease !== 'cut';
  if (!moves) return [cut.at];
  const count = Math.max(MOVE_SAMPLES, Math.ceil((end - cut.at) * FPS));
  const times: number[] = [];
  for (let k = 0; k <= count; k += 1) times.push(cut.at + ((end - cut.at) * k) / count);
  return times;
}

function overflowOf(rect: Rect, bounds: SetBounds): Record<CoverageSide, number> {
  return {
    left: Math.max(0, bounds.x0 - rect.x0),
    top: Math.max(0, bounds.y0 - rect.y0),
    right: Math.max(0, rect.x1 - bounds.x1),
    bottom: Math.max(0, rect.y1 - bounds.y1),
  };
}

/** Cuts whose visible frame leaves `setBounds`; an empty list means every framing is covered. */
export function coverage(
  cuts: readonly Cut[],
  setBounds: SetBounds = DEFAULT_SET_BOUNDS,
  frame: FrameSize = FRAME,
): CoverageIssue[] {
  const issues: CoverageIssue[] = [];
  cuts.forEach((cut, index) => {
    const worst: Record<CoverageSide, number> = { left: 0, top: 0, right: 0, bottom: 0 };
    let worstAt = cut.at;
    let worstValue = 0;
    for (const t of sampleTimes(cut)) {
      const over = overflowOf(visibleRect(clampFraming(cutFramingAt(cut, t)), frame), setBounds);
      for (const side of SIDES) {
        worst[side] = Math.max(worst[side], over[side]);
        if (over[side] > worstValue) {
          worstValue = over[side];
          worstAt = t;
        }
      }
    }
    if (worstValue <= EPSILON) return;
    issues.push({
      index,
      at: cut.at,
      ...(cut.name === undefined ? {} : { name: cut.name }),
      sides: SIDES.flatMap((side) => (worst[side] > EPSILON ? [side] : [])),
      overflow: worst,
      worstAt,
    });
  });
  return issues;
}
