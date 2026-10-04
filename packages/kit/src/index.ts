/**
 * @reelforge/kit: voxel toolkit for scenes (`ctx.kit`) - voxel models, greedy/instanced meshing
 * with baked AO, anchors and placement, and the typed registry of environments/props/effects.
 */
export const packageName = '@reelforge/kit';

export {
  ASSET_CROP_MODES,
  assetCropSchema,
  isAssetImage,
  type AssetCrop,
  type AssetCropMode,
  type AssetFocusCrop,
  type AssetImage,
  type AssetPictureOptions,
  type AssetPixels,
} from './assets/index.js';

export {
  GRID_VARIANTS,
  LIGHT_RIGS,
  SKY_STYLES,
  type EnvMethods,
  type EnvObject,
} from './env/index.js';
export * from './errors.js';
export * from './extensions.js';
export {
  glitchPixels,
  textPixels,
  type FxMethods,
  type FxObject,
  type LevelFxMethods,
  type LevelFxObject,
  type ScreenPixels,
} from './fx/index.js';
export {
  createKit,
  ENV_DEFINITIONS,
  FX_DEFINITIONS,
  kitCatalog,
  PROP_DEFINITIONS,
  type KitApi,
  type KitCatalog,
  type KitCatalogLook,
  type KitHandle,
  type KitOptions,
} from './kit.js';
export * from './looks/index.js';
export {
  isKitObject,
  STANDARD_ANCHORS,
  type KitObject,
  type KitObjectMethods,
  type MountOptions,
  type OnOptions,
} from './object.js';
export {
  SCREEN_MODES,
  type PixelScreen,
  type PropMethods,
  type PropObject,
  type ScreenMode,
} from './props/index.js';
export * from './registry.js';
export type * from './types.js';
export * from './variation/index.js';
export { KIT_VERSION } from './version.js';
export { VOXEL_API_DOCS, type ApiDoc, type GroupOptions, type VoxelApi } from './voxel/api.js';
export { componentFloors, inspectObject, type KitInspection } from './voxel/inspect.js';
export type { Sketch, SketchPlane } from './props/sketch.js';
export {
  aoLevelsFor,
  greedyMesh,
  type AoLevels,
  type ShadedColor,
  type VoxelMeshData,
} from './voxel/greedy.js';
export * from './voxel/grid.js';
export { chooseMode, instanceData, type VoxelInstanceData } from './voxel/instances.js';
export {
  DEFAULT_AO_STRENGTH,
  DEFAULT_VOXEL_SIZE,
  type VoxelMeshMode,
  type VoxelMeshOptions,
  type VoxelObject,
  type VoxelObjectMethods,
  type VoxelPivot,
  type VoxelTransform,
} from './voxel/mesh.js';
export {
  filledBounds,
  voxelAt,
  voxelCount,
  type VoxelBounds,
  type VoxelColor,
  type VoxelModel,
} from './voxel/model.js';
export * from './voxel/ops.js';
