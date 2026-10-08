/**
 * The Game B2 ASSET PACK: the film's own sprites, textures and item icons, defined per film in
 * the world's style grammar (PLAN.md#13.15, docs/worlds/DECISIONS.md "a world is a style
 * GRAMMAR"). One JSON-able object, the same in a scene (`kit.fx.b2View({ assets })`) and in a
 * project file `assets/game-b2/<name>.json` (`{ version: 1, world: 'game-b2', sprites, textures,
 * icons }`). Every entry is either pixel art (rows + a legend of the world's colours) or a call
 * of a seeded generator (`{ gen: 'plant', kind: 'conifer', seed: 4 }`). Ids are kebab case and
 * are used in levels exactly like the built-in names. Errors name the asset and the field.
 */
import { z } from 'zod';
import type { Bmp } from '../core/bitmap.js';
import { C } from '../palette.js';
import type { Sprite } from '../ray/sprites-props.js';
import { texture, type Texture } from '../ray/texture.js';
import { finish } from './draw.js';
import { compileArt, padded, tileTo64 } from './dsl.js';
import { creatureProblems, creatureSchema, makeCreature } from './gen-creatures.js';
import { iconGenSchema, makeIcon } from './gen-icons.js';
import { iconSizeProblems } from './icon-size.js';
import { makeObject, objectSchema } from './gen-objects.js';
import { makePerson, personSchema } from './gen-people.js';
import { makePlant, plantSchema } from './gen-plants.js';
import { makeStructure, structureSchema } from './gen-structures.js';
import { makeTexture, textureGenSchema } from './gen-textures.js';
import { makeVehicle, vehicleSchema } from './gen-vehicles.js';
import type { MadeSprite } from './made.js';
import { colourRef, colourRefHelp } from './ramps.js';

export const ASSET_ID = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
export const MAX_PACK_SPRITES = 48;
export const MAX_PACK_TEXTURES = 24;
export const MAX_PACK_ICONS = 24;

const rowsParam = z.array(z.string()).min(1).optional();
const framesParam = z.array(z.array(z.string()).min(1)).min(1).optional();
const legendParam = z.record(z.string(), z.string());

export const spriteArtSchema = z.strictObject({
  rows: rowsParam,
  frames: framesParam.describe('2-4 frames for creatures, flames, water'),
  legend: legendParam.describe(
    "char -> colour: a swatch ('sage') or a ramp step ('leaf.2'); 'clear' = transparent",
  ),
  mirror: z
    .boolean()
    .optional()
    .describe('The rows are the left half; the right half mirrors them'),
  size: z
    .tuple([z.number().min(0.05).max(6), z.number().min(0.05).max(6)])
    .optional()
    .describe('World [w, h] (default 64 px per cell)'),
  z: z
    .number()
    .min(-1)
    .max(4)
    .default(0)
    .describe('Foot height (floating fish, a bird on a branch)'),
  fps: z.number().min(0).max(12).default(4),
  glow: z.array(z.string()).max(4).default([]).describe('Colours that glow (flames, screens)'),
  outline: z.string().default('void').describe("Outline colour, or 'none'"),
  person: z
    .boolean()
    .default(false)
    .describe('Frames rest / talk / shake / shake: view.act() drives it'),
});
export const textureArtSchema = z.strictObject({
  size: z.union([z.literal(16), z.literal(32), z.literal(64)]),
  rows: rowsParam,
  frames: framesParam,
  legend: legendParam,
  fps: z.number().min(0).max(12).default(3),
  glow: z.array(z.string()).max(4).default([]),
});
export const iconArtSchema = z.strictObject({ rows: rowsParam, legend: legendParam });

/** The sprite generators by `gen` name (also listed by `reelforge kit-docs generators`). */
export const SPRITE_GENS = {
  plant: plantSchema,
  creature: creatureSchema,
  person: personSchema,
  structure: structureSchema,
  vehicle: vehicleSchema,
  object: objectSchema,
} as const;

