/**
 * Colours of the character pack (ADR-024). The concept page draws with the Crisp 640 swatches;
 * every swatch maps to a chain [Crisp 640, Noir Voxel, Soft 480, semantic token] (the nearest
 * swatch of each style, or the kit's existing chain where one exists, see docs/characters.md), so
 * the pack keeps its look in Crisp 640 and recolours with any other style.
 */
import { resolveHex } from '../context.js';
import { pickColor } from '../env/shared.js';
import { KitError } from '../errors.js';
import type { KitPalette } from '../types.js';

export const CAST_COLOR_CHAINS = {
  black: ['black', 'black', 'night', 'outline'],
  navy: ['navy', 'ink', 'night', 'outline'],
  indigo: ['indigo', 'charcoal', 'umber', 'shadow'],
  purple: ['purple', 'slate', 'dusk', 'ground'],
  violet: ['violet', 'steel', 'mauve', 'groundAlt'],
  magenta: ['magenta', 'blood', 'rose', 'accent4'],
  pink: ['pink', 'red', 'rose', 'accent2'],
  slateBlue: ['slateBlue', 'steel', 'dusk', 'shadow'],
  teal: ['teal', 'teal', 'denim', 'accent1'],
  brightTeal: ['brightTeal', 'teal', 'sage', 'accent1'],
  green: ['green', 'teal', 'mint', 'accent3'],
  orange: ['orange', 'amber', 'coral', 'hero'],
  lightOrange: ['lightOrange', 'gold', 'peach', 'keyLight'],
  cream: ['cream', 'bone', 'cream', 'heroTrim'],
  slateGrey: ['slateGrey', 'ash', 'ice', 'textDim'],
  darkSlate: ['darkSlate', 'slate', 'dusk', 'groundAlt'],
  burntOrange: ['burntOrange', 'copper', 'clay', 'hero'],
  rust: ['rust', 'ember', 'brown', 'shadow'],
  tan: ['tan', 'sepia', 'taupe', 'heroTrim'],
  midSlate: ['midSlate', 'fog', 'stone', 'textDim'],
  forest: ['forest', 'teal', 'olive', 'accent3'],
  wine: ['wine', 'blood', 'mauve', 'accent4'],
} as const satisfies Readonly<Record<string, readonly string[]>>;

/** A Crisp 640 swatch name of the page (resolved through its chain). */
export type CastColor = keyof typeof CAST_COLOR_CHAINS;

export const CAST_COLORS = Object.keys(CAST_COLOR_CHAINS) as CastColor[];

/** Semantic tokens every style defines (role specs may use them besides the swatch names). */
export const STYLE_TOKENS = [
  'sky',
  'ground',
  'groundAlt',
  'hero',
  'heroTrim',
  'accent1',
  'accent2',
  'accent3',
  'accent4',
  'keyLight',
  'fillLight',
  'shadow',
  'text',
  'textDim',
  'outline',
] as const;

export function isCastColor(name: string): name is CastColor {
  return Object.hasOwn(CAST_COLOR_CHAINS, name);
}

/** Whether a role spec may use `name`: a Crisp 640 swatch of the pack or a semantic token. */
export function isSpecColor(name: string): boolean {
  return isCastColor(name) || (STYLE_TOKENS as readonly string[]).includes(name);
}

/** Palette name to draw `color` with in the active style. */
export function paletteName(palette: KitPalette, color: string): string {
  if (isCastColor(color)) return pickColor(palette, CAST_COLOR_CHAINS[color]);
  if (palette[color] !== undefined) return color;
  throw new KitError(
    'invalid-color',
    `character colour "${color}" is neither a pack swatch (${CAST_COLORS.join(', ')}) nor in the style palette`,
  );
}

/** Hex of `color` in the active style. */
export function castHex(palette: KitPalette, color: string): string {
  return resolveHex(palette, paletteName(palette, color));
}
