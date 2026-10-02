/** Easing curves for rigs and scene animation: map progress 0..1 to eased 0..1 (pure). */

export type EaseFunction = (x: number) => number;

const clamp01 = (x: number): number => Math.min(1, Math.max(0, x));
const BACK_OVERSHOOT = 1.70158;

export const EASINGS = Object.freeze({
  linear: (x: number) => x,
  easeInQuad: (x: number) => x * x,
  easeOutQuad: (x: number) => 1 - (1 - x) * (1 - x),
  easeInOutQuad: (x: number) => (x < 0.5 ? 2 * x * x : 1 - (-2 * x + 2) ** 2 / 2),
  easeInCubic: (x: number) => x * x * x,
  easeOutCubic: (x: number) => 1 - (1 - x) ** 3,
  easeInOutCubic: (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2),
  easeInOutSine: (x: number) => -(Math.cos(Math.PI * x) - 1) / 2,
  /** Overshoots slightly past 1 before settling (snappy arrivals). */
  easeOutBack: (x: number) =>
    1 + (BACK_OVERSHOOT + 1) * (x - 1) ** 3 + BACK_OVERSHOOT * (x - 1) ** 2,
  smoothstep: (x: number) => x * x * (3 - 2 * x),
} satisfies Record<string, EaseFunction>);

export type EaseName = keyof typeof EASINGS;
/** An easing by name (e.g. 'easeInOutCubic') or a custom function. */
export type EaseInput = EaseName | EaseFunction;

export const DEFAULT_EASE: EaseName = 'easeInOutCubic';

function isEaseName(name: string): name is EaseName {
  return Object.hasOwn(EASINGS, name);
}

export function resolveEase(input: EaseInput = DEFAULT_EASE): EaseFunction {
  if (typeof input === 'function') return input;
  if (isEaseName(input)) return EASINGS[input];
  throw new RangeError(
    `unknown ease "${String(input)}"; use one of: ${Object.keys(EASINGS).join(', ')}`,
  );
}

/**
 * Eased progress of t through [from, to]: 0 before `from`, 1 after `to` (holds the end pose), a
 * step at `from` when to <= from.
 */
export function progressBetween(
  t: number,
  from: number,
  to: number,
  ease: EaseInput = DEFAULT_EASE,
): number {
  const linear = to > from ? clamp01((t - from) / (to - from)) : t >= from ? 1 : 0;
  return resolveEase(ease)(linear);
}
