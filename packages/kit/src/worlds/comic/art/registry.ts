/**
 * Project vocabulary of a comic film (PLAN.md#13.15a): `defineProp`, `defineCharacter` and
 * `defineBackdrop(id, spec)` name things the film needs (a ranger, a lantern, a pine forest at
 * dawn) once, so every panel and shot draws the same one with `art.draw(g, id, options)`. A spec
 * is plain JSON - shape parts, a sprite, a generator preset or backdrop layers - or, in JS
 * asset files only, a `draw(g, options)` painter. Validated with readable errors and capped.
 */
import { z } from 'zod';
import { KitError } from '../../../errors.js';
import type { ComicPen } from '../page/pen.js';
import { parseArt, placeShape } from './common.js';
import { GENERATORS, isGeneratorName } from './generators.js';
import { drawParts, shapePartsSchema, type UseResolver } from './shape-dsl.js';
import { Sketch } from './sketch.js';
import { drawSprite, spriteSchema } from './sprite.js';

export const ASSET_KINDS = ['prop', 'character', 'backdrop'] as const;
export type AssetKind = (typeof ASSET_KINDS)[number];

export const ASSET_ID = /^[a-z][a-z0-9-]{0,39}$/;
export const MAX_ASSETS = 64;

const CREATURES = ['person', 'animal', 'bird', 'fish', 'insect', 'reptile'];
const PLACES = [
  'backdrop',
  'sky',
  'land',
  'hills',
  'sea',
  'dunes',
  'forest',
  'skyline',
  'interior',
  'space',
];

const description = z.string().max(200).optional();
const painter = z.custom<(g: ComicPen, options: Readonly<Record<string, unknown>>) => void>(
  (value) => typeof value === 'function',
  {
    message: 'draw must be a function (g, options) => void (JS asset files only)',
  },
);
const genSpec = z.looseObject({ gen: z.string().min(1), description });

const SPEC_SCHEMAS = {
  parts: z.strictObject({
    parts: shapePartsSchema,
    height: z.number().positive().default(100).describe('Model height drawn `size` tall'),
    description,
  }),
  sprite: z.strictObject({ sprite: spriteSchema, description }),
  layers: z.strictObject({ layers: z.array(genSpec).min(1).max(12), description }),
  draw: z.strictObject({ draw: painter, description }),
  gen: genSpec,
} as const;
const SPEC_KEYS = Object.keys(SPEC_SCHEMAS) as (keyof typeof SPEC_SCHEMAS)[];

type SpecKey = keyof typeof SPEC_SCHEMAS;

/** A parsed spec, tagged by the key it carries. */
export type AssetSpec = {
  [K in SpecKey]: { readonly type: K; readonly value: z.output<(typeof SPEC_SCHEMAS)[K]> };
}[SpecKey];

/** One spec, by the key it carries (parts, sprite, layers, draw or gen), with a readable error. */
export function parseAssetSpec(value: unknown, where: string): AssetSpec {
  const keys =
    typeof value === 'object' && value !== null ? SPEC_KEYS.filter((key) => key in value) : [];
  const [key] = keys;
  if (key === undefined || keys.length > 1) {
    throw new KitError(
      'invalid-params',
      `${where}: a spec has exactly one of ${SPEC_KEYS.join(', ')} (got ${keys.length > 0 ? keys.join(' + ') : 'none'})`,
    );
  }
  switch (key) {
    case 'parts':
      return { type: key, value: parseArt(SPEC_SCHEMAS.parts, value, where) };
    case 'sprite':
      return { type: key, value: parseArt(SPEC_SCHEMAS.sprite, value, where) };
    case 'layers':
      return { type: key, value: parseArt(SPEC_SCHEMAS.layers, value, where) };
    case 'draw':
      return { type: key, value: parseArt(SPEC_SCHEMAS.draw, value, where) };
    case 'gen':
      return { type: key, value: parseArt(SPEC_SCHEMAS.gen, value, where) };
  }
}

const placeSchema = z.looseObject({
  x: placeShape.x.default(0),
  y: placeShape.y.default(0),
  size: z.number().positive().optional(),
  scale: z.number().positive().max(20).default(1),
  flip: placeShape.flip,
});

function kindError(id: string, kind: AssetKind, spec: AssetSpec): string | undefined {
  if (spec.type === 'gen') {
    const { gen } = spec.value;
    if (!isGeneratorName(gen))
      return `unknown generator '${gen}'; generators: ${Object.keys(GENERATORS).join(', ')}`;
    if (kind === 'character' && !CREATURES.includes(gen))
      return `a character is drawn by ${CREATURES.join(', ')} (or parts, a sprite, draw); '${gen}' makes a prop or backdrop`;
    if (kind === 'backdrop' && !PLACES.includes(gen))
      return `a backdrop is drawn by ${PLACES.join(', ')} or layers`;
  }
  if (spec.type === 'layers') {
    if (kind !== 'backdrop')
      return `layers are for backdrops; ${kind} '${id}' takes parts, a sprite, gen or draw`;
    const bad = spec.value.layers.find((layer) => !isGeneratorName(layer.gen));
    if (bad !== undefined) return `layer generator '${bad.gen}' is unknown`;
  }
  return undefined;
}

interface Entry {
  readonly kind: AssetKind;
  readonly spec: AssetSpec;
}

