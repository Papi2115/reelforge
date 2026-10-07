/**
 * World registry (PLAN.md#13.1). `WORLDS` lists every world module the kit ships (Sketchbook
 * first, 13.6). Their looks join `LOOKS` scoped to the world's style, and the engine registers
 * each world's style preset next to the built-in ones.
 */
import type { Look } from '../looks/types.js';
import { SKETCHBOOK } from './sketchbook/index.js';
import type { World } from './types.js';

export * from './types.js';
export {
  SKETCHBOOK_ID,
  SKETCHBOOK_INKS,
  strokeLetteringFindings,
  type StrokeLetteringFinding,
} from './sketchbook/index.js';

/** Every world module, in delivery order. */
export const WORLDS: readonly World[] = Object.freeze([SKETCHBOOK]);

/** The looks of these worlds, world by world. */
export function worldLooks(worlds: readonly World[] = WORLDS): Look[] {
  return worlds.flatMap((world) => world.looks);
}
