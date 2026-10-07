/**
 * The generator spec of the open vocabulary (`screen.generate(id, { kind, ... })`, or a
 * `generated` entry of an asset file): one zod schema per kind with readable defaults, and the
 * dispatch to the generators. Sprite kinds may override the NUSIZ fields of the result (`size`,
 * `copies`, `gap`), its `fps` and `rowH`; `scenery` makes a playfield. A missing seed is derived
 * from the id, so a definition is stable across renders and machines.
 */
import { z } from 'zod';
import { sid } from '../../core/math.js';
import type { PlayfieldSpec } from '../playfield.js';
import type { SpriteSpec } from '../sprite.js';
import { bird, fish, insect, quadruped, reptile, type QuadrupedParams } from './animals.js';
import { boss, BOSS_BODIES, effect, EFFECTS } from './bosses.js';
import { bush, cactus, rock, seaweed, tree } from './nature.js';
import { HATS, person, ROLES, TOOLS } from './people.js';
import { scenery, SCENERY_KINDS } from './scenery.js';
import { building, BUILDINGS, item, ITEMS, vehicle, VEHICLES } from './things.js';

const seed = z.int().min(0).max(1_000_000).optional();
const ink = z.string().min(1).max(16);
const inks = z.record(z.string(), ink).optional();
const nusiz = {
  size: z.union([z.literal(1), z.literal(2), z.literal(4)]).optional(),
  copies: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
  gap: z.enum(['close', 'medium', 'wide']).optional(),
  fps: z.number().min(0.5).max(30).optional(),
  rowH: z.int().min(1).max(4).optional(),
  describe: z.string().min(1).max(80).optional(),
};

export const ANIMAL_PRESETS = {
  deer: { neck: 2, legs: 3, horns: 'antlers', hump: false, tail: true, bulk: 2 },
  horse: { neck: 2, legs: 4, horns: 'ears', hump: false, tail: true, bulk: 2, colour: 'walnut' },
  camel: { neck: 3, legs: 4, horns: 'ears', hump: true, tail: true, bulk: 2, colour: 'tan' },
  dog: { neck: 0, legs: 2, horns: 'ears', hump: false, tail: true, bulk: 2 },
  cow: { neck: 0, legs: 2, horns: 'horns', hump: false, tail: true, bulk: 3, colour: 'cream' },
  bear: {
    neck: 0,
    legs: 2,
    horns: 'ears',
    hump: false,
    tail: false,
    bulk: 3,
    colour: 'walnutDark',
  },
  goat: { neck: 1, legs: 2, horns: 'horns', hump: false, tail: true, bulk: 2, colour: 'grey' },
} as const satisfies Record<string, Omit<QuadrupedParams, 'seed'>>;

const ANIMALS = Object.keys(ANIMAL_PRESETS) as [
  keyof typeof ANIMAL_PRESETS,
  ...(keyof typeof ANIMAL_PRESETS)[],
];

export const generatorSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('tree'), shape: z.enum(['pine', 'round', 'palm', 'birch', 'dead']).default('round'), height: z.int().min(8).max(40).default(16), leaf: ink.optional(), trunk: ink.optional(), seed, ...nusiz }),
  z.strictObject({ kind: z.literal('bush'), width: z.int().min(3).max(8).default(6), colour: ink.optional(), seed, ...nusiz }),
  z.strictObject({ kind: z.literal('cactus'), height: z.int().min(8).max(32).default(14), arms: z.int().min(0).max(2).default(2), seed, ...nusiz }),
  z.strictObject({ kind: z.literal('seaweed'), height: z.int().min(6).max(30).default(12), seed, ...nusiz }),
  z.strictObject({ kind: z.literal('rock'), width: z.int().min(3).max(8).default(6), seed, ...nusiz }),
  z.strictObject({ kind: z.literal('bird'), colour: ink.optional(), seed, ...nusiz }),
  z.strictObject({ kind: z.literal('fish'), colour: ink.optional(), stripe: ink.optional(), seed, ...nusiz }),
  z.strictObject({ kind: z.literal('animal'), like: z.enum(ANIMALS).default('deer'), neck: z.int().min(0).max(3).optional(), legs: z.int().min(2).max(4).optional(), horns: z.enum(['none', 'antlers', 'horns', 'ears']).optional(), hump: z.boolean().optional(), tail: z.boolean().optional(), bulk: z.int().min(2).max(3).optional(), colour: ink.optional(), legColour: ink.optional(), hornColour: ink.optional(), seed, ...nusiz }),
  z.strictObject({ kind: z.literal('insect'), type: z.enum(['bee', 'locust', 'beetle', 'butterfly']).default('bee'), seed, ...nusiz }),
  z.strictObject({ kind: z.literal('reptile'), type: z.enum(['lizard', 'snake', 'turtle']).default('lizard'), seed, ...nusiz }),
  z.strictObject({ kind: z.literal('person'), role: z.enum(ROLES).default('plain'), hat: z.enum(HATS).optional(), tool: z.enum(TOOLS).optional(), colours: z.strictObject({ skin: ink, hair: ink, hatColour: ink, top: ink, band: ink, legs: ink }).partial().optional(), seed, ...nusiz }),
  z.strictObject({ kind: z.literal('vehicle'), type: z.enum(VEHICLES), colours: inks, seed, ...nusiz }),
  z.strictObject({ kind: z.literal('building'), type: z.enum(BUILDINGS), lit: z.boolean().optional(), colours: inks, seed, ...nusiz }),
  z.strictObject({ kind: z.literal('item'), type: z.enum(ITEMS), colours: inks, seed, ...nusiz }),
  z.strictObject({ kind: z.literal('boss'), body: z.enum(BOSS_BODIES), eyes: z.int().min(0).max(3).default(2), mouth: z.enum(['teeth', 'grin', 'none']).default('teeth'), arms: z.boolean().default(false), crown: z.boolean().default(false), colour: ink.optional(), accent: ink.optional(), seed, ...nusiz }),
  z.strictObject({ kind: z.literal('effect'), type: z.enum(EFFECTS), colour: ink.optional(), seed, ...nusiz }),
  z.strictObject({ kind: z.literal('scenery'), type: z.enum(SCENERY_KINDS), rows: z.int().min(1).max(24).default(4), rowH: z.int().min(1).max(30).optional(), colours: z.array(ink).min(1).max(8).optional(), seed, describe: nusiz.describe }),
]); // prettier-ignore

