/** Time <-> position helpers of the timeline and time readouts (PLAN.md#6.3). */

/** `m:ss.cc` (`1:02.50`); negative and non-finite times show as 0. */
export function formatTime(seconds: number): string {
  const centis = Number.isFinite(seconds) ? Math.max(0, Math.round(seconds * 100)) : 0;
  const minutes = Math.floor(centis / 6000);
  const rest = centis - minutes * 6000;
  const wholeSeconds = Math.floor(rest / 100);
  const fraction = rest - wholeSeconds * 100;
  return `${String(minutes)}:${String(wholeSeconds).padStart(2, '0')}.${String(fraction).padStart(2, '0')}`;
}

/** `m:ss` for ruler labels, `m:ss.d` between whole seconds. */
export function formatRulerLabel(seconds: number): string {
  const tenths = Math.max(0, Math.round(seconds * 10));
  const whole = Math.floor(tenths / 10);
  const label = `${String(Math.floor(whole / 60))}:${String(whole % 60).padStart(2, '0')}`;
  return tenths % 10 === 0 ? label : `${label}.${String(tenths % 10)}`;
}

const TICK_STEPS = [0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600] as const;
const LARGEST_TICK_STEP = 600;
export const MIN_TICK_SPACING_PX = 64;

/** Ruler tick times: the smallest step whose ticks are at least MIN_TICK_SPACING_PX apart. */
export function rulerTicks(duration: number, widthPx: number): number[] {
  if (!(duration > 0) || !(widthPx > 0)) return [];
  const pxPerSecond = widthPx / duration;
  const step =
    TICK_STEPS.find((candidate) => candidate * pxPerSecond >= MIN_TICK_SPACING_PX) ??
    LARGEST_TICK_STEP;
  const ticks: number[] = [];
  for (let index = 0; index * step <= duration + 1e-9; index += 1) ticks.push(index * step);
  return ticks;
}

/** Time under horizontal position `x` (px from the lane start) of a `widthPx` lane, clamped. */
export function timeAtPosition(x: number, widthPx: number, duration: number): number {
  if (!(duration > 0) || !(widthPx > 0)) return 0;
  return Math.min(duration, Math.max(0, (x / widthPx) * duration));
}

/** Position of `t` as a percentage of `duration`, clamped to 0..100. */
export function timePercent(t: number, duration: number): number {
  if (!(duration > 0)) return 0;
  return Math.min(100, Math.max(0, (t / duration) * 100));
}
