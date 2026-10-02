/**
 * `kit.fx.flicker`: light flicker patterns as pure functions of t (neon stutter, candle,
 * broken tube, strobe, pulse). The effect owns an optional point light and drives the
 * intensity of target lights and the visibility of target objects (neon signs, screens).
 */
import type * as THREE from 'three';
import { z } from 'zod';
import { colorOf } from '../env/shared.js';
import { createKitObject } from '../object.js';
import { defineFx } from '../registry.js';
import { asFx, clamp01, noise1, seedOf, smoothNoise, timeParam } from './shared.js';

export const FLICKER_PATTERNS = ['neon', 'candle', 'broken', 'strobe', 'pulse'] as const;
export type FlickerPattern = (typeof FLICKER_PATTERNS)[number];

function isObject3D(value: unknown): value is THREE.Object3D {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as Partial<THREE.Object3D>).isObject3D === true
  );
}

function isLight(object: THREE.Object3D): object is THREE.Light {
  return (object as Partial<THREE.Light>).isLight === true;
}

export const flickerParams = z.object({
  pattern: z
    .enum(FLICKER_PATTERNS)
    .default('neon')
    .describe(
      'neon = steady with stutter blackouts, candle = soft wobble, broken = mostly dark with bursts, strobe = hard on/off at rate, pulse = smooth sine',
    ),
  rate: z.number().positive().default(6).describe('Events per second (strobe/pulse frequency)'),
  min: z.number().min(0).max(1).default(0).describe('Level when off (0..1)'),
  start: timeParam.default(0).describe('Before this local time the level is steady at 1'),
  end: z
    .number()
    .optional()
    .describe('After this local time the level is steady at 1 (default: never)'),
  seed: z.number().int().default(0).describe('Variant of the pattern'),
  light: z
    .object({
      color: z.string().default('keyLight').describe('Palette name'),
      intensity: z.number().min(0).default(6),
      distance: z.number().min(0).default(8).describe('Range in units (0 = infinite)'),
    })
    .nullable()
    .default(null)
    .describe('Own point light at the effect position (null = none)'),
  targets: z
    .array(z.custom<THREE.Object3D>(isObject3D, 'must be a light or a scene object'))
    .default([])
    .describe(
      'Lights get intensity x level; other objects are shown while level >= threshold (glow signs, screens)',
    ),
  threshold: z.number().min(0).max(1).default(0.5).describe('Visibility threshold for objects'),
});

export type FlickerParams = z.output<typeof flickerParams>;

/** Flicker level 0..1 (before `min` is applied) of a pattern at time t. Pure. */
export function flickerRaw(pattern: FlickerPattern, t: number, rate: number, seed: number): number {
  const slot = Math.floor(t * rate);
  const inSlot = t * rate - slot;
  switch (pattern) {
    case 'neon': {
      // ~20 % of slots stutter: dark blips at the start of the slot.
      if (noise1(slot, 1, seed) >= 0.2) return 1;
      const blips = 1 + Math.floor(noise1(slot, 2, seed) * 3);
      return Math.floor(inSlot * blips * 2) % 2 === 0 ? 0 : 1;
    }
    case 'candle':
      return clamp01(
        0.72 + 0.2 * (smoothNoise(t * rate, 3, seed) - 0.5) * 2 + 0.08 * Math.sin(t * 17.3),
      );
    case 'broken': {
      const burst = noise1(Math.floor(t * rate * 0.25), 4, seed) < 0.35;
      return burst && noise1(slot, 5, seed) < 0.6 ? 1 : 0;
    }
    case 'strobe':
      return inSlot < 0.5 ? 1 : 0;
    case 'pulse':
      return 0.5 + 0.5 * Math.cos(t * rate * Math.PI * 2);
  }
}

/** Level min..1 at time t: steady 1 outside [start, end). */
export function flickerLevel(params: FlickerParams, t: number, seed: number): number {
  if (t < params.start || t >= (params.end ?? Infinity)) return 1;
  const raw = flickerRaw(params.pattern, t, params.rate, seed);
  return params.min + (1 - params.min) * raw;
}

export const flicker = defineFx({
  name: 'flicker',
  description:
    'Flicker driver: neon stutter, candle, broken tube, strobe or pulse between start and end. Drives target lights (intensity x level), toggles target objects (glow signs, screens) and an optional own point light. fx.value(t) gives the level for anything else. fx.update(t) every frame.',
  params: flickerParams,
  build(params, tools) {
    const { three } = tools;
    const seed = seedOf(tools.rng.fork(`seed:${String(params.seed)}`));
    const object = createKitObject(three, { kitType: 'flicker' });
    const lights: { light: THREE.Light; base: number }[] = [];
    const others: THREE.Object3D[] = [];
    if (params.light) {
      const own = new three.PointLight(
        colorOf(tools, params.light.color),
        params.light.intensity,
        params.light.distance,
        1.2,
      );
      own.name = 'flickerLight';
      object.add(own);
      lights.push({ light: own, base: own.intensity });
    }
    for (const target of params.targets) {
      if (isLight(target)) lights.push({ light: target, base: target.intensity });
      else others.push(target);
    }
    /** Flicker level (min..1) at time t. */
    const value = (t: number): number => flickerLevel(params, t, seed);
    const fx = asFx(object, (t) => {
      const level = value(t);
      for (const { light, base } of lights) light.intensity = base * level;
      for (const target of others) target.visible = level >= params.threshold;
    });
    return Object.assign(fx, { value });
  },
});
