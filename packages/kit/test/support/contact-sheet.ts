/** Contact sheets: equally sized RGBA frames tiled row-major into one image with gutters. */
import type { RgbaImage } from '../../../engine/src/cli/index.js';

const GUTTER_GREY = 128;

export function composeSheet(tiles: readonly RgbaImage[], columns: number, gutter = 4): RgbaImage {
  const first = tiles[0];
  if (!first) throw new Error('composeSheet: no tiles');
  const { width: tileWidth, height: tileHeight } = first;
  const rows = Math.ceil(tiles.length / columns);
  const width = columns * tileWidth + (columns + 1) * gutter;
  const height = rows * tileHeight + (rows + 1) * gutter;
  const data = new Uint8Array(width * height * 4).fill(GUTTER_GREY);
  for (let alpha = 3; alpha < data.length; alpha += 4) data[alpha] = 255;
  tiles.forEach((tile, index) => {
    if (tile.width !== tileWidth || tile.height !== tileHeight) {
      throw new Error(
        `composeSheet: tile ${String(index)} is not ${String(tileWidth)}x${String(tileHeight)}`,
      );
    }
    const left = gutter + (index % columns) * (tileWidth + gutter);
    const top = gutter + Math.floor(index / columns) * (tileHeight + gutter);
    for (let y = 0; y < tileHeight; y += 1) {
      const row = tile.data.subarray(y * tileWidth * 4, (y + 1) * tileWidth * 4);
      data.set(row, ((top + y) * width + left) * 4);
    }
  });
  return { width, height, data };
}
