/**
 * World registry (PLAN.md#13.1). `WORLDS` lists every world module the kit ships (Sketchbook
 * first, 13.6; Comic, 13.3; Game B2, 13.4; Game B1, 13.5). Their looks join `LOOKS` scoped to the world's style, and the engine
 * registers each world's style preset next to the built-in ones.
 */
import type { Look } from '../looks/types.js';
import { COMIC } from './comic/index.js';
import { GAME_B1 } from './game-b1/index.js';
import { GAME_B2 } from './game-b2/index.js';
import { SKETCHBOOK } from './sketchbook/index.js';
import type { World } from './types.js';

export * from './types.js';
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

/** Every world module, in delivery order. */
export const WORLDS: readonly World[] = Object.freeze([SKETCHBOOK, COMIC, GAME_B2, GAME_B1]);

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
