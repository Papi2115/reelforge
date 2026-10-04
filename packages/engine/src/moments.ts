/**
 * Render effects of accepted reveal moments (PLAN.md#12.27, ADR-020), applied by the runtime on
 * top of the shots without rebuilding a scene: a slow-motion time remap of a shot's local time
 * (`timeRemap`, @reelforge/shared time-remap.ts) and a palette-shift flash (`paletteShift`) that
 * steps style colours to a lighter member of their tone family through a 4x4 ordered dither.
 * Shots without effects never reach this code (the runtime keeps its idle path).
 */
import type { VariationBudget } from '@reelforge/kit';
import { paletteShiftAmount, remapTime, type ManifestShot } from '@reelforge/shared';
import { BAYER_4X4, hexToRgb, LUMA_WEIGHTS, type Rgb } from './palette.js';

/** Scene local time for a film-local time (identity, bit for bit, outside every window). */
export type ShotClock = (localTime: number) => number;

/** The clock of a shot with slow-motion windows, undefined for a shot without any. */
export function shotClock(shot: Pick<ManifestShot, 't0' | 'timeRemap'>): ShotClock | undefined {
  const windows = shot.timeRemap;
  if (windows === undefined || windows.length === 0) return undefined;
  return (localTime) => {
    const t = shot.t0 + localTime;
    const inside = windows.some((window) => t > window.from && t < window.to);
    return inside ? remapTime(windows, t) - shot.t0 : localTime;
  };
}

/** Palette-shift strength of a shot at its local time (0 = no shift). */
export function shotPaletteShift(
  shot: Pick<ManifestShot, 't0' | 'paletteShift'>,
  localTime: number,
): number {
  const windows = shot.paletteShift;
  if (windows === undefined || windows.length === 0) return 0;
  return paletteShiftAmount(windows, shot.t0 + localTime);
}

const rgbKey = (rgb: Rgb): number =>
  (Math.round(rgb[0] * 255) << 16) | (Math.round(rgb[1] * 255) << 8) | Math.round(rgb[2] * 255);

const luma = (rgb: Rgb): number =>
  rgb[0] * LUMA_WEIGHTS[0] + rgb[1] * LUMA_WEIGHTS[1] + rgb[2] * LUMA_WEIGHTS[2];

function distance(first: Rgb, second: Rgb): number {
  return (
    LUMA_WEIGHTS[0] * (first[0] - second[0]) ** 2 +
    LUMA_WEIGHTS[1] * (first[1] - second[1]) ** 2 +
    LUMA_WEIGHTS[2] * (first[2] - second[2]) ** 2
  );
}

/**
 * Colour (packed 0xRRGGBB) -> the lighter style colour it flashes to: a tone family's head takes
 * its closest lighter member (STYLE.md variation budgets, closest first); every other swatch the
 * nearest lighter swatch. Swatches without a lighter one are left out (they stay).
 * `toward: 'darker'` maps to the darker neighbours instead (live co-direction tone, PLAN.md#12.14).
 */
export function paletteShiftMap(
  swatches: Readonly<Record<string, string>>,
  budgets: Readonly<Record<string, Pick<VariationBudget, 'tones'>>>,
  toward: 'lighter' | 'darker' = 'lighter',
): Map<number, number> {
  const beyond = (other: Rgb, own: Rgb): boolean =>
    toward === 'lighter' ? luma(other) > luma(own) + 1e-6 : luma(other) < luma(own) - 1e-6;
  const colors = new Map<string, Rgb>(
    Object.entries(swatches).map(([name, hex]) => [name, hexToRgb(hex)]),
  );
  const map = new Map<number, number>();
  for (const budget of Object.values(budgets)) {
    for (const [family, members] of Object.entries(budget.tones)) {
      const own = colors.get(family);
      if (own === undefined || map.has(rgbKey(own))) continue;
      const lighter = members
        .map((name) => colors.get(name))
        .find((rgb): rgb is Rgb => rgb !== undefined && beyond(rgb, own));
      if (lighter !== undefined) map.set(rgbKey(own), rgbKey(lighter));
    }
  }
  const all = [...colors.values()];
  for (const own of all) {
    if (map.has(rgbKey(own))) continue;
    let best: Rgb | undefined;
    for (const other of all) {
      if (!beyond(other, own)) continue;
      if (best === undefined || distance(own, other) < distance(own, best)) best = other;
    }
    if (best !== undefined) map.set(rgbKey(own), rgbKey(best));
  }
  return map;
}

/**
 * Writes `frame` (RGBA8) shifted by `amount` (0..1) into `out`: a mapped pixel takes its lighter
 * colour where the 4x4 Bayer threshold is below `amount`; alpha and unmapped pixels are copied.
 */
export function applyPaletteShift(
  frame: Uint8Array,
  width: number,
  map: ReadonlyMap<number, number>,
  amount: number,
  out: Uint8Array,
): void {
  out.set(frame);
  if (amount <= 0) return;
  const pixels = frame.length / 4;
  for (let index = 0; index < pixels; index += 1) {
    const x = index % width;
    const y = (index - x) / width;
    const threshold = ((BAYER_4X4[(y & 3) * 4 + (x & 3)] ?? 0) + 0.5) / 16;
    if (threshold >= amount) continue;
    const offset = index * 4;
    const key =
      ((frame[offset] ?? 0) << 16) | ((frame[offset + 1] ?? 0) << 8) | (frame[offset + 2] ?? 0);
    const target = map.get(key);
    if (target === undefined) continue;
    out[offset] = (target >> 16) & 255;
    out[offset + 1] = (target >> 8) & 255;
    out[offset + 2] = target & 255;
  }
}
