/**
 * Rubber stamp of the retro-UI documents: bold caps in a double frame, tilted by nearest-neighbour
 * rotation, with worn ink (hashed holes). The slam is a pure function of k = (t - at) / STAMP_TIME:
 * the stamp comes down large and see-through, then prints at full size.
 */
import { hashCell } from '../../env/shared.js';
import {
  createCanvas,
  drawText,
  setPixel,
  strokeRect,
  textWidth,
  type PixelCanvas,
  type Point,
} from './canvas.js';

export const STAMP_TIME = 0.25;
const TILT = -0.2;
const WEAR = 0.14;

function stampArt(text: string, color: number): PixelCanvas {
  const style = { scale: 2, bold: true };
  const width = textWidth(text, style) + 16;
  const art = createCanvas(width, 28);
  strokeRect(art, { x: 0, y: 0, w: width, h: 28 }, color);
  strokeRect(art, { x: 1, y: 1, w: width - 2, h: 26 }, color);
  strokeRect(art, { x: 4, y: 4, w: width - 8, h: 20 }, color);
  drawText(art, text, 8, 7, color, style);
  return art;
}

/**
 * Draws the stamp centred on `at` for slam progress k (< 0 nothing, 0..1 coming down, >= 1
 * printed). Pure in (text, at, color, seed, k).
 */
export function drawStamp(
  canvas: PixelCanvas,
  text: string,
  at: Point,
  color: number,
  seed: number,
  k: number,
): void {
  if (k < 0) return;
  const art = stampArt(text, color);
  const landing = Math.min(1, k);
  const scale = landing < 1 ? 1.5 - 0.5 * landing : 1;
  const ghost = landing < 1;
  const cos = Math.cos(TILT);
  const sin = Math.sin(TILT);
  const reach = Math.ceil((Math.hypot(art.width, art.height) / 2) * scale) + 1;
  for (let dy = -reach; dy <= reach; dy += 1) {
    for (let dx = -reach; dx <= reach; dx += 1) {
      const x = Math.round(at[0]) + dx;
      const y = Math.round(at[1]) + dy;
      if (ghost && ((x + y) & 1) === 1) continue;
      const sx = Math.floor((dx * cos + dy * sin) / scale + art.width / 2);
      const sy = Math.floor((-dx * sin + dy * cos) / scale + art.height / 2);
      if (sx < 0 || sy < 0 || sx >= art.width || sy >= art.height) continue;
      if (art.data[sy * art.width + sx] === 0) continue;
      if (!ghost && hashCell(sx, sy, 11, seed) < WEAR) continue;
      setPixel(canvas, x, y, color);
    }
  }
}
