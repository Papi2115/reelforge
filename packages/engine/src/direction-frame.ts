/**
 * Pixel passes of live co-direction (PLAN.md#12.14) on a finished RGBA8 frame (CPU, after the
 * post-fx and any reveal-moment flash): a tone shift inside the style palette, a crop-scale zoom
 * by integer nearest-neighbour sampling and the host's overlay marks. Every pass copies or maps
 * palette colours, so a palette-pure frame stays palette-pure (vibe guard).
 */
import { applyPaletteShift } from './moments.js';
import { lutLookup, type PaletteLut } from './palette.js';

/** Source column/row of each output column/row for a centred zoom (nearest neighbour). */
export function zoomIndexMap(size: number, zoom: number): Int32Array {
  const map = new Int32Array(size);
  const centre = size / 2;
  for (let index = 0; index < size; index += 1) {
    const source = Math.floor((index + 0.5 - centre) / zoom + centre);
    map[index] = Math.min(size - 1, Math.max(0, source));
  }
  return map;
}

/** Writes `frame` zoomed by `zoom` (≥ 1, centred) into `out`; every pixel is a copied pixel. */
export function applyZoom(
  frame: Uint8Array,
  width: number,
  height: number,
  zoom: number,
  out: Uint8Array,
): void {
  if (zoom <= 1) {
    out.set(frame);
    return;
  }
  const columns = zoomIndexMap(width, zoom);
  const rows = zoomIndexMap(height, zoom);
  for (let y = 0; y < height; y += 1) {
    const sourceRow = (rows[y] ?? 0) * width;
    const targetRow = y * width;
    for (let x = 0; x < width; x += 1) {
      const from = (sourceRow + (columns[x] ?? 0)) * 4;
      const to = (targetRow + x) * 4;
      out[to] = frame[from] ?? 0;
      out[to + 1] = frame[from + 1] ?? 0;
      out[to + 2] = frame[from + 2] ?? 0;
      out[to + 3] = frame[from + 3] ?? 255;
    }
  }
}

/** Tone maps of a style: each palette colour -> its lighter / darker neighbour. */
export interface ToneMaps {
  readonly lighter: ReadonlyMap<number, number>;
  readonly darker: ReadonlyMap<number, number>;
}

/** `dim` −1..+1 (darker..lighter) applied through the ordered-dither palette shift. */
export function applyTone(
  frame: Uint8Array,
  width: number,
  maps: ToneMaps,
  dim: number,
  out: Uint8Array,
): void {
  const map = dim < 0 ? maps.darker : maps.lighter;
  applyPaletteShift(frame, width, map, Math.min(1, Math.abs(dim)), out);
}

/**
 * Draws the opaque pixels of an overlay surface (RGBA8, alpha 0 or 255) over `frame` in place,
 * each colour snapped through the style's palette LUT exactly like the GPU text composite.
 */
export function compositeOverlay(
  frame: Uint8Array,
  overlay: Uint8Array,
  lut: PaletteLut,
  snapCache: Map<number, number>,
): void {
  const bytes = lut.palette.map((rgb) => rgb.map((channel) => Math.round(channel * 255)));
  for (let offset = 0; offset < overlay.length; offset += 4) {
    if ((overlay[offset + 3] ?? 0) === 0) continue;
    const r = overlay[offset] ?? 0;
    const g = overlay[offset + 1] ?? 0;
    const b = overlay[offset + 2] ?? 0;
    const key = (r << 16) | (g << 8) | b;
    let snapped = snapCache.get(key);
    if (snapped === undefined) {
      const color = bytes[lutLookup(lut, [r / 255, g / 255, b / 255])] ?? [r, g, b];
      snapped = ((color[0] ?? 0) << 16) | ((color[1] ?? 0) << 8) | (color[2] ?? 0);
      snapCache.set(key, snapped);
    }
    frame[offset] = (snapped >> 16) & 255;
    frame[offset + 1] = (snapped >> 8) & 255;
    frame[offset + 2] = snapped & 255;
    frame[offset + 3] = 255;
  }
}
