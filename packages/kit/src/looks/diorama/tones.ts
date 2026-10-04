/**
 * Colours of the diorama look: one slot table shared by every diorama (canvas slots are palette
 * names, so the look recolours with the style), shifted by the time of day. Chains list the Crisp
 * 640 swatch first, then Noir Voxel and Soft 480 swatches, and end with a token every style has.
 */
import { pickColor } from '../../env/shared.js';
import type { KitPalette } from '../../types.js';
import type { VoxelColor } from '../../voxel/model.js';

export const TIMES_OF_DAY = ['day', 'dusk', 'night'] as const;
export type TimeOfDay = (typeof TIMES_OF_DAY)[number];

export const BASE_MATERIALS = ['earth', 'concrete', 'wood'] as const;
export type BaseMaterial = (typeof BASE_MATERIALS)[number];

type Chain = readonly string[];

const C = {
  black: ['black', 'black', 'night', 'outline'],
  navy: ['navy', 'ink', 'night', 'sky'],
  indigo: ['indigo', 'charcoal', 'plum', 'groundAlt'],
  purple: ['purple', 'charcoal', 'plum', 'ground'],
  violet: ['violet', 'slate', 'mauve', 'ground'],
  wine: ['wine', 'bloodDark', 'plum', 'accent4'],
  magenta: ['magenta', 'blood', 'rose', 'accent4'],
  pink: ['pink', 'red', 'rose', 'accent2'],
  slateBlue: ['slateBlue', 'slate', 'denim', 'shadow'],
  teal: ['teal', 'tealDark', 'cornflower', 'accent1'],
  brightTeal: ['brightTeal', 'teal', 'mint', 'accent1'],
  green: ['green', 'teal', 'mint', 'accent3'],
  forest: ['forest', 'tealDark', 'olive', 'accent3'],
  orange: ['orange', 'amber', 'coral', 'hero'],
  lightOrange: ['lightOrange', 'gold', 'peach', 'keyLight'],
  cream: ['cream', 'bone', 'cream', 'heroTrim'],
  tan: ['tan', 'sepia', 'sand', 'heroTrim'],
  burntOrange: ['burntOrange', 'copper', 'clay', 'hero'],
  rust: ['rust', 'brown', 'umber', 'shadow'],
  slateGrey: ['slateGrey', 'ash', 'stone', 'textDim'],
  midSlate: ['midSlate', 'steel', 'pebble', 'textDim'],
  darkSlate: ['darkSlate', 'slate', 'taupe', 'groundAlt'],
} as const satisfies Record<string, Chain>;

export type ChainName = keyof typeof C;

/** Every colour slot of a diorama canvas. */
export const SLOTS = [
  'plate',
  'plateRim',
  'base',
  'baseAlt',
  'floor',
  'floorAlt',
  'seam',
  'wall',
  'wallLow',
  'wallCap',
  'trim',
  'pane',
  'wood',
  'woodDark',
  'metal',
  'metalDark',
  'dark',
  'darkest',
  'paper',
  'screen',
  'leaf',
  'leafDark',
  'pot',
  'trunk',
  'skin',
  'hair',
  'shirtA',
  'shirtB',
  'shirtC',
  'pants',
  'fabric',
  'fabricAlt',
  'rug',
  'rugBorder',
  'road',
  'roadLine',
  'sidewalk',
  'curb',
  'grass',
  'grassAlt',
  'bodyA',
  'bodyB',
  'bodyC',
  'bodyD',
  'roof',
  'windowLit',
  'windowDark',
  'lamp',
  'accent',
  'accentDark',
  'water',
] as const;

export type Slot = (typeof SLOTS)[number];

type ToneTable = Readonly<Record<Slot, ChainName | { readonly glow: ChainName }>>;

