/**
 * The generators of each world's open vocabulary as docs data (real run Game B2 #2: the
 * world-assets turn learned option values by trial, 8 of 14 checks failed). For `reelforge
 * kit-docs generators`: every generator a project asset file can call, how it is selected, and
 * the JSON Schema of its options, read from the same zod schemas that validate the files (so the
 * docs never drift from the code). Placement and timing options a file cannot set are left out.
 */
import { z } from 'zod';
import { SWATCH_NAMES as COMIC_SWATCHES } from './comic/inks.js';
import { GENERATORS as COMIC_GENERATORS } from './comic/art/generators.js';
import { B1_SWATCHES } from './game-b1/palette.js';
import { generatorSchema as b1GeneratorSchema } from './game-b1/vocab/gen/generators.js';
import { iconGenSchema } from './game-b2/assets/gen-icons.js';
import { textureGenSchema } from './game-b2/assets/gen-textures.js';
import { SPRITE_GENS } from './game-b2/assets/pack.js';
import { RAMP_HELP, RAMP_NAMES } from './game-b2/assets/ramps.js';
import { B2_SWATCHES } from './game-b2/palette.js';
import { SWATCH_NAMES as SKETCH_SWATCHES } from './sketchbook/inks.js';
import { drawSchema, FAMILIES } from './sketchbook/vocab/gen/index.js';
import { personLook } from './sketchbook/vocab/person.js';

export type JsonSchemaObject = Readonly<Record<string, unknown>>;

export interface WorldGenerator {
  readonly name: string;
  /** Where it goes in an asset file and the key that selects it. */
  readonly use: string;
  readonly summary: string | undefined;
  /** JSON Schema (input side) of the options a file may set. */
  readonly options: JsonSchemaObject;
}

export interface WorldGeneratorDocs {
  readonly world: string;
  readonly generators: readonly WorldGenerator[];
  /**
   * Named value lists (`colour`, Game B2's `ramp`): an option whose allowed values are exactly
   * one of them is shown by the list's name, the list once.
   */
  readonly lists: Readonly<Record<string, readonly string[]>>;
  /** Rules shared by every generator of the world (colour references, overrides). */
  readonly notes: readonly string[];
}

/** The input JSON Schema of `schema` without the selector and placement keys. */
function optionsOf(schema: z.ZodType, drop: readonly string[]): JsonSchemaObject {
  const json = z.toJSONSchema(schema, { io: 'input', unrepresentable: 'any' }) as Record<
    string,
    unknown
  >;
  const properties = (json['properties'] ?? {}) as Record<string, unknown>;
  const required = Array.isArray(json['required']) ? (json['required'] as unknown[]) : [];
  return {
    type: 'object',
    properties: Object.fromEntries(
      Object.entries(properties).filter(([key]) => !drop.includes(key)),
    ),
    required: required.filter((key) => typeof key === 'string' && !drop.includes(key)),
  };
}

function gameB2(): WorldGeneratorDocs {
  const sprites = Object.entries(SPRITE_GENS).map(([name, schema]): WorldGenerator => ({
    name,
    use: `sprites: { "gen": "${name}", ... }`,
    summary: undefined,
    options: optionsOf(schema, ['gen']),
  }));
  return {
    world: 'game-b2',
    generators: [
      ...sprites,
      {
        name: 'texture',
        use: 'textures: { "gen": "texture", ... }',
        summary: 'a wall, floor or ceiling tile',
        options: optionsOf(textureGenSchema, ['gen']),
      },
      {
        name: 'icon',
        use: 'icons: { "gen": "icon", ... }',
        summary: 'an inventory / HUD icon',
        options: optionsOf(iconGenSchema, ['gen']),
      },
    ],
    lists: { colour: B2_SWATCHES, ramp: RAMP_NAMES },
    notes: [
      `a string colour option (bloom, belly, hairColour, trim, accent, colour) takes a colour name or a ramp step like leaf.2 (ramps and their steps: ${RAMP_HELP})`,
      'every sprite generator call may also set fps (0-12, 0 = still) and z (foot height -1..4)',
      'seed is a whole number 0-1000000 (never a string)',
    ],
  };
}

function gameB1(): WorldGeneratorDocs {
  return {
    world: 'game-b1',
    generators: b1GeneratorSchema.options.map((option) => {
      const kind = option.shape.kind.value;
      return {
        name: kind,
        use: `generated: { "<id>": { "kind": "${kind}", ... } }${kind === 'scenery' ? ' (a playfield)' : ' (a sprite)'}`,
        summary: undefined,
        options: optionsOf(option, ['kind']),
      };
    }),
    lists: { colour: B1_SWATCHES },
    notes: [
      'string ink options (colour, stripe, leaf, trunk, accent, legColour, hornColour, colours.*) take a colour name',
      'seed is a whole number 0-1000000 (left out: derived from the id)',
    ],
  };
}

function comic(): WorldGeneratorDocs {
  return {
    world: 'comic',
    generators: Object.entries(COMIC_GENERATORS).map(([name, generator]) => ({
      name,
      use: `characters | props | backdrops: { "gen": "${name}", ... }`,
      summary: generator.doc,
      options: optionsOf(generator.schema, ['x', 'y', 't', 'box']),
    })),
    lists: { colour: COMIC_SWATCHES },
    notes: [
      'a character is drawn by person, animal, bird, fish, insect or reptile; a backdrop by a place generator (sky, land, hills, sea, dunes, forest, skyline, interior, space, backdrop) or layers',
      'string options that paint (fill, belly, top, bottom, hairColor, hatColor, toolColor, silhouette, color, ...) take a colour name; seed is a whole number or a short string',
    ],
  };
}

const SKETCH_DRAW_KEYS = {
  type: true,
  color: true,
  action: true,
  count: true,
  plain: true,
  bold: true,
  shade: true,
} as const;

function sketchbook(): WorldGeneratorDocs {
  const draws = FAMILIES.map((entry): WorldGenerator => ({
    name: entry.kind,
    use: `a prop: "spec": { "draw": "${entry.kind}", ..., "h": 4-1200 }`,
    summary: entry.summary,
    // A family without actions takes none (its schema allows only undefined).
    options: optionsOf(drawSchema(entry).pick(SKETCH_DRAW_KEYS), entry.actions ? [] : ['action']),
  }));
  return {
    world: 'sketchbook',
    generators: [
      {
        name: 'figure',
        use: 'a figure: "kind": "figure", "spec": { ...the look }',
        summary: 'a recurring person (scenes draw it with page.person({ like: id }))',
        options: optionsOf(personLook, []),
      },
      ...draws,
    ],
    lists: { colour: SKETCH_SWATCHES },
    notes: ['color options take a colour name; h is the page height of the drawing (4-1200)'],
  };
}

const DOCS: Readonly<Record<string, () => WorldGeneratorDocs>> = {
  sketchbook,
  comic,
  'game-b2': gameB2,
  'game-b1': gameB1,
};

const cache = new Map<string, WorldGeneratorDocs>();

/** The generator docs of a world (by its style id), or undefined for a style without them. */
export function worldGeneratorDocs(world: string | undefined): WorldGeneratorDocs | undefined {
  if (world === undefined || !Object.hasOwn(DOCS, world)) return undefined;
  const hit = cache.get(world);
  if (hit !== undefined) return hit;
  const made = DOCS[world]?.();
  if (made !== undefined) cache.set(world, made);
  return made;
}
