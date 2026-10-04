/**
 * Times and easing of the flat-2d templates. A time is local seconds or a spoken phrase; phrases
 * are resolved once at build time through the scene's `ctx.anchor` (passed as the `anchor`
 * param), so shapes, icons and words land on the words that name them.
 */
import { z } from 'zod';
import { KitError } from '../../errors.js';

/** Seconds (local shot time) or a phrase from the script. */
export const whenParam = z
  .union([
    z.number().refine(Number.isFinite, 'must be a finite time in seconds'),
    z.string().min(1),
  ])
  .describe('Local time in seconds, or a spoken phrase ("phrase#2" = 2nd time; needs anchor)');

export type When = z.output<typeof whenParam>;

type AnchorResult = number | { readonly t: number };
export type AnchorFunction = (phrase: string, nth?: number) => AnchorResult;

export const anchorParam = z
  .custom<AnchorFunction>((value) => typeof value === 'function', {
    message: "anchor must be the scene's ctx.anchor function (pass anchor: ctx.anchor)",
  })
  .optional()
  .describe('Pass ctx.anchor when any time is a spoken phrase');

export type Resolver = (when: When | undefined, fallback: number) => number;

/**
 * Turns `When` values into local seconds: numbers pass through, phrases go to `anchor`
 * (`"phrase#2"` = 2nd occurrence), undefined gives the fallback. `call` names the template in
 * errors.
 */
export function createResolver(anchor: AnchorFunction | undefined, call: string): Resolver {
  const cache = new Map<string, number>();
  return (when, fallback) => {
    if (when === undefined) return fallback;
    if (typeof when === 'number') return when;
    const cached = cache.get(when);
    if (cached !== undefined) return cached;
    if (anchor === undefined) {
      throw new KitError(
        'invalid-params',
        `${call}: "${when}" is a spoken phrase; pass anchor: ctx.anchor so it can be timed (or use seconds)`,
      );
    }
    const match = /^(.*)#(\d+)$/.exec(when);
    const phrase = match ? (match[1] ?? when) : when;
    const nth = match ? Number(match[2]) : 1;
    const result = anchor(phrase, nth);
    const t = typeof result === 'number' ? result : result.t;
    if (!Number.isFinite(t)) {
      throw new KitError('invalid-params', `${call}: anchor("${phrase}") gave no time`);
    }
    cache.set(when, t);
    return t;
  };
}

export function clamp01(value: number): number {
  return value <= 0 ? 0 : value >= 1 ? 1 : value;
}

/** 0 before `start`, 1 after start + duration, linear in between. */
export function ramp(t: number, start: number, duration: number): number {
  if (duration <= 0) return t >= start ? 1 : 0;
  return clamp01((t - start) / duration);
}

export function easeOutCubic(k: number): number {
  return 1 - (1 - k) ** 3;
}

export function easeInCubic(k: number): number {
  return k * k * k;
}

export function easeInOutCubic(k: number): number {
  return k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2;
}

/** Overshoots to ~1.1 then settles at 1 (pop-ins). */
export function easeOutBack(k: number): number {
  if (k <= 0) return 0;
  if (k >= 1) return 1;
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * (k - 1) ** 3 + c1 * (k - 1) ** 2;
}

/** Damped bounce landing at 1 (drops). */
export function easeOutBounce(k: number): number {
  const n = 7.5625;
  const d = 2.75;
  if (k < 1 / d) return n * k * k;
  if (k < 2 / d) return n * (k - 1.5 / d) ** 2 + 0.75;
  if (k < 2.5 / d) return n * (k - 2.25 / d) ** 2 + 0.9375;
  return n * (k - 2.625 / d) ** 2 + 0.984375;
}

/** Deterministic wobble in -1..1 for shakes (a sum of incommensurate sines of t). */
export function wobble(t: number, seed: number): number {
  return (Math.sin(t * 71 + seed * 1.7) + Math.sin(t * 113 + seed * 3.1)) / 2;
}
