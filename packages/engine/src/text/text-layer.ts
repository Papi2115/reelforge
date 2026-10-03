/**
 * Per-shot text layer: owns the low-res RGBA overlay that the composite pass lays over the shot
 * (after AO/outline, before transitions, vignette, scanlines, dither and the palette LUT), and the
 * registry of cards drawn in the current frame. `ctx.text` in `build` can only measure.
 */
import { PALETTE_TOKENS, type SafeAreaMargins } from '@reelforge/shared';
import { EngineError } from '../errors.js';
import { hashString } from '../rng.js';
import type { ScenePalette } from '../style.js';
import {
  defaultTitleScale,
  fontByName,
  renderKinetic,
  renderLowerThird,
  renderTitle,
  type CardEnv,
  type CardResult,
} from './cards.js';
import { layoutText, measureLayout } from './layout.js';
import {
  kineticOptionsSchema,
  kineticWordsSchema,
  lowerThirdOptionsSchema,
  measureStyleSchema,
  parseTextArgument,
  titleOptionsSchema,
} from './options.js';
import { createTextSurface, hexToRgb8, type Rgb8, type TextSurface } from './surface.js';
import type { PixelRect, TextApi, TextCard, TextCardKind, TextMetrics } from './types.js';

/** What the renderer needs from a shot's text layer. */
export interface TextOverlay {
  /** RGBA8, top-down, width*height*4; alpha is 0 (no text) or 255. */
  readonly pixels: Uint8Array<ArrayBuffer>;
  readonly empty: boolean;
}

export interface TextLayerOptions {
  readonly shotId: string;
  readonly width: number;
  readonly height: number;
  readonly safeArea: SafeAreaMargins;
  readonly palette: ScenePalette;
  /** Shot seed; card jitter is derived from it and the card id. */
  readonly seed: number;
}

export interface TextLayer {
  readonly overlay: TextOverlay;
  /** The overlay's raster target (the annotation layer draws into it too). */
  readonly surface: TextSurface;
  readonly safeArea: PixelRect;
  /** `ctx.text` during build: measuring only. */
  readonly buildApi: TextApi;
  /** `ctx.text` during update: draws into the overlay at the time set by `beginFrame`. */
  readonly frameApi: TextApi;
  /** Clears the overlay and the card registry for a new frame at local time t. */
  beginFrame(t: number): void;
  /** Cards registered since the last `beginFrame`. */
  cards(): readonly TextCard[];
}

const ID_TEXT_LENGTH = 24;

export function safeAreaRect(width: number, height: number, margins: SafeAreaMargins): PixelRect {
  const x = Math.round(width * margins.x);
  const y = Math.round(height * margins.y);
  return { x, y, w: width - 2 * x, h: height - 2 * y };
}

function requireText(value: unknown, call: string, shotId: string): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  throw new EngineError('invalid-text-options', `${call}: the text must be a string`, { shotId });
}

function defaultId(kind: TextCardKind, text: string): string {
  return `${kind}:${text.replace(/\s+/g, ' ').trim().slice(0, ID_TEXT_LENGTH)}`;
}

