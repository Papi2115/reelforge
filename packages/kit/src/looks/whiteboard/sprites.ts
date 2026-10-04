/**
 * Sprites of the whiteboard look, built once per board at the raster's scale: the drawing hand
 * (sleeve, wrist, palm, thumb, a marker, fingers wrapped round it) or a bare marker, both with the
 * marker tip at the origin and the arm leaving towards the bottom right, and the felt eraser. A
 * sprite is a list of pixels with colour roles (`ink` = the current marker's colour), outlined by
 * the style's outline colour, so it is pixel art at any position and costs one pass to stamp.
 */
import type { Pixel, Raster } from '../blueprint/raster.js';
import type { Theme } from './theme.js';

export type SpriteRole = 'ink' | 'body' | 'skin' | 'skinShade' | 'sleeve' | 'outline' | 'felt';

export interface SpritePixel {
  readonly dx: number;
  readonly dy: number;
  readonly role: SpriteRole;
}

export type Sprite = readonly SpritePixel[];

/** A sprite layer in marker space: u along the marker (0 = tip), v across (+ = down-left). */
interface Layer {
  readonly role: SpriteRole;
  /** Shade role of pixels on this layer's edge against a layer below (finger lines). */
  readonly edge?: SpriteRole | undefined;
  readonly inside: (u: number, v: number) => boolean;
}

/** Sleeve: from the cuff (SLEEVE_FROM along the marker) off the raster's edge. */
const SLEEVE_FROM = 52;
const SLEEVE_HALF = 14;
const SLEEVE_AXIS = -6;

const ANGLE = (38 * Math.PI) / 180;
const AXIS: readonly [number, number] = [Math.cos(ANGLE), Math.sin(ANGLE)];

const blob =
  (cu: number, cv: number, ru: number, rv: number) =>
  (u: number, v: number): boolean =>
    ((u - cu) / ru) ** 2 + ((v - cv) / rv) ** 2 <= 1;

/** Marker body in marker space: tip, cone, barrel, cap (lengths in reference px). */
function markerLayers(length: number, cap: boolean): Layer[] {
  const layers: Layer[] = [
    {
      role: 'body',
      edge: 'outline',
      inside: (u, v) => u > 2.5 && u <= length && Math.abs(v) <= Math.min(3.2, 1.4 + u * 0.45),
    },
    { role: 'ink', inside: (u, v) => u >= -0.5 && u <= 2.5 && Math.abs(v) <= 0.7 + u * 0.35 },
  ];
  if (cap)
    layers.push({
      role: 'ink',
      inside: (u, v) => u > length - 6 && u <= length && Math.abs(v) <= 3.2,
    });
  return layers;
}

/** Hand gripping the marker: wrist and cuff, palm, thumb, marker, then the curled fingers. */
function handLayers(): Layer[] {
  const shade = 'skinShade' as const;
  return [
    { role: 'skin', inside: (u, v) => u >= 30 && u < 52 && Math.abs(v - SLEEVE_AXIS) <= 10.5 },
    { role: 'body', inside: (u, v) => u >= 46 && u < 53 && Math.abs(v - SLEEVE_AXIS) <= 13 },
    { role: 'skin', inside: blob(27, -6, 15, 12.5) },
    { role: 'skin', inside: blob(16, -8, 8.5, 4) },
    ...markerLayers(32, false),
    { role: 'skin', edge: shade, inside: blob(15, 4.2, 8, 4) },
    { role: 'skin', edge: shade, inside: blob(22.5, 7.6, 7.5, 3.8) },
    { role: 'skin', edge: shade, inside: blob(29.5, 8.4, 6.5, 3.5) },
  ];
}

