/**
 * The video's asset pictures (manifest `assets`, decoded by the pipeline) and the handles scenes
 * get from `ctx.assets.image()`. One library per loaded video: base64 is decoded on first use,
 * palette LUTs and stylised pixels are memoised per (picture, options, size, colours), so shots
 * and repaints share them. Nothing here fetches or decodes image files (ADR-014).
 */
import {
  assetCropSchema,
  type AssetCrop,
  type AssetImage,
  type AssetPictureOptions,
  type AssetPixels,
} from '@reelforge/kit';
import { ASSET_REF_PATTERN, type ManifestAsset } from '@reelforge/shared';
import { EngineError } from '../errors.js';
import { buildPaletteLut, hexToRgb, type BayerSize, type PaletteLut } from '../palette.js';
import {
  ASSET_STYLIZE_VERSION,
  assetLuminance,
  cropKey,
  stylizeAsset,
  type AssetSource,
} from './stylize.js';

/** Stylisation chosen by the scene for one handle. */
export interface AssetStyle {
  readonly crop: AssetCrop;
  readonly contrast: boolean;
  /** 0..1 */
  readonly dither: number;
  /** `#rrggbb` colours the picture maps onto by default. */
  readonly colors: readonly string[];
}

export interface AssetLibrarySettings {
  /** The style's quantisation colours (`#rrggbb`, palette order) and their LUT (the post-fx one). */
  readonly colors: readonly string[];
  readonly lut: PaletteLut;
  readonly ditherSize: BayerSize;
}

export interface AssetLibrary {
  /** Refs this video carries (`id` or `id@seconds`). */
  readonly refs: readonly string[];
  readonly defaultColors: readonly string[];
  has(ref: string): boolean;
  /** A handle for `ref`; throws `asset-not-found` (with the known refs) for others. */
  image(ref: string, style: AssetStyle, shotId: string): AssetImage;
}

const BASE64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const BASE64_VALUES = new Int16Array(128).fill(-1);
for (let index = 0; index < BASE64.length; index += 1)
  BASE64_VALUES[BASE64.charCodeAt(index)] = index;

/** Decodes unpadded or padded standard base64 (validated by the manifest schema). */
export function decodeBase64(text: string): Uint8Array {
  const clean = text.replace(/=+$/, '');
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let buffer = 0;
  let bits = 0;
  let at = 0;
  for (let index = 0; index < clean.length; index += 1) {
    const value = BASE64_VALUES[clean.charCodeAt(index)] ?? -1;
    if (value < 0) throw new EngineError('invalid-manifest', 'asset pixels are not base64');
    buffer = (buffer << 6) | value;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[at] = (buffer >> bits) & 255;
      at += 1;
    }
  }
  return out;
}

const HEX = /^#[0-9a-f]{6}$/i;
const MAX_PICTURE_EDGE = 1024;

function checkSize(call: string, width: number, height: number, shotId: string): void {
  const valid = (value: number): boolean =>
    Number.isInteger(value) && value >= 1 && value <= MAX_PICTURE_EDGE;
  if (!valid(width) || !valid(height)) {
    throw new EngineError(
      'invalid-asset-options',
      `${call}: width and height must be whole pixels 1..${String(MAX_PICTURE_EDGE)} (got ${String(width)} x ${String(height)})`,
      { shotId },
    );
  }
}

function parseCrop(call: string, crop: unknown, shotId: string): AssetCrop {
  const parsed = assetCropSchema.safeParse(crop);
  if (parsed.success) return parsed.data;
  throw new EngineError(
    'invalid-asset-options',
    `${call}: crop must be 'cover', 'center' or { focus: [x, y] (0..1), zoom (>= 1) }`,
    { shotId },
  );
}

function checkColors(call: string, colors: readonly string[], shotId: string): void {
  const bad = colors.find((color) => typeof color !== 'string' || !HEX.test(color));
  if (colors.length === 0 || colors.length > 256 || bad !== undefined) {
    throw new EngineError(
      'invalid-asset-options',
      `${call}: colors must be 1..256 '#rrggbb' strings${bad === undefined ? '' : ` (got ${JSON.stringify(bad)})`}`,
      { shotId },
    );
  }
}

