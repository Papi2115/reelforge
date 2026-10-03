/**
 * Colour roles of the blueprint look. Each role is a chain "Crisp 640 swatch, Noir swatch, Soft
 * swatch, semantic token" (like the voxel environments), so the look reads as blueprint blue in
 * Crisp 640 and still recolours with every style. Scene params take palette names.
 */
import { resolveHex } from '../../context.js';
import { pickColor } from '../../env/shared.js';
import type { KitPalette } from '../../types.js';
import { hexPixel, type Pixel } from './raster.js';

const ROLE_CHAINS = {
  /** Sheet background. */
  paper: ['slateBlue', 'tealDark', 'denim', 'shadow'],
  /** Deep areas: water on maps, title-block cells. */
  deep: ['navy', 'ink', 'dusk', 'sky'],
  /** Grid lines and construction lines. */
  grid: ['teal', 'teal', 'cornflower', 'groundAlt'],
  /** Main linework and lettering. */
  ink: ['cream', 'bone', 'cream', 'text'],
  /** Secondary lettering, ticks, dimension lines. */
  dim: ['slateGrey', 'ash', 'ice', 'textDim'],
  /** The shot's idea: highlighted data, active nodes, routes. */
  accent: ['brightTeal', 'red', 'sage', 'accent1'],
  /** Key value / warning / now-marker. */
  hot: ['orange', 'amber', 'coral', 'hero'],
  /** Second accent. */
  alt: ['pink', 'gold', 'peach', 'accent2'],
  /** Third accent. */
  good: ['green', 'teal', 'cornflower', 'accent3'],
} as const satisfies Record<string, readonly string[]>;

export type Role = keyof typeof ROLE_CHAINS;

export type Theme = Readonly<Record<Role, Pixel>> & {
  /** Any palette name (or role name) -> Pixel. */
  color(name: string): Pixel;
  /** Data series colours in order. */
  readonly series: readonly Pixel[];
};

const SERIES_ROLES: readonly Role[] = ['accent', 'hot', 'alt', 'good', 'ink'];

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
    series: SERIES_ROLES.map((role) => roles[role]),
    color: (name) => (isRole(name) ? roles[name] : hexPixel(resolveHex(palette, name))),
  };
}

/** Role names scenes may pass where a palette name is expected. */
export const ROLE_NAMES = Object.keys(ROLE_CHAINS) as Role[];
