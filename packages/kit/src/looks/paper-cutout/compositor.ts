/**
 * The paper stage's compositor: sprites placed on depth layers are painted back to front into one
 * frame-sized index raster. Before a piece is pasted, its drop shadow darkens what lies beneath
 * through the palette `shade` map: the further below a pixel's own layer is, the longer and
 * softer the shadow (offset grows with the layer gap, the soft fringe is a 50 % checker dither).
 * Shadows of several pieces stack (shade of a shade). Pure code, unit-tested without GL.
 */
import { CLEAR, type PaperColors } from './colors.js';
import type { Sprite } from './sprite.js';

/** A sprite at a whole-pixel position of the frame on one layer. */
export interface PlacedSprite {
  readonly sprite: Sprite;
  /** Top-left corner in frame pixels. */
  readonly x: number;
  readonly y: number;
  /** Depth layer (0 = backdrop sheet, higher = nearer). */
  readonly layer: number;
  /** Casts a drop shadow on the layers below (default true). */
  readonly shadow?: boolean | undefined;
}

/** Largest layer gap that still lengthens a shadow. */
const MAX_GAP = 3;

export interface ShadowShape {
  /** Offset [x, y] in px per layer gap 1..3 (index 0 unused). */
  readonly offsets: readonly (readonly [number, number])[];
  /** Soft fringe width in px per layer gap. */
  readonly soft: readonly number[];
}

export const LIGHTS = ['low', 'high'] as const;
export type Light = (typeof LIGHTS)[number];

/**
 * Shadow offsets for a strength (0 = none, 1 = normal, 2 = long), the frame scale and the light:
 * `low` (in front, below: shadows rise above each layer's edge, the classic layered paper-cut
 * look) or `high` (above: shadows fall down and right, for pieces pinned on a wall or a sheet).
 */
export function shadowShape(strength: number, scale: number, light: Light = 'low'): ShadowShape {
  const offsets: [number, number][] = [[0, 0]];
  const soft: number[] = [0];
  const length = strength * scale;
  for (let gap = 1; gap <= MAX_GAP; gap += 1) {
    offsets.push(
      light === 'low'
        ? [Math.round(length * (0.5 + 0.5 * gap)), -Math.round(length * (1 + gap))]
        : [Math.round(length * 0.6 * (1 + gap)), Math.round(length * (1.5 + 1.5 * gap))],
    );
    soft.push(strength <= 0 ? 0 : Math.max(1, Math.round(scale * Math.min(gap, 2))));
  }
  return { offsets, soft };
}

export interface Compositor {
  readonly width: number;
  readonly height: number;
  /** Colour index per frame pixel, row 0 = top. */
  readonly data: Uint8Array;
  /** Layer (+1) of the piece that painted each pixel (0 = only the base colour). */
  readonly layers: Uint8Array;
  compose(base: number, placed: readonly PlacedSprite[]): void;
  /** Writes the frame as RGBA bytes (row 0 = top). */
  writeRgba(target: Uint8Array): void;
}

function masked(sprite: Sprite, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= sprite.width || y >= sprite.height) return false;
  return sprite.data[y * sprite.width + x] !== CLEAR;
}

export function createCompositor(
  width: number,
  height: number,
  colors: PaperColors,
  shape: ShadowShape,
): Compositor {
  const data = new Uint8Array(width * height);
  const layers = new Uint8Array(width * height);
  // RGBA bytes of each colour index as one platform-endian word (same bytes as colors.rgba).
  const table = new Uint32Array(Uint8Array.from(colors.rgba).buffer);

  const castShadow = (item: PlacedSprite): void => {
    const { sprite, x, y, layer } = item;
    const [farX, farY] = shape.offsets[MAX_GAP] ?? [0, 0];
    const reach = Math.max(Math.abs(farX), Math.abs(farY)) + (shape.soft[MAX_GAP] ?? 0);
    const x0 = Math.max(0, x - reach);
    const y0 = Math.max(0, y - reach);
    const x1 = Math.min(width, x + sprite.width + reach);
    const y1 = Math.min(height, y + sprite.height + reach);
    for (let qy = y0; qy < y1; qy += 1) {
      for (let qx = x0; qx < x1; qx += 1) {
        const offset = qy * width + qx;
        const below = layers[offset] ?? 0;
        const gap = Math.min(MAX_GAP, layer + 1 - below);
        if (gap <= 0 || below === 0) continue;
        const [ox, oy] = shape.offsets[gap] ?? [0, 0];
        if (ox === 0 && oy === 0) continue;
        const sx = qx - x - ox;
        const sy = qy - y - oy;
        let dark = masked(sprite, sx, sy);
        if (!dark && ((qx + qy) & 1) === 0) {
          const soft = shape.soft[gap] ?? 0;
          dark =
            masked(sprite, sx - soft, sy) ||
            masked(sprite, sx + soft, sy) ||
            masked(sprite, sx, sy - soft) ||
            masked(sprite, sx, sy + soft);
        }
        if (dark) {
          const color = data[offset] ?? CLEAR;
          data[offset] = colors.shade[color] ?? color;
        }
      }
    }
  };

  const paste = (item: PlacedSprite): void => {
    const { sprite, x, y, layer } = item;
    for (let row = 0; row < sprite.height; row += 1) {
      const qy = y + row;
      if (qy < 0 || qy >= height) continue;
      for (let column = 0; column < sprite.width; column += 1) {
        const color = sprite.data[row * sprite.width + column] ?? CLEAR;
        const qx = x + column;
        if (color === CLEAR || qx < 0 || qx >= width) continue;
        data[qy * width + qx] = color;
        layers[qy * width + qx] = layer + 1;
      }
    }
  };

  return {
    width,
    height,
    data,
    layers,
    compose(base, placed) {
      data.fill(base);
      layers.fill(0);
      const ordered = placed
        .map((item, order) => ({ item, order }))
        .sort((a, b) => a.item.layer - b.item.layer || a.order - b.order);
      for (const { item } of ordered) {
        if (item.shadow !== false && item.layer > 0) castShadow(item);
        paste(item);
      }
    },
    writeRgba(target) {
      const pixels = new Uint32Array(target.buffer, target.byteOffset, data.length);
      for (let index = 0; index < data.length; index += 1) {
        pixels[index] = table[data[index] ?? CLEAR] ?? 0;
      }
    },
  };
}