/** Every generator call may also set its animation speed (0 = still) and foot height. */
const genOverrides = z.strictObject({
  fps: z.number().min(0).max(12).optional(),
  z: z.number().min(-1).max(4).optional(),
});

export const packSchema = z.strictObject({
  version: z.literal(1).default(1),
  world: z.literal('game-b2').default('game-b2'),
  sprites: z.record(z.string(), z.unknown()).default({}),
  textures: z.record(z.string(), z.unknown()).default({}),
  icons: z.record(z.string(), z.unknown()).default({}),
});
export type AssetPackInput = z.input<typeof packSchema>;

export interface AssetSprite {
  readonly frames: readonly Sprite[];
  readonly size: readonly [number, number];
  readonly z: number;
  readonly fps: number;
  /** Rest / talk / shake frames (view.act). */
  readonly person: boolean;
}

export interface AssetTexture {
  readonly frames: readonly Texture[];
  readonly fps: number;
}

export interface AssetSet {
  readonly sprites: Map<string, AssetSprite>;
  readonly textures: Map<string, AssetTexture>;
  readonly icons: Map<string, Bmp>;
}

export type Compiled<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly errors: readonly string[] };

export function emptyAssets(): AssetSet {
  return { sprites: new Map(), textures: new Map(), icons: new Map() };
}

function zodLines(where: string, error: z.ZodError): string[] {
  return error.issues.map((issue) => {
    const path = issue.path.map(String).join('.');
    return `${where}${path === '' ? '' : `.${path}`}: ${issue.message}`;
  });
}

function colours(where: string, refs: readonly string[], errors: string[]): number[] {
  return refs.flatMap((ref) => {
    const index = colourRef(ref);
    if (index === undefined) errors.push(`${where}: ${colourRefHelp(ref)}`);
    return index === undefined ? [] : [index];
  });
}

const cache = new Map<string, Compiled<unknown>>();

function memo<T>(kind: string, value: unknown, make: () => Compiled<T>): Compiled<T> {
  const key = `${kind}:${JSON.stringify(value)}`;
  const hit = cache.get(key);
  if (hit !== undefined) return hit as Compiled<T>;
  const made = make();
  cache.set(key, made);
  return made;
}

function genOf(value: unknown): unknown {
  return typeof value === 'object' && value !== null && 'gen' in value ? value.gen : undefined;
}

function artSprite(where: string, value: unknown): Compiled<AssetSprite> {
  const parsed = spriteArtSchema.safeParse(value);
  if (!parsed.success) return { ok: false, errors: zodLines(where, parsed.error) };
  const spec = parsed.data;
  const art = compileArt(spec, where, { maxW: 128, maxH: 128 });
  if (!art.ok) return { ok: false, errors: art.errors };
  const errors: string[] = [];
  const glow = colours(`${where}.glow`, spec.glow, errors);
  const outline = spec.outline === 'none' ? null : (colourRef(spec.outline) ?? C.VOID);
  if (spec.outline !== 'none' && colourRef(spec.outline) === undefined)
    errors.push(`${where}.outline: ${colourRefHelp(spec.outline)}`);
  if (spec.person && art.frames.length !== 4)
    errors.push(`${where}: a person needs 4 frames (rest, talking, shake left, shake right)`);
  if (errors.length > 0) return { ok: false, errors };
  const first = art.frames[0];
  const size = spec.size ?? [((first?.w ?? 16) + 2) / 64, ((first?.h ?? 16) + 2) / 64];
  const frames = art.frames.map((bmp) =>
    finish(outline === null ? bmp : padded(bmp), outline, glow),
  );
  return {
    ok: true,
    value: { frames, size, z: spec.z, fps: frames.length > 1 ? spec.fps : 0, person: spec.person },
  };
}

