/**
 * The 24 inks of the Sketchbook world (docs/worlds/sketchbook/NOTES.md): one notebook, five pens,
 * four pencils. The page renderer paints palette indices (`INK.*`) into an index buffer and maps
 * them to the style's swatches at the end, so every pixel is a palette colour (no dither, no
 * halftone: paper shading uses the flat SOFT/HARD remaps below).
 */

/** [index name, style swatch name, hex] in index order. */
export const INK_TABLE = [
  ['PAPER', 'paper', '#f4eedb'],
  ['FIBRE', 'fibre', '#e6ddc4'],
  ['SHADE', 'shade', '#cbbd9d'],
  ['RULE', 'rule', '#a8c2d6'],
  ['MARGIN', 'margin', '#e6a4a1'],
  ['GRID', 'grid', '#bfd6cc'],
  ['GRAPH_L', 'graphiteLight', '#a09b92'],
  ['GRAPHITE', 'graphite', '#5e5a55'],
  ['INK', 'ink', '#1d1b20'],
  ['BIC', 'bic', '#2b48a1'],
  ['BIC_L', 'bicLight', '#7189c6'],
  ['RED', 'red', '#d8342b'],
  ['HILITE', 'highlighter', '#e6ef5a'],
  ['STICKY', 'sticky', '#f6d86c'],
  ['STICKY_D', 'stickyDark', '#d9b74e'],
  ['GREEN', 'green', '#6b9a47'],
  ['ORANGE', 'orange', '#e48a35'],
  ['SKY', 'skyPencil', '#88b6d6'],
  ['PURPLE', 'purple', '#8a5c9c'],
  ['COFFEE', 'coffee', '#a8744c'],
  ['COFFEE_L', 'coffeeLight', '#dcbf98'],
  ['KRAFT', 'kraft', '#d2b386'],
  ['KRAFT_D', 'kraftDark', '#b19064'],
  ['DESK', 'desk', '#46332a'],
] as const;

type InkRow = (typeof INK_TABLE)[number];
export type InkName = InkRow[0];
export type SwatchName = InkRow[1];

/** Palette index by ink name. */
export const INK = Object.freeze(
  Object.fromEntries(INK_TABLE.map(([name], index) => [name, index])) as Record<InkName, number>,
);

/** Style swatch names in index order. */
export const SWATCH_NAMES: readonly SwatchName[] = INK_TABLE.map(([, swatch]) => swatch);

/** Style swatch name -> palette index (colour options of the page API). */
export function inkOfSwatch(name: string): number | undefined {
  const index = SWATCH_NAMES.indexOf(name as SwatchName);
  return index < 0 ? undefined : index;
}

/** A 32-entry index remap (identity except the listed pairs). */
export type Remap = Uint8Array;

function remap(pairs: readonly (readonly [InkName, InkName])[]): Remap {
  const table = new Uint8Array(32);
  for (let index = 0; index < 32; index += 1) table[index] = index;
  for (const [from, to] of pairs) table[INK[from]] = INK[to];
  return table;
}

/** Paper-like inks: the highlighter and soft shadows only touch these (ink stays on top). */
export const PAPERLIKE: Uint8Array = (() => {
  const table = new Uint8Array(32);
  const names: readonly InkName[] = [
    'PAPER',
    'FIBRE',
    'SHADE',
    'RULE',
    'MARGIN',
    'GRID',
    'KRAFT',
    'KRAFT_D',
    'STICKY',
    'STICKY_D',
    'COFFEE_L',
    'HILITE',
  ];
  for (const name of names) table[INK[name]] = 1;
  return table;
})();

/** Soft cast shadow (pen, hand, lifted paper). */
export const SOFT: Remap = remap([
  ['PAPER', 'FIBRE'],
  ['FIBRE', 'SHADE'],
  ['RULE', 'BIC_L'],
  ['GRID', 'SHADE'],
  ['MARGIN', 'COFFEE_L'],
  ['KRAFT', 'KRAFT_D'],
  ['STICKY', 'STICKY_D'],
  ['HILITE', 'STICKY'],
  ['COFFEE_L', 'KRAFT'],
  ['SHADE', 'GRAPH_L'],
  ['KRAFT_D', 'COFFEE'],
]);

/** Firmer shadow (stacked inserts, wire, clips). */
export const HARD: Remap = remap([
  ['PAPER', 'SHADE'],
  ['FIBRE', 'SHADE'],
  ['RULE', 'BIC_L'],
  ['GRID', 'GRAPH_L'],
  ['MARGIN', 'COFFEE'],
  ['KRAFT', 'KRAFT_D'],
  ['KRAFT_D', 'COFFEE'],
  ['STICKY', 'STICKY_D'],
  ['SHADE', 'GRAPH_L'],
  ['COFFEE_L', 'KRAFT_D'],
  ['HILITE', 'STICKY_D'],
  ['GRAPH_L', 'GRAPHITE'],
]);

/** Clear tape: a faint lift of the paper underneath. */
export const TAPE: Remap = remap([
  ['PAPER', 'FIBRE'],
  ['FIBRE', 'FIBRE'],
  ['KRAFT', 'COFFEE_L'],
  ['KRAFT_D', 'KRAFT'],
  ['RULE', 'GRID'],
  ['GRID', 'FIBRE'],
]);
