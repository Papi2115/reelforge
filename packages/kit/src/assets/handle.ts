/**
 * Asset pictures in kit props (PLAN.md#12.11, ADR-014). A scene gets a handle from
 * `ctx.assets.image(ref, options)` in build() and passes it to a prop's `asset` param; the prop
 * asks the handle for the picture at the pixel size of its slot. The engine stylises it (crop,
 * area downscale, contrast stretch, Bayer dither, palette snap: pure integer code), so every pixel
 * is one of the colours asked for (the style palette by default) and props show it unlit or lit,
 * nearest-filtered, like any other style colour.
 */
import { z } from 'zod';

/** `cover`: fill the slot, overflow cropped evenly; `center`: whole picture, centred, letterboxed. */
export const ASSET_CROP_MODES = ['cover', 'center'] as const;
export type AssetCropMode = (typeof ASSET_CROP_MODES)[number];

/** Cover crop around `focus` ([x, y] fractions of the picture) magnified by `zoom` (>= 1). */
export interface AssetFocusCrop {
  readonly focus: readonly [number, number];
  readonly zoom: number;
}

export type AssetCrop = AssetCropMode | AssetFocusCrop;

export const assetCropSchema = z
  .union([
    z.enum(ASSET_CROP_MODES),
    z
      .object({
        focus: z.tuple([z.number().min(0).max(1), z.number().min(0).max(1)]),
        zoom: z.number().min(1).max(16).default(1),
      })
      .strict(),
  ])
  .describe(
    "Crop: 'cover' (fill, centred), 'center' (whole picture, letterboxed) or { focus: [x, y] (0..1), zoom (>= 1) }",
  );

/** Stylised pixels of an asset at one size. */
export interface AssetPixels {
  readonly width: number;
  readonly height: number;
  /** Colours (`#rrggbb`) the indices refer to. */
  readonly colors: readonly string[];
  /** Colour index per pixel, rows top-down. */
  readonly indices: Uint8Array;
  /** The same pixels as RGBA bytes (alpha 255), rows top-down. */
  readonly rgba: Uint8Array;
}

export interface AssetPictureOptions {
  /** `#rrggbb` colours to map onto; default: the handle's tones (the style palette). */
  readonly colors?: readonly string[] | undefined;
  /** Overrides the handle's crop for this slot. */
  readonly crop?: AssetCrop | undefined;
}

/** What `ctx.assets.image(ref)` returns (implemented by the engine). */
export interface AssetImage {
  readonly kind: 'asset-image';
  /** Asset id (`assets.json`). */
  readonly id: string;
  /** The ref the scene asked for (`id` or `id@seconds`). */
  readonly ref: string;
  /** Width / height of the source picture. */
  readonly aspect: number;
  readonly crop: AssetCrop;
  /** Stable identity of the picture and its stylisation options (sha256 + params). */
  readonly key: string;
  /** The picture at width x height pixels in style colours (memoised; pure). */
  pixels(width: number, height: number, options?: AssetPictureOptions): AssetPixels;
  /**
   * Luminance 0..255 per pixel (crop, area average, contrast; no palette), rows top-down: for
   * looks that dither the picture onto their own tone ramp (newsprint halftone, phosphor).
   */
  luminance(width: number, height: number, crop?: AssetCrop): Uint8Array;
}

export function isAssetImage(value: unknown): value is AssetImage {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    record['kind'] === 'asset-image' &&
    typeof record['ref'] === 'string' &&
    typeof record['pixels'] === 'function' &&
    typeof record['luminance'] === 'function'
  );
}

/** The `asset` param of a prop. */
export const assetParam = z
  .custom<AssetImage>(isAssetImage, {
    message: "expected a picture from ctx.assets.image('<asset id>') (called in build)",
  })
  // Documented as an object (the handle) in the catalog and kit-docs.
  .meta({ type: 'object', title: 'AssetImage' })
  .describe("Picture from ctx.assets.image('<asset id>') (build only)");

/** Picture size in pixels for a slot `slotWidth` wide following the picture's aspect (clamped). */
export function pictureSize(
  aspect: number,
  slotWidth: number,
  limits: { readonly minAspect: number; readonly maxAspect: number },
): readonly [number, number] {
  const clamped = Math.min(limits.maxAspect, Math.max(limits.minAspect, aspect));
  return [slotWidth, Math.max(1, Math.round(slotWidth / clamped))];
}
