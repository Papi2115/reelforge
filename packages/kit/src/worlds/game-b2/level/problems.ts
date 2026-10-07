/**
 * What the level schema cannot express: grid shape, a closed border (indoors), doors between two
 * walls, placements inside open cells, label widths of the pixel face, decorations only the
 * built-in textures carry, tall walls only outdoors, unique ids. Every message names the grid row
 * or the field and says what to change.
 */
import { textWidth, unsupportedChars } from '../core/font.js';
import {
  FLOOR_TEXTURES,
  isBuiltInSprite,
  isBuiltInWall,
  isDoor,
  isWall,
  legendOf,
  lowWallHeight,
  MAX_GRID,
  type BuiltInSprite,
  type KnownAssets,
  type LegendEntry,
  type Level,
} from './schema.js';

function labelProblems(text: string, where: string, maxWidth: number): string[] {
  const bad = unsupportedChars(text);
  const out =
    bad.length > 0
      ? [`${where}: "${text}" has characters the pixel face cannot draw: ${bad.join(' ')}`]
      : [];
  if (maxWidth === 0) out.push(`${where}: this sprite carries no label`);
  else if (textWidth(text) > maxWidth)
    out.push(
      `${where}: "${text}" is too long for it (max ${String(maxWidth)} px wide; shorten it)`,
    );
  return out;
}

function gridProblems(level: Level): string[] {
  const out: string[] = [];
  const width = level.grid[0]?.length ?? 0;
  const outdoor = level.sky !== undefined;
  if (width < 3 || width > MAX_GRID)
    out.push(`grid: rows must be 3-${String(MAX_GRID)} cells wide (row 0 has ${String(width)})`);
  for (const ch of Object.keys(level.legend))
    if (ch.length !== 1) out.push(`legend: key ${JSON.stringify(ch)} must be one character`);
  level.grid.forEach((row, y) => {
    if (row.length !== width)
      out.push(
        `grid row ${String(y)}: ${String(row.length)} cells, expected ${String(width)} like row 0`,
      );
    for (let x = 0; x < row.length; x += 1) {
      const ch = row.charAt(x);
      const entry = legendOf(level, ch);
      if (entry === undefined)
        out.push(`grid row ${String(y)}: "${ch}" at x=${String(x)} is not in the legend`);
      const edge = x === 0 || y === 0 || x === width - 1 || y === level.grid.length - 1;
      if (edge && !outdoor && entry !== undefined && !isWall(entry))
        out.push(
          `grid row ${String(y)}: cell x=${String(x)} is on the border and must be a wall (close the level)`,
        );
    }
  });
  return out;
}

function cellAt(level: Level, x: number, y: number): LegendEntry | undefined {
  const ch = level.grid[y]?.[x];
  return ch === undefined ? undefined : legendOf(level, ch);
}

function doorProblems(level: Level): string[] {
  const out: string[] = [];
  level.grid.forEach((row, y) => {
    for (let x = 0; x < row.length; x += 1) {
      if (!isDoor(legendOf(level, row.charAt(x)))) continue;
      const across = isWall(cellAt(level, x, y - 1)) && isWall(cellAt(level, x, y + 1));
      const along = isWall(cellAt(level, x - 1, y)) && isWall(cellAt(level, x + 1, y));
      if (across === along)
        out.push(
          `grid row ${String(y)}: door at x=${String(x)} needs walls on exactly two opposite sides (above+below or left+right)`,
        );
    }
  });
  return out;
}

function placeProblems(level: Level, what: string, at: readonly [number, number]): string[] {
  const [x, y] = at;
  const entry = cellAt(level, Math.floor(x), Math.floor(y));
  if (entry === undefined) return [`${what}: pos [${String(x)}, ${String(y)}] is outside the grid`];
  if (isWall(entry) && (entry.height ?? lowWallHeight(entry.wall) ?? 1) < 1) return [];
  if (isWall(entry) || isDoor(entry))
    return [
      `${what}: pos [${String(x)}, ${String(y)}] is inside a ${isDoor(entry) ? 'door' : 'wall'} cell; move it into an open cell`,
    ];
  return [];
}

function wallProblems(level: Level): string[] {
  return Object.entries(level.legend).flatMap(([ch, entry]) => {
    if (!isWall(entry)) return [];
    const where = `legend "${ch}"`;
    const out: string[] = [];
    if (!isBuiltInWall(entry.wall)) {
      const decor = (['label', 'chalk', 'pinned', 'count', 'crossed'] as const).filter(
        (key) => entry[key] !== undefined,
      );
      if (decor.length > 0)
        out.push(
          `${where}: ${decor.join(', ')} only decorate the built-in wall textures; draw it into your texture "${entry.wall}" instead`,
        );
    }
    if ((entry.height ?? 0) > 1 && level.sky === undefined)
      out.push(
        `${where}.height: ${String(entry.height)} is taller than the ceiling (1); walls over 1 need an outdoor level (sky)`,
      );
    if (entry.label !== undefined) out.push(...labelProblems(entry.label, `${where}.label`, 20));
    return out;
  });
}

/** Widest label (px of the pixel face) each built-in sprite can carry. */
const LABEL_WIDTH: Readonly<Record<BuiltInSprite, number>> = {
  'sand-pile': 20,
  carton: 22,
  pallet: 18,
  desk: 0,
  clerk: 0,
  sign: 42,
  exit: 20,
  boxes: 0,
  item: 20,
  card: 24,
  bin: 0,
};

function voidProblems(level: Level): string[] {
  if (level.sky !== undefined) return [];
  return Object.entries(level.legend).flatMap(([ch, entry]) =>
    'floor' in entry && (entry.floor === 'none' || entry.ceiling === 'none')
      ? [`legend "${ch}": floor / ceiling 'none' (open void or sky) needs an outdoor level (sky)`]
      : [],
  );
}

function skyProblems(level: Level, ids: KnownAssets): string[] {
  const ground = level.sky?.ground;
  if (ground === undefined || ground === 'none' || ids.textures.has(ground)) return [];
  return (FLOOR_TEXTURES as readonly string[]).includes(ground)
    ? []
    : [
        `sky.ground: unknown texture "${ground}" (a floor texture, 'none', or an id of assets.textures)`,
      ];
}

/** Problems a schema cannot express: grid shape, closed border, doors, placements, labels. */
export function levelProblems(level: Level, ids: KnownAssets): string[] {
  const out = [
    ...gridProblems(level),
    ...doorProblems(level),
    ...wallProblems(level),
    ...skyProblems(level, ids),
    ...voidProblems(level),
  ];
  level.lights.forEach((light, i) =>
    out.push(...placeProblems(level, `lights[${String(i)}]`, light.pos)),
  );
  level.sprites.forEach((entry, i) => {
    out.push(...placeProblems(level, `sprites[${String(i)}] (${entry.sprite})`, entry.pos));
    if (entry.label !== undefined)
      out.push(
        ...labelProblems(
          entry.label,
          `sprites[${String(i)}].label`,
          isBuiltInSprite(entry.sprite) ? LABEL_WIDTH[entry.sprite] : 0,
        ),
      );
  });
  const named = [...level.lights, ...level.sprites].flatMap((entry) =>
    entry.id === undefined ? [] : [entry.id],
  );
  const repeated = named.filter((id, i) => named.indexOf(id) !== i);
  if (repeated.length > 0) out.push(`ids must be unique: ${[...new Set(repeated)].join(', ')}`);
  return out;
}
