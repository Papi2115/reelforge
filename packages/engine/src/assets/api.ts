/**
 * `ctx.assets` (PLAN.md#12.11): build-time access to the video's asset pictures. `image(ref,
 * options)` returns a handle for kit props (`kit.props.photoFrame({ asset })`...); in update() it
 * throws (pictures are chosen once, like sfx cues). `has(ref)` and `refs` work anywhere, so a scene
 * can keep a kit fallback when an asset is missing.
 */
import type { AssetImage } from '@reelforge/kit';
import { assetCropSchema } from '@reelforge/kit';
import { z } from 'zod';
import type { AssetImageOptions, AssetsApi } from '../contract.js';
import { EngineError } from '../errors.js';
import type { ScenePalette } from '../style.js';
import type { AssetLibrary } from './library.js';

const imageOptionsSchema = z
  .object({
    crop: assetCropSchema.default('cover'),
    contrast: z.boolean().default(true),
    dither: z.number().min(0).max(1).default(0.5),
    tones: z.array(z.string()).min(2).max(64).optional(),
  })
  .strict();

export interface AssetsApiInput {
  readonly library: AssetLibrary;
  readonly palette: ScenePalette;
  readonly shotId: string;
  /** `image()` is only allowed in build(). */
  readonly phase: 'build' | 'update';
}

function describeIssues(error: z.ZodError): string {
  return error.issues
    .map((issue) => `${issue.path.join('.') || 'options'}: ${issue.message}`)
    .join('; ');
}

export function createAssetsApi(input: AssetsApiInput): AssetsApi {
  const { library, palette, shotId } = input;
  const toneColors = (tones: readonly string[]): string[] =>
    tones.map((name) => {
      const hex = palette[name];
      if (hex === undefined) {
        throw new EngineError(
          'invalid-asset-options',
          `ctx.assets.image(): tone "${name}" is not in the style palette (use ctx.palette names, e.g. ${Object.keys(palette).slice(0, 6).join(', ')})`,
          { shotId },
        );
      }
      return hex;
    });
  return Object.freeze({
    refs: library.refs,
    has: (ref: string) => library.has(ref),
    image(ref: string, options: AssetImageOptions = {}): AssetImage {
      if (input.phase === 'update') {
        throw new EngineError(
          'assets-outside-build',
          `ctx.assets.image(${JSON.stringify(ref)}) was called in update(); get pictures once in build() and keep the props in the returned state`,
          { shotId },
        );
      }
      // Scenes are untyped JS: a computed id may not be a string at all.
      const given: unknown = ref;
      if (typeof given !== 'string') {
        throw new EngineError(
          'invalid-asset-options',
          `ctx.assets.image(<${typeof given}>): the ref must be an asset id string such as 'nasa-apollo-11'`,
          { shotId },
        );
      }
      const parsed = imageOptionsSchema.safeParse(options);
      if (!parsed.success) {
        throw new EngineError(
          'invalid-asset-options',
          `ctx.assets.image(${JSON.stringify(ref)}): invalid options (${describeIssues(parsed.error)}); allowed: crop, contrast, dither (0..1), tones (palette names)`,
          { shotId },
        );
      }
      const { crop, contrast, dither, tones } = parsed.data;
      return library.image(
        ref,
        {
          crop,
          contrast,
          dither,
          colors: tones === undefined ? library.defaultColors : toneColors(tones),
        },
        shotId,
      );
    },
  });
}
