/**
 * Render-time effects of accepted "wow moments" (PLAN.md#12.27, ADR-020), applied by the engine
 * on top of a shot without rebuilding its scene:
 *
 * - `timeRemap` (slow motion): a window [from, to] (film seconds) inside the shot where scene time
 *   s(t) runs slower, then catches up, so that s(from) = from and s(to) = to:
 *
 *       u = (t − from) / (to − from)                       (0..1 inside the window)
 *       s(t) = t − (to − from) · (1 − rate) / (2π) · (1 − cos 2πu)
 *       s'(t) = 1 − (1 − rate) · sin 2πu                   ∈ [rate, 2 − rate]
 *
 *   The slowest speed is `rate` (a quarter in, u = 0.25), the fastest catch-up `2 − rate` (three
 *   quarters in); the speed is 1 at both edges, so entering and leaving the window has no jump.
 *   Outside the window s(t) = t exactly: every anchor, cue and VO word outside it is untouched,
 *   and the moment proposer never puts an anchor strictly inside the window (moments.ts).
 *   The largest lag, at the middle, is (to − from) · (1 − rate) / π.
 * - `paletteShift`: a brief flash in which style colours step to the next lighter member of their
 *   tone family (STYLE.md variation budget) through an ordered dither: in-palette by design.
 *
 * Pure functions of time: preview and export apply the same manifest.
 */
import { z } from 'zod';

/** Slowest allowed speed of a slow-motion window (and the fastest catch-up: 2 − rate). */
export const MIN_REMAP_RATE = 0.25;
export const MAX_REMAP_RATE = 0.9;
/** Windows per shot. */
export const MAX_SHOT_EFFECT_WINDOWS = 4;

export const timeRemapWindowSchema = z
  .object({
    /** Film seconds. */
    from: z.number().nonnegative(),
    to: z.number().positive(),
    /** Slowest speed inside the window (scene seconds per real second). */
    rate: z.number().min(MIN_REMAP_RATE).max(MAX_REMAP_RATE),
  })
  .refine((window) => window.to > window.from, { message: 'to must be > from', path: ['to'] });
export type TimeRemapWindow = z.infer<typeof timeRemapWindowSchema>;

export const paletteShiftWindowSchema = z
  .object({
    from: z.number().nonnegative(),
    to: z.number().positive(),
  })
  .refine((window) => window.to > window.from, { message: 'to must be > from', path: ['to'] });
export type PaletteShiftWindow = z.infer<typeof paletteShiftWindowSchema>;

const TWO_PI = 2 * Math.PI;

/** Scene time for real film time t (identity outside every window; windows must not overlap). */
export function remapTime(windows: readonly TimeRemapWindow[], t: number): number {
  for (const window of windows) {
    if (t <= window.from || t >= window.to) continue;
    const span = window.to - window.from;
    const u = (t - window.from) / span;
    return t - ((span * (1 - window.rate)) / TWO_PI) * (1 - Math.cos(TWO_PI * u));
  }
  return t;
}

/** Scene speed ds/dt at t (1 outside every window). */
export function remapRate(windows: readonly TimeRemapWindow[], t: number): number {
  for (const window of windows) {
    if (t <= window.from || t >= window.to) continue;
    const u = (t - window.from) / (window.to - window.from);
    return 1 - (1 - window.rate) * Math.sin(TWO_PI * u);
  }
  return 1;
}

/** Largest lag of scene time behind real time in a window (at its middle). */
export function maxRemapLag(window: TimeRemapWindow): number {
  return ((window.to - window.from) * (1 - window.rate)) / Math.PI;
}

/** Shares of a palette-shift window: fast attack, hold, slower release. */
const SHIFT_ATTACK = 0.15;
const SHIFT_RELEASE = 0.4;

/** Strength 0..1 of the palette shift at t (0 outside every window). */
export function paletteShiftAmount(windows: readonly PaletteShiftWindow[], t: number): number {
  for (const window of windows) {
    if (t < window.from || t >= window.to) continue;
    const u = (t - window.from) / (window.to - window.from);
    if (u < SHIFT_ATTACK) return u / SHIFT_ATTACK;
    if (u > 1 - SHIFT_RELEASE) return (1 - u) / SHIFT_RELEASE;
    return 1;
  }
  return 0;
}

interface Windowed {
  readonly from: number;
  readonly to: number;
}

/** Problems of a shot's windows: inside [t0, t1], in time order, not overlapping. */
export function effectWindowProblems(
  windows: readonly Windowed[],
  shot: { readonly t0: number; readonly t1: number },
): string[] {
  const problems: string[] = [];
  windows.forEach((window, index) => {
    if (window.from < shot.t0 - 1e-9 || window.to > shot.t1 + 1e-9) {
      problems.push(
        `window ${String(index)} must lie inside the shot [${String(shot.t0)}, ${String(shot.t1)}]`,
      );
    }
    const previous = windows[index - 1];
    if (previous !== undefined && window.from < previous.to) {
      problems.push(`window ${String(index)} must start after window ${String(index - 1)} ends`);
    }
  });
  return problems;
}
