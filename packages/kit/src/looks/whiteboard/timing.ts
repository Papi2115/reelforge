/**
 * When each mark of a whiteboard drawing is drawn. A mark is pinned to a time (`at`: seconds or a
 * spoken phrase resolved through ctx.anchor), lasts its own `duration`, or is auto-timed: it
 * starts when the previous one ends (plus a short pen gap) and takes as long as its ink is long at
 * the board's drawing speed. Auto-timed marks before a pinned one hurry up (down to a third of
 * their time) so the one hand is free when the pinned mark's phrase is spoken.
 */
import type { Resolver, When } from '../blueprint/timing.js';

export interface TimingRequest {
  /** Drawing cost in raster px (marks.shapeCost). */
  readonly cost: number;
  readonly at?: When | undefined;
  readonly duration?: number | undefined;
  /** Pause before an auto-timed mark (default: the board's gap). */
  readonly gap?: number | undefined;
}

export interface TimingOptions {
  readonly start: number;
  /** Seconds between auto-timed marks. */
  readonly gap: number;
  /** Drawing speed in raster px per second. */
  readonly speed: number;
  readonly resolve: Resolver;
  /** Shortest / longest auto duration (s). */
  readonly minDuration?: number | undefined;
  readonly maxDuration?: number | undefined;
}

export interface Slot {
  readonly start: number;
  readonly duration: number;
}

/** Fastest a hand hurries towards a pinned mark (share of the normal duration). */
const MIN_HURRY = 0.35;

/** Auto duration of a mark of `cost` px. */
export function autoDuration(cost: number, options: TimingOptions): number {
  const min = options.minDuration ?? 0.18;
  const max = options.maxDuration ?? 3;
  return Math.min(max, Math.max(min, cost / Math.max(1, options.speed)));
}

/** Start and duration of every mark, in order (see the module comment). */
export function scheduleMarks(requests: readonly TimingRequest[], options: TimingOptions): Slot[] {
  const pinned = requests.map((request) =>
    request.at === undefined ? undefined : options.resolve(request.at, 0),
  );
  const durations = requests.map(
    (request) => request.duration ?? autoDuration(request.cost, options),
  );
  const gaps = requests.map((request, index) => (index === 0 ? 0 : (request.gap ?? options.gap)));
  const slots: Slot[] = [];
  let cursor = options.start;
  let hurry = 1;
  requests.forEach((request, index) => {
    const at = pinned[index];
    if (at !== undefined) {
      const duration = durations[index] ?? 0;
      slots.push({ start: at, duration });
      cursor = Math.max(cursor, at + duration);
      return;
    }
    if (index === 0 || pinned[index - 1] !== undefined) {
      hurry = hurryFactor(index, cursor, pinned, durations, gaps, requests);
    }
    const ownDuration = request.duration !== undefined;
    const duration = (durations[index] ?? 0) * (ownDuration ? 1 : hurry);
    const start = cursor + (gaps[index] ?? 0) * hurry;
    slots.push({ start, duration });
    cursor = Math.max(cursor, start + duration);
  });
  return slots;
}

/** How much the auto-timed run starting at `from` must speed up to end before the next pin. */
function hurryFactor(
  from: number,
  cursor: number,
  pinned: readonly (number | undefined)[],
  durations: readonly number[],
  gaps: readonly number[],
  requests: readonly TimingRequest[],
): number {
  let flexible = 0;
  let fixed = 0;
  for (let index = from; index < requests.length; index += 1) {
    const pin = pinned[index];
    if (pin !== undefined) {
      const available = pin - cursor - fixed - (gaps[index] ?? 0);
      if (flexible <= available) return 1;
      return Math.max(MIN_HURRY, available / flexible);
    }
    const duration = durations[index] ?? 0;
    flexible += gaps[index] ?? 0;
    if (requests[index]?.duration === undefined) flexible += duration;
    else fixed += duration;
  }
  return 1;
}
