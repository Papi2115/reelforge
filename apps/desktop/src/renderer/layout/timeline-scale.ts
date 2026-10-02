/** Time readouts and ruler ticks of the timeline (PLAN.md#6.3, #6.5). */

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

const TICK_STEPS = [0.1, 0.2, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600] as const;
const LARGEST_TICK_STEP = 600;
export const MIN_TICK_SPACING_PX = 64;

/** Smallest ruler step (s) whose ticks are at least MIN_TICK_SPACING_PX apart. */
export function rulerStep(pxPerSecond: number): number {
  if (!(pxPerSecond > 0)) return LARGEST_TICK_STEP;
  return (
    TICK_STEPS.find((candidate) => candidate * pxPerSecond >= MIN_TICK_SPACING_PX) ??
    LARGEST_TICK_STEP
  );
}

/** Ruler tick times within [from, to] (whole multiples of the step for the zoom). */
export function rulerTicks(from: number, to: number, pxPerSecond: number): number[] {
  if (!(to > from) || !(pxPerSecond > 0)) return [];
  const step = rulerStep(pxPerSecond);
  const ticks: number[] = [];
  const first = Math.max(0, Math.ceil(from / step - 1e-9));
  for (let index = first; index * step <= to + 1e-9; index += 1) {
    ticks.push(Math.round(index * step * 1000) / 1000);
  }
  return ticks;
}
