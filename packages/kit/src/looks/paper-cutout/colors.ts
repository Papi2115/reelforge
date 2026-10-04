/**
 * Colours of the paper cut-out look. Every pixel the look paints is an index into a table of the
 * style palette's own colours (index 0 = clear), so frames stay on the palette by construction.
 * Shadows and paper rims need "the same paper, darker / lighter": `shade` and `light` map each
 * colour to another palette colour, picked in CIELAB (a darker colour of similar hue) with a few
 * hand-tuned Crisp 640 pairs, so a shadow falling on any colour (asset pictures included) lands
 * on a palette colour too.
 */
import { resolveHex } from '../../context.js';
import { pickColor } from '../../env/shared.js';
import type { KitPalette } from '../../types.js';

/** Index of a transparent sprite pixel. */
export const CLEAR = 0;

/**
 * Colour roles: "Crisp 640 swatch, Noir swatch, Soft swatch, token" chains (like the voxel
 * environments), so the look keeps its colours in Crisp 640 and still recolours with every style.
 */
export const PAPER_ROLES = {
  /** White paper: cards, tags, clouds, the moon. */
  paper: ['cream', 'bone', 'cream', 'text'],
  /** Kraft / cardboard. */
  kraft: ['tan', 'sepia', 'sand', 'groundAlt'],
  /** Ink: lettering, window frames, outlines. */
  ink: ['navy', 'ink', 'night', 'outline'],
  /** Grey ink: document lines. */
  inkDim: ['midSlate', 'steel', 'stone', 'textDim'],
  /** Warm accent: the sun, lit windows, lamps. */
  sun: ['lightOrange', 'gold', 'peach', 'keyLight'],
  /** Strong warm accent: roofs, the puppet's coat. */
  hero: ['orange', 'amber', 'coral', 'hero'],
  heroDark: ['burntOrange', 'copper', 'clay', 'hero'],
  /** Wood: trunks, posts, furniture. */
  wood: ['rust', 'brown', 'brown', 'groundAlt'],
  woodLight: ['burntOrange', 'ember', 'clay', 'hero'],
  /** Greens of hills and crowns, far to near. */
  green: ['green', 'teal', 'mint', 'accent3'],
  greenMid: ['forest', 'tealDark', 'sage', 'accent3'],
  greenDark: ['slateBlue', 'charcoal', 'olive', 'shadow'],
  /** Blues of skies and far hills. */
  skyLight: ['brightTeal', 'ash', 'ice', 'accent1'],
  skyMid: ['teal', 'steel', 'cornflower', 'shadow'],
  skyDeep: ['slateBlue', 'slate', 'denim', 'shadow'],
  /** Dusk bands, top to horizon. */
  duskTop: ['indigo', 'ink', 'dusk', 'sky'],
  duskMid: ['purple', 'charcoal', 'plum', 'ground'],
  duskLow: ['violet', 'bloodDark', 'mauve', 'groundAlt'],
  duskGlow: ['magenta', 'blood', 'rose', 'accent4'],
  /** Night. */
  night: ['navy', 'black', 'night', 'sky'],
  nightMid: ['indigo', 'ink', 'dusk', 'groundAlt'],
  /** Stone / concrete: buildings. */
  stone: ['midSlate', 'slate', 'stone', 'textDim'],
  stoneLight: ['slateGrey', 'fog', 'taupe', 'textDim'],
  stoneDark: ['darkSlate', 'charcoal', 'pebble', 'shadow'],
  /** Accents for clothes, books, labels. */
  pink: ['pink', 'red', 'rose', 'accent2'],
  wine: ['wine', 'bloodDark', 'plum', 'accent4'],
  teal: ['teal', 'tealDark', 'cornflower', 'accent1'],
} as const satisfies Record<string, readonly string[]>;

export type PaperRole = keyof typeof PAPER_ROLES;

/** Hand-tuned Crisp 640 shades (applied when both names exist in the palette). */
const SHADE_OVERRIDES: readonly (readonly [string, string])[] = [
  ['cream', 'tan'],
  ['teal', 'slateBlue'],
  ['brightTeal', 'slateBlue'],
  ['indigo', 'navy'],
  ['navy', 'black'],
  ['lightOrange', 'tan'],
  ['tan', 'rust'],
];

type Rgb = readonly [number, number, number];

function hexRgb(hex: string): Rgb {
  const channel = (offset: number): number => Number.parseInt(hex.slice(offset, offset + 2), 16);
  return [channel(1), channel(3), channel(5)];
}

