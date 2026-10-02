/**
 * CPU raster target of the text layer: RGBA8, top-down, at the low-res frame size. Pixels are
 * either fully opaque or untouched (alpha 0), so the GPU composite is a plain select. Partial
 * opacity is an ordered (Bayer 4x4) dissolve in screen space: pixel-art friendly and exact.
 */
import { BAYER_4X4 } from '../palette.js';
import type { Glyph } from './font.js';
import type { PixelRect } from './types.js';

/** Colour as 8-bit sRGB channels. */
export type Rgb8 = readonly [number, number, number];

export interface Paint {
  /** 0..1: share of pixels drawn (ordered dissolve); 1 = solid. */
  readonly opacity: number;
  /** Only pixels inside this rectangle are drawn. */
  readonly clip?: PixelRect | undefined;
}

export const SOLID: Paint = { opacity: 1 };

export interface TextSurface {
  readonly width: number;
  readonly height: number;
  readonly pixels: Uint8Array<ArrayBuffer>;
  /** True when nothing was drawn since the last clear. */
  readonly empty: boolean;
  clear(): void;
  fillRect(rect: PixelRect, color: Rgb8, paint?: Paint): void;
  /** Draws the glyph with its cap line at y = `capY`, each font cell `scale` x `scale` pixels. */
  drawGlyph(glyph: Glyph, x: number, capY: number, scale: number, color: Rgb8, paint?: Paint): void;
}

export function hexToRgb8(hex: string): Rgb8 {
  const value = Number.parseInt(hex.slice(1), 16);
  return [(value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff];
}

function dissolveVisible(x: number, y: number, opacity: number): boolean {
  if (opacity >= 1) return true;
  const threshold = ((BAYER_4X4[(y & 3) * 4 + (x & 3)] ?? 0) + 0.5) / 16;
  return threshold < opacity;
}

export function createTextSurface(width: number, height: number): TextSurface {
  const pixels = new Uint8Array(width * height * 4);
  let empty = true;

  const fill = (
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    color: Rgb8,
    paint: Paint,
  ): void => {
    if (paint.opacity <= 0) return;
    const clip = paint.clip;
    const left = Math.max(0, x0, clip ? clip.x : 0);
    const top = Math.max(0, y0, clip ? clip.y : 0);
    const right = Math.min(width, x1, clip ? clip.x + clip.w : width);
    const bottom = Math.min(height, y1, clip ? clip.y + clip.h : height);
    for (let y = top; y < bottom; y += 1) {
      for (let x = left; x < right; x += 1) {
        if (!dissolveVisible(x, y, paint.opacity)) continue;
        const offset = (y * width + x) * 4;
        pixels[offset] = color[0];
        pixels[offset + 1] = color[1];
        pixels[offset + 2] = color[2];
        pixels[offset + 3] = 255;
        empty = false;
      }
    }
  };

  return {
    width,
    height,
    pixels,
    get empty() {
      return empty;
    },
    clear() {
      if (empty) return;
      pixels.fill(0);
      empty = true;
    },
    fillRect(rect, color, paint = SOLID) {
      fill(rect.x, rect.y, rect.x + rect.w, rect.y + rect.h, color, paint);
    },
    drawGlyph(glyph, x, capY, scale, color, paint = SOLID) {
      for (let row = 0; row < glyph.height; row += 1) {
        const y = capY + (glyph.top + row) * scale;
        for (let column = 0; column < glyph.width; column += 1) {
          if (glyph.bits[row * glyph.width + column] !== 1) continue;
          const cellX = x + column * scale;
          fill(cellX, y, cellX + scale, y + scale, color, paint);
        }
      }
    },
  };
}
