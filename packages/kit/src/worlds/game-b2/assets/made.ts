/**
 * What every sprite generator of the open layer returns, and the shared knobs: a seed, a size in
 * world units and the ramps to paint with (names of `RAMPS`, never hex).
 */
import { z } from 'zod';
import type { Sprite } from '../ray/sprites-props.js';
import { RAMP_NAMES, type RampName } from './ramps.js';

export interface MadeSprite {
  /** Animation frames (1 = still). */
  readonly frames: readonly Sprite[];
  /** World width and height (cells; the walls are 1 tall indoors). */
  readonly size: readonly [number, number];
  /** Foot height above the floor (birds and fish float). */
  readonly z: number;
  /** Frames per second of the animation (0 = still). */
  readonly fps: number;
}

/** Bitmap pixels per world unit of the generators (the built-in clerk is ~80). */
export const PPU = 56;

export function px(world: number, min = 4): number {
  return Math.max(min, Math.round(world * PPU));
}

const RAMP_ENUM = RAMP_NAMES as readonly [RampName, ...RampName[]];

export const rampParam = z.enum(RAMP_ENUM, {
  error: (issue) => `unknown ramp ${JSON.stringify(issue.input)} (ramps: ${RAMP_NAMES.join(', ')})`,
});

export const seedParam = z.int().min(0).max(1_000_000).default(1);
