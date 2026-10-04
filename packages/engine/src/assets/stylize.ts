/**
 * Asset stylisation (PLAN.md#12.11, ADR-014): decoded RGB pixels -> a picture in style colours.
 * crop (cover / center letterbox / focus + zoom, no ML) -> area-average resample -> optional
 * contrast stretch -> ordered Bayer dither -> palette snap through the same lookup table as the
 * post-fx pass (palette.ts). Pixel loops use integer arithmetic only and the geometry uses plain
 * IEEE doubles (no transcendental functions), so the same input gives the same bytes everywhere.
 */
import type { AssetCrop } from '@reelforge/kit';
import { bayerMatrix, lutCell, type BayerSize, type PaletteLut } from '../palette.js';

/** Decoded picture: RGB8, rows top-down. */
export interface AssetSource {
  readonly width: number;
  readonly height: number;
  readonly rgb: Uint8Array;
}

/** Bump when the stylisation output changes (part of every asset key and the export cache). */
export const ASSET_STYLIZE_VERSION = 1;

/** Integer source rectangle [x0, x1) x [y0, y1) and where it lands in the target. */
export interface CropPlan {
  readonly x0: number;
  readonly y0: number;
  readonly x1: number;
  readonly y1: number;
  /** Target area the crop fills (the rest is letterbox). */
  readonly target: {
    readonly x: number;
    readonly y: number;
    readonly w: number;
    readonly h: number;
  };
}

