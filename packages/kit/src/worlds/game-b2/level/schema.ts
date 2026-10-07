/**
 * The Game B2 level format (PLAN.md#13.4): what the runtime Claude writes for one location. A
 * compact text grid (rows top to bottom, x right, y down, one character per 1x1 cell), a legend
 * of wall / door / floor characters, a mood (light and fog) and up to 12 lights and 40 sprites.
 * `checkLevel` validates it with readable, located errors (`grid row 3: ...`).
 */
import { z } from 'zod';
import { textWidth, unsupportedChars } from '../core/font.js';
import { B2_SWATCHES, type B2SwatchName } from '../palette.js';

export const MAX_GRID = 32;
export const MAX_SPRITES = 40;
export const MAX_LIGHTS = 12;

export const WALL_TEXTURES = [
  'concrete',
  'wood-panel',
  'cubicle',
  'shelf',
  'shelf-end',
  'corrugated',
  'cinderblock',
  'counter',
  'store-shelf',
] as const;
export const FLOOR_TEXTURES = [
  'concrete',
  'concrete-sand',
  'carpet',
  'warehouse',
  'warehouse-line',
  'tile',
  'tile-big',
  'sand',
] as const;
export const CEILING_TEXTURES = [
  'dark',
  'office',
  'office-light',
  'warehouse',
  'warehouse-tube',
  'grey',
  'grey-tube',
] as const;
export const MOODS = ['dark', 'tungsten', 'fluorescent', 'shop', 'backroom'] as const;
export const SPRITE_KINDS = [
  'sand-pile',
  'carton',
  'pallet',
  'desk',
  'clerk',
  'sign',
  'exit',
  'boxes',
  'item',
  'card',
  'bin',
] as const;

/** Default heights of the low walls (sprites may stand on them: stacks on a counter). */
export const LOW_WALLS: Readonly<Partial<Record<(typeof WALL_TEXTURES)[number], number>>> = {
  cubicle: 0.55,
  counter: 0.42,
};

const known = (list: readonly string[]): string => list.join(', ');
const pick = <const T extends readonly [string, ...string[]]>(list: T, what: string) =>
  z.enum(list, {
    error: (issue) => `unknown ${what} ${JSON.stringify(issue.input)} (known: ${known(list)})`,
  });

const label = z.string().min(1).max(12).describe('Real words of the shot only (stencils, signs)');
const SWATCHES = B2_SWATCHES as readonly [B2SwatchName, ...B2SwatchName[]];
const swatch = z.enum(SWATCHES, {
  error: (issue) =>
    `unknown colour ${JSON.stringify(issue.input)} (a game-b2 swatch, e.g. pink, tan)`,
});
const pos = z
  .tuple([z.number(), z.number()])
  .describe('[x, y] in cells (0.5 = the middle of cell 0)');

export const wallCellSchema = z.strictObject({
  wall: pick(WALL_TEXTURES, 'wall texture'),
  label: label
    .optional()
    .describe('Stencil on cartons (shelf) or the aisle sign (shelf-end), <= 4 letters'),
  chalk: z.enum(['tally', 'arrow', 'cross']).optional().describe('Chalk mark on concrete'),
  count: z.int().min(1).max(9).optional().describe('Strokes of a chalk tally'),
  pinned: z.enum(['calendar', 'poster']).optional().describe('Pinned on wood-panel'),
  crossed: z.int().min(0).max(35).optional().describe('Days crossed on a pinned calendar'),
  height: z
    .number()
    .min(0.2)
    .max(1)
    .optional()
    .describe('Wall height (1 = ceiling; cubicle 0.55, counter 0.42)'),
  cap: swatch.optional().describe('Colour of the top of a low wall'),
});

export const doorCellSchema = z.strictObject({
  door: z
    .literal(true)
    .describe('A sliding door; walls on two opposite sides; open it with view.open()'),
});

export const openCellSchema = z.strictObject({
  floor: pick(FLOOR_TEXTURES, 'floor texture').optional(),
  ceiling: pick(CEILING_TEXTURES, 'ceiling texture').optional(),
  flicker: z.boolean().optional().describe("A tube ceiling that follows the level's faulty tube"),
  mood: pick(MOODS, 'mood')
    .optional()
    .describe(
      "This cell's room mood (default the level's): a dark corridor opening onto a tungsten office",
    ),
});

export const legendEntrySchema = z.union([wallCellSchema, doorCellSchema, openCellSchema]);

export const lightSchema = z.strictObject({
  id: z.string().min(1).max(24).optional(),
  pos,
  z: z.number().min(0).max(1).default(0.95).describe('Height (0 floor, 1 ceiling)'),
  power: z.number().min(0).max(2).default(0.9),
  radius: z.number().min(0.5).max(8).default(3.6),
  flicker: z
    .enum(['none', 'tube', 'bulb'])
    .default('none')
    .describe('tube = the faulty tube cadence'),
  bulb: z.boolean().default(false).describe('Draw a hanging bulb at the light (sways a little)'),
});

export const spriteSchema = z.strictObject({
  id: z.string().min(1).max(24).optional().describe('Name for view.act()'),
  sprite: pick(SPRITE_KINDS, 'sprite'),
  pos,
  z: z.number().min(-1).max(1).optional().describe('Height of its foot above the floor'),
  w: z.number().min(0.05).max(3).optional().describe('World width (default per sprite)'),
  h: z.number().min(0.05).max(2).optional().describe('World height (default per sprite)'),
  label: label.optional(),
  band: swatch.optional().describe('Label band of an item: pink = THE item of the story'),
  person: z.boolean().optional().describe('desk: a worker at it, seen from behind'),
  seed: z.int().min(0).optional(),
  tilt: z.number().min(-15).max(15).optional().describe('card: tilt in degrees'),
});