export function createTextLayer(options: TextLayerOptions): TextLayer {
  const { shotId, width, height, palette } = options;
  const surface = createTextSurface(width, height);
  const safeArea = safeAreaRect(width, height, options.safeArea);
  const colors = new Map<string, Rgb8>();
  const swatches: Readonly<Record<string, string>> = palette;
  let t = 0;
  let cards: TextCard[] = [];
  const idCounts = new Map<string, number>();

  const resolveColor = (call: string, name: string, option: string): Rgb8 => {
    const cached = colors.get(name);
    if (cached) return cached;
    const hex = Object.hasOwn(swatches, name) ? swatches[name] : undefined;
    if (hex === undefined) {
      throw new EngineError(
        'invalid-text-options',
        `${call}: options.${option}: "${name}" is not a colour of this style; use a palette token (${PALETTE_TOKENS.join(', ')}) or a swatch name`,
        { shotId },
      );
    }
    const rgb = hexToRgb8(hex);
    colors.set(name, rgb);
    return rgb;
  };

  const uniqueId = (id: string): string => {
    const count = (idCounts.get(id) ?? 0) + 1;
    idCounts.set(id, count);
    return count === 1 ? id : `${id}#${String(count)}`;
  };

  const register = (
    kind: TextCardKind,
    text: string,
    explicitId: string | undefined,
    render: (env: CardEnv) => CardResult,
  ): TextCard => {
    const id = uniqueId(explicitId ?? defaultId(kind, text));
    const call = `ctx.text.${kind === 'lower-third' ? 'lowerThird' : kind}() [card "${id}"]`;
    const env: CardEnv = {
      surface,
      width,
      height,
      safeArea,
      t,
      seed: hashString(`text:${id}`, options.seed),
      color: (name, option) => resolveColor(call, name, option),
    };
    const result = render(env);
    const card: TextCard = { id, kind, text, ...result };
    cards.push(card);
    return card;
  };

  const measure = (text: unknown, style: unknown): TextMetrics => {
    const call = 'ctx.text.measure()';
    const parsed = parseTextArgument(measureStyleSchema, style ?? {}, call, shotId);
    const font = fontByName(parsed.font);
    const scale = parsed.scale ?? (parsed.font === 'mono' ? 1 : defaultTitleScale(height));
    const maxPixels = parsed.maxWidth === undefined ? Infinity : parsed.maxWidth * width;
    const normalized = font.normalize(requireText(text, call, shotId));
    const layout = layoutText(normalized, font, Math.max(1, Math.floor(maxPixels / scale)));
    return measureLayout(layout, scale);
  };

  const frameApi: TextApi = {
    safeArea,
    title(text, titleOptions) {
      const call = 'ctx.text.title()';
      const parsed = parseTextArgument(titleOptionsSchema, titleOptions ?? {}, call, shotId);
      const content = requireText(text, call, shotId);
      return register('title', content, parsed.id, (env) => renderTitle(env, content, parsed));
    },
    lowerThird(primary, secondary, lowerOptions) {
      const call = 'ctx.text.lowerThird()';
      const parsed = parseTextArgument(lowerThirdOptionsSchema, lowerOptions ?? {}, call, shotId);
      const first = requireText(primary, call, shotId);
      const second =
        secondary === undefined || secondary === null ? '' : requireText(secondary, call, shotId);
      const text = second === '' ? first : `${first} / ${second}`;
      return register('lower-third', text, parsed.id, (env) =>
        renderLowerThird(env, first, second, parsed),
      );
    },
    kinetic(words, kineticOptions) {
      const call = 'ctx.text.kinetic()';
      const parsed = parseTextArgument(kineticOptionsSchema, kineticOptions ?? {}, call, shotId);
      const list = parseTextArgument(kineticWordsSchema, words, call, shotId, 'words');
      const label =
        typeof list === 'string'
          ? list
          : list.map((word) => (typeof word === 'string' ? word : word.text)).join(' ');
      return register('kinetic', label, parsed.id, (env) => renderKinetic(env, list, parsed));
    },
    measure,
    layout: () => [...cards],
  };

  const drawingInBuild = (name: string): never => {
    throw new EngineError(
      'text-outside-update',
      `ctx.text.${name}() draws a single frame; call it in update(t, state, ctx) every frame (use at/until for timing), not in build()`,
      { shotId },
    );
  };

  const buildApi: TextApi = {
    safeArea,
    title: () => drawingInBuild('title'),
    lowerThird: () => drawingInBuild('lowerThird'),
    kinetic: () => drawingInBuild('kinetic'),
    measure,
    layout: () => [],
  };

  return {
    overlay: surface,
    surface,
    safeArea,
    buildApi,
    frameApi,
    beginFrame(time) {
      t = time;
      surface.clear();
      cards = [];
      idCounts.clear();
    },
    cards: () => cards,
  };
}
