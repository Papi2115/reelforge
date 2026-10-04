/**
 * Colour roles of the retro-UI look. Canvases store role indices (1..n, 0 = transparent); each
 * role resolves to a palette name through a chain "Crisp 640 swatch, Noir swatch, Soft 480 swatch,
 * semantic token" (like the voxel kit), so every look pixel is a style colour in any preset.
 * `DIM` steps a role one tone darker (scanlines, phosphor glow, shadows); tints remap all roles
 * onto a phosphor ramp by luminance (green/amber CRTs).
 */
import { resolveHex } from '../../context.js';
import { pickColor } from '../../env/shared.js';
import type { KitPalette } from '../../types.js';

export const ROLE_NAMES = [
  'black',
  'navy',
  'indigo',
  'purple',
  'violet',
  'magenta',
  'wine',
  'pink',
  'slateBlue',
  'teal',
  'cyan',
  'green',
  'forest',
  'orange',
  'amber',
  'burnt',
  'rust',
  'cream',
  'tan',
  'grey',
  'midGrey',
  'darkGrey',
] as const;

export type Role = (typeof ROLE_NAMES)[number];

/** Role -> canvas index (1-based; 0 is transparent). */
export const C = Object.freeze(
  Object.fromEntries(ROLE_NAMES.map((name, index) => [name, index + 1])),
) as Readonly<Record<Role, number>>;

const CHAINS: Readonly<Record<Role, readonly string[]>> = {
  black: ['black', 'black', 'night', 'outline'],
  navy: ['navy', 'ink', 'night', 'sky'],
  indigo: ['indigo', 'charcoal', 'plum', 'groundAlt'],
  purple: ['purple', 'slate', 'dusk', 'ground'],
  violet: ['violet', 'steel', 'mauve', 'accent4'],
  magenta: ['magenta', 'blood', 'rose', 'accent4'],
  wine: ['wine', 'bloodDark', 'mauve', 'shadow'],
  pink: ['pink', 'red', 'coral', 'accent2'],
  slateBlue: ['slateBlue', 'tealDark', 'denim', 'shadow'],
  teal: ['teal', 'teal', 'cornflower', 'accent1'],
  cyan: ['brightTeal', 'teal', 'ice', 'accent1'],
  green: ['green', 'teal', 'sage', 'accent3'],
  forest: ['forest', 'tealDark', 'olive', 'accent3'],
  orange: ['orange', 'amber', 'coral', 'hero'],
  amber: ['lightOrange', 'gold', 'peach', 'keyLight'],
  burnt: ['burntOrange', 'copper', 'clay', 'hero'],
  rust: ['rust', 'ember', 'brown', 'shadow'],
  cream: ['cream', 'bone', 'cream', 'text'],
  tan: ['tan', 'sepia', 'taupe', 'textDim'],
  grey: ['slateGrey', 'ash', 'taupe', 'textDim'],
  midGrey: ['midSlate', 'fog', 'stone', 'textDim'],
  darkGrey: ['darkSlate', 'steel', 'pebble', 'groundAlt'],
};

/** One tone darker (scanlines, glow halos, pressed buttons). */
const DIM: Readonly<Record<Role, Role>> = {
  black: 'black',
  navy: 'black',
  indigo: 'navy',
  purple: 'indigo',
  violet: 'purple',
  magenta: 'wine',
  wine: 'indigo',
  pink: 'magenta',
  slateBlue: 'navy',
  teal: 'slateBlue',
  cyan: 'teal',
  green: 'forest',
  forest: 'slateBlue',
  orange: 'burnt',
  amber: 'orange',
  burnt: 'rust',
  rust: 'indigo',
  cream: 'grey',
  tan: 'burnt',
  grey: 'midGrey',
  midGrey: 'darkGrey',
  darkGrey: 'indigo',
};

const DIM_INDEX: readonly number[] = [0, ...ROLE_NAMES.map((name) => C[DIM[name]])];

/** Index one tone darker (0 stays 0). */
export function dimIndex(index: number): number {
  return DIM_INDEX[index] ?? 0;
}

/** Phosphor of a CRT: `color` keeps the roles, the others remap them by luminance. */
export const CRT_TINTS = ['color', 'green', 'amber'] as const;
export type CrtTint = (typeof CRT_TINTS)[number];

const TINT_RAMPS: Readonly<Record<Exclude<CrtTint, 'color'>, readonly Role[]>> = {
  green: ['black', 'forest', 'green', 'green'],
  amber: ['black', 'rust', 'orange', 'amber'],
};

/** Resolved roles of one style: RGBA bytes per index and a luminance per index. */
export interface RoleColors {
  /** 4 bytes per index; index 0 is transparent. */
  readonly rgba: Uint8Array;
  /** Rec. 601 luminance 0..1 per index (0 for index 0). */
  readonly luminance: Float32Array;
  /** Palette name each role resolved to. */
  readonly names: Readonly<Record<Role, string>>;
}

export function resolveRoles(palette: KitPalette): RoleColors {
  const count = ROLE_NAMES.length + 1;
  const rgba = new Uint8Array(count * 4);
  const luminance = new Float32Array(count);
  const names = {} as Record<Role, string>;
  ROLE_NAMES.forEach((role, position) => {
    const name = pickColor(palette, CHAINS[role]);
    names[role] = name;
    const value = Number.parseInt(resolveHex(palette, name).slice(1), 16);
    const index = position + 1;
    const [r, g, b] = [(value >> 16) & 255, (value >> 8) & 255, value & 255];
    rgba.set([r, g, b, 255], index * 4);
    luminance[index] = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  });
  return { rgba, luminance, names };
}

/** Index -> index map of a tint (identity for `color`). */
export function tintMap(colors: RoleColors, tint: CrtTint): Uint8Array {
  const count = ROLE_NAMES.length + 1;
  const map = new Uint8Array(count);
  for (let index = 0; index < count; index += 1) map[index] = index;
  if (tint === 'color') return map;
  const ramp = TINT_RAMPS[tint].map((role) => C[role]);
  const dark = 0.12;
  const light = 0.7;
  for (let index = 1; index < count; index += 1) {
    const lum = colors.luminance[index] ?? 0;
    const step =
      lum < dark ? 0 : 1 + Math.floor(((lum - dark) / (light - dark)) * (ramp.length - 1));
    map[index] = ramp[Math.min(ramp.length - 1, step)] ?? C.black;
  }
  return map;
}

/** Accent families for title bars, banners and progress bars (dark, light). */
export const ACCENTS = ['violet', 'teal', 'orange', 'pink', 'green'] as const;
export type Accent = (typeof ACCENTS)[number];

export const ACCENT_RAMP: Readonly<Record<Accent, readonly [number, number]>> = {
  violet: [C.purple, C.violet],
  teal: [C.slateBlue, C.teal],
  orange: [C.rust, C.burnt],
  pink: [C.wine, C.magenta],
  green: [C.slateBlue, C.forest],
};

/** Bright colour of an accent (progress chunks, links, highlights). */
export const ACCENT_BRIGHT: Readonly<Record<Accent, number>> = {
  violet: C.magenta,
  teal: C.cyan,
  orange: C.orange,
  pink: C.pink,
  green: C.green,
};
