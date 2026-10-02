/**
 * Enter/exit animation of a card as a pure function of local time: visibility, pixel offset,
 * integer scale, dissolve opacity, typewriter reveal and wipe. Random jitter is hashed from the
 * card seed and a stepped time index, so a given t always looks the same.
 */
import { EASINGS } from '../camera/easing.js';
import { hashString } from '../rng.js';
import type { TitleAnimation } from './options.js';

export interface CardTiming {
  readonly at: number;
  readonly until: number;
  readonly enter: TitleAnimation;
  readonly exit: TitleAnimation;
  readonly enterDuration: number;
  readonly exitDuration: number;
}

export interface CardTransform {
  readonly visible: boolean;
  readonly dx: number;
  readonly dy: number;
  /** Integer pixel scale to draw with (0 = nothing to draw). */
  readonly scale: number;
  readonly opacity: number;
  /** Share of glyphs drawn (typewriter), 0..1. */
  readonly reveal: number;
  /** Share of the card width uncovered from the left (wipe), 0..1. */
  readonly wipe: number;
}

export interface TransformFrame {
  readonly width: number;
  readonly height: number;
  /** Scale of the card at rest. */
  readonly scale: number;
  /** Per-card seed of the shake jitter. */
  readonly seed: number;
}

/** Shake jitter: max offset in pixels and new offsets per second (stepped). */
export const SHAKE_PIXELS = 4;
export const SHAKE_RATE = 24;
const SLIDE_SHARE_Y = 0.08;
const SLIDE_SHARE_X = 0.1;

/** Seeded offset in [-amplitude, amplitude] (integer) for a time step and axis. */
export function jitter(seed: number, step: number, axis: number, amplitude: number): number {
  const hash = hashString(`${String(step)}:${String(axis)}`, seed);
  return Math.round((hash / 0xffffffff) * 2 * amplitude - amplitude);
}

function rest(scale: number): CardTransform {
  return { visible: true, dx: 0, dy: 0, scale, opacity: 1, reveal: 1, wipe: 1 };
}

/** Transform of `effect` at progress k (0 = start of entering / fully exited, 1 = at rest). */
function effectAt(
  effect: TitleAnimation,
  k: number,
  t: number,
  frame: TransformFrame,
  leaving: boolean,
): CardTransform {
  const base = rest(frame.scale);
  const eased = EASINGS.easeOutCubic(k);
  const direction = leaving ? -1 : 1;
  const slideY = Math.round((1 - eased) * SLIDE_SHARE_Y * frame.height) * direction;
  const slideX = Math.round((1 - eased) * SLIDE_SHARE_X * frame.width) * direction;
  const slideOpacity = Math.min(1, 2 * k);
  switch (effect) {
    case 'none':
      return base;
    case 'fade':
      return { ...base, opacity: k };
    case 'wipe':
      return { ...base, wipe: eased };
    case 'pop':
      return { ...base, scale: Math.max(0, Math.round(frame.scale * EASINGS.easeOutBack(k))) };
    case 'typewriter':
      return { ...base, reveal: k };
    case 'shake': {
      const amplitude = SHAKE_PIXELS * (1 - k);
      const step = Math.floor(t * SHAKE_RATE);
      return {
        ...base,
        dx: jitter(frame.seed, step, 0, amplitude),
        dy: jitter(frame.seed, step, 1, amplitude),
      };
    }
    case 'slide-up':
      return { ...base, dy: slideY, opacity: slideOpacity };
    case 'slide-down':
      return { ...base, dy: -slideY, opacity: slideOpacity };
    case 'slide-left':
      return { ...base, dx: slideX, opacity: slideOpacity };
    case 'slide-right':
      return { ...base, dx: -slideX, opacity: slideOpacity };
  }
}

export function cardTransform(t: number, timing: CardTiming, frame: TransformFrame): CardTransform {
  if (t < timing.at || t >= timing.until) return { ...rest(frame.scale), visible: false };
  const entering = (t - timing.at) / timing.enterDuration;
  if (entering < 1) return effectAt(timing.enter, entering, t, frame, false);
  const leaving = (timing.until - t) / timing.exitDuration;
  if (leaving < 1) return effectAt(timing.exit, leaving, t, frame, true);
  return rest(frame.scale);
}
