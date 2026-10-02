/**
 * `createKit`: one kit instance per shot (the engine creates it in buildShot and exposes
 * `handle.api` as `ctx.kit`). Three.js comes in through the options, so the kit bundled into the
 * sandboxed engine frame uses the engine's single Three instance and has no imports of its own.
 */
import { createKitContext } from './context.js';
import { ENV_DEFINITIONS } from './env/index.js';
import { FX_DEFINITIONS } from './fx/index.js';
import type { Three } from './object.js';
import { PROP_DEFINITIONS } from './props/index.js';
import {
  bindRegistry,
  catalogEntries,
  type BoundRegistry,
  type KitCatalogEntry,
} from './registry.js';
import type { KitPalette, KitRng } from './types.js';
import { createVoxelApi, VOXEL_API_DOCS, type ApiDoc, type VoxelApi } from './voxel/api.js';
import { KIT_VERSION } from './version.js';

/** `ctx.kit` as scenes see it. */
export interface KitApi {
  /** KIT_VERSION (part of the export cache key). */
  readonly version: string;
  readonly voxel: VoxelApi;
  readonly env: BoundRegistry<typeof ENV_DEFINITIONS>;
  readonly props: BoundRegistry<typeof PROP_DEFINITIONS>;
  readonly fx: BoundRegistry<typeof FX_DEFINITIONS>;
}

export interface KitOptions {
  /** The engine's Three.js namespace (ctx.three). */
  readonly three: Three;
  /** The active style's palette (ctx.palette): kit colours are names resolved against it. */
  readonly palette: KitPalette;
  /** Seeded stream reserved for the kit (not the scene's ctx.rng). */
  readonly rng: KitRng;
}

/** Engine-side handle of a kit instance. */
export interface KitHandle {
  readonly api: KitApi;
  /** Ends the build phase: afterwards factories that create objects throw (see assertBuildPhase). */
  seal(): void;
  /** Frees every geometry and material this kit instance created. */
  dispose(): void;
}

export { ENV_DEFINITIONS, FX_DEFINITIONS, PROP_DEFINITIONS };

export function createKit(options: KitOptions): KitHandle {
  const context = createKitContext(options.three, options.palette, options.rng);
  const voxel = createVoxelApi(context);
  const api: KitApi = Object.freeze({
    version: KIT_VERSION,
    voxel,
    env: bindRegistry(context, voxel, ENV_DEFINITIONS),
    props: bindRegistry(context, voxel, PROP_DEFINITIONS),
    fx: bindRegistry(context, voxel, FX_DEFINITIONS),
  });
  return {
    api,
    seal() {
      context.seal();
    },
    dispose() {
      context.dispose();
    },
  };
}

export interface KitCatalog {
  readonly version: string;
  readonly voxel: Readonly<Record<string, ApiDoc>>;
  readonly env: readonly KitCatalogEntry[];
  readonly props: readonly KitCatalogEntry[];
  readonly fx: readonly KitCatalogEntry[];
}

/** Machine-readable description of everything in ctx.kit (source of kit-docs, PLAN.md#3.3). */
export function kitCatalog(): KitCatalog {
  return {
    version: KIT_VERSION,
    voxel: VOXEL_API_DOCS,
    env: catalogEntries(ENV_DEFINITIONS),
    props: catalogEntries(PROP_DEFINITIONS),
    fx: catalogEntries(FX_DEFINITIONS),
  };
}
