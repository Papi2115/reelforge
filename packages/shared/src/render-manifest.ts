/**
 * Input of the engine harness `load(manifest)`: everything needed to render a video
 * deterministically. Built in memory by the app from project.json + storyboard + scenes +
 * words; scene module sources are inlined so the sandboxed engine never touches the disk.
 */
import { z } from 'zod';
import { ambientShotSchema, ambientVariationSettingsSchema } from './ambient-variation.js';
import { assetIdSchema, assetMimeSchema } from './assets.js';
import { manifestCastRolesSchema } from './cast-roles.js';
import { kitExtensionSchema } from './kit-extensions.js';
import { shotDirectionSchema } from './live-direction.js';
import { paletteSchema } from './palette.js';
import { shotIdSchema, transitionSchema } from './storyboard.js';
import { stylePresetIdSchema } from './style-preset.js';
import {
  effectWindowProblems,
  MAX_SHOT_EFFECT_WINDOWS,
  paletteShiftWindowSchema,
  timeRemapWindowSchema,
} from './time-remap.js';
import { videoFormatSchema } from './video-format.js';
import { manifestWorldAssetsSchema } from './world-assets.js';
import { wordsFileSchema } from './words.js';

export const RENDER_MANIFEST_VERSION = 1;

/** Tolerance when checking that consecutive shots touch (t1 of one == t0 of the next). */
export const SHOT_CONTIGUITY_EPSILON = 1e-9;

export const sceneSourceSchema = z.object({
  /** Path for error messages / stack traces, e.g. `scenes/s01_intro.js`. */
  file: z.string().min(1),
  /** ES module source text. */
  source: z.string().min(1),
});
export type SceneSource = z.infer<typeof sceneSourceSchema>;

export const manifestShotSchema = z
  .object({
    id: shotIdSchema,
    t0: z.number().nonnegative(),
    t1: z.number().positive(),
    transitionIn: transitionSchema.optional(),
    scene: sceneSourceSchema,
    /** Storyboard position of the shot for ambient variation (absent: derived from the order). */
    ambient: ambientShotSchema.optional(),
    /**
     * Slow-motion windows of accepted reveal moments (PLAN.md#12.27, time-remap.ts), film
     * seconds inside the shot; scene time equals film time outside them. Absent = none.
     */
    timeRemap: z.array(timeRemapWindowSchema).max(MAX_SHOT_EFFECT_WINDOWS).optional(),
    /** Palette-shift flashes of accepted reveal moments (film seconds). Absent = none. */
    paletteShift: z.array(paletteShiftWindowSchema).max(MAX_SHOT_EFFECT_WINDOWS).optional(),
    /** Live co-direction overrides (PLAN.md#12.14, live-direction.ts). Absent = none. */
    direction: shotDirectionSchema.optional(),
  })
  .refine((shot) => shot.t1 > shot.t0, { message: 't1 must be > t0', path: ['t1'] })
  .superRefine((shot, issues) => {
    for (const key of ['timeRemap', 'paletteShift'] as const) {
      for (const message of effectWindowProblems(shot[key] ?? [], shot)) {
        issues.addIssue({ code: 'custom', message, path: [key] });
      }
    }
  });
export type ManifestShot = z.infer<typeof manifestShotSchema>;

/**
 * How a scene names an asset (PLAN.md#12.11): `<asset id>` or, for a still of a video,
 * `<asset id>@<seconds>` (`nasa-launch@12.5`; without `@` a video shows its middle frame).
 */
export const ASSET_REF_PATTERN = /^([a-z0-9][a-z0-9-]{0,63})(?:@(\d{1,5}(?:\.\d{1,3})?))?$/;
export const assetRefSchema = z.string().regex(ASSET_REF_PATTERN);

/** Longest edge of the decoded pixels an asset carries into the engine (the frame is 640 wide). */
export const ASSET_SOURCE_MAX_EDGE = 640;

/**
 * A picture the scenes may embed (`ctx.assets.image(ref)`), decoded by the pipeline (ffmpeg,
 * then an integer area downscale to ASSET_SOURCE_MAX_EDGE) so the sandboxed engine never decodes
 * or fetches anything. `rgb` = base64 of width*height*3 bytes, rows top-down.
 */
export const manifestAssetSchema = z
  .object({
    ref: assetRefSchema,
    id: assetIdSchema,
    /** Project-relative file of the original (for messages; the engine never reads it). */
    file: z.string().min(1),
    mime: assetMimeSchema,
    sha256: z.string().regex(/^[0-9a-f]{64}$/),
    /** Video still time in seconds (videos only). */
    at: z.number().nonnegative().optional(),
    width: z.int().min(1).max(ASSET_SOURCE_MAX_EDGE),
    height: z.int().min(1).max(ASSET_SOURCE_MAX_EDGE),
    rgb: z.string().regex(/^[A-Za-z0-9+/]*$/),
  })
  .refine((asset) => asset.rgb.length === asset.width * asset.height * 4, {
    message: 'rgb must be base64 of width*height*3 bytes',
    path: ['rgb'],
  });
