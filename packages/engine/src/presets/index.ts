/**
 * Built-in style presets (PLAN.md §4.2). The JSON files are the source of truth and are validated
 * with the shared zod schema when the engine loads, so a broken preset fails loudly and early.
 */
import { stylePresetSchema, type StylePreset } from '@reelforge/shared';
import noirVoxel from './noir-voxel.json' with { type: 'json' };
import soft480 from './soft-480.json' with { type: 'json' };
import voxelPixelCrisp640 from './voxel-pixel-crisp640.json' with { type: 'json' };

export const DEFAULT_STYLE_ID = 'voxel-pixel-crisp640';

function parsePreset(input: unknown): StylePreset {
  const result = stylePresetSchema.safeParse(input);
  if (result.success) return result.data;
  const details = result.error.issues
    .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
    .join('; ');
  throw new Error(`invalid built-in style preset: ${details}`);
}

const PRESETS: ReadonlyMap<string, StylePreset> = new Map(
  [voxelPixelCrisp640, noirVoxel, soft480].map((raw) => {
    const preset = parsePreset(raw);
    return [preset.id, preset] as const;
  }),
);

export const STYLE_PRESET_IDS: readonly string[] = [...PRESETS.keys()];

/** The preset with this id, or undefined. */
export function findStylePreset(id: string): StylePreset | undefined {
  return PRESETS.get(id);
}

export function defaultStylePreset(): StylePreset {
  const preset = PRESETS.get(DEFAULT_STYLE_ID);
  if (!preset) throw new Error(`default style preset "${DEFAULT_STYLE_ID}" is missing`);
  return preset;
}
