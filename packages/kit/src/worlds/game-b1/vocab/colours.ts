/**
 * Colour names of the open vocabulary (PLAN.md#13.15): the 23 game-b1 inks only, with readable
 * hints for the everyday names an author reaches for first ("green" -> avocado, oliveDark). A
 * colour table is one name, one name per row, or row stops `{ "0": "tan", "3": "teal" }` (from
 * row 0 tan, from row 3 teal): the 2600 changes a sprite's or the playfield's colour once per
 * scanline, never inside one.
 */
import { B1_SWATCHES, colorOfSwatch } from '../palette.js';

/** Everyday colour words -> the inks that play them in this world. */
const HINTS: Readonly<Record<string, readonly string[]>> = {
  green: ['avocado', 'oliveDark', 'teal'],
  darkgreen: ['oliveDark', 'tealDark'],
  red: ['crimson (the point only)', 'rust', 'orange'],
  brown: ['walnut', 'teak', 'walnutDark'],
  yellow: ['gold', 'tan'],
  black: ['void', 'tube'],
  pink: ['mauve'],
  purple: ['dusk', 'mauve'],
  sky: ['blue', 'aqua'],
  lightblue: ['aqua'],
  navy: ['night', 'blue'],
  beige: ['cream', 'tan'],
  skin: ['tan', 'teak', 'cream'],
  silver: ['grey'],
  gray: ['grey', 'greyDark'],
  sand: ['tan', 'cream'],
  water: ['blue', 'teal', 'tealDark'],
};

/** A readable reason when `name` is not an ink, undefined when it is. */
export function colourProblem(name: string): string | undefined {
  if (colorOfSwatch(name) !== undefined) return undefined;
  const key = name.toLowerCase().replace(/[^a-z]/g, '');
  const hint = HINTS[key] ?? B1_SWATCHES.filter((ink) => ink.toLowerCase().includes(key));
  const tail = hint.length > 0 ? `; try ${hint.join(', ')}` : '';
  return `"${name}" is not a game-b1 ink (the 23: ${B1_SWATCHES.join(', ')})${tail}`;
}

export type ColourTable = string | readonly (string | null)[] | Readonly<Record<string, string>>;

/**
 * One colour (or null = row skipped) per row of `rows`, plus the problems found. `what` names the
 * table in messages ("sprite ranger colours").
 */
export function resolveColours(
  table: ColourTable,
  rows: number,
  what: string,
): { readonly colours: (string | null)[]; readonly problems: string[] } {
  const problems: string[] = [];
  const check = (name: string, where: string): void => {
    const problem = colourProblem(name);
    if (problem !== undefined) problems.push(`${what}${where}: ${problem}`);
  };
  if (typeof table === 'string') {
    check(table, '');
    return { colours: Array.from({ length: rows }, () => table), problems };
  }
  if (Array.isArray(table)) {
    const list = table as readonly (string | null)[];
    if (list.length !== rows)
      problems.push(
        `${what}: ${String(list.length)} colours for ${String(rows)} rows; give one per row (the 2600 changes colour once per scanline), one name for all, or row stops { "0": "tan", "3": "teal" }`,
      );
    list.forEach((name, i) => {
      if (name !== null) check(name, `[${String(i)}]`);
    });
    return { colours: Array.from({ length: rows }, (_, i) => list[i] ?? null), problems };
  }
  const stops = Object.entries(table as Readonly<Record<string, string>>)
    .map(([row, name]) => [Number(row), name] as const)
    .sort((a, b) => a[0] - b[0]);
  stops.forEach(([row, name]) => {
    if (!Number.isInteger(row) || row < 0 || row >= rows)
      problems.push(`${what}: stop "${String(row)}" is not a row (0-${String(rows - 1)})`);
    check(name, ` stop ${String(row)}`);
  });
  if (stops[0]?.[0] !== 0) problems.push(`${what}: row stops must start at "0"`);
  const colours: (string | null)[] = [];
  for (let r = 0; r < rows; r += 1) {
    let current: string | null = null;
    for (const [row, name] of stops) if (row <= r) current = name;
    colours.push(current);
  }
  return { colours, problems };
}