function clampInt(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Where `crop` takes its pixels from and where they go in a width x height target. */
export function planCrop(
  source: { readonly width: number; readonly height: number },
  width: number,
  height: number,
  crop: AssetCrop,
): CropPlan {
  const sw = source.width;
  const sh = source.height;
  if (crop === 'center') {
    // Contain: the whole picture, centred; the bars are letterbox.
    const wide = sw * height >= sh * width;
    const w = wide ? width : Math.max(1, Math.round((height * sw) / sh));
    const h = wide ? Math.max(1, Math.round((width * sh) / sw)) : height;
    const x = Math.floor((width - w) / 2);
    const y = Math.floor((height - h) / 2);
    return { x0: 0, y0: 0, x1: sw, y1: sh, target: { x, y, w, h } };
  }
  const zoom = crop === 'cover' ? 1 : crop.zoom;
  const focus = crop === 'cover' ? ([0.5, 0.5] as const) : crop.focus;
  const wide = sw * height >= sh * width;
  const coverW = wide ? (sh * width) / height : sw;
  const coverH = wide ? sh : (sw * height) / width;
  const cw = clampInt(Math.round(coverW / zoom), 1, sw);
  const ch = clampInt(Math.round(coverH / zoom), 1, sh);
  const x0 = clampInt(Math.round(focus[0] * sw - cw / 2), 0, sw - cw);
  const y0 = clampInt(Math.round(focus[1] * sh - ch / 2), 0, sh - ch);
  return { x0, y0, x1: x0 + cw, y1: y0 + ch, target: { x: 0, y: 0, w: width, h: height } };
}

/**
 * Area-average resample of the source rectangle of `plan` into its target area: every target
 * pixel averages the source pixels of its span (rounded half up, integers only); spans are at
 * least one pixel, so magnifying repeats pixels. Returns RGB8 of width x height and a mask of
 * the pixels that belong to the picture (letterbox = 0).
 */
export function resampleArea(
  source: AssetSource,
  plan: CropPlan,
  width: number,
  height: number,
): { readonly rgb: Uint8Array; readonly mask: Uint8Array } {
  const rgb = new Uint8Array(width * height * 3);
  const mask = new Uint8Array(width * height);
  const { target } = plan;
  const cw = plan.x1 - plan.x0;
  const ch = plan.y1 - plan.y0;
  const spanX = new Int32Array(target.w + 1);
  const spanY = new Int32Array(target.h + 1);
  for (let index = 0; index <= target.w; index += 1) {
    spanX[index] = plan.x0 + Math.floor((index * cw) / target.w);
  }
  for (let index = 0; index <= target.h; index += 1) {
    spanY[index] = plan.y0 + Math.floor((index * ch) / target.h);
  }
  for (let ty = 0; ty < target.h; ty += 1) {
    const sy0 = spanY[ty] ?? 0;
    const sy1 = Math.max(sy0 + 1, spanY[ty + 1] ?? 0);
    for (let tx = 0; tx < target.w; tx += 1) {
      const sx0 = spanX[tx] ?? 0;
      const sx1 = Math.max(sx0 + 1, spanX[tx + 1] ?? 0);
      let r = 0;
      let g = 0;
      let b = 0;
      for (let sy = sy0; sy < sy1; sy += 1) {
        let offset = (sy * source.width + sx0) * 3;
        for (let sx = sx0; sx < sx1; sx += 1) {
          r += source.rgb[offset] ?? 0;
          g += source.rgb[offset + 1] ?? 0;
          b += source.rgb[offset + 2] ?? 0;
          offset += 3;
        }
      }
      const count = (sy1 - sy0) * (sx1 - sx0);
      const out = ((target.y + ty) * width + target.x + tx) * 3;
      rgb[out] = Math.floor((2 * r + count) / (2 * count));
      rgb[out + 1] = Math.floor((2 * g + count) / (2 * count));
      rgb[out + 2] = Math.floor((2 * b + count) / (2 * count));
      mask[(target.y + ty) * width + target.x + tx] = 1;
    }
  }
  return { rgb, mask };
}

/** Rec. 601 luma 0..255 of an RGB8 pixel (integer weights). */
export function luma(r: number, g: number, b: number): number {
  return (77 * r + 150 * g + 29 * b + 128) >> 8;
}

/** Share of pixels clipped at each end by the contrast stretch (per mille). */
const STRETCH_CLIP = 20;
/** Below this luma range the picture is left alone (flat images stay flat). */
const MIN_STRETCH_RANGE = 16;

/** Stretches the luma range [2 %, 98 %] of the masked pixels to 0..255 (same map per channel). */
export function stretchContrast(rgb: Uint8Array, mask: Uint8Array): void {
  const histogram = new Uint32Array(256);
  let total = 0;
  mask.forEach((inside, pixel) => {
    if (inside === 0) return;
    const offset = pixel * 3;
    const value = luma(rgb[offset] ?? 0, rgb[offset + 1] ?? 0, rgb[offset + 2] ?? 0);
    histogram[value] = (histogram[value] ?? 0) + 1;
    total += 1;
  });
  if (total === 0) return;
  const clip = Math.floor((total * STRETCH_CLIP) / 1000);
  let low = 0;
  for (let seen = 0; low < 255 && seen + (histogram[low] ?? 0) <= clip; low += 1) {
    seen += histogram[low] ?? 0;
  }
  let high = 255;
  for (let seen = 0; high > 0 && seen + (histogram[high] ?? 0) <= clip; high -= 1) {
    seen += histogram[high] ?? 0;
  }
  const range = high - low;
  if (range < MIN_STRETCH_RANGE) return;
  const map = new Uint8Array(256);
  for (let value = 0; value < 256; value += 1) {
    map[value] = clampInt(Math.floor(((value - low) * 255 * 2 + range) / (2 * range)), 0, 255);
  }
  mask.forEach((inside, pixel) => {
    if (inside === 0) return;
    const offset = pixel * 3;
    rgb[offset] = map[rgb[offset] ?? 0] ?? 0;
    rgb[offset + 1] = map[rgb[offset + 1] ?? 0] ?? 0;
    rgb[offset + 2] = map[rgb[offset + 2] ?? 0] ?? 0;
  });
}

/** Strongest dither offset (dither = 1), in 0..1 colour units (the style presets use ~0.1). */
export const MAX_ASSET_DITHER_SPREAD = 0.25;

/** Integer Bayer offsets (in 1/255 units) for `strength` 0..1, row-major size x size. */
export function ditherOffsets(size: BayerSize, strength: number): Int16Array {
  const matrix = bayerMatrix(size);
  const cells = size * size;
  const spread = strength * MAX_ASSET_DITHER_SPREAD * 255;
  return Int16Array.from(matrix, (value) => Math.round(((value + 0.5) / cells - 0.5) * spread));
}

export interface StylizeOptions {
  readonly width: number;
  readonly height: number;
  readonly crop: AssetCrop;
  /** Palette LUT of the target colours (buildPaletteLut). */
  readonly lut: PaletteLut;
  /** Dither strength 0..1 (0 = plain palette snap). */
  readonly dither: number;
  readonly ditherSize: BayerSize;
  readonly contrast: boolean;
}

export interface StylizedPixels {
  /** Index into lut.palette per pixel, rows top-down. */
  readonly indices: Uint8Array;
}

/** Cropped, resampled (and stretched) RGB of a width x height slot, with its picture mask. */
export function preparePixels(
  source: AssetSource,
  options: Pick<StylizeOptions, 'width' | 'height' | 'crop' | 'contrast'>,
): { readonly rgb: Uint8Array; readonly mask: Uint8Array } {
  const plan = planCrop(source, options.width, options.height, options.crop);
  const prepared = resampleArea(source, plan, options.width, options.height);
  if (options.contrast) stretchContrast(prepared.rgb, prepared.mask);
  return prepared;
}

/** Index of the darkest palette colour (letterbox bars). */
export function darkestIndex(lut: PaletteLut): number {
  let best = 0;
  let bestLuma = Number.POSITIVE_INFINITY;
  lut.palette.forEach(([r, g, b], index) => {
    const value = luma(Math.round(r * 255), Math.round(g * 255), Math.round(b * 255));
    if (value < bestLuma) {
      bestLuma = value;
      best = index;
    }
  });
  return best;
}

/** The stylised picture: palette index per pixel (deterministic, integer pixel math). */
export function stylizeAsset(source: AssetSource, options: StylizeOptions): StylizedPixels {
  const { width, height, lut } = options;
  const { rgb, mask } = preparePixels(source, options);
  const offsets = ditherOffsets(options.ditherSize, options.dither);
  const size = options.ditherSize;
  const levels = lut.levels;
  const cell = (value: number): number => lutCell(clampInt(value, 0, 255) / 255, levels);
  const bars = darkestIndex(lut);
  const indices = new Uint8Array(width * height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const pixel = y * width + x;
      if (mask[pixel] === 0) {
        indices[pixel] = bars;
        continue;
      }
      const offset = offsets[(y % size) * size + (x % size)] ?? 0;
      const at = pixel * 3;
      const r = cell((rgb[at] ?? 0) + offset);
      const g = cell((rgb[at + 1] ?? 0) + offset);
      const b = cell((rgb[at + 2] ?? 0) + offset);
      indices[pixel] = lut.indices[(b * levels + g) * levels + r] ?? 0;
    }
  }
  return { indices };
}

/** Luminance 0..255 of the prepared picture (letterbox = 0), rows top-down. */
export function assetLuminance(
  source: AssetSource,
  options: Pick<StylizeOptions, 'width' | 'height' | 'crop' | 'contrast'>,
): Uint8Array {
  const { rgb, mask } = preparePixels(source, options);
  const out = new Uint8Array(options.width * options.height);
  mask.forEach((inside, pixel) => {
    if (inside === 0) return;
    const at = pixel * 3;
    out[pixel] = luma(rgb[at] ?? 0, rgb[at + 1] ?? 0, rgb[at + 2] ?? 0);
  });
  return out;
}

/** Stable text of a crop for cache keys (`cover`, `center`, `f0.3,0.4z2`). */
export function cropKey(crop: AssetCrop): string {
  if (typeof crop === 'string') return crop;
  return `f${String(crop.focus[0])},${String(crop.focus[1])}z${String(crop.zoom)}`;
}
