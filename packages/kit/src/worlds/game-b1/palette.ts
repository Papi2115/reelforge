/**
 * The 23 inks of the Game B1 world (docs/worlds/game-hud-b1-boss-v2/NOTES.md): an early-80s
 * living room seen through an NTSC 2600 picture. The renderer paints palette indices and maps them
 * to the style's swatches at the end; every post effect (scanline, colour bleed, burn-in ghost,
 * attract-mode cycle, hit flash) is a lookup table inside the palette, so frames stay palette-pure.
 */

/** [index name, style swatch name, hex] in index order (the showcase's order). */
export const B1_TABLE = [
  ['VOID', 'void', '#0b090d'],
  ['TUBE', 'tube', '#17131d'],
  ['NIGHT', 'night', '#2a2340'],
  ['DUSK', 'dusk', '#533a5e'],
  ['MAUVE', 'mauve', '#9c5c74'],
  ['WALNUT_D', 'walnutDark', '#2c1a12'],
  ['WALNUT', 'walnut', '#50301e'],
  ['TEAK', 'teak', '#84522c'],
  ['TAN', 'tan', '#bf8d57'],
  ['CREAM', 'cream', '#efd9ae'],
  ['WHITE', 'white', '#fff3dc'],
  ['RUST', 'rust', '#92381a'],
  ['ORANGE', 'orange', '#d9651f'],
  ['GOLD', 'gold', '#eba73a'],
  ['TEAL_D', 'tealDark', '#163c43'],
  ['TEAL', 'teal', '#2a8783'],
  ['AQUA', 'aqua', '#82c9b5'],
  ['OLIVE_D', 'oliveDark', '#39401a'],
  ['AVOCADO', 'avocado', '#77812d'],
  ['GREY_D', 'greyDark', '#403d47'],
  ['GREY', 'grey', '#8a8591'],
  ['BLUE', 'blue', '#4a68bd'],
  ['CRIMSON', 'crimson', '#e3304a'],
] as const;

type Row = (typeof B1_TABLE)[number];
export type B1ColorName = Row[0];
export type B1SwatchName = Row[1];

/** Number of inks. */
export const INKS = B1_TABLE.length;

/** Palette index by ink name. */
export const C = Object.freeze(
  Object.fromEntries(B1_TABLE.map(([name], index) => [name, index])) as Record<B1ColorName, number>,
);

/** Index of a transparent pixel in scratch layers (glass, HUD band copies). */
export const T = 255;

/** Style swatch names in index order (the colour names of the scene API). */
export const B1_SWATCHES: readonly B1SwatchName[] = B1_TABLE.map(([, swatch]) => swatch);

/** Swatch name -> palette index, undefined for unknown names. */
export function colorOfSwatch(name: string): number | undefined {
  const index = B1_SWATCHES.indexOf(name as B1SwatchName);
  return index < 0 ? undefined : index;
}

/** A lookup table index -> index (identity except the pairs given by ink name). */
export type Lut = Uint8Array;

function lut(pairs: Partial<Record<B1ColorName, B1ColorName>>): Lut {
  const out = new Uint8Array(256);
  for (let i = 0; i < 256; i += 1) out[i] = i;
  for (const [from, to] of Object.entries(pairs) as [B1ColorName, B1ColorName][])
    out[C[from]] = C[to];
  return out;
}

/** One step down each ramp: scanlines, shadows, tube falloff. */
export const SCAN = lut({
  TUBE: 'VOID',
  NIGHT: 'TUBE',
  DUSK: 'NIGHT',
  MAUVE: 'DUSK',
  WALNUT_D: 'VOID',
  WALNUT: 'WALNUT_D',
  TEAK: 'WALNUT',
  TAN: 'TEAK',
  CREAM: 'TAN',
  WHITE: 'CREAM',
  RUST: 'WALNUT',
  ORANGE: 'RUST',
  GOLD: 'ORANGE',
  TEAL_D: 'TUBE',
  TEAL: 'TEAL_D',
  AQUA: 'TEAL',
  OLIVE_D: 'WALNUT_D',
  AVOCADO: 'OLIVE_D',
  GREY_D: 'TUBE',
  GREY: 'GREY_D',
  BLUE: 'NIGHT',
  CRIMSON: 'RUST',
});

/** NTSC colour bleed: the chroma that smears right onto dark pixels (-1 = none). */
export const BLEED = new Int16Array(256).fill(-1);
for (const [from, to] of [
  ['ORANGE', 'RUST'],
  ['GOLD', 'RUST'],
  ['CRIMSON', 'RUST'],
  ['TEAL', 'TEAL_D'],
  ['AQUA', 'TEAL_D'],
  ['BLUE', 'NIGHT'],
  ['AVOCADO', 'OLIVE_D'],
  ['MAUVE', 'DUSK'],
  ['TAN', 'WALNUT'],
  ['CREAM', 'WALNUT'],
] as const)
  BLEED[C[from]] = C[to];

/** Dark inks (bleed targets, burn-in ghosts show only on them). */
export const DARK = new Uint8Array(256);
for (const name of ['VOID', 'TUBE', 'NIGHT', 'WALNUT_D', 'TEAL_D', 'OLIVE_D', 'GREY_D'] as const)
  DARK[C[name]] = 1;

