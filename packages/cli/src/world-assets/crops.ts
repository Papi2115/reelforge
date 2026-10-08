/**
 * Per-asset legibility crops of a film's world assets (real runs Game B2 2 / Game B1 2: the old
 * "thumbnail" shrank the whole sheet, so sprites were ~10 px dots and the critic passed them).
 * Each asset is rendered ALONE and compared with the same page drawn empty: the changed pixels are
 * the asset. Its crop is shown at film size: as large as it is in a 1080p frame, but never taller
 * than 128 px (a phone-size look; big things shrink, small things are never blown up beyond their
 * 1080p size). Up to 6 crops share one image, each labelled with a neutral code (A1, A2, …), so
 * the critic names what it sees without being told the name.
 */
import type { RgbaImage } from '@reelforge/engine/raster';
import { blit, createImage, drawLabel, labelHeight, type Rgb } from '../render/image.js';

/** The film's delivery height (the frames are scaled to it on export). */
export const FILM_HEIGHT = 1080;
/** Tallest and widest one crop is shown. */
export const CROP_TILE_HEIGHT = 128;
export const CROP_TILE_WIDTH = 256;
/** Crops per critic image. */
export const CROPS_PER_IMAGE = 6;
const COLUMNS = 3;
const GAP = 8;
const PAD = 3;
const LABEL_SCALE = 2;
/** A pixel changed when one channel differs by more than this (render noise stays below). */
const CHANGE_THRESHOLD = 24;
const BACKGROUND: Rgb = [16, 16, 22];
const TILE: Rgb = [34, 34, 46];
const TEXT: Rgb = [236, 236, 228];
const FAILED: Rgb = [110, 18, 36];