function linear(channel: number): number {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** sRGB -> CIELAB (D65). */
export function toLab([r, g, b]: Rgb): Rgb {
  const R = linear(r);
  const G = linear(g);
  const B = linear(b);
  const f = (t: number): number => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const x = f((0.4124 * R + 0.3576 * G + 0.1805 * B) / 0.95047);
  const y = f(0.2126 * R + 0.7152 * G + 0.0722 * B);
  const z = f((0.0193 * R + 0.1192 * G + 0.9505 * B) / 1.08883);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}

/** Nearest colour (weighted Lab, hue counts double) to `target` among `candidates`. */
function nearest(labs: readonly Rgb[], candidates: readonly number[], target: Rgb): number {
  let best = -1;
  let bestDistance = Infinity;
  for (const index of candidates) {
    const lab = labs[index];
    if (lab === undefined) continue;
    const distance =
      (lab[0] - target[0]) ** 2 + 2 * (lab[1] - target[1]) ** 2 + 2 * (lab[2] - target[2]) ** 2;
    if (distance < bestDistance) {
      bestDistance = distance;
      best = index;
    }
  }
  return best;
}

/** `shade` / `light` tables for colours given in Lab (index 0 = clear maps to itself). */
export function toneMaps(labs: readonly Rgb[]): { shade: Uint8Array; light: Uint8Array } {
  const count = labs.length;
  const shade = new Uint8Array(count);
  const light = new Uint8Array(count);
  const all = Array.from({ length: count - 1 }, (_, index) => index + 1);
  for (let index = 1; index < count; index += 1) {
    const [l, a, b] = labs[index] ?? [0, 0, 0];
    const darker = all.filter((other) => (labs[other]?.[0] ?? 0) < l - 6);
    const darkest = all.filter((other) => (labs[other]?.[0] ?? 0) < l);
    const pool = darker.length > 0 ? darker : darkest;
    const dark = nearest(labs, pool, [l * 0.62, a * 0.8, b * 0.8]);
    shade[index] = dark < 0 ? index : dark;
    const lighter = all.filter((other) => (labs[other]?.[0] ?? 0) > l + 6);
    const bright = nearest(labs, lighter, [Math.min(100, l * 1.25 + 8), a * 0.9, b * 0.9]);
    light[index] = bright < 0 ? index : bright;
  }
  return { shade, light };
}

/** The colour table of one style palette. */
export interface PaperColors {
  /** RGBA bytes per index (index 0 = transparent black). */
  readonly rgba: Uint8Array;
  /** Index -> a darker palette colour (shadows). */
  readonly shade: Uint8Array;
  /** Index -> a lighter palette colour. */
  readonly light: Uint8Array;
  /** Index -> the colour of a torn or cut edge (two steps lighter on very dark paper). */
  readonly rim: Uint8Array;
  /** Palette name, role name or '#rrggbb' of a palette colour -> index. */
  index(name: string): number;
  /** Index of a palette '#rrggbb' (asset pictures); unknown colours map to the nearest. */
  hex(value: string): number;
  /** Index of a role. */
  role(role: PaperRole): number;
}

const isRole = (name: string): name is PaperRole => name in PAPER_ROLES;

export function createColors(palette: KitPalette): PaperColors {
  const hexes: string[] = [];
  const byHex = new Map<string, number>();
  for (const value of Object.values(palette)) {
    const hex = value.toLowerCase();
    if (byHex.has(hex)) continue;
    hexes.push(hex);
    byHex.set(hex, hexes.length);
  }
  const labs: Rgb[] = [[0, 0, 0], ...hexes.map((hex) => toLab(hexRgb(hex)))];
  const rgba = new Uint8Array((hexes.length + 1) * 4);
  hexes.forEach((hex, position) => {
    rgba.set([...hexRgb(hex), 255], (position + 1) * 4);
  });
  const { shade, light } = toneMaps(labs);
  // A rim one step lighter vanishes on near-black paper (night skies): go two steps there.
  const rim = light.map((lighter, index) =>
    (labs[index]?.[0] ?? 100) < 22 ? (light[lighter] ?? lighter) : lighter,
  );
  for (const [from, to] of SHADE_OVERRIDES) {
    const source = palette[from];
    const target = palette[to];
    if (source === undefined || target === undefined) continue;
    const a = byHex.get(source.toLowerCase());
    const b = byHex.get(target.toLowerCase());
    if (a !== undefined && b !== undefined) shade[a] = b;
  }
  const hex = (value: string): number => {
    const known = byHex.get(value.toLowerCase());
    if (known !== undefined) return known;
    const all = Array.from({ length: hexes.length }, (_, index) => index + 1);
    return Math.max(1, nearest(labs, all, toLab(hexRgb(value))));
  };
  const role = (name: PaperRole): number =>
    hex(resolveHex(palette, pickColor(palette, PAPER_ROLES[name])));
  return {
    rgba,
    shade,
    light,
    rim,
    hex,
    role,
    index: (name) => (isRole(name) ? role(name) : hex(resolveHex(palette, name))),
  };
}
