/**
 * Game logic vocabulary for the TV (PLAN.md#13.15), all pure functions of t: a sprite's path
 * through keys (whole TV units, stepped at a held cadence like a 2600 kernel's motion), the coarse
 * playfield scroll in whole blocks, and visual collisions between boxes. Nothing here keeps state:
 * a collision is something the scene SHOWS (a flash, a bounce), never a simulation.
 */
import { EASES, type EaseId, seg } from '../core/math.js';

export type PathKey = readonly [t: number, x: number, y: number];

export interface PathPoint {
  readonly x: number;
  readonly y: number;
  /** -1 moving left, 1 right, 0 still (face the sprite with it). */
  readonly dir: -1 | 0 | 1;
  readonly moving: boolean;
}

/** Where a sprite is at t on keys [[t, x, y], ...]; `fps` holds steps (default 15). */
export function path(
  keys: readonly PathKey[],
  t: number,
  o: { readonly ease?: EaseId; readonly fps?: number } = {},
): PathPoint {
  const first = keys[0];
  if (first === undefined) return { x: 0, y: 0, dir: 0, moving: false };
  const fps = o.fps ?? 15;
  const tt = Math.floor(t * fps + 1e-6) / fps;
  if (tt <= first[0])
    return { x: Math.round(first[1]), y: Math.round(first[2]), dir: 0, moving: false };
  for (let i = 1; i < keys.length; i += 1) {
    const a = keys[i - 1];
    const b = keys[i];
    if (a === undefined || b === undefined || tt >= b[0]) continue;
    const u = EASES[o.ease ?? 'lin'](seg(tt, a[0], b[0]));
    const dx = b[1] - a[1];
    return {
      x: Math.round(a[1] + dx * u),
      y: Math.round(a[2] + (b[2] - a[2]) * u),
      dir: dx > 0 ? 1 : dx < 0 ? -1 : 0,
      moving: dx !== 0 || b[2] !== a[2],
    };
  }
  const last = keys[keys.length - 1] ?? first;
  return { x: Math.round(last[1]), y: Math.round(last[2]), dir: 0, moving: false };
}

/** Coarse scroll: whole 4-unit playfield blocks moved at `speed` units per second since t0. */
export function scroll(t: number, speed: number, t0 = 0): number {
  return Math.floor((Math.max(0, t - t0) * speed) / 4);
}

export interface Box {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

/** Two boxes overlap (a visual collision: show it, do not simulate it). */
export function hit(a: Box, b: Box): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}