export const levelSchema = z.strictObject({
  name: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'level names are kebab case, e.g. warehouse'),
  seed: z.int().min(0).optional(),
  mood: pick(MOODS, 'mood').default('dark'),
  density: z.number().min(0).max(0.5).optional().describe('Fog density (default from the mood)'),
  ambient: z.number().min(0).max(1.2).optional().describe('Ambient light (default from the mood)'),
  floor: pick(FLOOR_TEXTURES, 'floor texture').default('concrete'),
  ceiling: pick(CEILING_TEXTURES, 'ceiling texture').default('dark'),
  grid: z.array(z.string()).min(3).max(MAX_GRID),
  legend: z.record(z.string(), legendEntrySchema),
  lights: z.array(lightSchema).max(MAX_LIGHTS).default([]),
  sprites: z.array(spriteSchema).max(MAX_SPRITES).default([]),
});

export type LevelInput = z.input<typeof levelSchema>;
export type Level = z.output<typeof levelSchema>;
export type LegendEntry = z.output<typeof legendEntrySchema>;
export type WallCell = z.output<typeof wallCellSchema>;
export type LightSpec = z.output<typeof lightSchema>;
export type SpriteSpec = z.output<typeof spriteSchema>;

export function isWall(entry: LegendEntry | undefined): entry is WallCell {
  return entry !== undefined && 'wall' in entry;
}

export function isDoor(entry: LegendEntry | undefined): boolean {
  return entry !== undefined && 'door' in entry;
}

/** Legend entry of a character ('.' and ' ' are open cells unless the legend says otherwise). */
export function legendOf(level: Level, ch: string): LegendEntry | undefined {
  return level.legend[ch] ?? (ch === '.' || ch === ' ' ? {} : undefined);
}

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
      if (edge && entry !== undefined && !isWall(entry))
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
  if (isWall(entry) && (entry.height ?? LOW_WALLS[entry.wall] ?? 1) < 1) return [];
  if (isWall(entry) || isDoor(entry))
    return [
      `${what}: pos [${String(x)}, ${String(y)}] is inside a ${isDoor(entry) ? 'door' : 'wall'} cell; move it into an open cell`,
    ];
  return [];
}

function wallLabelProblems(level: Level): string[] {
  return Object.entries(level.legend).flatMap(([ch, entry]) => {
    if (!isWall(entry) || entry.label === undefined) return [];
    return labelProblems(entry.label, `legend "${ch}".label`, 20);
  });
}

/** Widest label (px of the pixel face) each sprite can carry. */
const LABEL_WIDTH: Readonly<Record<(typeof SPRITE_KINDS)[number], number>> = {
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

/** Problems a schema cannot express: grid shape, closed border, doors, placements, labels. */
export function levelProblems(level: Level): string[] {
  const out = [...gridProblems(level), ...doorProblems(level), ...wallLabelProblems(level)];
  level.lights.forEach((light, i) =>
    out.push(...placeProblems(level, `lights[${String(i)}]`, light.pos)),
  );
  level.sprites.forEach((entry, i) => {
    out.push(...placeProblems(level, `sprites[${String(i)}] (${entry.sprite})`, entry.pos));
    if (entry.label !== undefined)
      out.push(
        ...labelProblems(entry.label, `sprites[${String(i)}].label`, LABEL_WIDTH[entry.sprite]),
      );
  });
  const ids = [...level.lights, ...level.sprites].flatMap((entry) =>
    entry.id === undefined ? [] : [entry.id],
  );
  const repeated = ids.filter((id, i) => ids.indexOf(id) !== i);
  if (repeated.length > 0) out.push(`ids must be unique: ${[...new Set(repeated)].join(', ')}`);
  return out;
}

export type LevelCheck =
  | { readonly ok: true; readonly level: Level }
  | { readonly ok: false; readonly errors: readonly string[] };

function issueLines(prefix: string, error: z.ZodError): string[] {
  return error.issues.map((issue) => {
    const at = [prefix, ...issue.path.map(String)].filter((part) => part !== '').join('.');
    return `${at || '(level)'}: ${issue.message}`;
  });
}

/** A legend entry is checked by its kind (wall / door / open), so errors name the real field. */
function legendErrors(input: unknown): string[] {
  if (typeof input !== 'object' || input === null || !('legend' in input)) return [];
  const legend = input.legend;
  if (typeof legend !== 'object' || legend === null) return [];
  return Object.entries(legend).flatMap(([ch, entry]: [string, unknown]) => {
    const kind =
      typeof entry === 'object' && entry !== null
        ? 'wall' in entry
          ? wallCellSchema
          : 'door' in entry
            ? doorCellSchema
            : openCellSchema
        : openCellSchema;
    const parsed = kind.safeParse(entry);
    return parsed.success ? [] : issueLines(`legend "${ch}"`, parsed.error);
  });
}

/** Parses and checks a level; errors name the field or grid row. */
export function checkLevel(input: unknown): LevelCheck {
  const legend = legendErrors(input);
  if (legend.length > 0) return { ok: false, errors: legend };
  const parsed = levelSchema.safeParse(input);
  if (!parsed.success) return { ok: false, errors: issueLines('', parsed.error) };
  const errors = levelProblems(parsed.data);
  return errors.length > 0 ? { ok: false, errors } : { ok: true, level: parsed.data };
}
