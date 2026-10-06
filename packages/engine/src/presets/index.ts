/**
 * Built-in style presets (PLAN.md §4.2) and world styles (PLAN.md#13.1). The JSON files are the
 * source of truth and are validated with the shared zod schema when the engine loads, so a broken
 * preset fails loudly and early.
 */
import { WORLDS } from '@reelforge/kit';
import type { StylePreset } from '@reelforge/shared';
import noirVoxel from './noir-voxel.json' with { type: 'json' };
import { createStyleRegistry, type StyleRegistry } from './registry.js';
import soft480 from './soft-480.json' with { type: 'json' };
import voxelPixelCrisp640 from './voxel-pixel-crisp640.json' with { type: 'json' };

export {
  createStyleRegistry,
  renderStyleProblem,
  STYLE_FONT_IDS,
  type StyleEntry,
  type StyleRegistry,
  type WorldStyleInfo,
} from './registry.js';

export const DEFAULT_STYLE_ID = 'voxel-pixel-crisp640';

/** The built-in presets, in picker order. */
export const BUILT_IN_STYLE_PRESETS: readonly unknown[] = Object.freeze([
  voxelPixelCrisp640,
  noirVoxel,
  soft480,
]);

/** Built-in presets plus the style of every world the kit ships. */
export const STYLE_REGISTRY: StyleRegistry = createStyleRegistry(BUILT_IN_STYLE_PRESETS, WORLDS);

/** Selectable style ids (experimental world styles are left out). */
export const STYLE_PRESET_IDS: readonly string[] = STYLE_REGISTRY.ids;

/** The preset with this id (experimental world styles included), or undefined. */
export function findStylePreset(id: string): StylePreset | undefined {
  return STYLE_REGISTRY.find(id);
}

export function defaultStylePreset(): StylePreset {
  const preset = STYLE_REGISTRY.find(DEFAULT_STYLE_ID);
  if (!preset) throw new Error(`default style preset "${DEFAULT_STYLE_ID}" is missing`);
  return preset;
}