const DAY: ToneTable = {
  plate: 'navy',
  plateRim: 'slateBlue',
  base: 'darkSlate',
  baseAlt: 'midSlate',
  floor: 'slateGrey',
  floorAlt: 'midSlate',
  seam: 'darkSlate',
  wall: 'violet',
  wallLow: 'purple',
  wallCap: 'cream',
  trim: 'tan',
  pane: { glow: 'brightTeal' },
  wood: 'tan',
  woodDark: 'burntOrange',
  metal: 'slateGrey',
  metalDark: 'darkSlate',
  dark: 'darkSlate',
  darkest: 'black',
  paper: 'cream',
  screen: { glow: 'brightTeal' },
  leaf: 'green',
  leafDark: 'forest',
  pot: 'burntOrange',
  trunk: 'rust',
  skin: 'tan',
  hair: 'rust',
  shirtA: 'orange',
  shirtB: 'brightTeal',
  shirtC: 'pink',
  pants: 'indigo',
  fabric: 'cream',
  fabricAlt: 'pink',
  rug: 'magenta',
  rugBorder: 'cream',
  road: 'darkSlate',
  roadLine: 'cream',
  sidewalk: 'slateGrey',
  curb: 'midSlate',
  grass: 'forest',
  grassAlt: 'green',
  bodyA: 'violet',
  bodyB: 'slateBlue',
  bodyC: 'teal',
  bodyD: 'wine',
  roof: 'darkSlate',
  windowLit: 'brightTeal',
  windowDark: 'navy',
  lamp: 'cream',
  accent: 'brightTeal',
  accentDark: 'teal',
  water: 'teal',
};

/** Dusk: warm low sun, windows reflect the sunset, lamps switch on. */
const DUSK: ToneTable = {
  ...DAY,
  wall: 'violet',
  wallLow: 'purple',
  pane: { glow: 'pink' },
  windowLit: { glow: 'lightOrange' },
  windowDark: 'purple',
  lamp: { glow: 'lightOrange' },
  grass: 'forest',
  grassAlt: 'forest',
};

/** Night: cool moonlight; windows, lamps and screens glow. */
const NIGHT: ToneTable = {
  ...DAY,
  pane: { glow: 'slateBlue' },
  windowLit: { glow: 'lightOrange' },
  windowDark: 'navy',
  lamp: { glow: 'lightOrange' },
  sidewalk: 'midSlate',
  grassAlt: 'forest',
};

const TABLES: Readonly<Record<TimeOfDay, ToneTable>> = { day: DAY, dusk: DUSK, night: NIGHT };

const BASES: Readonly<Record<BaseMaterial, readonly [ChainName, ChainName]>> = {
  earth: ['rust', 'burntOrange'],
  concrete: ['darkSlate', 'midSlate'],
  wood: ['burntOrange', 'rust'],
};

/** Palette name of a chain in the active style. */
export function tone(palette: KitPalette, name: ChainName): string {
  return pickColor(palette, C[name]);
}

/** Overrides of single slots by a diorama (palette names or chain names). */
export type SlotOverrides = Partial<
  Readonly<Record<Slot, ChainName | { readonly glow: ChainName }>>
>;

/**
 * Colour of every slot for a time of day: base material, accent (any palette name; drives
 * screens, LEDs and highlights) and per-diorama overrides applied on top.
 */
export function dioramaColors(
  palette: KitPalette,
  time: TimeOfDay,
  base: BaseMaterial,
  accent: string,
  overrides: SlotOverrides = {},
): Readonly<Record<Slot, VoxelColor>> {
  const table: ToneTable = { ...TABLES[time], ...overrides };
  const [baseTone, baseAltTone] = BASES[base];
  const colors = {} as Record<Slot, VoxelColor>;
  for (const slot of SLOTS) {
    const entry = table[slot];
    colors[slot] =
      typeof entry === 'string'
        ? tone(palette, entry)
        : { color: tone(palette, entry.glow), glow: true };
  }
  colors.base = tone(palette, baseTone);
  colors.baseAlt = tone(palette, baseAltTone);
  colors.accent = accent;
  colors.screen = { color: accent, glow: true };
  return colors;
}
