/**
 * Style presets (PLAN.md §4.1–4.2): render resolution, the palette every output pixel is snapped
 * to (unless the preset sets `quantize: false`), semantic colour tokens for scenes, and the
 * pixel-art post-fx settings. The engine ships its presets as JSON
 * (`packages/engine/src/presets/*.json`); a render manifest selects one by id.
 */
import { z } from 'zod';
import { variationBudgetKeySchema, variationBudgetSchema } from './ambient-variation.js';
import { paletteSchema } from './palette.js';
import { treatmentSchema } from './storyboard.js';

export const STYLE_PRESET_VERSION = 1;

/**
 * Semantic colour roles every preset must define. Scenes should prefer tokens (`palette.sky`) over
 * swatch names (`palette.navy`) so the same scene works in every style.
 */
export const PALETTE_TOKENS = [
  'sky',
  'ground',
  'groundAlt',
  'hero',
  'heroTrim',
  'accent1',
  'accent2',
  'accent3',
  'accent4',
  'keyLight',
  'fillLight',
  'shadow',
  'text',
  'textDim',
  'outline',
] as const;
export type PaletteToken = (typeof PALETTE_TOKENS)[number];

export const stylePresetIdSchema = z
  .string()
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'style ids are kebab-case, e.g. "voxel-pixel-crisp640"');

const swatchNameSchema = z.string().min(1);

export const ditherSettingsSchema = z.object({
  /** Ordered-dither matrix. */
  matrix: z.enum(['bayer4', 'bayer8']),
  /** Strength of the dither offset in normalized colour units (0 disables dithering). */
  spread: z.number().min(0).max(1),
});

export const outlineSettingsSchema = z.object({
  /** Swatch or token name of the outline colour. */
  color: swatchNameSchema,
  /** A pixel is outlined when a 4-neighbour is closer by more than this share of its depth. */
  threshold: z.number().positive().max(1),
});

export const aoSettingsSchema = z.object({
  /** Max darkening (0..1) of fully occluded creases. */
  strength: z.number().min(0).max(1),
  /** Sample distance in low-res pixels. */
  radius: z.int().min(1).max(8),
  /** Occluders further in front than this (world units) are ignored (avoids halos). */
  range: z.number().positive(),
});

export const scanlineSettingsSchema = z.object({
  /** Every `period`-th row (top-down) is darkened. */
  period: z.int().min(2).max(8),
  strength: z.number().min(0).max(1),
});

export const vignetteSettingsSchema = z.object({
  strength: z.number().min(0).max(1),
  /** Normalized distance from the centre (1 = corner) where darkening starts. */
  radius: z.number().min(0).max(1.5),
  /** Width of the falloff, in the same units. */
  softness: z.number().positive().max(2),
});

/** Text safe area: margin per side as a share of the frame width (x) and height (y). */
export const safeAreaSchema = z.object({
  x: z.number().min(0).max(0.25),
  y: z.number().min(0).max(0.25),
});
export type SafeAreaMargins = z.infer<typeof safeAreaSchema>;

/** Safe area of presets that do not set one: 5 % margins. */
export const DEFAULT_SAFE_AREA: SafeAreaMargins = { x: 0.05, y: 0.05 };

export const stylePresetSchema = z
  .object({
    version: z.literal(STYLE_PRESET_VERSION),
    id: stylePresetIdSchema,
    name: z.string().min(1),
    /** Low-res render target; must upscale by an integer factor to the export size. */
    resolution: z.object({ width: z.int().min(16).max(4096), height: z.int().min(16).max(4096) }),
    /** Quantization set: every output pixel is one of these colours (unless `quantize: false`). */
    palette: paletteSchema,
    /** Semantic role -> swatch name. */
    tokens: z.record(z.enum(PALETTE_TOKENS), swatchNameSchema),
    dither: ditherSettingsSchema,
    /**
     * `false` = full-colour style (PLAN.md#14.1): the post pass does not snap output pixels to the
     * palette and applies no dither offset; the palette (2..32 colours) only feeds the scene tokens,
     * text and annotation colours. Absent or `true` = the palette snap of every pixel-art style.
     */
    quantize: z.boolean().optional(),
    outline: outlineSettingsSchema.optional(),
    ao: aoSettingsSchema.optional(),
    scanlines: scanlineSettingsSchema.optional(),
    vignette: vignetteSettingsSchema.optional(),
    /** Where text cards must stay (QA, `ctx.text.safeArea`); defaults to DEFAULT_SAFE_AREA. */
    safeArea: safeAreaSchema.optional(),
    /**
     * Ambient variation budgets by key (a look's `variationBudget`, e.g. `voxel`; PLAN.md#12.8).
     * A look without a budget in the style never varies.
     */
    variation: z.record(variationBudgetKeySchema, variationBudgetSchema).optional(),
  })
  .superRefine((preset, issues) => {
    const swatches = new Set(Object.keys(preset.palette));
    for (const [key, budget] of Object.entries(preset.variation ?? {})) {
      for (const [family, members] of Object.entries(budget.tones)) {
        for (const [index, name] of [family, ...members].entries()) {
          if (swatches.has(name)) continue;
          issues.addIssue({
            code: 'custom',
            message: `variation tone "${name}" is not a swatch of the palette`,
            path: ['variation', key, 'tones', family, ...(index === 0 ? [] : [index - 1])],
          });
        }
      }
    }
    const tokens = new Set<string>(PALETTE_TOKENS);
    for (const name of swatches) {
      if (tokens.has(name)) {
        issues.addIssue({
          code: 'custom',
          message: `swatch "${name}" collides with a palette token name`,
          path: ['palette', name],
        });
      }
    }
    for (const token of PALETTE_TOKENS) {
      const swatch = preset.tokens[token];
      if (!swatches.has(swatch)) {
        issues.addIssue({
          code: 'custom',
          message: `token "${token}" refers to unknown swatch "${swatch}"`,
          path: ['tokens', token],
        });
      }
    }
    const outline = preset.outline?.color;
    if (outline !== undefined && !swatches.has(outline) && !tokens.has(outline)) {
      issues.addIssue({
        code: 'custom',
        message: `outline colour "${outline}" is neither a swatch nor a token`,
        path: ['outline', 'color'],
      });
    }
  });
export type StylePreset = z.infer<typeof stylePresetSchema>;

export const STYLE_MANIFEST_VERSION = 1;

/**
 * `styles/<id>/style.json`: the user-facing card of a built-in style. Palette, tokens and post-fx
 * live only in the engine preset with the same id (the source of truth); this file adds what the
 * app and the runtime Claude need to choose and use the style (a test keeps both in sync).
 */
export const styleManifestSchema = z.object({
  version: z.literal(STYLE_MANIFEST_VERSION),
  /** Id of the engine preset (and name of the folder). */
  id: stylePresetIdSchema,
  /** Display name; equal to the preset name. */
  name: z.string().min(1),
  /** One or two sentences for the style picker. */
  description: z.string().min(1),
  /** The style new projects start with (exactly one built-in style). */
  default: z.boolean(),
  /** Recommended `kit.env.lights` preset. */
  lights: z.string().min(1),
  /** Treatments (PLAN.md §4.3) the style suits best, in order of preference. */
  treatments: z.array(treatmentSchema).min(1),
});
export type StyleManifest = z.infer<typeof styleManifestSchema>;
