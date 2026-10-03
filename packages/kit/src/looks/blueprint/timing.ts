/**
 * Reveal times of the blueprint templates. A time is either local seconds or a spoken phrase;
 * phrases are resolved once at build time through the scene's `ctx.anchor` (passed as the
 * `anchor` param), so data points, nodes and markers land on the words that name them.
 */
import { z } from 'zod';
import { KitError } from '../../errors.js';

/** Seconds (local shot time) or a phrase from the script. */
export const whenParam = z
  .union([
    z.number().refine(Number.isFinite, 'must be a finite time in seconds'),
    z.string().min(1),
  ])
  .describe('Local time in seconds, or a spoken phrase (needs anchor: ctx.anchor)');

export type When = z.output<typeof whenParam>;

/** What `ctx.anchor` returns (or plain seconds from a custom resolver). */
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

/** Default schedule: item i appears at start + i * stagger unless it has its own time. */
export function scheduleTimes(
  items: readonly (When | undefined)[],
  resolve: Resolver,
  start: number,
  stagger: number,
): number[] {
  return items.map((when, index) => resolve(when, start + index * stagger));
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

export function easeInOutCubic(k: number): number {
  return k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2;
}
