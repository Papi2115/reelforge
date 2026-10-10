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
  ACCESSORY_SLOTS,
  accessoryExtensionSchema,
  CAST,
  castDefinitions,
  castListing,
  charactersDocs,
  checkProjectCast,
  closestId,
  didYouMean,
  EXPRESSIONS,
  loadProjectCast,
  MASCOTS,
  MAX_OUTFIT_COLORS,
  NO_PROJECT_CAST,
  outfitColors,
  PACK_IDS,
  parseAccessoryFile,
  parseRoleFile,
  POSES,
  REACTIONS,
  roleSpecChecks,
  roleSpecSchema,
  SLOT_FRAMES,
  validateRoleSpec,
  type AccessoryExtension,
  type AccessorySlot,
  type AnyRoleSpec,
  type CastApi,
  type CastFileProblem,
  type CastFileSource,
  type CastId,
  type CastListingEntry,
  type CharacterObject,
  type Expression,
  type MascotId,
  type PoseName,
  type ProjectCast,
  type ProjectCastCheck,
  type ProjectCastSources,
  type ProjectRole,
  type ReactionName,
  type RoleSpec,
  type RoleSpecCheck,
  type RoleSpecCheckId,
  type RoleSpecInput,
  type RoleSpecResult,
} from './characters/index.js';
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
  END_CARD_CAMERA,
  endCardLayout,
  endCardNameScale,
  splitEndCardText,
  type EndCardFormat,
  type EndCardLayout,
} from './fx/end-card.js';
export {
  CAST_DEFINITIONS,
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
export * from './worlds/index.js';
export * from './worlds/c-cam/modules/index.js';
