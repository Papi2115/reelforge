/**
 * The generator registry of `page.draw(kind, options)` (PLAN.md#13.15a): every family by kind,
 * the option schema of a call (placement + the shared knobs), and the finishing touches (`bold`
 * outline for a hero, `plain` without fills). `vocabularyLines()` is the docs table.
 */
import { z } from 'zod';
import { KitError } from '../../../../errors.js';
import { fitDoodle } from '../compile.js';
import {
  completeDoodle,
  placeOptions,
  SHADES,
  swatch,
  type DoodlePart,
  type DoodleSpec,
  type Shade,
} from '../spec.js';
import { ANIMAL_FAMILIES } from './animals.js';
import { CREATURE_FAMILIES } from './creatures.js';
import { Draft } from './draft.js';
import { GROUPS, type Family, type Knobs } from './family.js';
import { EFFECT_FAMILIES, ICON_FAMILIES } from './icons.js';
import { OBJECT_FAMILIES } from './objects.js';
import { PLANT_FAMILIES } from './plants.js';
import { SCENERY_FAMILIES } from './scenery.js';
import { STRUCTURE_FAMILIES } from './structures.js';
import { TOOL_FAMILIES } from './tools.js';

export const FAMILIES: readonly Family[] = [
  ...ANIMAL_FAMILIES,
  ...CREATURE_FAMILIES,
  ...PLANT_FAMILIES,
  ...SCENERY_FAMILIES,
  ...STRUCTURE_FAMILIES,
  ...OBJECT_FAMILIES,
  ...TOOL_FAMILIES,
  ...ICON_FAMILIES,
  ...EFFECT_FAMILIES,
];

const BY_KIND = new Map(FAMILIES.map((entry) => [entry.kind, entry]));

export const DRAW_KINDS: readonly string[] = FAMILIES.map((entry) => entry.kind);

export function familyOf(kind: unknown, call: string): Family {
  const found = typeof kind === 'string' ? BY_KIND.get(kind) : undefined;
  if (found) return found;
  throw new KitError(
    'invalid-params',
    `${call}: unknown kind "${String(kind)}"; kinds are ${DRAW_KINDS.join(', ')} (or page.doodle / page.spot for your own drawing)`,
  );
}

const enumOf = (values: readonly string[]) => z.enum(values as [string, ...string[]]);

/** Knobs shared by every family (on top of the placement). */
export function knobShape(entry: Family) {
  const types = Object.keys(entry.types);
  return {
    type: enumOf(types).default(types[0] ?? ''),
    color: swatch.optional().describe('Main crayon colour'),
    action: entry.actions ? enumOf(entry.actions).optional() : z.undefined().optional(),
    count: z.int().min(1).max(60).optional(),
    plain: z.boolean().default(false).describe('Outline only, no crayon'),
    shade: z.enum(SHADES).optional().describe('Crayon of every fill: hatch|dense|light|scribble'),
    bold: z.boolean().optional().describe('Fatter outline (default: when hero)'),
  };
}

const SCHEMAS = new Map<string, ReturnType<typeof drawSchemaOf>>();

function drawSchemaOf(entry: Family) {
  return placeOptions.extend(knobShape(entry));
}

export function drawSchema(entry: Family): ReturnType<typeof drawSchemaOf> {
  let schema = SCHEMAS.get(entry.kind);
  if (!schema) {
    schema = drawSchemaOf(entry);
    SCHEMAS.set(entry.kind, schema);
  }
  return schema;
}

const KEEP_BOX: ReadonlySet<string> = new Set(['backdrop', 'icon', 'effect']);

export interface FinishOptions {
  readonly plain: boolean;
  readonly bold: boolean;
  readonly shade?: Shade | undefined;
}

/** `bold`: felt outlines 3 px; `plain`: no fills (a pure hatch part goes). */
export function finish(spec: DoodleSpec, o: FinishOptions): DoodleSpec {
  if (!o.plain && !o.bold && o.shade === undefined) return spec;
  const parts = spec.parts
    .filter((part) => !(o.plain && 'hatch' in part))
    .map((part): DoodlePart => {
      let out: DoodlePart = part;
      if (o.plain && out.fill !== undefined) out = { ...out, fill: undefined };
      if (o.bold && out.nib === 'felt' && out.width === undefined) out = { ...out, width: 3 };
      if (o.shade !== undefined && out.fill !== undefined) out = { ...out, shade: o.shade };
      return out;
    });
  return { ...spec, parts: parts.length > 0 ? parts : spec.parts };
}

/** A family's drawing for these knobs and seed, completed and finished. */
export function makeDrawing(
  entry: Family,
  knobs: Knobs,
  seed: number,
  finishing: FinishOptions,
  call: string,
): DoodleSpec {
  const maker = entry.types[knobs.type];
  if (!maker) throw new KitError('invalid-params', `${call}: unknown type "${knobs.type}"`);
  const spec = finish(completeDoodle(maker(new Draft(seed), knobs), call), finishing);
  // Backdrops (page px), icons and effects (a fixed frame) keep their box; everything else is
  // fitted, so `h` is the height of the drawing itself.
  return KEEP_BOX.has(entry.group) ? spec : fitDoodle(spec);
}

/** Kind -> where to find a held item by its type name (`holds: 'axe'`). */
export function itemFamily(type: string): Family | undefined {
  const order = ['tool', 'instrument', 'object', 'plant', 'icon', 'vehicle', 'animal'];
  for (const group of order) {
    const found = FAMILIES.find((entry) => entry.group === group && type in entry.types);
    if (found) return found;
  }
  return undefined;
}

/** One docs line per group: `group: kind (type, type, ...) ...`. */
export function vocabularyLines(): string[] {
  return GROUPS.map((group) => {
    const kinds = FAMILIES.filter((entry) => entry.group === group).map((entry) => {
      const actions = entry.actions ? `; action ${entry.actions.join('|')}` : '';
      return `${entry.kind} (${entry.summary}${actions})`;
    });
    return `${group}: ${kinds.join('; ')}`;
  });
}
