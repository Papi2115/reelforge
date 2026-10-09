/**
 * Per-kit-instance state shared by every factory: the Three namespace and palette passed in by
 * the engine, shared materials, the resources to dispose and the build-phase guard.
 */
import type * as THREE from 'three';
import { KitError } from './errors.js';
import type { Disposable, Three } from './object.js';
import type { KitPalette, KitRng } from './types.js';
import type { AmbientVariation } from './variation/types.js';
import type { ShadedColor } from './voxel/greedy.js';
import type { VoxelColor } from './voxel/model.js';

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

export interface KitMaterials {
  /** Lambert, flat-shaded, vertex colours (greedy meshes). */
  readonly lit: THREE.MeshLambertMaterial;
  /** Unlit, vertex colours (glow voxels of greedy meshes). */
  readonly glow: THREE.MeshBasicMaterial;
  /** Lambert, flat-shaded, per-instance colours. */
  readonly instancedLit: THREE.MeshLambertMaterial;
  /** Unlit, per-instance colours. */
  readonly instancedGlow: THREE.MeshBasicMaterial;
}

export interface KitFrame {
  readonly width: number;
  readonly height: number;
}

export interface KitContext {
  readonly three: Three;
  readonly palette: KitPalette;
  /** The kit's own stream; factories fork it per call (never the scene's ctx.rng). */
  readonly rng: KitRng;
  /** Ambient variation of the shot (PLAN.md#12.8); undefined when the project has it off. */
  readonly variation: AmbientVariation | undefined;
  /** Frame size of the shot in px (portrait shorts are taller than wide); absent in unit tests. */
  readonly frame: KitFrame | undefined;
  materials(): KitMaterials;
  /** Registers a resource freed by the kit's dispose(). */
  track<T extends Disposable>(resource: T): T;
  /** Throws when a factory that creates scene objects is called after build(). */
  assertBuildPhase(call: string): void;
  seal(): void;
  dispose(): void;
}

export function createKitContext(
  three: Three,
  palette: KitPalette,
  rng: KitRng,
  variation?: AmbientVariation,
  frame?: KitFrame,
): KitContext {
  const resources: Disposable[] = [];
  let materials: KitMaterials | undefined;
  let sealed = false;
  const track = <T extends Disposable>(resource: T): T => {
    resources.push(resource);
    return resource;
  };
  return {
    three,
    palette,
    rng,
    variation,
    frame,
    track,
    materials() {
      materials ??= {
        lit: track(new three.MeshLambertMaterial({ vertexColors: true, flatShading: true })),
        glow: track(new three.MeshBasicMaterial({ vertexColors: true })),
        instancedLit: track(new three.MeshLambertMaterial({ flatShading: true })),
        instancedGlow: track(new three.MeshBasicMaterial()),
      };
      return materials;
    },
    assertBuildPhase(call) {
      if (!sealed) return;
      throw new KitError(
        'kit-outside-build',
        `${call} was called in update(); create kit objects once in build(), keep them in the returned state and animate them in update()`,
      );
    },
    seal() {
      sealed = true;
    },
    dispose() {
      for (const resource of resources.splice(0)) resource.dispose();
      materials = undefined;
    },
  };
}

/** Resolves a palette name or '#rrggbb' to the hex string of the active style. */
export function resolveHex(palette: KitPalette, color: VoxelColor): string {
  const name = typeof color === 'string' ? color : color.color;
  const hex = palette[name];
  if (hex !== undefined) return hex;
  if (HEX_COLOR.test(name)) return name;
  throw new KitError(
    'invalid-color',
    `colour "${name}" is not in the style palette; use a ctx.palette name (prefer tokens such as hero, accent1, ground; available: ${Object.keys(palette).join(', ')}) or '#rrggbb'`,
  );
}

/** Model palette -> colours for the mesher (Three.Color semantics, i.e. the engine's colour space). */
export function shadeColors(
  three: Three,
  palette: KitPalette,
  colors: readonly VoxelColor[],
): ShadedColor[] {
  return colors.map((color) => {
    const value = new three.Color(resolveHex(palette, color));
    return {
      rgb: [value.r, value.g, value.b],
      glow: typeof color !== 'string' && color.glow === true,
    };
  });
}
