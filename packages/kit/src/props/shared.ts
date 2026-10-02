/**
 * Shared pieces of the props (PLAN.md#3.3): the PropObject shape (a KitObject with a pure
 * `update(t)` hook plus prop-specific animation hooks), common params, style-aware colour chains
 * and small helpers to mesh sketches and validate hook arguments.
 */
import { z } from 'zod';
import { asEnv, colorParam } from '../env/shared.js';
import { KitError } from '../errors.js';
import { createKitObject, type KitObject } from '../object.js';
import type { KitTools } from '../registry.js';
import type { Vec3 } from '../types.js';
import type { VoxelObject } from '../voxel/mesh.js';
import type { Sketch } from './sketch.js';

/** Voxel size of desk-scale props (a 32-voxel object is 1 unit; the hero is 2 units tall). */
export const SMALL_VOXEL = 1 / 32;
/** Voxel size of furniture-scale props (server rack, map table, school desk). */
export const MEDIUM_VOXEL = 1 / 16;

export interface PropMethods {
  /**
   * Poses the prop's own animation (screens, LEDs, clock hands, globe spin) for local time t. A
   * pure function of t: call it from the scene's update(t) on every frame (no-op when static).
   */
  update(t: number): void;
}

export type PropObject = KitObject & PropMethods;

/** Adds update(t) (validated, pure) and the prop's hooks to a kit object. */
export function asProp<Methods extends object>(
  object: KitObject,
  methods: Methods,
  pose: (t: number) => void = () => undefined,
): PropObject & Methods {
  return Object.assign(asEnv(object, pose), methods);
}

export const scaleParam = z
  .number()
  .positive()
  .max(16)
  .default(1)
  .describe('Uniform size multiplier (1 = catalog size)');

export const seedParam = z
  .number()
  .int()
  .default(0)
  .describe('Layout variant (same seed = same look in every shot)');

/** Optional palette-name override of one part of a prop. */
export function colorField(part: string): z.ZodOptional<z.ZodString> {
  return z.string().optional().describe(`Palette name of ${part} (default: style-aware)`);
}

/** `override` when given, else the first colour of `chain` the active style defines. */
export function pick(
  tools: KitTools,
  override: string | undefined,
  chain: readonly string[],
): string {
  return colorParam(tools.palette, override, chain);
}

/** Colour chains: Voxel Pixel swatch, Noir swatch, Soft 480 swatch, then a token every style has. */
export const DARK = ['darkSlate', 'slate', 'dusk', 'groundAlt'] as const;
export const DARKEST = ['indigo', 'charcoal', 'night', 'shadow'] as const;
export const METAL = ['slateGrey', 'ash', 'ice', 'textDim'] as const;
export const PAPER = ['cream', 'bone', 'sand', 'heroTrim'] as const;
export const INK = ['darkSlate', 'slate', 'plum', 'shadow'] as const;
export const RED = ['red', 'pink', 'rose', 'accent2'] as const;
export const GREEN = ['green', 'sage', 'teal', 'accent3'] as const;
export const GREEN_DARK = ['teal', 'tealDark', 'olive', 'accent1'] as const;
export const GOLD = ['gold', 'lightOrange', 'peach', 'keyLight'] as const;
export const GOLD_DARK = ['amber', 'orange', 'coral', 'hero'] as const;
export const SEA = ['teal', 'cornflower', 'tealDark', 'accent1'] as const;
export const LAND = ['green', 'sage', 'ash', 'accent3'] as const;
export const SCREEN_OFF = ['black', 'ink', 'night', 'outline'] as const;
export const SCREEN_BACK = ['slateBlue', 'tealDark', 'night', 'shadow'] as const;
export const SCREEN_DIM = ['teal', 'steel', 'cornflower', 'textDim'] as const;

export interface PropShell {
  readonly object: KitObject;
  /** Mesh of a sketch at the prop's voxel size, pivot bottom centre (added to the object). */
  mesh<Slot extends string>(sketch: Sketch<Slot>, pivot?: Vec3): VoxelObject;
}

/** Empty prop object with uniform `scale`; anchors are set once the parts exist. */
export function propShell(
  tools: KitTools,
  kitType: string,
  voxelSize: number,
  scale: number,
): PropShell {
  const object = createKitObject(tools.three, { kitType });
  object.scale.setScalar(scale);
  return {
    object,
    mesh(sketch, pivot) {
      const options = pivot === undefined ? { voxelSize } : { voxelSize, pivot };
      const mesh = tools.voxel.mesh(sketch.model(tools.voxel), options);
      object.add(mesh);
      return mesh;
    },
  };
}

/** Local position of grid point `point` of `mesh`, in its parent's space (for anchors). */
export function gridPoint(mesh: VoxelObject, point: Vec3): Vec3 {
  const local = mesh.gridToLocal(point).add(mesh.position);
  return [local.x, local.y, local.z];
}

/** Sets anchors (local units) on a prop object. */
export function setAnchors(object: KitObject, anchors: Readonly<Record<string, Vec3>>): void {
  for (const [name, point] of Object.entries(anchors)) object.setAnchor(name, point);
}

/** A finite number argument of an animation hook (scenes are untyped JS). */
export function finiteArg(call: string, value: unknown): number {
  const number = typeof value === 'boolean' ? Number(value) : value;
  if (typeof number === 'number' && Number.isFinite(number)) return number;
  throw new KitError('invalid-params', `${call}: expected a finite number (got ${String(value)})`);
}

/** A 0..1 amount (clamped; booleans count as 0/1). */
export function amountArg(call: string, value: unknown): number {
  return Math.min(1, Math.max(0, finiteArg(call, value)));
}
