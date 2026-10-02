/** Small RGBA8 raster helpers for contact sheets (top-down, 4 bytes per pixel). */
import { MONO_FONT, type BitmapFont } from '@reelforge/engine';
import type { RgbaImage } from '@reelforge/engine/raster';

export type Rgb = readonly [number, number, number];

export interface MutableImage extends RgbaImage {
  readonly data: Uint8Array;
}

export function createImage(width: number, height: number, background: Rgb): MutableImage {
  const data = new Uint8Array(width * height * 4);
  for (let offset = 0; offset < data.length; offset += 4) {
    data.set([background[0], background[1], background[2], 255], offset);
  }
  return { width, height, data };
}

export function fillRect(
  image: MutableImage,
  x: number,
  y: number,
  w: number,
  h: number,
  color: Rgb,
): void {
  const left = Math.max(0, x);
  const top = Math.max(0, y);
  const right = Math.min(image.width, x + w);
  const bottom = Math.min(image.height, y + h);
  for (let row = top; row < bottom; row += 1) {
    for (let column = left; column < right; column += 1) {
      image.data.set([color[0], color[1], color[2], 255], (row * image.width + column) * 4);
    }
  }
}

/** Copies `source` into `target` with its top-left at (x, y), clipped to the target. */
export function blit(target: MutableImage, source: RgbaImage, x: number, y: number): void {
  for (let row = 0; row < source.height; row += 1) {
    const targetRow = y + row;
    if (targetRow < 0 || targetRow >= target.height) continue;
    const left = Math.max(0, -x);
    const right = Math.min(source.width, target.width - x);
    if (right <= left) continue;
    const start = (row * source.width + left) * 4;
    const end = (row * source.width + right) * 4;
    target.data.set(source.data.subarray(start, end), (targetRow * target.width + x + left) * 4);
  }
}

/** Box-filter downscale by an integer factor (averages each factor x factor block). */
export function downscale(source: RgbaImage, factor: number): RgbaImage {
  if (factor <= 1) return source;
  const width = Math.floor(source.width / factor);
  const height = Math.floor(source.height / factor);
  const data = new Uint8Array(width * height * 4);
  const area = factor * factor;
  for (let row = 0; row < height; row += 1) {
    for (let column = 0; column < width; column += 1) {
      for (let channel = 0; channel < 4; channel += 1) {
        let sum = 0;
        for (let dy = 0; dy < factor; dy += 1) {
          for (let dx = 0; dx < factor; dx += 1) {
            const offset =
              ((row * factor + dy) * source.width + column * factor + dx) * 4 + channel;
            sum += source.data[offset] ?? 0;
          }
        }
        data[(row * width + column) * 4 + channel] = Math.round(sum / area);
      }
    }
  }
  return { width, height, data };
}

/** Width in pixels of a one-line label drawn with `drawLabel`. */
export function labelWidth(text: string, scale: number, font: BitmapFont = MONO_FONT): number {
  let width = 0;
  for (const char of font.normalize(text)) width += font.advance(char);
  return width * scale;
}

/** Height of a label line (ascent + cap height + descent) in pixels. */
export function labelHeight(scale: number, font: BitmapFont = MONO_FONT): number {
  return font.lineHeight * scale;
}

/** Draws one line of pixel-font text with its line box's top-left at (x, y). */
export function drawLabel(
  image: MutableImage,
  text: string,
  x: number,
  y: number,
  color: Rgb,
  scale: number,
  font: BitmapFont = MONO_FONT,
): void {
  const capY = y + font.ascent * scale;
  let cursor = x;
  for (const char of font.normalize(text)) {
    const glyph = font.glyph(char);
    if (char !== ' ') {
      for (let row = 0; row < glyph.height; row += 1) {
        for (let column = 0; column < glyph.width; column += 1) {
          if (glyph.bits[row * glyph.width + column] !== 1) continue;
          fillRect(
            image,
            cursor + column * scale,
            capY + (glyph.top + row) * scale,
            scale,
            scale,
            color,
          );
        }
      }
    }
    cursor += font.advance(char) * scale;
  }
}
