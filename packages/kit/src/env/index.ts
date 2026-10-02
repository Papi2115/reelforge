/** Environments of the kit (PLAN.md#3.2), in catalog order. */
import type { KitDefinition } from '../registry.js';
import { blockCity } from './city.js';
import { floatingCubes } from './floating.js';
import { bench, desk } from './furniture.js';
import { lights } from './lights.js';
import { neonGrid } from './neon-grid.js';
import { room } from './room.js';
import { sky } from './sky.js';
import { voidScene } from './void.js';

export const ENV_DEFINITIONS = [
  sky,
  neonGrid,
  lights,
  desk,
  bench,
  room,
  blockCity,
  floatingCubes,
  voidScene,
] as const satisfies readonly KitDefinition[];

export type { EnvMethods, EnvObject } from './shared.js';
export { GRID_VARIANTS } from './neon-grid.js';
export { LIGHT_RIGS } from './lights.js';
export { SKY_STYLES } from './sky.js';