function genSprite(where: string, value: unknown): Compiled<AssetSprite> {
  const gen = genOf(value);
  const schema =
    typeof gen === 'string' && gen in SPRITE_GENS
      ? SPRITE_GENS[gen as keyof typeof SPRITE_GENS]
      : undefined;
  if (schema === undefined)
    return {
      ok: false,
      errors: [
        `${where}.gen: unknown generator ${JSON.stringify(gen)} (sprites: ${Object.keys(SPRITE_GENS).join(', ')}; or pixel art with rows + legend)`,
      ],
    };
  const { fps, z: foot, ...rest } = value as Record<string, unknown>;
  const extra = genOverrides.safeParse({ fps, z: foot });
  if (!extra.success) return { ok: false, errors: zodLines(where, extra.error) };
  const parsed = schema.safeParse(rest);
  if (!parsed.success) return { ok: false, errors: zodLines(where, parsed.error) };
  const spec = parsed.data;
  let made: MadeSprite;
  switch (spec.gen) {
    case 'plant':
      made = makePlant(spec);
      break;
    case 'creature': {
      const problems = creatureProblems(spec);
      if (problems.length > 0) return { ok: false, errors: problems.map((p) => `${where}.${p}`) };
      made = makeCreature(spec);
      break;
    }
    case 'person':
      made = makePerson(spec);
      break;
    case 'structure':
      made = makeStructure(spec);
      break;
    case 'vehicle':
      made = makeVehicle(spec);
      break;
    case 'object':
      made = makeObject(spec);
      break;
  }
  return {
    ok: true,
    value: {
      ...made,
      fps: extra.data.fps ?? made.fps,
      z: extra.data.z ?? made.z,
      person: spec.gen === 'person',
    },
  };
}

/** One sprite definition (pixel art or a generator call). */
export function compileSprite(where: string, value: unknown): Compiled<AssetSprite> {
  return memo('s', value, () =>
    genOf(value) === undefined ? artSprite(where, value) : genSprite(where, value),
  );
}

/** One texture definition (a 16/32/64 tile or the texture generator). */
export function compileTexture(where: string, value: unknown): Compiled<AssetTexture> {
  return memo('t', value, () => {
    if (genOf(value) !== undefined) {
      const parsed = textureGenSchema.safeParse(value);
      return parsed.success
        ? { ok: true, value: makeTexture(parsed.data) }
        : { ok: false, errors: zodLines(where, parsed.error) };
    }
    const parsed = textureArtSchema.safeParse(value);
    if (!parsed.success) return { ok: false, errors: zodLines(where, parsed.error) };
    const spec = parsed.data;
    const art = compileArt(spec, where, { maxW: 64, maxH: 64, square: spec.size });
    if (!art.ok) return { ok: false, errors: art.errors };
    const errors: string[] = [];
    const glow = colours(`${where}.glow`, spec.glow, errors);
    if (errors.length > 0) return { ok: false, errors };
    const frames = art.frames.map((tile) => texture(tileTo64(tile), glow));
    return { ok: true, value: { frames, fps: frames.length > 1 ? spec.fps : 0 } };
  });
}

/** One icon definition (pixel art <= 16x16 or the icon generator). */
export function compileIcon(where: string, value: unknown): Compiled<Bmp> {
  return memo('i', value, () => {
    if (genOf(value) !== undefined) {
      const parsed = iconGenSchema.safeParse(value);
      return parsed.success
        ? { ok: true, value: makeIcon(parsed.data) }
        : { ok: false, errors: zodLines(where, parsed.error) };
    }
    const parsed = iconArtSchema.safeParse(value);
    if (!parsed.success) return { ok: false, errors: zodLines(where, parsed.error) };
    const art = compileArt(parsed.data, where, { maxW: 16, maxH: 16 });
    if (!art.ok) return { ok: false, errors: art.errors };
    const bmp = art.frames[0];
    if (bmp === undefined) return { ok: false, errors: [`${where}: no pixels`] };
    const small = iconSizeProblems(where, bmp);
    return small.length > 0
      ? { ok: false, errors: small }
      : { ok: true, value: padded(bmp).outline(C.VOID) };
  });
}
