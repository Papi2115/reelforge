/**
 * Sprites of the paper cut-out look: palette-indexed pixel buffers (colors.ts, 0 = clear) and the
 * integer drawing primitives the pieces are cut with (scanline polygons, ellipses, thick lines,
 * the kit's 5x7 caps font). Pure code, no Three.js: every piece is a function of its params and
 * the stop-motion step, rasterised here.
 */
import { GLYPH_ROWS, layoutLine, normalizeText } from '../../fx/font.js';
import { CLEAR } from './colors.js';

export interface Sprite {
  readonly width: number;
  readonly height: number;
  /** Row-major colour indices, row 0 = top. */
  readonly data: Uint8Array;
}

export type Point = readonly [number, number];

export function createSprite(width: number, height: number): Sprite {
  const w = Math.max(1, Math.ceil(width));
  const h = Math.max(1, Math.ceil(height));
  return { width: w, height: h, data: new Uint8Array(w * h) };
}

export function getPixel(sprite: Sprite, x: number, y: number): number {
  if (x < 0 || y < 0 || x >= sprite.width || y >= sprite.height) return CLEAR;
  return sprite.data[y * sprite.width + x] ?? CLEAR;
}

export function setPixel(sprite: Sprite, x: number, y: number, color: number): void {
  const px = Math.floor(x);
  const py = Math.floor(y);
  if (px < 0 || py < 0 || px >= sprite.width || py >= sprite.height) return;
  sprite.data[py * sprite.width + px] = color;
}

export function fillRect(
  sprite: Sprite,
  x: number,
  y: number,
  w: number,
  h: number,
  color: number,
): void {
  const x0 = Math.max(0, Math.round(x));
  const y0 = Math.max(0, Math.round(y));
  const x1 = Math.min(sprite.width, Math.round(x + w));
  const y1 = Math.min(sprite.height, Math.round(y + h));
  for (let row = y0; row < y1; row += 1)
    sprite.data.fill(color, row * sprite.width + x0, row * sprite.width + x1);
}

/** Even-odd scanline fill sampled at pixel centres (no anti-aliasing). */
export function fillPolygon(sprite: Sprite, points: readonly Point[], color: number): void {
  if (points.length < 3) return;
  let top = Infinity;
  let bottom = -Infinity;
  for (const [, y] of points) {
    top = Math.min(top, y);
    bottom = Math.max(bottom, y);
  }
  const y0 = Math.max(0, Math.floor(top));
  const y1 = Math.min(sprite.height - 1, Math.ceil(bottom));
  const crossings: number[] = [];
  for (let row = y0; row <= y1; row += 1) {
    const sy = row + 0.5;
    crossings.length = 0;
    for (let index = 0; index < points.length; index += 1) {
      const [ax, ay] = points[index] ?? [0, 0];
      const [bx, by] = points[(index + 1) % points.length] ?? [0, 0];
      if ((ay <= sy && by > sy) || (by <= sy && ay > sy)) {
        crossings.push(ax + ((sy - ay) / (by - ay)) * (bx - ax));
      }
    }
    crossings.sort((a, b) => a - b);
    for (let index = 0; index + 1 < crossings.length; index += 2) {
      const from = Math.max(0, Math.round(crossings[index] ?? 0));
      const to = Math.min(sprite.width, Math.round(crossings[index + 1] ?? 0));
      if (to > from) sprite.data.fill(color, row * sprite.width + from, row * sprite.width + to);
    }
  }
}

export function fillEllipse(
  sprite: Sprite,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  color: number,
): void {
  if (rx <= 0 || ry <= 0) return;
  const y0 = Math.max(0, Math.floor(cy - ry));
  const y1 = Math.min(sprite.height - 1, Math.ceil(cy + ry));
  for (let row = y0; row <= y1; row += 1) {
    const dy = (row + 0.5 - cy) / ry;
    if (dy * dy > 1) continue;
    const half = rx * Math.sqrt(1 - dy * dy);
    const from = Math.max(0, Math.round(cx - half));
    const to = Math.min(sprite.width, Math.round(cx + half));
    if (to > from) sprite.data.fill(color, row * sprite.width + from, row * sprite.width + to);
  }
}

