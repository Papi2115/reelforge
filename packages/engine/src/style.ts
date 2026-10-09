/**
 * Resolves the style of a render: preset (by id) + manifest palette overrides -> render size, the
 * scene-facing palette (swatches + semantic tokens) and the post-fx settings of the GPU pass.
 */
import {
  DEFAULT_SAFE_AREA,
  MAX_PALETTE_SIZE,
  orientFrameSize,
  PALETTE_TOKENS,
  videoFormatOf,
  type FrameSize,
  type NamedPalette,
  type PaletteToken,
  type SafeAreaMargins,
  type StylePreset,
  type VariationBudget,
  type VideoFormat,
} from '@reelforge/shared';
import { EngineError } from './errors.js';
import {
  buildPaletteLut,
  hexToRgb,
  paletteRgb,
  type BayerSize,
  type DitherOptions,
  type PaletteLut,
  type Rgb,
} from './palette.js';
import { DEFAULT_STYLE_ID, STYLE_REGISTRY, type StyleRegistry } from './presets/index.js';

/** `ctx.palette`: every swatch by name plus every semantic token, as hex strings. */
export type ScenePalette = Readonly<NamedPalette> & Readonly<Record<PaletteToken, string>>;

export interface OutlineFx {
  readonly color: Rgb;
  readonly threshold: number;
}
export type AoFx = NonNullable<StylePreset['ao']>;
export type ScanlineFx = NonNullable<StylePreset['scanlines']>;
export type VignetteFx = NonNullable<StylePreset['vignette']>;

export interface PostFxSettings {
  /**
   * Palette snap table of the final step. Undefined = full-colour style (preset `quantize: false`,
   * PLAN.md#14.1): no dither offset and no palette snap, the composed colour is the output.
   */
  readonly lut: PaletteLut | undefined;
  readonly dither: DitherOptions;
  readonly outline: OutlineFx | undefined;
  readonly ao: AoFx | undefined;
  readonly scanlines: ScanlineFx | undefined;
  readonly vignette: VignetteFx | undefined;
}

export interface ResolvedStyle {
  readonly id: string;
  /** Video format (PLAN.md#13.18); width/height are already oriented for it. */
  readonly format: VideoFormat;
  readonly width: number;
  readonly height: number;
  /**
   * Quantization set (preset palette merged with the manifest overrides). A full-colour style
   * (`post.lut` undefined) keeps it for tokens, text, annotations and imported-asset stylizing.
   */
  readonly swatches: Readonly<NamedPalette>;
  readonly palette: ScenePalette;
  readonly post: PostFxSettings;
  /** Text safe-area margins (shares of the frame size). */
  readonly safeArea: SafeAreaMargins;
  /** Ambient variation budgets by key (PLAN.md#12.8); empty when the style has none. */
  readonly variation: Readonly<Record<string, VariationBudget>>;
}

export interface StyleRequest {
  readonly style?: string | undefined;
  /** Absent = landscape (the preset's resolution as declared). */
  readonly format?: VideoFormat | undefined;
  readonly width?: number | undefined;
  readonly height?: number | undefined;
  readonly palette?: Readonly<NamedPalette> | undefined;
}

const DITHER_SIZES: Readonly<Record<StylePreset['dither']['matrix'], BayerSize>> = {
  bayer4: 4,
  bayer8: 8,
};

function invalid(message: string): EngineError {
  return new EngineError('invalid-manifest', message);
}

function mergeSwatches(
  preset: StylePreset,
  overrides: Readonly<NamedPalette> | undefined,
): NamedPalette {
  const tokens = new Set<string>(PALETTE_TOKENS);
  for (const name of Object.keys(overrides ?? {})) {
    if (tokens.has(name)) {
      throw invalid(`palette.${name}: "${name}" is a token name; override the swatch it maps to`);
    }
  }
  const swatches: NamedPalette = { ...preset.palette, ...overrides };
  const size = Object.keys(swatches).length;
  if (size > MAX_PALETTE_SIZE) {
    throw invalid(
      `palette: style "${preset.id}" plus overrides has ${String(size)} colours (max ${String(MAX_PALETTE_SIZE)})`,
    );
  }
  return swatches;
}