export interface Bounds {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface CropTile {
  /** Neutral label (A1 …): the critic is not told the asset's name. */
  readonly code: string;
  readonly image?: RgbaImage | undefined;
  /** Why there is no crop (did not render, draws nothing). */
  readonly failure?: string | undefined;
}

/** Project-relative files of the solo scenes and the crop images (git-ignored app data). */
export const worldAssetSoloScene = (page: number): string =>
  `.reelforge/frames/world-assets/solo-${String(page)}.js`;
export const worldAssetCropSheet = (image: number): string =>
  `.reelforge/frames/world-assets/crops-${cropLetter(image)}.png`;

/** A … Z, then AA, AB … (no world allows more than a few dozen assets). */
function cropLetter(image: number): string {
  const letter = String.fromCharCode(65 + (image % 26));
  return image < 26 ? letter : `${String.fromCharCode(64 + Math.floor(image / 26))}${letter}`;
}

/** The code of the `index`-th crop (0-based): A1 … A6, B1 … */
export function cropTileCode(index: number): string {
  const image = Math.floor(index / CROPS_PER_IMAGE);
  return `${cropLetter(image)}${String((index % CROPS_PER_IMAGE) + 1)}`;
}

/**
 * Where the asset is: the box of pixels that differ between its solo render and the empty page
 * (padded); the whole frame without a usable empty render; undefined when nothing changed.
 */
export function assetBounds(solo: RgbaImage, empty: RgbaImage | undefined): Bounds | undefined {
  const whole = { x: 0, y: 0, width: solo.width, height: solo.height };
  if (empty === undefined || empty.width !== solo.width || empty.height !== solo.height)
    return whole;
  let left = solo.width;
  let top = solo.height;
  let right = -1;
  let bottom = -1;
  for (let y = 0; y < solo.height; y += 1) {
    for (let x = 0; x < solo.width; x += 1) {
      const offset = (y * solo.width + x) * 4;
      let changed = false;
      for (let channel = 0; channel < 3 && !changed; channel += 1) {
        const delta = Math.abs(
          (solo.data[offset + channel] ?? 0) - (empty.data[offset + channel] ?? 0),
        );
        changed = delta > CHANGE_THRESHOLD;
      }
      if (!changed) continue;
      left = Math.min(left, x);
      right = Math.max(right, x);
      top = Math.min(top, y);
      bottom = Math.max(bottom, y);
    }
  }
  if (right < 0) return undefined;
  const x = Math.max(0, left - PAD);
  const y = Math.max(0, top - PAD);
  return {
    x,
    y,
    width: Math.min(solo.width, right + PAD + 1) - x,
    height: Math.min(solo.height, bottom + PAD + 1) - y,
  };
}

/** The scale of a crop: its 1080p size, capped by the tile box. */
export function filmScale(frameHeight: number, bounds: Bounds): number {
  return Math.min(
    FILM_HEIGHT / frameHeight,
    CROP_TILE_HEIGHT / bounds.height,
    CROP_TILE_WIDTH / bounds.width,
  );
}

/** Nearest-neighbour by an integer factor up (pixel art stays crisp), box average down. */
function resample(source: RgbaImage, bounds: Bounds, scale: number): RgbaImage {
  const up = scale >= 1 ? Math.floor(scale) : 0;
  const width = Math.max(1, up > 0 ? bounds.width * up : Math.round(bounds.width * scale));
  const height = Math.max(1, up > 0 ? bounds.height * up : Math.round(bounds.height * scale));
  const data = new Uint8Array(width * height * 4);
  for (let row = 0; row < height; row += 1) {
    const y0 = bounds.y + Math.floor((row * bounds.height) / height);
    const y1 = Math.max(y0 + 1, bounds.y + Math.floor(((row + 1) * bounds.height) / height));
    for (let column = 0; column < width; column += 1) {
      const x0 = bounds.x + Math.floor((column * bounds.width) / width);
      const x1 = Math.max(x0 + 1, bounds.x + Math.floor(((column + 1) * bounds.width) / width));
      const sums = [0, 0, 0, 0];
      for (let y = y0; y < y1; y += 1) {
        for (let x = x0; x < x1; x += 1) {
          const offset = (y * source.width + x) * 4;
          for (let channel = 0; channel < 4; channel += 1)
            sums[channel] = (sums[channel] ?? 0) + (source.data[offset + channel] ?? 0);
        }
      }
      const area = (y1 - y0) * (x1 - x0);
      sums.forEach((sum, channel) => {
        data[(row * width + column) * 4 + channel] = Math.round(sum / area);
      });
    }
  }
  return { width, height, data };
}

/** The asset's crop at film size (see the module comment). */
export function filmSizeCrop(frame: RgbaImage, bounds: Bounds): RgbaImage {
  return resample(frame, bounds, filmScale(frame.height, bounds));
}

/** One critic image: up to 6 crops in a 3-column grid, each in a 256x128 box under its code. */
export function composeCropSheet(tiles: readonly CropTile[]): RgbaImage {
  const band = labelHeight(LABEL_SCALE) + 4;
  const rows = Math.max(1, Math.ceil(tiles.length / COLUMNS));
  const columns = Math.max(1, Math.min(COLUMNS, tiles.length));
  const cellHeight = band + CROP_TILE_HEIGHT;
  const sheet = createImage(
    GAP + columns * (CROP_TILE_WIDTH + GAP),
    GAP + rows * (cellHeight + GAP),
    BACKGROUND,
  );
  tiles.forEach((tile, index) => {
    const x = GAP + (index % COLUMNS) * (CROP_TILE_WIDTH + GAP);
    const y = GAP + Math.floor(index / COLUMNS) * (cellHeight + GAP);
    drawLabel(sheet, tile.code, x + PAD, y + 2, TEXT, LABEL_SCALE);
    const box = createImage(CROP_TILE_WIDTH, CROP_TILE_HEIGHT, tile.image ? TILE : FAILED);
    if (tile.image) {
      const left = Math.floor((CROP_TILE_WIDTH - tile.image.width) / 2);
      const top = Math.floor((CROP_TILE_HEIGHT - tile.image.height) / 2);
      blit(box, tile.image, left, top);
    } else {
      drawLabel(box, (tile.failure ?? 'not rendered').slice(0, 20), PAD, PAD, TEXT, LABEL_SCALE);
    }
    blit(sheet, box, x, y + band);
  });
  return sheet;
}