/** Pixels of layers (marker space when `rotated`, plain x/y otherwise), outlined. */
function rasterize(layers: readonly Layer[], s: number, reach: number, rotated = true): Sprite {
  const radius = Math.ceil(reach * s);
  const size = radius * 2 + 1;
  const labels = new Int16Array(size * size).fill(-1);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const px = (x - radius) / s;
      const py = (y - radius) / s;
      const u = rotated ? px * AXIS[0] + py * AXIS[1] : px;
      const v = rotated ? -px * AXIS[1] + py * AXIS[0] : py;
      layers.forEach((layer, index) => {
        if (layer.inside(u, v)) labels[y * size + x] = index;
      });
    }
  }
  const label = (x: number, y: number): number =>
    x < 0 || y < 0 || x >= size || y >= size ? -1 : (labels[y * size + x] ?? -1);
  const pixels: SpritePixel[] = [];
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const own = label(x, y);
      const around = [label(x - 1, y), label(x + 1, y), label(x, y - 1), label(x, y + 1)];
      let role: SpriteRole | undefined;
      if (own < 0) {
        if (around.some((other) => other >= 0)) role = 'outline';
      } else {
        const layer = layers[own];
        // Edge against any layer below (finger lines, the marker's outline over the palm).
        const below = around.some((other) => other >= 0 && other < own);
        role = below && layer?.edge ? layer.edge : layer?.role;
      }
      if (role) pixels.push({ dx: x - radius, dy: y - radius, role });
    }
  }
  return pixels;
}

export type PenKind = 'hand' | 'marker' | 'none';

/** The pen sprite for a board drawn at `s` raster px per reference px. */
export function penSprite(kind: PenKind, s: number): Sprite {
  if (kind === 'none') return [];
  return kind === 'hand'
    ? rasterize(handLayers(), s, 58)
    : rasterize(markerLayers(30, true), s, 34);
}

/** The felt eraser, centred on the origin. */
export function eraserSprite(s: number): Sprite {
  const width = 46;
  const height = 22;
  const block = (x: number, y: number): boolean =>
    Math.abs(x) <= width / 2 && Math.abs(y) <= height / 2;
  return rasterize(
    [
      { role: 'sleeve', inside: block },
      { role: 'felt', inside: (x, y) => block(x, y) && y > height / 2 - 7 },
    ],
    s,
    width / 2 + 2,
    false,
  );
}

/** Draws the sleeve of the hand whose marker tip is at (x, y), out of the raster. */
export function drawSleeve(raster: Raster, x: number, y: number, s: number, theme: Theme): void {
  const ox = Math.round(x);
  const oy = Math.round(y);
  const [c, sn] = AXIS;
  const reach = (SLEEVE_HALF + 1) / sn;
  for (let row = Math.max(0, oy); row < raster.height; row += 1) {
    const py = (row - oy) / s;
    const centre = ox + ((py * c - SLEEVE_AXIS) / sn) * s;
    for (let column = Math.floor(centre - reach * s); column <= centre + reach * s; column += 1) {
      const px = (column - ox) / s;
      const u = px * c + py * sn;
      const v = -px * sn + py * c - SLEEVE_AXIS;
      if (u < SLEEVE_FROM - 1 || Math.abs(v) > SLEEVE_HALF + 1) continue;
      const edge = u < SLEEVE_FROM || Math.abs(v) > SLEEVE_HALF;
      raster.set(column, row, edge ? theme.outline : theme.sleeve);
    }
  }
}

/** Stamps a sprite with its origin at (x, y); `ink` is the marker colour. */
export function drawSprite(
  raster: Raster,
  sprite: Sprite,
  x: number,
  y: number,
  theme: Theme,
  ink: Pixel,
): void {
  const ox = Math.round(x);
  const oy = Math.round(y);
  const colors: Readonly<Record<SpriteRole, Pixel>> = {
    ink,
    body: theme.board,
    skin: theme.skin,
    skinShade: theme.skinShade,
    sleeve: theme.sleeve,
    outline: theme.outline,
    felt: theme.wall,
  };
  for (const pixel of sprite) raster.set(ox + pixel.dx, oy + pixel.dy, colors[pixel.role]);
}