/** Everything but `gen` and `description` of a generator preset. */
function presetOptions(spec: Readonly<Record<string, unknown>>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(spec).filter(([key]) => key !== 'gen' && key !== 'description'),
  );
}

export class ArtRegistry {
  private readonly entries = new Map<string, Entry>();

  constructor(private readonly where = 'page.art') {}

  get ids(): string[] {
    return [...this.entries.keys()];
  }

  kindOf(id: string): AssetKind | undefined {
    return this.entries.get(id)?.kind;
  }

  define(kind: AssetKind, id: string, value: unknown): void {
    const where = `${this.where}.define${kind[0]?.toUpperCase() ?? ''}${kind.slice(1)}('${id}')`;
    if (!ASSET_ID.test(id))
      throw new KitError(
        'invalid-params',
        `${where}: ids are kebab case, e.g. 'park-ranger' (a-z, 0-9, -; <= 40)`,
      );
    if (isGeneratorName(id))
      throw new KitError(
        'invalid-params',
        `${where}: '${id}' is a generator name; pick a name for YOUR thing, e.g. 'old-${id}'`,
      );
    if (this.entries.has(id))
      throw new KitError('invalid-params', `${where}: '${id}' is already defined`);
    if (this.entries.size >= MAX_ASSETS)
      throw new KitError(
        'invalid-params',
        `${where}: at most ${String(MAX_ASSETS)} defined things per page`,
      );
    const spec = parseAssetSpec(value, where);
    const problem = kindError(id, kind, spec);
    if (problem !== undefined) throw new KitError('invalid-params', `${where}: ${problem}`);
    this.entries.set(id, { kind, spec });
  }

  /** Draws a defined thing: where it stands, how tall, which way (gen presets take any of their knobs). */
  draw(g: ComicPen, id: string, options: Readonly<Record<string, unknown>> = {}): void {
    const entry = this.entries.get(id);
    if (entry === undefined) {
      const known = this.ids;
      throw new KitError(
        'invalid-params',
        `${this.where}.draw: '${id}' is not defined (defined: ${known.length > 0 ? known.join(', ') : 'nothing yet'}; defineProp/defineCharacter/defineBackdrop first)`,
      );
    }
    this.drawEntry(g, id, entry, options, 0);
  }

  /** Draws a defined backdrop (or any defined thing) to fill a box [x, y, w, h]. */
  drawInBox(g: ComicPen, id: string, box: readonly [number, number, number, number]): void {
    const entry = this.entries.get(id);
    if (entry === undefined) {
      this.draw(g, id);
      return;
    }
    const [x, y, w, h] = box;
    const { spec } = entry;
    const filled =
      spec.type === 'layers' ||
      spec.type === 'draw' ||
      (spec.type === 'gen' && PLACES.includes(spec.value.gen));
    this.drawEntry(
      g,
      id,
      entry,
      filled ? { box: [...box] } : { x: x + w / 2, y: y + h, size: h },
      0,
    );
  }

  private drawEntry(
    g: ComicPen,
    id: string,
    entry: Entry,
    options: Readonly<Record<string, unknown>>,
    depth: number,
  ): void {
    const { spec } = entry;
    const where = `${this.where}.draw('${id}')`;
    switch (spec.type) {
      case 'layers':
        for (const layer of spec.value.layers)
          this.drawGen(g, { ...presetOptions(layer), ...options }, layer.gen, where);
        return;
      case 'draw':
        spec.value.draw(g, options);
        return;
      case 'gen':
        this.drawGen(g, { ...presetOptions(spec.value), ...options }, spec.value.gen, where);
        return;
      default: {
        const place = parseArt(placeSchema, options, where);
        const height =
          spec.type === 'parts'
            ? spec.value.height
            : spec.value.sprite.rows.length * spec.value.sprite.px;
        const k = ((place.size ?? height) / height) * place.scale;
        const sk = new Sketch(g, {
          x: place.x,
          y: place.y,
          k,
          flip: place.flip,
          angle: 0,
          key: `art:${id}`,
        });
        if (spec.type === 'parts') drawParts(sk, spec.value.parts, this.resolver(), depth);
        else drawSprite(sk, spec.value.sprite);
      }
    }
  }

  private drawGen(
    g: ComicPen,
    options: Readonly<Record<string, unknown>>,
    gen: string,
    where: string,
  ): void {
    if (!isGeneratorName(gen))
      throw new KitError('invalid-params', `${where}: unknown generator '${gen}'`);
    const generator = GENERATORS[gen];
    generator.draw(g, parseArt(generator.schema, options, `${where} (${gen})`));
  }

  /** `{ shape: 'use', id }` inside parts: the defined thing drawn in the part's frame. */
  resolver(): UseResolver {
    const use: UseResolver = (id, sk, depth) => {
      const entry = this.entries.get(id);
      if (entry === undefined)
        throw new KitError(
          'invalid-params',
          `${this.where}: part uses '${id}', which is not defined`,
        );
      const { spec } = entry;
      if (spec.type === 'parts') drawParts(sk, spec.value.parts, use, depth);
      else if (spec.type === 'sprite') drawSprite(sk, spec.value.sprite);
      else this.drawEntry(sk.g, id, entry, sk.placeOptions({ size: 100 }), depth);
    };
    return use;
  }
}
