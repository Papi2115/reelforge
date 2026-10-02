/**
 * Contact sheet: a grid of labelled frames in one image (one row per shot), the format the
 * runtime Claude and the Haiku critic read. Labels use the engine's pixel mono font.
 */
import type { RgbaImage } from '@reelforge/engine/cli';
import {
  blit,
  createImage,
  downscale,
  drawLabel,
  fillRect,
  labelHeight,
  labelWidth,
  type MutableImage,
  type Rgb,
} from './image.js';

export interface SheetTile {
  readonly label: string;
  /** The frame; absent when the shot could not be rendered (`failure` says why, briefly). */
  readonly frame?: RgbaImage | undefined;
  readonly failure?: string | undefined;
}

export interface SheetRow {
  readonly tiles: readonly SheetTile[];
}

export interface SheetLayout {
  readonly title: string;
  /** Size of a full frame (all frames of a project share the style's size). */
  readonly frameWidth: number;
  readonly frameHeight: number;
  /** Integer downscale of the frames (1 = native pixels). */
  readonly factor: number;
}

const BACKGROUND: Rgb = [16, 16, 22];
const BAND: Rgb = [34, 34, 46];
const TEXT: Rgb = [236, 236, 228];
const FAILED: Rgb = [110, 18, 36];
const GAP = 6;
const LABEL_SCALE = 2;
const LABEL_PAD = 3;

/** Shortens `text` to fit `width` pixels at the label scale. */
function fit(text: string, width: number, scale: number): string {
  if (labelWidth(text, scale) <= width) return text;
  let cut = text;
  while (cut.length > 0 && labelWidth(`${cut}..`, scale) > width) cut = cut.slice(0, -1);
  return `${cut}..`;
}

function drawTile(
  sheet: MutableImage,
  tile: SheetTile,
  x: number,
  y: number,
  size: { readonly w: number; readonly h: number; readonly band: number; readonly factor: number },
): void {
  fillRect(sheet, x, y, size.w, size.band, BAND);
  drawLabel(
    sheet,
    fit(tile.label, size.w - 2 * LABEL_PAD, LABEL_SCALE),
    x + LABEL_PAD,
    y + 2,
    TEXT,
    LABEL_SCALE,
  );
  const top = y + size.band;
  if (tile.frame) {
    blit(sheet, downscale(tile.frame, size.factor), x, top);
    return;
  }
  fillRect(sheet, x, top, size.w, size.h, FAILED);
  const message = fit(tile.failure ?? 'not rendered', size.w - 2 * LABEL_PAD, LABEL_SCALE);
  const lineY = top + Math.floor((size.h - labelHeight(LABEL_SCALE)) / 2);
  drawLabel(sheet, message, x + LABEL_PAD, lineY, TEXT, LABEL_SCALE);
}

export function composeSheet(layout: SheetLayout, rows: readonly SheetRow[]): RgbaImage {
  const factor = Math.max(1, Math.floor(layout.factor));
  const w = Math.floor(layout.frameWidth / factor);
  const h = Math.floor(layout.frameHeight / factor);
  const band = labelHeight(LABEL_SCALE) + 4;
  const titleBand = labelHeight(LABEL_SCALE) + 2 * GAP;
  const columns = Math.max(1, ...rows.map((row) => row.tiles.length));
  const width = Math.max(
    columns * w + (columns + 1) * GAP,
    labelWidth(layout.title, LABEL_SCALE) + 2 * GAP,
  );
  const rowHeight = band + h + GAP;
  const sheet = createImage(width, titleBand + rows.length * rowHeight, BACKGROUND);
  drawLabel(sheet, layout.title, GAP, GAP, TEXT, LABEL_SCALE);
  rows.forEach((row, rowIndex) => {
    row.tiles.forEach((tile, column) => {
      const x = GAP + column * (w + GAP);
      const y = titleBand + rowIndex * rowHeight;
      drawTile(sheet, tile, x, y, { w, h, band, factor });
    });
  });
  return sheet;
}