function swatchHex(swatches: Readonly<NamedPalette>, name: string): string {
  const hex = swatches[name];
  if (hex === undefined) throw invalid(`style colour "${name}" is not in the palette`);
  return hex;
}

function scenePalette(preset: StylePreset, swatches: Readonly<NamedPalette>): ScenePalette {
  const tokens = Object.fromEntries(
    PALETTE_TOKENS.map((token) => [token, swatchHex(swatches, preset.tokens[token])]),
  ) as Record<PaletteToken, string>;
  return Object.freeze({ ...swatches, ...tokens });
}

function checkSize(preset: StylePreset, size: FrameSize, request: StyleRequest): void {
  const { width, height } = size;
  const mismatch =
    (request.width !== undefined && request.width !== width) ||
    (request.height !== undefined && request.height !== height);
  if (mismatch) {
    throw invalid(
      `width/height ${String(request.width)}x${String(request.height)} do not match style "${preset.id}" ` +
        `(${String(width)}x${String(height)}); omit them or use the style's resolution`,
    );
  }
}

/**
 * `registry` defaults to the built-in and world styles (STYLE_REGISTRY); tests pass their own.
 * Experimental world styles resolve too: showcase renders are gated by their callers.
 */
export function resolveStyle(
  request: StyleRequest,
  registry: StyleRegistry = STYLE_REGISTRY,
): ResolvedStyle {
  const id = request.style ?? DEFAULT_STYLE_ID;
  const preset = registry.find(id);
  if (!preset) {
    throw invalid(`style "${id}" is unknown; available: ${registry.ids.join(', ')}`);
  }
  const format = videoFormatOf(request);
  const size = orientFrameSize(preset.resolution, format);
  checkSize(preset, size, request);
  const swatches = Object.freeze(mergeSwatches(preset, request.palette));
  const palette = scenePalette(preset, swatches);
  const outline = preset.outline;
  return {
    id,
    format,
    width: size.width,
    height: size.height,
    swatches,
    palette,
    post: {
      // Full-colour styles (`quantize: false`) have no snap table.
      lut: preset.quantize === false ? undefined : buildPaletteLut(paletteRgb(swatches)),
      dither: { size: DITHER_SIZES[preset.dither.matrix], spread: preset.dither.spread },
      outline: outline && {
        color: hexToRgb(swatchHex(palette, outline.color)),
        threshold: outline.threshold,
      },
      ao: preset.ao,
      scanlines: preset.scanlines,
      vignette: preset.vignette,
    },
    safeArea: preset.safeArea ?? DEFAULT_SAFE_AREA,
    variation: preset.variation ?? {},
  };
}

/** Vignette multiplier for pixel (x, y) of a width x height frame (CPU reference of the shader). */
export function vignetteFactor(
  x: number,
  y: number,
  width: number,
  height: number,
  vignette: VignetteFx,
): number {
  const aspect = width / height;
  const dx = ((x + 0.5) / width - 0.5) * aspect;
  const dy = (y + 0.5) / height - 0.5;
  const distance = Math.hypot(dx, dy) / Math.hypot(0.5 * aspect, 0.5);
  const edge0 = vignette.radius;
  const edge1 = vignette.radius + vignette.softness;
  const k = Math.min(1, Math.max(0, (distance - edge0) / (edge1 - edge0)));
  return 1 - vignette.strength * k * k * (3 - 2 * k);
}

/** Scanline multiplier for top-down row y (CPU reference of the shader). */
export function scanlineFactor(y: number, scanlines: ScanlineFx): number {
  return y % scanlines.period === scanlines.period - 1 ? 1 - scanlines.strength : 1;
}
