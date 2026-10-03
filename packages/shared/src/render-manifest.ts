/**
 * Input of the engine harness `load(manifest)`: everything needed to render a video
 * deterministically. Built in memory by the app from project.json + storyboard + scenes +
 * words; scene module sources are inlined so the sandboxed engine never touches the disk.
 */
import { z } from 'zod';
import { ambientShotSchema, ambientVariationSettingsSchema } from './ambient-variation.js';
import { kitExtensionSchema } from './kit-extensions.js';
import { paletteSchema } from './palette.js';
import { shotIdSchema, transitionSchema } from './storyboard.js';
import { stylePresetIdSchema } from './style-preset.js';
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
  })
  .refine((shot) => shot.t1 > shot.t0, { message: 't1 must be > t0', path: ['t1'] });
export type ManifestShot = z.infer<typeof manifestShotSchema>;

export const renderManifestSchema = z
  .object({
    version: z.literal(RENDER_MANIFEST_VERSION),
    /** Style preset id (engine presets); defaults to the engine's default style. */
    style: stylePresetIdSchema.optional(),
    /** Render size; defaults to the style's resolution and must match it when given. */
    width: z.int().min(16).max(4096).optional(),
    height: z.int().min(16).max(4096).optional(),
    fps: z.int().min(1).max(120),
    /** Project seed (uint32); every shot derives its own RNG stream from it. */
    seed: z.int().min(0).max(0xffffffff),
    /** Swatch overrides/additions merged over the style's palette (same names replace colours). */
    palette: paletteSchema.optional(),
    words: wordsFileSchema.optional(),
    /** Project-local props (`kit-ext/props/*.js`), registered before any scene is built. */
    kitExtensions: z.array(kitExtensionSchema).optional(),
    /** Ambient variation switch (PLAN.md#12.8); absent or disabled = every shot as authored. */
    ambientVariation: ambientVariationSettingsSchema.optional(),
    shots: z.array(manifestShotSchema).min(1),
  })
  .superRefine((manifest, issues) => {
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