export type GeneratorSpec = z.input<typeof generatorSchema>;
export const GENERATOR_KINDS = generatorSchema.options.map((option) => option.shape.kind.value);

export type Generated =
  | { readonly type: 'sprite'; readonly spec: SpriteSpec }
  | { readonly type: 'playfield'; readonly spec: PlayfieldSpec };

type Parsed = z.output<typeof generatorSchema>;

function spriteOf(g: Exclude<Parsed, { kind: 'scenery' }>, s: number): SpriteSpec {
  switch (g.kind) {
    case 'tree':
      return tree({ shape: g.shape, height: g.height, seed: s, leaf: g.leaf, trunk: g.trunk });
    case 'bush':
      return bush({ width: g.width, seed: s, colour: g.colour });
    case 'cactus':
      return cactus({ height: g.height, arms: g.arms, seed: s });
    case 'seaweed':
      return seaweed({ height: g.height, seed: s });
    case 'rock':
      return rock({ width: g.width, seed: s });
    case 'bird':
      return bird({ seed: s, colour: g.colour });
    case 'fish':
      return fish({ seed: s, colour: g.colour, stripe: g.stripe });
    case 'animal': {
      const base: Omit<QuadrupedParams, 'seed'> = ANIMAL_PRESETS[g.like];
      const spec = quadruped({
        ...base,
        seed: s,
        ...(g.neck === undefined ? {} : { neck: g.neck }),
        ...(g.legs === undefined ? {} : { legs: g.legs }),
        ...(g.horns === undefined ? {} : { horns: g.horns }),
        ...(g.hump === undefined ? {} : { hump: g.hump }),
        ...(g.tail === undefined ? {} : { tail: g.tail }),
        ...(g.bulk === undefined ? {} : { bulk: g.bulk }),
        colour: g.colour ?? base.colour,
        legColour: g.legColour,
        hornColour: g.hornColour,
      });
      return { ...spec, describe: g.like };
    }
    case 'insect':
      return insect({ type: g.type, seed: s });
    case 'reptile':
      return reptile({ type: g.type, seed: s });
    case 'person':
      return person({ role: g.role, seed: s, hat: g.hat, tool: g.tool, colours: g.colours });
    case 'vehicle':
      return vehicle({ type: g.type, seed: s, ...(g.colours ? { colours: g.colours } : {}) });
    case 'building':
      return building({ type: g.type, seed: s, lit: g.lit, ...(g.colours ? { colours: g.colours } : {}) });
    case 'item':
      return item({ type: g.type, seed: s, ...(g.colours ? { colours: g.colours } : {}) });
    case 'boss':
      return boss({ body: g.body, seed: s, eyes: g.eyes, mouth: g.mouth, arms: g.arms, crown: g.crown, colour: g.colour, accent: g.accent });
    case 'effect':
      return effect({ type: g.type, colour: g.colour });
  }
} // prettier-ignore

/** Runs a parsed generator spec; `id` seeds it when the spec has no seed. */
export function runGenerator(id: string, g: Parsed): Generated {
  const s = ('seed' in g ? g.seed : undefined) ?? (sid(id) >>> 0) % 100_000;
  if (g.kind === 'scenery')
    return {
      type: 'playfield',
      spec: {
        ...scenery({ kind: g.type, rows: g.rows, seed: s, rowH: g.rowH, colours: g.colours }),
        ...(g.describe === undefined ? {} : { describe: g.describe }),
      },
    };
  const base = spriteOf(g, s);
  const overrides = Object.fromEntries(
    (['size', 'copies', 'gap', 'fps', 'rowH', 'describe'] as const)
      .filter((key) => g[key] !== undefined)
      .map((key) => [key, g[key]]),
  );
  return { type: 'sprite', spec: { ...base, ...overrides } };
}
