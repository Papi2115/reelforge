/**
 * World registry (PLAN.md#13.1). `WORLDS` lists every world module the kit ships (Sketchbook
 * first, 13.6; Comic, 13.3; Game B2, 13.4; Game B1, 13.5; Grim Ink, 14.2, wired in 14.12). Their
 * looks join `LOOKS` scoped to the world's style, and the engine registers each world's style
 * preset next to the built-in ones.
 */
import type { Look } from '../looks/types.js';
import { C_CAM } from './c-cam/index.js';
import { COMIC } from './comic/index.js';
import { GAME_B1 } from './game-b1/index.js';
import { GAME_B2 } from './game-b2/index.js';
import { SKETCHBOOK } from './sketchbook/index.js';
import type { World } from './types.js';

export * from './types.js';
export { C_CAM_ID } from './c-cam/index.js';
export { C_CAM_VOCABULARY, type CCamVocabulary } from './c-cam/vocabulary.js';
export { STAGE_INK_NAMES, type StageInk } from './c-cam/stage-ink.js';
export type { InkStageEnv, InkStageObject } from './c-cam/stage.js';
export { COMIC_ID, COMIC_INKS } from './comic/index.js';
export { GAME_B1_COLOURS, GAME_B1_ID, GAME_B1_LUTS } from './game-b1/index.js';
export {
  BUILT_IN_LEVELS,
  checkLevel,
  GAME_B2_COLOURS,
  GAME_B2_ID,
  type LevelInput,
} from './game-b2/index.js';
export {
  SKETCHBOOK_ID,
  SKETCHBOOK_INKS,
  strokeLetteringFindings,
  type StrokeLetteringFinding,
} from './sketchbook/index.js';
// Project asset files of the open vocabularies (PLAN.md#13.15 phase 2): format checks and the
// ids a scene refers to, for the loader, `reelforge validate` and the scene QA.
export {
  comicAssetFileSchema,
  parseComicAssets,
  unknownComicArtIds,
  type ComicAssets,
  type ComicAssetsResult,
  type UnknownArtId,
} from './comic/art/assets.js';
export {
  b1AssetFileSchema,
  b1SceneRefs,
  checkB1Assets,
  type B1AssetFile,
  type B1AssetIds,
  type B1AssetReport,
} from './game-b1/index.js';
export { checkAssets, type AssetPackInput, type AssetsResult } from './game-b2/index.js';
export type { KnownAssets } from './game-b2/index.js';
export { packSchema as b2AssetPackSchema } from './game-b2/assets/pack.js';
export { ICONS as GAME_B2_ICONS } from './game-b2/hud/inventory.js';
export {
  checkSketchAssets,
  parseSketchAsset,
  sketchAssetFindings,
  sketchAssetSchema,
  type SketchAsset,
  type SketchAssetFinding,
} from './sketchbook/index.js';

export {
  worldGeneratorDocs,
  type JsonSchemaObject,
  type WorldGenerator,
  type WorldGeneratorDocs,
} from './generator-docs.js';

/** Every world module, in delivery order. */
export const WORLDS: readonly World[] = Object.freeze([SKETCHBOOK, COMIC, GAME_B2, GAME_B1, C_CAM]);

/**
 * True when `style` is the style of a registered world that is not wired yet (no prompts or
 * project defaults): render-only, never offered to users or the runtime Claude.
 */
export function isUnwiredWorldStyle(
  style: string | undefined,
  worlds: readonly World[] = WORLDS,
): boolean {
  return worlds.some((world) => world.id === style && !world.wired);
}

/** The looks of these worlds, world by world. */
export function worldLooks(worlds: readonly World[] = WORLDS): Look[] {
  return worlds.flatMap((world) => world.looks);
}
