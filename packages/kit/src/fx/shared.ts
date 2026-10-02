/**
 * Shared pieces of the effects (PLAN.md#3.4): the FxObject shape (a KitObject with a pure
 * `update(t)`), timing/easing helpers and param schemas used by several effects.
 */
import { z } from 'zod';
import { hashCell } from '../env/shared.js';
import { KitError } from '../errors.js';
import type { KitObject } from '../object.js';

export interface FxMethods {
  /** Poses the effect for local time t (pure): call it from the scene's update(t) every frame. */
  update(t: number): void;
}

export type FxObject = KitObject & FxMethods;

export interface LevelFxMethods {
  /**
   * Poses the effect for local time t (pure). `level` (0..1) overrides the effect's own
   * schedule for this frame, e.g. `fx.update(t, t > hit.t ? 1 : 0)`.
   */
  update(t: number, level?: number): void;
}

export type LevelFxObject = KitObject & LevelFxMethods;

function checkTime(object: KitObject, t: number): void {
  if (!Number.isFinite(t)) {
    throw new KitError(
      'invalid-params',
      `${object.kitType}.update(t): t must be a finite time in seconds (got ${String(t)})`,
    );
  }
}

/** Adds update(t) (validating t) to a kit object and poses it at t = 0. */
export function asFx<T extends KitObject>(object: T, pose: (t: number) => void): T & FxMethods {
  const update = (t: number): void => {
    checkTime(object, t);
    pose(t);
  };
  update(0);
  return Object.assign(object, { update });
}

/** Adds update(t, level?) (validating both) to a kit object and poses it at t = 0. */
export function asLevelFx<T extends KitObject>(
  object: T,
  pose: (t: number, level: number | undefined) => void,
): T & LevelFxMethods {
  const update = (t: number, level?: number): void => {
    checkTime(object, t);
    if (level !== undefined && !(level >= 0 && level <= 1)) {
      throw new KitError(
        'invalid-params',
        `${object.kitType}.update(t, level): level must be 0..1 (got ${String(level)})`,
      );
    }
    pose(t, level);
  };
  update(0);
  return Object.assign(object, { update });
}

export function clamp01(value: number): number {
  return value <= 0 ? 0 : value >= 1 ? 1 : value;
}

/** 0 before `start`, 1 after `end`, linear in between (a step at `start` when end <= start). */
export function progress(t: number, start: number, end: number): number {
  if (end <= start) return t >= start ? 1 : 0;
  return clamp01((t - start) / (end - start));
}

export const EASES = {
  linear: (k: number) => k,
  easeInCubic: (k: number) => k * k * k,
  easeOutCubic: (k: number) => 1 - (1 - k) ** 3,
  easeInOutCubic: (k: number) => (k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2),
  /** Overshoots by ~10 % and settles: pop-ins. */
  easeOutBack: (k: number) => {
    const c1 = 1.70158;
    return 1 + (c1 + 1) * (k - 1) ** 3 + c1 * (k - 1) ** 2;
  },
} as const;

export type EaseName = keyof typeof EASES;

export const easeParam = z
  .enum(Object.keys(EASES) as [EaseName, ...EaseName[]])
  .describe('Easing curve: linear, easeInCubic, easeOutCubic, easeInOutCubic, easeOutBack');

export const vec3Param = z.tuple([z.number(), z.number(), z.number()]);
export const vec2Param = z.tuple([z.number(), z.number()]);
export const timeParam = z.number().refine(Number.isFinite, 'must be a finite time in seconds');

/** Deterministic pseudo-random value in [0, 1) for an integer key and a seed. */
export function noise1(index: number, salt: number, seed: number): number {
  return hashCell(index, salt, 0x51ed, seed);
}

/** Smooth 1D value noise in [0, 1) (cosine-interpolated lattice), pure in x. */
export function smoothNoise(x: number, salt: number, seed: number): number {
  const cell = Math.floor(x);
  const fraction = x - cell;
  const blend = (1 - Math.cos(fraction * Math.PI)) / 2;
  const a = noise1(cell, salt, seed);
  const b = noise1(cell + 1, salt, seed);
  return a + (b - a) * blend;
}

/** Integer seed of a call: the definition's rng stream mixed with the user-facing seed. */
export function seedOf(random: () => number): number {
  return Math.floor(random() * 0x7fffffff);
}

/** Default series colours (palette tokens every style defines). */
export const SERIES_COLORS = ['accent1', 'accent2', 'hero', 'accent3', 'accent4'] as const;