/** Burn-in: a ghost lifts dark glass one step. */
export const GHOST = lut({ VOID: 'TUBE', TUBE: 'NIGHT', WALNUT_D: 'WALNUT', NIGHT: 'DUSK' });

/** Hit flash: dark inks flash cream, everything else goes black (one frame). */
export const FLASH = (() => {
  const out = new Uint8Array(256);
  for (let i = 0; i < 256; i += 1) out[i] = i < INKS ? (DARK[i] === 1 ? C.CREAM : C.VOID) : i;
  return out;
})();

/** The crash: everything drains toward the dark end of its ramp. */
export const DRAIN = lut({
  NIGHT: 'TUBE',
  DUSK: 'GREY_D',
  MAUVE: 'GREY_D',
  WALNUT_D: 'TUBE',
  WALNUT: 'GREY_D',
  TEAK: 'GREY_D',
  TAN: 'GREY_D',
  CREAM: 'GREY',
  WHITE: 'GREY',
  RUST: 'GREY_D',
  ORANGE: 'GREY_D',
  GOLD: 'GREY',
  TEAL_D: 'TUBE',
  TEAL: 'GREY_D',
  AQUA: 'GREY',
  OLIVE_D: 'TUBE',
  AVOCADO: 'GREY_D',
  BLUE: 'GREY_D',
  CRIMSON: 'GREY_D',
});

/** 2600 attract mode: an idle picture keeps its shapes while its hues step round the wheel. */
export const CYCLE: readonly Lut[] = [
  lut({
    RUST: 'TEAL_D',
    ORANGE: 'TEAL',
    GOLD: 'AQUA',
    CRIMSON: 'BLUE',
    TAN: 'TEAL',
    CREAM: 'AQUA',
    WHITE: 'AQUA',
    TEAK: 'TEAL_D',
    WALNUT: 'NIGHT',
    WALNUT_D: 'TUBE',
    AVOCADO: 'BLUE',
    OLIVE_D: 'NIGHT',
    MAUVE: 'TEAL',
    DUSK: 'TEAL_D',
    TEAL: 'BLUE',
    AQUA: 'GREY',
    BLUE: 'DUSK',
    GREY: 'AQUA',
  }),
  lut({
    RUST: 'DUSK',
    ORANGE: 'MAUVE',
    GOLD: 'MAUVE',
    CRIMSON: 'MAUVE',
    TAN: 'MAUVE',
    CREAM: 'GREY',
    WHITE: 'CREAM',
    TEAK: 'DUSK',
    WALNUT: 'NIGHT',
    WALNUT_D: 'TUBE',
    AVOCADO: 'DUSK',
    OLIVE_D: 'TUBE',
    TEAL: 'DUSK',
    TEAL_D: 'NIGHT',
    AQUA: 'MAUVE',
    BLUE: 'DUSK',
    GREY: 'MAUVE',
    MAUVE: 'GREY',
    DUSK: 'NIGHT',
  }),
  lut({
    RUST: 'OLIVE_D',
    ORANGE: 'AVOCADO',
    GOLD: 'AVOCADO',
    CRIMSON: 'RUST',
    TAN: 'AVOCADO',
    CREAM: 'TAN',
    WHITE: 'TAN',
    TEAK: 'OLIVE_D',
    WALNUT: 'WALNUT_D',
    AVOCADO: 'TEAK',
    TEAL: 'AVOCADO',
    TEAL_D: 'OLIVE_D',
    AQUA: 'TAN',
    BLUE: 'OLIVE_D',
    GREY: 'TAN',
    MAUVE: 'TEAK',
    DUSK: 'WALNUT_D',
    NIGHT: 'TUBE',
  }),
];

/**
 * HUD ink on paper: where the instruction manual covers the frame the HUD prints in the paper's
 * key ink instead of its light glass colours (the year and slots stay readable on cream).
 */
export const INK_FLIP = lut({
  TAN: 'WALNUT_D',
  CREAM: 'WALNUT_D',
  WHITE: 'WALNUT_D',
  GREY: 'WALNUT_D',
  GREY_D: 'TEAK',
  GOLD: 'RUST',
  TUBE: 'TAN',
});

/** Paper ageing and stains of the printed manual (a step down the warm ramp). */
export const AGE = lut({ CREAM: 'TAN', WHITE: 'CREAM' });
export const STAIN = lut({ CREAM: 'TAN', WHITE: 'TAN', TAN: 'TEAK', TEAL: 'TEAL_D' });
export const RIM = lut({ CREAM: 'TEAK', WHITE: 'TAN', TAN: 'TEAK', TEAL: 'TEAL_D' });

/** The LUTs the engine's game-native transitions apply to whole frames (index -> index). */
export const GAME_B1_LUTS = { scan: SCAN, flash: FLASH, cycle: CYCLE } as const;

/** Named whole-picture remaps of the scene API (`g.remap(name)`). */
export const REMAPS = {
  dim: SCAN,
  flash: FLASH,
  drain: DRAIN,
  ghost: GHOST,
  cycle1: CYCLE[0] ?? SCAN,
  cycle2: CYCLE[1] ?? SCAN,
  cycle3: CYCLE[2] ?? SCAN,
} as const;

export type RemapName = keyof typeof REMAPS;
export const REMAP_NAMES = Object.keys(REMAPS) as readonly RemapName[];
