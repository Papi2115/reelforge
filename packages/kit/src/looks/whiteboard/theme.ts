/**
 * Colour roles of the whiteboard look. Each role is a chain "Crisp 640 swatch, Noir swatch, Soft
 * swatch, semantic token" (like the blueprint roles), so the board reads as an off-white
 * whiteboard with black / blue / red / green markers in Crisp 640 and still recolours with every
 * style. Scene params take ink names, role names or palette names.
 */
import { resolveHex } from '../../context.js';
import { pickColor } from '../../env/shared.js';
import type { KitPalette } from '../../types.js';
import { hexPixel, type Pixel } from '../blueprint/raster.js';

const ROLE_CHAINS = {
  /** The writing surface. */
  board: ['cream', 'bone', 'cream', 'text'],
  /** Faint grain, ghosts of old marker and the optional grid. */
  grain: ['slateGrey', 'ash', 'taupe', 'textDim'],
  /** Wall around the board. */
  wall: ['darkSlate', 'charcoal', 'pebble', 'groundAlt'],
  /** Aluminium frame and its shade. */
  frame: ['slateGrey', 'fog', 'taupe', 'textDim'],
  frameDark: ['midSlate', 'steel', 'stone', 'ground'],
  /** Marker inks. */
  black: ['black', 'black', 'night', 'outline'],
  blue: ['teal', 'teal', 'denim', 'accent3'],
  red: ['burntOrange', 'red', 'clay', 'hero'],
  green: ['forest', 'sepia', 'olive', 'accent1'],
  /** The drawing hand and its sleeve. */
  skin: ['tan', 'sepia', 'peach', 'heroTrim'],
  skinShade: ['rust', 'brown', 'brown', 'hero'],
  sleeve: ['midSlate', 'slate', 'denim', 'shadow'],
  /** Outline of sprites (hand, marker, eraser). */
  outline: ['black', 'black', 'night', 'outline'],
} as const satisfies Record<string, readonly string[]>;

export type Role = keyof typeof ROLE_CHAINS;

/** Marker inks scenes name by colour. */
export const INKS = ['black', 'blue', 'red', 'green'] as const;
export type Ink = (typeof INKS)[number];

export type Theme = Readonly<Record<Role, Pixel>> & {
  /** Ink, role or palette name (or '#rrggbb') -> Pixel. */
  color(name: string): Pixel;
};

export function createTheme(palette: KitPalette): Theme {
  const roles = Object.fromEntries(
    Object.entries(ROLE_CHAINS).map(([role, chain]) => [
      role,
      hexPixel(resolveHex(palette, pickColor(palette, chain))),
    ]),
  ) as Record<Role, Pixel>;
  const isRole = (name: string): name is Role => name in ROLE_CHAINS;
  return {
    ...roles,
    color: (name) => (isRole(name) ? roles[name] : hexPixel(resolveHex(palette, name))),
  };
}
