/**
 * The Game B2 level format (PLAN.md#13.4, open vocabulary #13.15): what the runtime Claude writes
 * for one location. A compact text grid (rows top to bottom, x right, y down, one character per
 * 1x1 cell), a legend of wall / door / floor characters, a mood (light and fog) and up to 12
 * lights and 40 sprites; optionally a `sky` (outdoor level). Walls, floors, ceilings and sprites
 * name the built-in textures / sprites or the film's own assets (`kit.fx.b2View({ assets })`),
 * so `checkLevel(level, known)` takes the ids the assets define. Errors are readable and located
 * (`grid row 3: ...`).
 */
import { z } from 'zod';
import { B2_SWATCHES, type B2SwatchName } from '../palette.js';
import { levelProblems } from './problems.js';
import { skySchema } from './sky.js';

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
export type BuiltInSprite = (typeof SPRITE_KINDS)[number];
export type BuiltInWall = (typeof WALL_TEXTURES)[number];

/** Default heights of the low walls (sprites may stand on them: stacks on a counter). */
export const LOW_WALLS: Readonly<Partial<Record<BuiltInWall, number>>> = {
  cubicle: 0.55,
  counter: 0.42,
};

/** Ids the film's asset packs define (a Set or the asset Map). */
export interface IdSet {
  has(id: string): boolean;
  keys(): Iterable<string>;
}

export interface KnownAssets {
  readonly sprites: IdSet;
  readonly textures: IdSet;
}

export const NO_ASSETS: KnownAssets = { sprites: new Set<string>(), textures: new Set<string>() };

export function isBuiltInSprite(name: string): name is BuiltInSprite {
  return (SPRITE_KINDS as readonly string[]).includes(name);
}

export function isBuiltInWall(name: string): name is BuiltInWall {
  return (WALL_TEXTURES as readonly string[]).includes(name);
}

/** Height of a low built-in wall (undefined = full height). */
export function lowWallHeight(wall: string): number | undefined {
  return isBuiltInWall(wall) ? LOW_WALLS[wall] : undefined;
}

const known = (list: readonly string[]): string => list.join(', ');
const pick = <const T extends readonly [string, ...string[]]>(list: T, what: string) =>
  z.enum(list, {
    error: (issue) => `unknown ${what} ${JSON.stringify(issue.input)} (known: ${known(list)})`,
  });

/** A built-in name or an id of the film's assets (`section`). */
function nameOf(list: readonly string[], what: string, ids: IdSet, section: string, open = false) {
  return z.string().superRefine((value, ctx) => {
    if (list.includes(value) || ids.has(value) || (open && value === 'none')) return;
    const own = [...ids.keys()];
    const hint =
      own.length > 0
        ? `; the film's assets.${section}: ${own.join(', ')}`
        : `; or define it in assets.${section}`;
    ctx.addIssue({
      code: 'custom',
      message: `unknown ${what} ${JSON.stringify(value)} (known: ${known(list)})${hint}`,
    });
  });
}

const label = z.string().min(1).max(12).describe('Real words of the shot only (stencils, signs)');
const SWATCHES = B2_SWATCHES as readonly [B2SwatchName, ...B2SwatchName[]];
const swatch = z.enum(SWATCHES, {
  error: (issue) =>
    `unknown colour ${JSON.stringify(issue.input)} (a game-b2 swatch, e.g. pink, tan)`,
});
const pos = z
  .tuple([z.number(), z.number()])
  .describe('[x, y] in cells (0.5 = the middle of cell 0)');

