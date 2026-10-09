/** Effects and 3D infographics of the kit (PLAN.md#3.4), in catalog order. */
import type { KitDefinition } from '../registry.js';
import { bars3d } from './bars.js';
import { counter } from './counter.js';
import { dissolve } from './dissolve.js';
import { endCard } from './end-card.js';
import { flicker } from './flicker.js';
import { glitch } from './glitch.js';
import { label3d } from './label.js';
import { mapAnimated } from './map.js';
import { nodeGraph } from './node-graph.js';
import { screenGlitch } from './screen.js';
import { shardExplosion } from './shards.js';
import { ticker, typewriterBlock } from './text-fx.js';
import { timeline3d } from './timeline.js';

export const FX_DEFINITIONS = [
  shardExplosion,
  dissolve,
  glitch,
  flicker,
  counter,
  bars3d,
  nodeGraph,
  timeline3d,
  mapAnimated,
  typewriterBlock,
  ticker,
  screenGlitch,
  label3d,
] as const satisfies readonly KitDefinition[];

/**
 * Effects the app itself uses in scenes it writes (a short's end card, PLAN.md#13.18): bound in
 * every kit like the others, but not in the catalog or kit-docs (never offered to Claude).
 */
export const APP_FX_DEFINITIONS = [endCard] as const satisfies readonly KitDefinition[];

export type { FxMethods, FxObject, LevelFxMethods, LevelFxObject } from './shared.js';
export { glitchPixels, textPixels, type ScreenPixels } from './screen.js';
