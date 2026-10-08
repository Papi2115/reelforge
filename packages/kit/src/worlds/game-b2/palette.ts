/**
 * The 32 colours of the Game B2 world (docs/worlds/game-hud-b2-rpg-v2/NOTES.md), in ramp order
 * (dark -> light) so lookups stay readable. The renderer paints palette indices into index buffers
 * and maps them to the style's swatches at the end, so every pixel is a palette colour; lighting
 * and fog go through Doom-style colormaps built once per mood.
 */

/** [index name, style swatch name, hex] in index order. */
export const B2_TABLE = [
  ['VOID', 'void', '#08070a'],
  ['SHADOW', 'gloom', '#16131b'],
  ['UMBER', 'umber', '#2c1e18'],
  ['BROWN', 'brown', '#4e3325'],
  ['WOOD', 'wood', '#7d5336'],
  ['TAN', 'tan', '#b07b49'],
  ['TUNGSTEN', 'tungsten', '#e2a85f'],
  ['BULB', 'bulb', '#ffde9c'],
  ['MOSS_D', 'mossDark', '#10201a'],
  ['MOSS', 'moss', '#1f3b2d'],
  ['GREEN', 'green', '#3a634b'],
  ['SAGE', 'sage', '#6d9d6a'],
  ['FLUO', 'fluo', '#b5dd8f'],
  ['TUBE', 'tube', '#ecfbd2'],
  ['NIGHT_D', 'nightDark', '#0d1428'],
  ['NIGHT', 'night', '#1a2546'],
  ['DUSK', 'dusk', '#2f4471'],
  ['HAZE', 'haze', '#57729f'],
  ['MOON', 'moon', '#95afd1'],
  ['DIRT_D', 'dirtDark', '#39292c'],
  ['DIRT', 'dirt', '#6a5049'],
  ['SAND', 'sand', '#a5846a'],
  ['SAND_L', 'sandLight', '#d8b98f'],
  ['PAPER', 'paper', '#f5e7c6'],
  ['CHAR', 'char', '#2b292a'],
  ['SLATE', 'slate', '#504c4b'],
  ['GREY', 'grey', '#87817b'],
  ['PUTTY', 'putty', '#c4bdb0'],
  ['ACCENT', 'pink', '#ff4d7a'],
  ['ACCENT_D', 'wine', '#9b2546'],
  ['CLAY', 'clay', '#b4603c'],
  ['PLUM', 'plum', '#3d2b47'],
] as const;

type Row = (typeof B2_TABLE)[number];
export type B2ColorName = Row[0];
export type B2SwatchName = Row[1];

/** Palette index by colour name. */
export const C = Object.freeze(
  Object.fromEntries(B2_TABLE.map(([name], index) => [name, index])) as Record<B2ColorName, number>,
);

/** Index of a transparent pixel in sprite/texture/HUD bitmaps. */
export const T = 255;

/** Style swatch names in index order. */
export const B2_SWATCHES: readonly B2SwatchName[] = B2_TABLE.map(([, swatch]) => swatch);

/** Swatch name -> palette index (colour options of the API), undefined for unknown names. */
export function colorOfSwatch(name: string): number | undefined {
  const index = B2_SWATCHES.indexOf(name as B2SwatchName);
  return index < 0 ? undefined : index;
}

const RGB: readonly (readonly [number, number, number])[] = B2_TABLE.map(([, , hex]) => {
  const value = Number.parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255] as const;
});

/** RGB of a palette index. */
export function rgbOf(index: number): readonly [number, number, number] {
  return RGB[index] ?? [0, 0, 0];
}

/** Nearest palette colour (redmean distance); lighting never invents accent pixels. */
export function nearest(r: number, g: number, b: number): number {
  let best = 0;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (let index = 0; index < RGB.length; index += 1) {
    if (index === C.ACCENT || index === C.ACCENT_D) continue;
    const [pr, pg, pb] = rgbOf(index);
    const mean = (pr + r) / 2;
    const dr = pr - r;
    const dg = pg - g;
    const db = pb - b;
    const distance = (2 + mean / 256) * dr * dr + 4 * dg * dg + (2 + (255 - mean) / 256) * db * db;
    if (distance < bestDistance) {
      bestDistance = distance;
      best = index;
    }
  }
  return best;
}

export const LIGHT_LEVELS = 16;
export const FOG_LEVELS = 8;
/** Light value of the brightest level (overexposed tungsten). */
export const LIGHT_MAX = 1.3;

export type Rgb = readonly [number, number, number];

const colormapCache = new Map<string, Uint8Array>();

/**
 * cmap[(c * 16 + light) * 8 + fog] -> palette index for a mood (light tint, fog colour). The
 * accent keeps its own ramp so the point stays readable in the dark. Built once per mood.
 */
export function colormap(tint: Rgb, fog: Rgb): Uint8Array {
  const key = `${tint.join(',')}|${fog.join(',')}`;
  const cached = colormapCache.get(key);
  if (cached) return cached;
  const out = new Uint8Array(32 * LIGHT_LEVELS * FOG_LEVELS);
  for (let c = 0; c < 32; c += 1) {
    const [r, g, b] = rgbOf(c);
    for (let li = 0; li < LIGHT_LEVELS; li += 1) {
      const light = (li / (LIGHT_LEVELS - 1)) * LIGHT_MAX;
      for (let gi = 0; gi < FOG_LEVELS; gi += 1) {
        const fogShare = gi / (FOG_LEVELS - 1);
        let index: number;
        if ((c === C.ACCENT || c === C.ACCENT_D) && fogShare < 0.6 && light > 0.32) {
          index = light > 0.7 ? c : C.ACCENT_D;
        } else {
          const lit = (channel: number, k: number, f: number): number =>
            Math.min(255, channel * light * k) * (1 - fogShare) + f * fogShare;
          index = nearest(
            lit(r, tint[0], fog[0]),
            lit(g, tint[1], fog[1]),
            lit(b, tint[2], fog[2]),
          );
        }
        out[(c * LIGHT_LEVELS + li) * FOG_LEVELS + gi] = index;
      }
    }
  }
  colormapCache.set(key, out);
  return out;
}

/** c -> darker index (menus and close-ups dimming the world behind them). */
export function dimMap(k: number, tint: Rgb): Uint8Array {
  const out = new Uint8Array(256);
  for (let c = 0; c < 256; c += 1) out[c] = c;
  for (let c = 0; c < 32; c += 1) {
    const [r, g, b] = rgbOf(c);
    out[c] = nearest(r * k * tint[0], g * k * tint[1], b * k * tint[2]);
  }
  return out;
}