export type ManifestAsset = z.infer<typeof manifestAssetSchema>;

export const renderManifestSchema = z
  .object({
    version: z.literal(RENDER_MANIFEST_VERSION),
    /** Style preset id (engine presets); defaults to the engine's default style. */
    style: stylePresetIdSchema.optional(),
    /**
     * Video format (PLAN.md#13.18): `portrait` turns the style's resolution upright (640x360 ->
     * 360x640). Absent = landscape (the style's resolution as declared).
     */
    format: videoFormatSchema.optional(),
    /**
     * Render size; defaults to the style's resolution in `format` and must match it when given.
     */
    width: z.int().min(16).max(4096).optional(),
    height: z.int().min(16).max(4096).optional(),
    fps: z.int().min(1).max(120),
    /** Project seed (uint32); every shot derives its own RNG stream from it. */
    seed: z.int().min(0).max(0xffffffff),
    /** Swatch overrides/additions merged over the style's palette (same names replace colours). */
    palette: paletteSchema.optional(),
    words: wordsFileSchema.optional(),
    /**
     * Word-by-word captions (PLAN.md#13.18, a short's `short.captions`): the engine draws the
     * spoken `words` over every shot. Absent = off (every manifest made before Shorts).
     */
    captions: z.boolean().optional(),
    /** Project-local props (`kit-ext/props/*.js`), registered before any scene is built. */
    kitExtensions: z.array(kitExtensionSchema).optional(),
    /**
     * Project roles and accessory extensions (`characters/`, PLAN.md#12.20, ADR-026), resolved by
     * id in every shot's `kit.cast`; absent = the pack only.
     */
    castRoles: manifestCastRolesSchema.optional(),
    /** Ambient variation switch (PLAN.md#12.8); absent or disabled = every shot as authored. */
    ambientVariation: ambientVariationSettingsSchema.optional(),
    /** Decoded pictures the scenes reference (PLAN.md#12.11); absent = none. */
    assets: z.array(manifestAssetSchema).optional(),
    /**
     * The project's world asset files (`assets/<world>/*.json`, PLAN.md#13.15), parsed by the
     * engine into `ctx.worldAssets`; absent = none (a world's scenes get its empty set).
     */
    worldAssets: manifestWorldAssetsSchema.optional(),
    shots: z.array(manifestShotSchema).min(1),
  })
  .superRefine((manifest, issues) => {
    const refs = new Set<string>();
    (manifest.assets ?? []).forEach((asset, index) => {
      if (refs.has(asset.ref)) {
        issues.addIssue({
          code: 'custom',
          message: `duplicate asset ref "${asset.ref}"`,
          path: ['assets', index, 'ref'],
        });
      }
      refs.add(asset.ref);
    });
    const names = new Set<string>();
    (manifest.kitExtensions ?? []).forEach((extension, index) => {
      if (names.has(extension.name)) {
        issues.addIssue({
          code: 'custom',
          message: `duplicate kit extension "${extension.name}"`,
          path: ['kitExtensions', index, 'name'],
        });
      }
      names.add(extension.name);
    });
    const seen = new Set<string>();
    manifest.shots.forEach((shot, index) => {
      if (seen.has(shot.id)) {
        issues.addIssue({
          code: 'custom',
          message: `duplicate shot id "${shot.id}"`,
          path: ['shots', index, 'id'],
        });
      }
      seen.add(shot.id);
      const previous = index > 0 ? manifest.shots[index - 1] : undefined;
      const expectedT0 = previous ? previous.t1 : 0;
      if (Math.abs(shot.t0 - expectedT0) > SHOT_CONTIGUITY_EPSILON) {
        issues.addIssue({
          code: 'custom',
          message: `shot "${shot.id}" must start at ${String(expectedT0)} (shots are contiguous from 0)`,
          path: ['shots', index, 't0'],
        });
      }
      const transition = shot.transitionIn;
      if (transition && transition.type !== 'cut') {
        if (!previous) {
          issues.addIssue({
            code: 'custom',
            message: 'the first shot cannot transition in (no previous shot)',
            path: ['shots', index, 'transitionIn'],
          });
        } else if (transition.duration > shot.t1 - shot.t0) {
          issues.addIssue({
            code: 'custom',
            message: `transition into "${shot.id}" is longer than the shot`,
            path: ['shots', index, 'transitionIn', 'duration'],
          });
        }
      }
    });
  });
export type RenderManifest = z.infer<typeof renderManifestSchema>;
