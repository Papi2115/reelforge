/**
 * `reelforge kit-docs generators` (real run Game B2 #2: the world-assets turn guessed generator
 * options, 8 of 14 `world-assets check` calls failed): every generator of the project's world
 * with every option and its allowed values (enums, ranges, defaults), read from the kit's own
 * schemas (`worldGeneratorDocs`); `kit-docs generators.<name>` gives one generator with the
 * option notes line by line. Each text stays under the kit-docs output limit.
 */
import { worldGeneratorDocs, type WorldGenerator, type WorldGeneratorDocs } from '@reelforge/kit';
import { WORLD_ASSET_WORLDS } from '@reelforge/shared';
import { UsageError } from '../errors.js';
import { suggestNames } from './suggest.js';

export const GENERATORS_TOPIC = 'generators';

type Schema = Readonly<Record<string, unknown>>;

const isSchema = (value: unknown): value is Schema =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const list = (value: unknown): Schema[] => (Array.isArray(value) ? value.filter(isSchema) : []);

const num = (value: unknown): string | undefined =>
  typeof value === 'number' ? String(value) : undefined;

type Lists = Readonly<Record<string, readonly string[]>>;

/** The name of the list holding exactly these values, if any. */
function listName(values: readonly unknown[], lists: Lists): string | undefined {
  return Object.entries(lists).find(
    ([, known]) =>
      values.length === known.length && values.every((value) => known.includes(String(value))),
  )?.[0];
}

/** Bounds as wide as the safe integers say nothing (`int`, not `int -9007199254740991..`). */
const bound = (value: unknown): string | undefined =>
  typeof value === 'number' && Math.abs(value) < Number.MAX_SAFE_INTEGER
    ? String(value)
    : undefined;

function range(schema: Schema): string {
  const low = bound(schema['minimum']) ?? bound(schema['exclusiveMinimum']);
  const high = bound(schema['maximum']) ?? bound(schema['exclusiveMaximum']);
  if (low === undefined && high === undefined) return '';
  const from = schema['exclusiveMinimum'] === undefined ? (low ?? '') : `>${low ?? ''}`;
  const to = schema['exclusiveMaximum'] === undefined ? (high ?? '') : `<${high ?? ''}`;
  return ` ${from}..${to}`;
}

function count(schema: Schema): string {
  const low = num(schema['minItems']);
  const high = num(schema['maxItems']);
  return low === undefined && high === undefined ? '' : ` (${low ?? '0'}-${high ?? 'n'} items)`;
}

/** The allowed values of one option: `a|b|c`, `int 0..10`, `colour`, `{ skin?: colour }`. */
export function valueText(schema: Schema, lists: Lists): string {
  const values = schema['enum'];
  if (Array.isArray(values)) return listName(values, lists) ?? values.map(String).join('|');
  if ('const' in schema) return JSON.stringify(schema['const']);
  const union = [...list(schema['anyOf']), ...list(schema['oneOf'])].filter(
    (option) => option['type'] !== 'null',
  );
  if (union.length > 0) return union.map((option) => valueText(option, lists)).join('|');
  const tuple = list(schema['prefixItems']);
  if (tuple.length > 0) return `[${tuple.map((item) => valueText(item, lists)).join(', ')}]`;
  switch (schema['type']) {
    case 'integer':
      return `int${range(schema)}`;
    case 'number':
      return `number${range(schema)}`;
    case 'boolean':
      return 'true|false';
    case 'array': {
      const items = schema['items'];
      return `${isSchema(items) ? valueText(items, lists) : 'any'}[]${count(schema)}`;
    }
    case 'object':
      return objectText(schema, lists);
    default:
      return typeof schema['type'] === 'string' ? schema['type'] : 'any';
  }
}

function objectText(schema: Schema, lists: Lists): string {
  const properties = isSchema(schema['properties']) ? schema['properties'] : undefined;
  if (properties !== undefined && Object.keys(properties).length > 0) {
    return `{ ${optionTexts(schema, lists, false).join(', ')} }`;
  }
  const extra = schema['additionalProperties'];
  return isSchema(extra) ? `{ "<name>": ${valueText(extra, lists)} }` : 'object';
}

/** `name?: values = default` per option (+ ` (description)` when asked). */
function optionTexts(schema: Schema, lists: Lists, notes: boolean): string[] {
  const properties = isSchema(schema['properties']) ? schema['properties'] : {};
  const required = Array.isArray(schema['required']) ? schema['required'] : [];
  return Object.entries(properties).map(([name, value]) => {
    const option = isSchema(value) ? value : {};
    const optional = required.includes(name) ? '' : '?';
    const fallback =
      option['default'] === undefined ? '' : ` = ${JSON.stringify(option['default'])}`;
    const description = option['description'];
    const note = notes && typeof description === 'string' ? ` (${description})` : '';
    return `${name}${optional}: ${valueText(option, lists)}${fallback}${note}`;
  });
}

function header(docs: WorldGeneratorDocs): string[] {
  return [
    ...Object.entries(docs.lists).map(
      ([name, values]) =>
        `${name} (an option typed ${name} takes one of these): ${values.join(', ')}`,
    ),
    ...docs.notes.map((note) => `note: ${note}`),
  ];
}

function generatorLines(generator: WorldGenerator, docs: WorldGeneratorDocs): string[] {
  const summary = generator.summary === undefined ? '' : ` — ${generator.summary}`;
  return [
    `${generator.name}: ${generator.use}${summary}`,
    `  ${optionTexts(generator.options, docs.lists, true).join('; ')}`,
  ];
}

function oneGenerator(docs: WorldGeneratorDocs, name: string): string {
  const generator = docs.generators.find((entry) => entry.name === name);
  if (generator === undefined) {
    const names = docs.generators.map((entry) => entry.name);
    const guesses = suggestNames(name, names);
    throw new UsageError(
      `no ${docs.world} generator "${name}"${guesses.length === 0 ? '' : `; did you mean: ${guesses.join(', ')}?`}\ngenerators: ${names.join(', ')}`,
    );
  }
  const summary = generator.summary === undefined ? '' : ` — ${generator.summary}`;
  return [
    `${docs.world} generator ${generator.name}: ${generator.use}${summary}`,
    'options (name?: allowed values = default; ? = may be left out):',
    ...optionTexts(generator.options, docs.lists, true).map((line) => `  ${line}`),
    ...header(docs),
  ].join('\n');
}

/**
 * `kit-docs generators` (every generator of the project's world) or `generators.<name>` (one).
 * `world` is the project's style.
 */
export function describeGenerators(world: string | undefined, name?: string): string {
  const docs = worldGeneratorDocs(world);
  if (docs === undefined) {
    return `generators: only world projects (${WORLD_ASSET_WORLDS.join(', ')}) have them; this project's style is ${world ?? 'unknown'}`;
  }
  if (name !== undefined) return oneGenerator(docs, name);
  return [
    `generators of ${docs.world} for the asset files (assets/${docs.world}/*.json): every option with its allowed values (name?: values = default; ? = may be left out). Never pass a value that is not listed. One generator: reelforge kit-docs ${GENERATORS_TOPIC}.<name>`,
    ...header(docs),
    ...docs.generators.flatMap((generator) => generatorLines(generator, docs)),
  ].join('\n');
}

/** The topic name of `input` (`generators` or `generators.<name>`), or undefined. */
export function generatorsTopic(input: string): { readonly name?: string } | undefined {
  if (input === GENERATORS_TOPIC) return {};
  const prefix = `${GENERATORS_TOPIC}.`;
  return input.startsWith(prefix) ? { name: input.slice(prefix.length) } : undefined;
}
