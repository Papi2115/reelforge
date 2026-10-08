/**
 * The smallest readable pixel-art icon (real run Game B2 2: an 8 x 8 sugar cube and a 9 x 9
 * nutrient dot did not read in the inventory, where an icon is drawn 1:1 on the 640 x 360 HUD).
 * An icon's drawn pixels span at least MIN_ICON_SPAN px one way and MIN_ICON_SIDE px the other and
 * fill at least MIN_ICON_PIXELS: one bold silhouette filling the 12 x 12 grid, not a dot in it.
 */
import type { Bmp } from '../core/bitmap.js';
import { T } from '../palette.js';

export const MIN_ICON_SPAN = 10;
export const MIN_ICON_SIDE = 7;
export const MIN_ICON_PIXELS = 20;

/** Problems of an icon's drawn pixels (empty: readable). */
export function iconSizeProblems(where: string, bmp: Bmp): string[] {
  let x0 = bmp.w;
  let y0 = bmp.h;
  let x1 = -1;
  let y1 = -1;
  let pixels = 0;
  for (let y = 0; y < bmp.h; y += 1)
    for (let x = 0; x < bmp.w; x += 1) {
      if (bmp.d[y * bmp.w + x] === T) continue;
      pixels += 1;
      x0 = Math.min(x0, x);
      y0 = Math.min(y0, y);
      x1 = Math.max(x1, x);
      y1 = Math.max(y1, y);
    }
  const w = x1 < 0 ? 0 : x1 - x0 + 1;
  const h = y1 < 0 ? 0 : y1 - y0 + 1;
  const small =
    Math.max(w, h) < MIN_ICON_SPAN || Math.min(w, h) < MIN_ICON_SIDE || pixels < MIN_ICON_PIXELS;
  if (!small) return [];
  return [
    `${where}: the icon is ${String(w)} x ${String(h)} px with ${String(pixels)} drawn pixels, too small to read in the inventory (drawn 1:1 on the HUD); draw one bold silhouette filling the 12 x 12 grid (>= ${String(MIN_ICON_SPAN)} px one way, >= ${String(MIN_ICON_SIDE)} the other, >= ${String(MIN_ICON_PIXELS)} pixels), or use { gen: 'icon', kind }`,
  ];
}
