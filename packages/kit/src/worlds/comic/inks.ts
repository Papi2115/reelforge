/**
 * The 22 inks of the Comic world (docs/worlds/comic-panels-v2/NOTES.md): a four-colour job on
 * newsprint (key, process cyan/magenta/yellow, one spot red) plus a duotone sepia set for an older
 * print job. The page renderer paints palette indices (`INK.*`) into an index buffer and maps them
 * to the style's swatches at the end, so every pixel is a palette colour (halftone and dither are
 * patterns of whole inks, never blends).
 */

/** [index name, style swatch name, hex] in index order (the showcase's order). */
export const INK_TABLE = [
  ['INK', 'ink', '#1b1714'],
  ['NIGHT', 'night', '#252a3f'],
  ['PAPER', 'paper', '#f1e5c9'],
  ['SHADE', 'shade', '#dccba5'],
  ['AGED', 'aged', '#b49d76'],
  ['CYAN', 'cyan', '#3e86a0'],
  ['CYAN_D', 'cyanDeep', '#24546a'],
  ['MAG', 'magenta', '#c35a70'],
  ['YEL', 'yellow', '#e2b13b'],
  ['YEL_P', 'yellowPale', '#efd690'],
  ['RED', 'red', '#d8381f'],
  ['GREY_L', 'greyLight', '#aaa497'],
  ['GREY_M', 'greyMid', '#7a7569'],
  ['GREY_D', 'greyDark', '#4c4840'],
  ['GREEN', 'phosphor', '#93c86b'],
  ['PENCIL', 'pencil', '#8b8d94'],
  ['SEP_PAPER', 'sepiaPaper', '#e3cc98'],
  ['SEP_FIBRE', 'sepiaFibre', '#cfb27f'],
  ['SEP_TAN', 'sepiaTan', '#a9875c'],
  ['SEP_MID', 'sepiaMid', '#7a5a3c'],
  ['SEP_INK', 'sepiaInk', '#3f2a1c'],
  ['SEP_RED', 'sepiaRed', '#a8432b'],
] as const;

type InkRow = (typeof INK_TABLE)[number];
export type InkName = InkRow[0];
export type SwatchName = InkRow[1];

/** Palette index by ink name. */
export const INK = Object.freeze(
  Object.fromEntries(INK_TABLE.map(([name], index) => [name, index])) as Record<InkName, number>,
);

/** Style swatch names in index order (the colour names scenes use). */
export const SWATCH_NAMES: readonly SwatchName[] = INK_TABLE.map(([, swatch]) => swatch);

/** Style swatch name -> palette index; undefined for unknown names. */
export function inkOfSwatch(name: string): number | undefined {
  const index = SWATCH_NAMES.indexOf(name as SwatchName);
  return index < 0 ? undefined : index;
}

/**
 * Printing plate(s) each ink needs, for the press intro (`page.press`): K key, C cyan, M magenta,
 * Y yellow; '-' = paper and sepia inks, never held back.
 */
const PLATES: Readonly<Record<InkName, string>> = {
  INK: 'K',
  NIGHT: 'CK',
  PAPER: '-',
  SHADE: '-',
  AGED: '-',
  CYAN: 'C',
  CYAN_D: 'C',
  MAG: 'M',
  YEL: 'Y',
  YEL_P: 'Y',
  RED: 'M',
  GREY_L: 'K',
  GREY_M: 'K',
  GREY_D: 'K',
  GREEN: 'CY',
  PENCIL: 'K',
  SEP_PAPER: '-',
  SEP_FIBRE: '-',
  SEP_TAN: '-',
  SEP_MID: '-',
  SEP_INK: '-',
  SEP_RED: '-',
};

/** A 32-entry index remap. */
export type Remap = Uint8Array;

function identity(): Remap {
  const table = new Uint8Array(32);
  for (let index = 0; index < 32; index += 1) table[index] = index;
  return table;
}

/**
 * The older print job of a flashback (`page.flashback`, showcase shot 3): every newsprint ink
 * re-inked as the duotone sepia set (brown key, one tan tint on yellowed stock); red becomes the
 * rubber-stamp red, the sepia inks stay. A remap, not a filter: the page stays palette-pure.
 */
export const SEPIA: Remap = (() => {
  const table = identity();
  const to: readonly (readonly [InkName, InkName])[] = [
    ['INK', 'SEP_INK'],
    ['NIGHT', 'SEP_INK'],
    ['PAPER', 'SEP_PAPER'],
    ['SHADE', 'SEP_FIBRE'],
    ['AGED', 'SEP_TAN'],
    ['CYAN', 'SEP_TAN'],
    ['CYAN_D', 'SEP_MID'],
    ['MAG', 'SEP_MID'],
    ['YEL', 'SEP_TAN'],
    ['YEL_P', 'SEP_FIBRE'],
    ['RED', 'SEP_RED'],
    ['GREY_L', 'SEP_FIBRE'],
    ['GREY_M', 'SEP_TAN'],
    ['GREY_D', 'SEP_MID'],
    ['GREEN', 'SEP_TAN'],
    ['PENCIL', 'SEP_MID'],
  ];
  for (const [from, into] of to) table[INK[from]] = INK[into];
  return table;
})();

/** Paper-like inks (paper, shade, aged, pale caption yellow, sepia stock): shadows touch these. */
const PAPERLIKE_INKS: readonly InkName[] = [
  'PAPER',
  'SHADE',
  'AGED',
  'YEL_P',
  'SEP_PAPER',
  'SEP_FIBRE',
];

/**
 * The ink table for code outside the page renderer (the engine's panel-native transitions): the
 * inks in index order and which of them are paper-like.
 */
export const COMIC_INKS = Object.freeze({
  table: INK_TABLE,
  paperlike: Uint8Array.from(INK_TABLE, ([name]) => (PAPERLIKE_INKS.includes(name) ? 1 : 0)),
});

/**
 * Remap that shows only the plates printed so far (`printed` = e.g. 'YC'): an ink whose plates
 * are not all down falls back to what is (night on cyan alone = deep cyan, phosphor on yellow
 * alone = pale yellow) or to paper.
 */
export function plateRemap(printed: string): Remap {
  const table = identity();
  INK_TABLE.forEach(([name], index) => {
    const need = PLATES[name];
    if (need === '-' || Array.from(need).every((plate) => printed.includes(plate))) return;
    if (name === 'NIGHT' && printed.includes('C')) table[index] = INK.CYAN_D;
    else if (name === 'GREEN' && printed.includes('Y')) table[index] = INK.YEL_P;
    else table[index] = INK.PAPER;
  });
  return table;
}
