/**
 * `createKit`: one kit instance per shot (the engine creates it in buildShot and exposes
 * `handle.api` as `ctx.kit`). Three.js comes in through the options, so the kit bundled into the
 * sandboxed engine frame uses the engine's single Three instance and has no imports of its own.
 */
import { createKitContext } from './context.js';
import { ENV_DEFINITIONS } from './env/index.js';
import { checkExtensionNames } from './extensions.js';
import { FX_DEFINITIONS } from './fx/index.js';
import type { Three } from './object.js';
import { extraLookDefinitions, listLooks, LOOKS, VOXEL_LOOK_ID, type Look } from './looks/index.js';
import { PROP_DEFINITIONS } from './props/index.js';
import {
  bindRegistry,
  catalogEntries,
  type BoundRegistry,
  type KitCatalogEntry,
  type KitDefinition,
  type KitKind,
} from './registry.js';
import type { KitPalette, KitRng } from './types.js';
import type { AmbientVariation } from './variation/types.js';
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
  /**
   * Project-local props (`kit-ext/props/*.js`, see extensions.ts), callable as
   * `kit.props.<name>` next to the kit's own; a name of a kit prop is an error.
   */
  readonly extraProps?: readonly KitDefinition[] | undefined;
  /**
   * Look modules (default: LOOKS). The available ones other than voxel add their definitions
   * next to the kit's own (`kit.env/props/fx.<name>`); with only voxel available (today) the
   * API is exactly the voxel kit.
   */
  readonly looks?: readonly Look[] | undefined;
  /**
   * Ambient variation of the shot (PLAN.md#12.8); absent = environments exactly as authored.
   */
  readonly variation?: AmbientVariation | undefined;
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
  const context = createKitContext(options.three, options.palette, options.rng, options.variation);
  const voxel = createVoxelApi(context);
  const extraProps = options.extraProps ?? [];
  const looks = extraLookDefinitions(options.looks);
  const definitionsOf = (kind: KitKind): KitDefinition[] =>
    looks[kind].map((entry) => entry.definition);
  checkExtensionNames(
    [...PROP_DEFINITIONS, ...definitionsOf('prop')].map((definition) => definition.name),
    extraProps,
  );
  // Look and project definitions are untyped for TypeScript (scenes are plain JS); the voxel
  // kit's own keep their types.
  const props: BoundRegistry<typeof PROP_DEFINITIONS> = Object.freeze({
    ...bindRegistry(context, voxel, PROP_DEFINITIONS),
    ...bindRegistry(context, voxel, definitionsOf('prop')),
    ...bindRegistry(context, voxel, extraProps),
  });
  const env: BoundRegistry<typeof ENV_DEFINITIONS> = Object.freeze({
    ...bindRegistry(context, voxel, ENV_DEFINITIONS),
    ...bindRegistry(context, voxel, definitionsOf('env')),
  });
  const fx: BoundRegistry<typeof FX_DEFINITIONS> = Object.freeze({
    ...bindRegistry(context, voxel, FX_DEFINITIONS),
    ...bindRegistry(context, voxel, definitionsOf('fx')),
  });
  const api: KitApi = Object.freeze({ version: KIT_VERSION, voxel, env, props, fx });
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

/** An available look as the catalog lists it. */
export interface KitCatalogLook {
  readonly id: string;
  readonly label: string;
  readonly description: string;
}

export interface KitCatalog {
  readonly version: string;
  /** Available looks, voxel first; entries name theirs in `look`. */
  readonly looks: readonly KitCatalogLook[];
  readonly voxel: Readonly<Record<string, ApiDoc>>;
  readonly env: readonly KitCatalogEntry[];
  readonly props: readonly KitCatalogEntry[];
  readonly fx: readonly KitCatalogEntry[];
}

/**
 * Machine-readable description of everything in ctx.kit (source of kit-docs, PLAN.md#3.3):
 * the voxel kit's entries, then those of the other available looks, then `projectProps` (the
 * project's own props). `looks` defaults to LOOKS.
 */
export function kitCatalog(
  projectProps: readonly KitCatalogEntry[] = [],
  looks: readonly Look[] = LOOKS,
): KitCatalog {
  const extra = extraLookDefinitions(looks);
  const lookEntries = (kind: KitKind): KitCatalogEntry[] =>
    extra[kind].flatMap((entry) => catalogEntries([entry.definition], entry.look));
  return {
    version: KIT_VERSION,
    looks: listLooks(looks).map(({ id, label, description }) => ({ id, label, description })),
    voxel: VOXEL_API_DOCS,
    env: [...catalogEntries(ENV_DEFINITIONS, VOXEL_LOOK_ID), ...lookEntries('env')],
    props: [
      ...catalogEntries(PROP_DEFINITIONS, VOXEL_LOOK_ID),
      ...lookEntries('prop'),
      ...projectProps,
    ],
    fx: [...catalogEntries(FX_DEFINITIONS, VOXEL_LOOK_ID), ...lookEntries('fx')],
  };
}
