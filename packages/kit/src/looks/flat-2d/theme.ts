/**
 * Colour roles of the flat-2d look. Every role is a chain "Crisp 640 swatch, Noir swatch, Soft
 * swatch, semantic token" (first one the style has wins), so the look reads as saturated flat
 * design in Crisp 640 and still recolours with every style. A `tone` picks the stage family
 * (field, pattern tone, cards, shadow, lettering); the accents stay the same in every tone.
 */
import { z } from 'zod';
import { resolveHex } from '../../context.js';
import { pickColor } from '../../env/shared.js';
import type { KitPalette } from '../../types.js';
import { hexPixel, type Pixel } from './raster.js';

type Chain = readonly [string, string, string, string];

/** Roles a tone sets: the stage and what sits on it. */
interface ToneChains {
  /** Background field. */
  readonly field: Chain;
  /** Second stage tone: patterns, gradients, decor. */
  readonly alt: Chain;
  /** Cards, plates, badges behind icons. */
  readonly card: Chain;
  /** Flat drop shadows, track of bars and rings. */
  readonly shade: Chain;
  /** Main lettering. */
  readonly ink: Chain;
  /** Secondary lettering, captions. */
  readonly dim: Chain;
}

const LIGHT_INK: Chain = ['cream', 'bone', 'cream', 'text'];
const LIGHT_DIM: Chain = ['slateGrey', 'ash', 'ice', 'textDim'];

const TONES = {
  indigo: {
    field: ['indigo', 'charcoal', 'dusk', 'groundAlt'],
    alt: ['purple', 'slate', 'plum', 'ground'],
    card: ['violet', 'steel', 'mauve', 'ground'],
    shade: ['navy', 'ink', 'night', 'sky'],
    ink: LIGHT_INK,
    dim: LIGHT_DIM,
  },
  violet: {
    field: ['violet', 'slate', 'mauve', 'ground'],
    alt: ['purple', 'steel', 'plum', 'groundAlt'],
    card: ['indigo', 'charcoal', 'dusk', 'sky'],
    shade: ['purple', 'ink', 'plum', 'groundAlt'],
    ink: LIGHT_INK,
    dim: ['tan', 'ash', 'peach', 'textDim'],
  },
  teal: {
    field: ['slateBlue', 'tealDark', 'denim', 'shadow'],
    alt: ['teal', 'teal', 'cornflower', 'accent3'],
    card: ['navy', 'ink', 'dusk', 'sky'],
    shade: ['navy', 'black', 'night', 'outline'],
    ink: LIGHT_INK,
    dim: LIGHT_DIM,
  },
  night: {
    field: ['navy', 'ink', 'night', 'sky'],
    alt: ['indigo', 'charcoal', 'dusk', 'groundAlt'],
    card: ['purple', 'slate', 'plum', 'ground'],
    shade: ['black', 'black', 'night', 'outline'],
    ink: LIGHT_INK,
    dim: LIGHT_DIM,
  },
  wine: {
    field: ['wine', 'bloodDark', 'plum', 'accent4'],
    alt: ['magenta', 'blood', 'mauve', 'ground'],
    card: ['indigo', 'charcoal', 'dusk', 'sky'],
    shade: ['indigo', 'black', 'night', 'outline'],
    ink: LIGHT_INK,
    dim: ['tan', 'ash', 'peach', 'textDim'],
  },
  cream: {
    field: ['cream', 'bone', 'cream', 'text'],
    alt: ['tan', 'ash', 'sand', 'textDim'],
    card: ['navy', 'ink', 'dusk', 'sky'],
    shade: ['tan', 'ash', 'taupe', 'textDim'],
    ink: ['navy', 'ink', 'night', 'sky'],
    dim: ['midSlate', 'steel', 'stone', 'textDim'],
  },
} as const satisfies Record<string, ToneChains>;

export type ToneName = keyof typeof TONES;
export const TONE_NAMES = Object.keys(TONES) as [ToneName, ...ToneName[]];

export const toneParam = z
  .enum(TONE_NAMES)
  .default('indigo')
  .describe(
    'Stage tone family: indigo (default, dark), violet, teal, night (darkest), wine, cream (light, dark lettering)',
  );

/** Accents: the same in every tone. */
const ACCENTS = {
  /** The shot's hero colour. */
  primary: ['orange', 'amber', 'coral', 'hero'],
  secondary: ['brightTeal', 'red', 'sage', 'accent1'],
  tertiary: ['pink', 'gold', 'peach', 'accent2'],
  good: ['green', 'teal', 'mint', 'accent3'],
  gold: ['lightOrange', 'gold', 'sand', 'keyLight'],
  bad: ['magenta', 'blood', 'rose', 'accent4'],
  /** Light and dark details of icons (fixed in every tone). */
  light: LIGHT_INK,
  /** Secondary lettering on cards (cards are dark in every tone). */
  muted: LIGHT_DIM,
  dark: ['navy', 'black', 'night', 'outline'],
} as const satisfies Record<string, Chain>;

export type Role = keyof ToneChains | keyof typeof ACCENTS;

export type Theme = Readonly<Record<Role, Pixel>> & {
  readonly tone: ToneName;
  /** Any role or palette name -> Pixel. */
  color(name: string): Pixel;
  /** Accent colours in the order items take them. */
  readonly series: readonly Pixel[];
};

const ACCENT_ORDER = ['primary', 'secondary', 'tertiary', 'good', 'gold'] as const;

export const ROLE_NAMES: readonly Role[] = [
  'field',
  'alt',
  'card',
  'shade',
  'ink',
  'dim',
  ...(Object.keys(ACCENTS) as (keyof typeof ACCENTS)[]),
];

export function createTheme(palette: KitPalette, tone: ToneName = 'indigo'): Theme {
  const chains: Record<Role, Chain> = { ...TONES[tone], ...ACCENTS };
  const roles = Object.fromEntries(
    Object.entries(chains).map(([role, chain]) => [
      role,
      hexPixel(resolveHex(palette, pickColor(palette, chain))),
    ]),
  ) as Record<Role, Pixel>;
  const isRole = (name: string): name is Role => name in chains;
  return {
    ...roles,
    tone,
    series: ACCENT_ORDER.map((role) => roles[role]),
    color: (name) => (isRole(name) ? roles[name] : hexPixel(resolveHex(palette, name))),
  };
}

/** A colour param: a role (primary, secondary, ink, card, ...) or a palette name. */
export const colorParam = (fallback: string, what: string) =>
  z
    .string()
    .default(fallback)
    .describe(
      `${what}: a role (primary, secondary, tertiary, good, gold, bad, ink, dim, card, alt) or a palette name`,
    );