/** A straight strip `thickness` px wide from a to b (square ends). */
export function fillLine(
  sprite: Sprite,
  a: Point,
  b: Point,
  thickness: number,
  color: number,
): void {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const length = Math.hypot(dx, dy);
  if (length === 0) {
    fillRect(sprite, a[0] - thickness / 2, a[1] - thickness / 2, thickness, thickness, color);
    return;
  }
  const nx = (-dy / length) * (thickness / 2);
  const ny = (dx / length) * (thickness / 2);
  fillPolygon(
    sprite,
    [
      [a[0] + nx, a[1] + ny],
      [b[0] + nx, b[1] + ny],
      [b[0] - nx, b[1] - ny],
      [a[0] - nx, a[1] - ny],
    ],
    color,
  );
}

/** Points rotated by `degrees` (clockwise on screen) around `pivot`, then moved by `offset`. */
export function transform(
  points: readonly Point[],
  degrees: number,
  pivot: Point,
  offset: Point = [0, 0],
): Point[] {
  const angle = (degrees * Math.PI) / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return points.map(([x, y]) => {
    const rx = x - pivot[0];
    const ry = y - pivot[1];
    return [pivot[0] + rx * cos - ry * sin + offset[0], pivot[1] + rx * sin + ry * cos + offset[1]];
  });
}

export function rectPoints(x: number, y: number, w: number, h: number): Point[] {
  return [
    [x, y],
    [x + w, y],
    [x + w, y + h],
    [x, y + h],
  ];
}

/** Width in px of one line of text at an integer scale (5x7 caps font). */
export function textWidth(text: string, scale: number): number {
  return layoutLine(normalizeText(text)).width * scale;
}

export const TEXT_ROWS = GLYPH_ROWS;

/** Draws one line of 5x7 caps at (x, y) = top of the line; `align` refers to x. */
export function drawText(
  sprite: Sprite,
  text: string,
  x: number,
  y: number,
  scale: number,
  color: number,
  align: 'left' | 'center' | 'right' = 'left',
): void {
  const layout = layoutLine(normalizeText(text));
  const width = layout.width * scale;
  const left = Math.round(align === 'left' ? x : align === 'right' ? x - width : x - width / 2);
  const top = Math.round(y);
  for (const placed of layout.glyphs) {
    const glyph = placed.glyph;
    if (glyph === undefined) continue;
    for (let row = 0; row < GLYPH_ROWS; row += 1) {
      for (let column = 0; column < glyph.width; column += 1) {
        if (glyph.bits[row * glyph.width + column] !== 1) continue;
        fillRect(
          sprite,
          left + (placed.x + column) * scale,
          top + row * scale,
          scale,
          scale,
          color,
        );
      }
    }
  }
}

/** Largest integer scale <= max at which `text` fits `maxWidth` (at least 1). */
export function fitTextScale(text: string, maxWidth: number, max: number): number {
  for (let scale = max; scale > 1; scale -= 1) if (textWidth(text, scale) <= maxWidth) return scale;
  return 1;
}

/**
 * Copies `source` into `target` at (x, y), skipping clear pixels. With `shade`, the pixels of
 * `target` under the source moved by `shadow` px are darkened first (a 1-px inner drop shadow
 * between two pieces of one puppet or one stack).
 */
export function stamp(
  target: Sprite,
  source: Sprite,
  x: number,
  y: number,
  shade?: Uint8Array,
  shadow: Point = [1, 1],
): void {
  const ox = Math.round(x);
  const oy = Math.round(y);
  if (shade !== undefined) {
    const [sx, sy] = shadow;
    for (let row = 0; row < source.height; row += 1) {
      for (let column = 0; column < source.width; column += 1) {
        if (source.data[row * source.width + column] === CLEAR) continue;
        const tx = ox + column + sx;
        const ty = oy + row + sy;
        if (tx < 0 || ty < 0 || tx >= target.width || ty >= target.height) continue;
        if (getPixel(source, column + sx, row + sy) !== CLEAR) continue;
        const offset = ty * target.width + tx;
        const under = target.data[offset] ?? CLEAR;
        if (under !== CLEAR) target.data[offset] = shade[under] ?? under;
      }
    }
  }
  for (let row = 0; row < source.height; row += 1) {
    const ty = oy + row;
    if (ty < 0 || ty >= target.height) continue;
    for (let column = 0; column < source.width; column += 1) {
      const color = source.data[row * source.width + column] ?? CLEAR;
      const tx = ox + column;
      if (color === CLEAR || tx < 0 || tx >= target.width) continue;
      target.data[ty * target.width + tx] = color;
    }
  }
}
