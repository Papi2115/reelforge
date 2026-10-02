/** Small structural types shared by the kit; the engine passes values that satisfy them. */

export type Vec3 = readonly [number, number, number];

export type Axis = 'x' | 'y' | 'z';

/**
 * Seeded generator (same shape as the engine's `ctx.rng`, mulberry32). The kit never uses
 * Math.random: every random choice comes from an Rng passed in by the caller.
 */
export interface KitRng {
  (): number;
  range(min: number, max: number): number;
  int(min: number, max: number): number;
  pick<T>(items: readonly T[]): T;
  fork(label: string): KitRng;
}

/** `ctx.palette`: colour names (semantic tokens and swatches) -> '#rrggbb'. */
export type KitPalette = Readonly<Record<string, string>>;

export const AXIS_INDEX: Readonly<Record<Axis, 0 | 1 | 2>> = { x: 0, y: 1, z: 2 };