function schemasFor(ids: KnownAssets) {
  const wallCell = z.strictObject({
    wall: nameOf(WALL_TEXTURES, 'wall texture', ids.textures, 'textures'),
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
      .max(4)
      .optional()
      .describe('Wall height (1 = ceiling; cubicle 0.55, counter 0.42; up to 4 outdoors)'),
    cap: swatch.optional().describe('Colour of the top of a low wall'),
  });
  const doorCell = z.strictObject({
    door: z
      .literal(true)
      .describe('A sliding door; walls on two opposite sides; open it with view.open()'),
  });
  const openCell = z.strictObject({
    floor: nameOf(FLOOR_TEXTURES, 'floor texture', ids.textures, 'textures', true)
      .optional()
      .describe("'none' outdoors: no floor (the void of space, a cliff edge)"),
    ceiling: nameOf(CEILING_TEXTURES, 'ceiling texture', ids.textures, 'textures', true)
      .optional()
      .describe("Outdoors a cell with a ceiling has a roof; 'none' = open sky"),
    flicker: z.boolean().optional().describe("A tube ceiling that follows the level's faulty tube"),
    mood: pick(MOODS, 'mood')
      .optional()
      .describe(
        "This cell's room mood (default the level's): a dark corridor opening onto a tungsten office",
      ),
  });
  const light = z.strictObject({
    id: z.string().min(1).max(24).optional(),
    pos,
    z: z.number().min(0).max(4).default(0.95).describe('Height (0 floor, 1 ceiling)'),
    power: z.number().min(0).max(2).default(0.9),
    radius: z.number().min(0.5).max(8).default(3.6),
    flicker: z
      .enum(['none', 'tube', 'bulb', 'fire'])
      .default('none')
      .describe('tube = the faulty tube cadence, fire = a flame (torch, campfire)'),
    bulb: z.boolean().default(false).describe('Draw a hanging bulb at the light (sways a little)'),
  });
  const sprite = z.strictObject({
    id: z.string().min(1).max(24).optional().describe('Name for view.act()'),
    sprite: nameOf(SPRITE_KINDS, 'sprite', ids.sprites, 'sprites'),
    pos,
    z: z.number().min(-1).max(4).optional().describe('Height of its foot above the floor'),
    w: z.number().min(0.05).max(6).optional().describe('World width (default per sprite)'),
    h: z.number().min(0.05).max(6).optional().describe('World height (default per sprite)'),
    scale: z.number().min(0.1).max(4).optional().describe('Scales the default size'),
    flip: z.boolean().optional().describe('Mirrors it (a creature walking the other way)'),
    label: label.optional(),
    band: swatch.optional().describe('Label band of an item: pink = THE item of the story'),
    person: z.boolean().optional().describe('desk: a worker at it, seen from behind'),
    seed: z.int().min(0).optional(),
    tilt: z.number().min(-15).max(15).optional().describe('card: tilt in degrees'),
  });
  const level = z.strictObject({
    name: z
      .string()
      .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'level names are kebab case, e.g. warehouse'),
    seed: z.int().min(0).optional(),
    mood: pick(MOODS, 'mood').default('dark'),
    density: z.number().min(0).max(0.5).optional().describe('Fog density (default from the mood)'),
    ambient: z
      .number()
      .min(0)
      .max(1.2)
      .optional()
      .describe('Ambient light (default from the mood)'),
    floor: nameOf(FLOOR_TEXTURES, 'floor texture', ids.textures, 'textures').default('concrete'),
    ceiling: nameOf(CEILING_TEXTURES, 'ceiling texture', ids.textures, 'textures').default('dark'),
    sky: skySchema.optional().describe('Outdoor level: sky, skyline, ground beyond the grid'),
    grid: z.array(z.string()).min(3).max(MAX_GRID),
    legend: z.record(z.string(), z.union([wallCell, doorCell, openCell])),
    lights: z.array(light).max(MAX_LIGHTS).default([]),
    sprites: z.array(sprite).max(MAX_SPRITES).default([]),
  });
  return { wallCell, doorCell, openCell, light, sprite, level };
}

const BASE = schemasFor(NO_ASSETS);
export const wallCellSchema = BASE.wallCell;
export const doorCellSchema = BASE.doorCell;
export const openCellSchema = BASE.openCell;
export const legendEntrySchema = z.union([wallCellSchema, doorCellSchema, openCellSchema]);
export const lightSchema = BASE.light;
export const spriteSchema = BASE.sprite;
export const levelSchema = BASE.level;

const SCHEMAS = new WeakMap<KnownAssets, ReturnType<typeof schemasFor>>();

/** The level schemas that also accept the film's asset ids. */
export function levelSchemas(ids: KnownAssets): ReturnType<typeof schemasFor> {
  if (ids === NO_ASSETS) return BASE;
  let found = SCHEMAS.get(ids);
  if (found === undefined) {
    found = schemasFor(ids);
    SCHEMAS.set(ids, found);
  }
  return found;
}

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
function legendErrors(input: unknown, ids: KnownAssets): string[] {
  if (typeof input !== 'object' || input === null || !('legend' in input)) return [];
  const legend = input.legend;
  if (typeof legend !== 'object' || legend === null) return [];
  const schemas = levelSchemas(ids);
  return Object.entries(legend).flatMap(([ch, entry]: [string, unknown]) => {
    const kind =
      typeof entry === 'object' && entry !== null
        ? 'wall' in entry
          ? schemas.wallCell
          : 'door' in entry
            ? schemas.doorCell
            : schemas.openCell
        : schemas.openCell;
    const parsed = kind.safeParse(entry);
    return parsed.success ? [] : issueLines(`legend "${ch}"`, parsed.error);
  });
}

/**
 * Parses and checks a level; errors name the field or grid row. `ids` = the sprite and texture
 * ids the film's assets define (default none: built-in names only).
 */
export function checkLevel(input: unknown, ids: KnownAssets = NO_ASSETS): LevelCheck {
  const legend = legendErrors(input, ids);
  if (legend.length > 0) return { ok: false, errors: legend };
  const parsed = levelSchemas(ids).level.safeParse(input);
  if (!parsed.success) return { ok: false, errors: issueLines('', parsed.error) };
  const errors = levelProblems(parsed.data, ids);
  return errors.length > 0 ? { ok: false, errors } : { ok: true, level: parsed.data };
}
