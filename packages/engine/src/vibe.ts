/**
 * Vibe guard (ADR-009): every look of a film must keep the Style — the same palette, pixel fonts
 * and ordered dithering. The post-fx pass ends with the palette LUT, so every rendered pixel is a
 * palette colour; a frame with other colours (or transparency) came through a pipeline that
 * bypassed the post-fx (a look drawing its own smooth gradients, anti-aliased text, an embedded
 * photo that skipped the pixel filter). Golden tests of every look call this on their frames.
 */
import type { NamedPalette } from '@reelforge/shared';

export interface VibeImage {
  readonly width: number;
  readonly height: number;
  /** RGBA8, row-major. */
  readonly data: Uint8Array | Uint8ClampedArray;
}

/** The part of a resolved style the guard needs (`resolveStyle(...)` satisfies it). */
export interface VibeStyle {
  readonly id: string;
  /** Quantization set: the style palette merged with the project overrides. */
  readonly swatches: Readonly<NamedPalette>;
}

export interface VibeOptions {
  /** Share of off-palette pixels still accepted, in percent. Default 0. */
  readonly maxOffPalettePct?: number;
  /** How many of the most common off-palette colours an issue names. Default 5. */
  readonly examples?: number;
}

export interface VibeReport {
  readonly ok: boolean;
  /** Share of pixels whose colour is not in the style palette, percent (0..100). */
  readonly offPalettePct: number;
  readonly offPalettePixels: number;
  /** Palette colours that occur in the frame. */
  readonly paletteColorsUsed: number;
  readonly issues: readonly string[];
}

function hexKey(hex: string): number {
  return Number.parseInt(hex.slice(1), 16);
}

function keyHex(key: number): string {
  return `#${key.toString(16).padStart(6, '0')}`;
}

function percent(share: number): string {
  return `${share.toFixed(3)}%`;
}

export function vibeGuard(
  image: VibeImage,
  style: VibeStyle,
  options: VibeOptions = {},
): VibeReport {
  const pixels = image.width * image.height;
  if (image.data.length !== pixels * 4) {
    const issue = `frame is ${String(image.width)}x${String(image.height)} but has ${String(image.data.length)} bytes (expected RGBA8)`;
    return {
      ok: false,
      offPalettePct: 100,
      offPalettePixels: pixels,
      paletteColorsUsed: 0,
      issues: [issue],
    };
  }
  const palette = new Set(Object.values(style.swatches).map(hexKey));
  const used = new Set<number>();
  const off = new Map<number, number>();
  let translucent = 0;
  for (let offset = 0; offset < image.data.length; offset += 4) {
    const key =
      ((image.data[offset] ?? 0) << 16) |
      ((image.data[offset + 1] ?? 0) << 8) |
      (image.data[offset + 2] ?? 0);
    if (palette.has(key)) used.add(key);
    else off.set(key, (off.get(key) ?? 0) + 1);
    if ((image.data[offset + 3] ?? 0) !== 255) translucent += 1;
  }
  const offPixels = [...off.values()].reduce((sum, count) => sum + count, 0);
  const offPalettePct = pixels === 0 ? 0 : (offPixels / pixels) * 100;
  const issues: string[] = [];
  if (offPalettePct > (options.maxOffPalettePct ?? 0)) {
    const examples = [...off.entries()]
      .sort((first, second) => second[1] - first[1] || first[0] - second[0])
      .slice(0, options.examples ?? 5)
      .map(([key, count]) => `${keyHex(key)} x${String(count)}`)
      .join(', ');
    issues.push(
      `${percent(offPalettePct)} of the pixels (${String(offPixels)}) are not in the ${style.id} palette, e.g. ${examples}: something bypassed the post-fx (smooth gradient, anti-aliasing, unfiltered image)`,
    );
  }
  if (translucent > 0) {
    issues.push(`${String(translucent)} pixels are not opaque: frames must be fully opaque`);
  }
  return {
    ok: issues.length === 0,
    offPalettePct,
    offPalettePixels: offPixels,
    paletteColorsUsed: used.size,
    issues,
  };
}