function hexBytes(hex: string): readonly [number, number, number] {
  const value = Number.parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function rgbaOf(indices: Uint8Array, colors: readonly string[]): Uint8Array {
  const bytes = colors.map(hexBytes);
  const rgba = new Uint8Array(indices.length * 4);
  indices.forEach((index, pixel) => {
    const [r, g, b] = bytes[index] ?? [0, 0, 0];
    rgba.set([r, g, b, 255], pixel * 4);
  });
  return rgba;
}

/** A video without assets (shots built without a library, unit tests). */
export const NO_ASSETS: AssetLibrary = createAssetLibrary([], {
  colors: [],
  lut: { levels: 1, palette: [[0, 0, 0]], indices: new Uint8Array(1) },
  ditherSize: 4,
});

export function createAssetLibrary(
  assets: readonly ManifestAsset[],
  settings: AssetLibrarySettings,
): AssetLibrary {
  const entries = new Map(assets.map((asset) => [asset.ref, asset]));
  const sources = new Map<string, AssetSource>();
  const defaultKey = settings.colors.join(',').toLowerCase();
  const luts = new Map<string, PaletteLut>([[defaultKey, settings.lut]]);
  const memo = new Map<string, AssetPixels | Uint8Array>();
  const refs = Object.freeze([...entries.keys()].sort());

  const sourceOf = (asset: ManifestAsset): AssetSource => {
    let source = sources.get(asset.ref);
    if (!source) {
      source = { width: asset.width, height: asset.height, rgb: decodeBase64(asset.rgb) };
      sources.set(asset.ref, source);
    }
    return source;
  };
  const lutOf = (colors: readonly string[]): PaletteLut => {
    const key = colors.join(',').toLowerCase();
    let lut = luts.get(key);
    if (!lut) {
      lut = buildPaletteLut(colors.map(hexToRgb));
      luts.set(key, lut);
    }
    return lut;
  };

  return {
    refs,
    defaultColors: settings.colors,
    has: (ref) => entries.has(ref),
    image(ref, style, shotId) {
      const asset = entries.get(ref);
      if (!asset) {
        const known = refs.length === 0 ? 'none' : refs.join(', ');
        const hint = ASSET_REF_PATTERN.test(ref)
          ? "an asset must be listed in assets.json and its id written as a string literal in the scene, e.g. ctx.assets.image('nasa-apollo-11')"
          : "refs are asset ids ('nasa-apollo-11') or video stills ('nasa-launch@12.5')";
        throw new EngineError(
          'asset-not-found',
          `ctx.assets.image(${JSON.stringify(ref)}): no such asset in this video (known: ${known}); ${hint}`,
          { shotId },
        );
      }
      const key = [
        `${asset.sha256}${asset.at === undefined ? '' : `@${String(asset.at)}`}`,
        `v${String(ASSET_STYLIZE_VERSION)}`,
        cropKey(style.crop),
        style.contrast ? 'c1' : 'c0',
        `d${String(style.dither)}`,
        style.colors.join(',').toLowerCase(),
      ].join(':');
      const handle: AssetImage = {
        kind: 'asset-image',
        id: asset.id,
        ref,
        aspect: asset.width / asset.height,
        crop: style.crop,
        key,
        pixels(width, height, options: AssetPictureOptions = {}) {
          const call = `asset ${ref}.pixels(${String(width)}, ${String(height)})`;
          checkSize(call, width, height, shotId);
          const crop =
            options.crop === undefined ? style.crop : parseCrop(call, options.crop, shotId);
          const colors = options.colors ?? style.colors;
          checkColors(call, colors, shotId);
          const memoKey = `p|${key}|${String(width)}x${String(height)}|${cropKey(crop)}|${colors.join(',').toLowerCase()}`;
          const cached = memo.get(memoKey);
          if (cached && !(cached instanceof Uint8Array)) return cached;
          const { indices } = stylizeAsset(sourceOf(asset), {
            width,
            height,
            crop,
            lut: lutOf(colors),
            dither: style.dither,
            ditherSize: settings.ditherSize,
            contrast: style.contrast,
          });
          const result: AssetPixels = {
            width,
            height,
            colors: [...colors],
            indices,
            rgba: rgbaOf(indices, colors),
          };
          memo.set(memoKey, result);
          return result;
        },
        luminance(width, height, cropOverride) {
          const call = `asset ${ref}.luminance(${String(width)}, ${String(height)})`;
          checkSize(call, width, height, shotId);
          const crop =
            cropOverride === undefined ? style.crop : parseCrop(call, cropOverride, shotId);
          const memoKey = `l|${key}|${String(width)}x${String(height)}|${cropKey(crop)}`;
          const cached = memo.get(memoKey);
          if (cached instanceof Uint8Array) return cached;
          const result = assetLuminance(sourceOf(asset), {
            width,
            height,
            crop,
            contrast: style.contrast,
          });
          memo.set(memoKey, result);
          return result;
        },
      };
      return Object.freeze(handle);
    },
  };
}
