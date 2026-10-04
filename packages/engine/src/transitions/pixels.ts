/**
 * Pixel helpers of the transition kit (ADR-011): frames as 32-bit pixel views, integer hashes,
 * the 8x8 Bayer threshold and the palette tone ladder (palette colours sorted by luma). Every
 * transition writes either a pixel copied from one of the two post-fx frames or a palette colour
 * from the ladder, so its output never leaves the style palette.
 */
import { bayerMatrix, LUMA_WEIGHTS } from '../palette.js';

/** An RGBA8 frame, row-major, top-down (what `EngineRuntime.readFrame` returns). */
export interface TransitionFrame {
  readonly width: number;
  readonly height: number;
  readonly data: Uint8Array;
}

/** Palette tone ladder: palette colours as 32-bit pixels sorted from dark to light. */
export interface Tones {
  /** The pixel `steps` palette tones lighter (negative: darker); non-palette pixels unchanged. */
  shift(pixel: number, steps: number): number;
  /** Luma rank of a pixel (palette index on the ladder; non-palette pixels: their 8-bit luma). */
  rank(pixel: number): number;
  readonly darkest: number;
  readonly brightest: number;
}

/** Everything a transition reads and writes for one frame. */
export interface Composition {
  readonly width: number;
  readonly height: number;
  readonly a: Uint32Array;
  readonly b: Uint32Array;
  readonly out: Uint32Array;
  /** Progress 0..1 (0 = only A, 1 = only B). */
  readonly p: number;
  /** uint32 seed of this transition. */
  readonly seed: number;
  readonly tones: Tones;
}

export type Compositor = (composition: Composition) => void;

const LITTLE_ENDIAN = new Uint8Array(new Uint32Array([1]).buffer)[0] === 1;

/** Opaque 32-bit pixel of a 0xRRGGBB colour (byte order of the platform's Uint32Array view). */
export function packPixel(rgb: number): number {
  const r = (rgb >>> 16) & 0xff;
  const g = (rgb >>> 8) & 0xff;
  const b = rgb & 0xff;
  return LITTLE_ENDIAN
    ? ((0xff << 24) | (b << 16) | (g << 8) | r) >>> 0
    : ((r << 24) | (g << 16) | (b << 8) | 0xff) >>> 0;
}

function pixelLuma(pixel: number): number {
  const r = LITTLE_ENDIAN ? pixel & 0xff : pixel >>> 24;
  const g = LITTLE_ENDIAN ? (pixel >>> 8) & 0xff : (pixel >>> 16) & 0xff;
  const b = LITTLE_ENDIAN ? (pixel >>> 16) & 0xff : (pixel >>> 8) & 0xff;
  return LUMA_WEIGHTS[0] * r + LUMA_WEIGHTS[1] * g + LUMA_WEIGHTS[2] * b;
}

const OPAQUE_BLACK = packPixel(0x000000);

/** The tone ladder of a palette (0xRRGGBB colours). */
export function createTones(palette: readonly number[]): Tones {
  const ladder = [...new Set(palette.map(packPixel))].sort(
    (first, second) => pixelLuma(first) - pixelLuma(second) || first - second,
  );
  const ranks = new Map(ladder.map((pixel, index) => [pixel, index]));
  const top = ladder.length - 1;
  return {
    shift(pixel, steps) {
      const index = ranks.get(pixel);
      if (index === undefined) return pixel;
      return ladder[Math.min(top, Math.max(0, index + steps))] ?? pixel;
    },
    rank(pixel) {
      return ranks.get(pixel) ?? pixelLuma(pixel);
    },
    darkest: ladder[0] ?? OPAQUE_BLACK,
    brightest: ladder[top] ?? OPAQUE_BLACK,
  };
}

/** 32-bit avalanche hash (uint32 -> uint32). */
export function hash32(value: number): number {
  let x = value >>> 0;
  x = (x ^ (x >>> 16)) >>> 0;
  x = Math.imul(x, 0x7feb352d) >>> 0;
  x = (x ^ (x >>> 15)) >>> 0;
  x = Math.imul(x, 0x846ca68b) >>> 0;
  return (x ^ (x >>> 16)) >>> 0;
}

/** Hash of a seed and up to two integer coordinates. */
export function hashOf(seed: number, first: number, second = 0): number {
  return hash32(seed ^ hash32(Math.imul(first, 0x9e3779b9) ^ hash32(second + 0x632be5ab)));
}

/** A hash as a float in [0, 1). */
export function unit(hash: number): number {
  return (hash >>> 0) / 4_294_967_296;
}

const BAYER_8 = bayerMatrix(8);

/** Ordered-dither threshold in (0, 1) of cell (x, y) of the 8x8 Bayer matrix. */
export function bayerThreshold(x: number, y: number): number {
  return ((BAYER_8[(y & 7) * 8 + (x & 7)] ?? 0) + 0.5) / 64;
}

export function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/** Cubic smoothstep of a value already in [0, 1]. */
export function smooth(value: number): number {
  return value * value * (3 - 2 * value);
}

/** 32-bit view of an RGBA8 buffer (copied when its offset is not 4-byte aligned). */
export function pixelView(data: Uint8Array): Uint32Array {
  if (data.byteOffset % 4 === 0) {
    return new Uint32Array(data.buffer, data.byteOffset, data.byteLength >>> 2);
  }
  return new Uint32Array(data.slice().buffer);
}
