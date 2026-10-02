/**
 * Shared pieces of the environments (PLAN.md#3.2): the EnvObject shape (a KitObject with a
 * pure `update(t)` hook), style-aware colour choice and small deterministic helpers.
 */
import type * as THREE from 'three';
import { resolveHex } from '../context.js';
import { KitError } from '../errors.js';
import type { KitObject } from '../object.js';
import type { KitTools } from '../registry.js';
import type { KitPalette } from '../types.js';

export interface EnvMethods {
  /**
   * Poses the environment's animation (grid scroll, twinkling stars, floating cubes) for local
   * time t. A pure function of t: call it from the scene's update(t) on every frame.
   */
  update(t: number): void;
}

export type EnvObject = KitObject & EnvMethods;

/** Adds the update(t) hook (validating t) to a kit object. */
export function asEnv(object: KitObject, pose: (t: number) => void = () => undefined): EnvObject {
  const update = (t: number): void => {
    if (!Number.isFinite(t)) {
      throw new KitError(
        'invalid-params',
        `${object.kitType}.update(t): t must be a finite time in seconds (got ${String(t)})`,
      );
    }
    pose(t);
  };
  return Object.assign(object, { update });
}

/**
 * First colour name of `preferred` that the active palette defines. Chains list the Voxel Pixel
 * swatch first, then the swatches of the other presets, and end with a semantic token, which
 * every style defines; so environments keep their look in Crisp 640 and still recolour elsewhere.
 */
export function pickColor(palette: KitPalette, preferred: readonly string[]): string {
  const name = preferred.find((candidate) => palette[candidate] !== undefined);
  if (name !== undefined) return name;
  throw new KitError(
    'invalid-color',
    `none of the colours ${preferred.join(', ')} is in the style palette`,
  );
}

/** A palette name (or '#rrggbb') as a Three colour, for shader uniforms. */
export function colorOf(tools: KitTools, name: string): THREE.Color {
  return new tools.three.Color(resolveHex(tools.palette, name));
}

/** `override` when given, else the first available colour of `chain`. */
export function colorParam(
  palette: KitPalette,
  override: string | undefined,
  chain: readonly string[],
): string {
  return override ?? pickColor(palette, chain);
}

/** 32-bit integer hash (lowbias32) of a cell and a seed: deterministic pseudo-random per cell. */
export function hashCell(x: number, y: number, z: number, seed: number): number {
  let value =
    (Math.imul(x, 0x8da6b343) ^ Math.imul(y, 0xd8163841) ^ Math.imul(z, 0xcb1ab31f)) >>> 0;
  value = (value ^ seed) >>> 0;
  value ^= value >>> 16;
  value = Math.imul(value, 0x7feb352d);
  value ^= value >>> 15;
  value = Math.imul(value, 0x846ca68b);
  value ^= value >>> 16;
  return (value >>> 0) / 4294967296;
}

/** Units -> whole voxels (at least 1). */
export function voxels(units: number, voxelSize: number): number {
  return Math.max(1, Math.round(units / voxelSize));
}

/** Wood colours shared by the desk, the bench and the room floor. */
export const WOOD = ['brown', 'ember', 'lightOrange', 'keyLight'] as const;
export const WOOD_ALT = ['orange', 'amber', 'peach', 'hero'] as const;
export const WOOD_DARK = ['darkSlate', 'charcoal', 'umber', 'shadow'] as const;

/** Box3 that never grows: for backdrops (sky) whose anchors should sit at the origin. */
export function emptyBounds(tools: KitTools): () => THREE.Box3 {
  return () => new tools.three.Box3();
}
