/** `reelforge kit-docs [name]`: the voxel kit catalog (kitCatalog()) as compact reference text. */
import { kitCatalog, type KitCatalog, type KitCatalogEntry } from '@reelforge/kit';
import { COMMON_OPTIONS, parseCommandArgs } from '../args.js';
import { result, type Command } from '../command.js';
import { UsageError } from '../errors.js';

export const KIT_DOCS_USAGE = `usage: reelforge kit-docs [--json] [name]
Without a name: every ctx.kit function (kit.voxel.*, kit.env.*, kit.props.*, kit.fx.*) with its
params. With a name (e.g. calculator, props.calculator, fromGrid): details and an example call.
Exit code: 0 ok, 2 usage error (unknown name).`;

const NAMESPACE: Readonly<Record<KitCatalogEntry['kind'], string>> = {
  env: 'env',
  prop: 'props',
  fx: 'fx',
};
const EXAMPLE_PARAMS = 3;

type JsonSchema = Readonly<Record<string, unknown>>;

function isSchema(value: unknown): value is JsonSchema {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** A JSON Schema list keyword (`enum`), or [] when absent. */
function schemaValues(value: unknown): readonly unknown[] {
  return Array.isArray(value) ? value : [];
}

function schemaList(value: unknown): JsonSchema[] {
  return Array.isArray(value) ? value.filter(isSchema) : [];
}

/** Short type of a JSON Schema: `"a"|"b"`, `number`, `[number, number, number]`, `string[]`. */
export function typeSummary(schema: JsonSchema): string {
  const values = schema['enum'];
  if (Array.isArray(values)) return values.map((value) => JSON.stringify(value)).join('|');
  if ('const' in schema) return JSON.stringify(schema['const']);
  const union = [...schemaList(schema['anyOf']), ...schemaList(schema['oneOf'])];
  if (union.length > 0) return union.map(typeSummary).join('|');
  const tuple = schemaList(schema['prefixItems']);
  if (tuple.length > 0) return `[${tuple.map(typeSummary).join(', ')}]`;
  const type = schema['type'];
  if (type === 'array') {
    const items = schema['items'];
    return `${isSchema(items) ? typeSummary(items) : 'any'}[]`;
  }
  if (typeof type === 'string') return type === 'integer' ? 'int' : type;
  return 'any';
}

interface ParamDoc {
  readonly name: string;
  readonly type: string;
  readonly required: boolean;
  readonly defaultValue: unknown;
  /** First allowed value of an enum (for examples). */
  readonly firstValue: unknown;
  readonly description: string | undefined;
}

export function paramDocs(params: JsonSchema): ParamDoc[] {
  const properties = isSchema(params['properties']) ? params['properties'] : {};
  const required = Array.isArray(params['required']) ? params['required'] : [];
  return Object.entries(properties).map(([name, value]) => {
    const schema = isSchema(value) ? value : {};
    const description = schema['description'];
    const values = schema['enum'];
    return {
      name,
      type: typeSummary(schema),
      required: required.includes(name),
      defaultValue: schema['default'],
      firstValue: schemaValues(values)[0],
      description: typeof description === 'string' ? description : undefined,
    };
  });
}

function formatParam(param: ParamDoc): string {
  const optional = param.required ? '' : '?';
  const fallback =
    param.defaultValue === undefined ? '' : ` = ${JSON.stringify(param.defaultValue)}`;
  return `${param.name}${optional}: ${param.type}${fallback}`;
}

function callName(entry: KitCatalogEntry): string {
  return `kit.${NAMESPACE[entry.kind]}.${entry.name}`;
}

function entryLine(entry: KitCatalogEntry): string {
  const params = paramDocs(entry.params).map(formatParam).join(', ');
  return `  ${callName(entry)}({ ${params} }) — ${entry.description}`;
}

/** The whole catalog, one line per function. */
export function formatCatalog(catalog: KitCatalog): string {
  const lines = [
    `kit ${catalog.version} (ctx.kit; build() only; colours are palette names)`,
    'kit.voxel:',
  ];
  for (const doc of Object.values(catalog.voxel)) {
    lines.push(`  kit.voxel.${doc.signature} — ${doc.description}`);
  }
  const sections: [string, readonly KitCatalogEntry[]][] = [
    ['kit.env', catalog.env],
    ['kit.props', catalog.props],
    ['kit.fx', catalog.fx],
  ];
  for (const [title, entries] of sections) {
    lines.push(`${title}:${entries.length === 0 ? ' (none yet)' : ''}`, ...entries.map(entryLine));
  }
  lines.push('details + example: reelforge kit-docs <name>');
  return lines.join('\n');
}

/** Example call using defaults (or the first allowed value) of the first few params. */
export function exampleCall(entry: KitCatalogEntry): string {
  const shown = paramDocs(entry.params)
    .map((param) => {
      const sample = param.defaultValue ?? param.firstValue;
      return sample === undefined ? undefined : `${param.name}: ${JSON.stringify(sample)}`;
    })
    .filter((part): part is string => part !== undefined)
    .slice(0, EXAMPLE_PARAMS);
  return `const ${entry.name} = ${callName(entry)}({ ${shown.join(', ')} });`;
}

function formatEntry(entry: KitCatalogEntry): string {
  const params = paramDocs(entry.params);
  const anchors = Object.entries(entry.anchors);
  return [
    `${callName(entry)}(params) — ${entry.description}`,
    'params:',
    ...(params.length === 0
      ? ['  (none)']
      : params.map(
          (param) => `  ${formatParam(param)}${param.description ? ` — ${param.description}` : ''}`,
        )),
    `anchors (besides the standard ones):${anchors.length === 0 ? ' none' : ''}`,
    ...anchors.map(([name, meaning]) => `  ${name} — ${meaning}`),
    'example (in build(ctx)):',
    `  ${exampleCall(entry)}`,
  ].join('\n');
}

/** `calculator`, `props.calculator`, `kit.props.calculator`, `fromGrid`, `voxel.fromGrid`. */
export function describeKitName(catalog: KitCatalog, input: string): string {
  const name = input.replace(/^kit\./, '');
  const [first, second] = name.split('.');
  const bare = second ?? first ?? '';
  const voxelDoc = Object.entries(catalog.voxel).find(([key]) => key === bare);
  if (voxelDoc && (second === undefined || first === 'voxel')) {
    return `kit.voxel.${voxelDoc[1].signature}\n  ${voxelDoc[1].description}`;
  }
  const entries = [...catalog.env, ...catalog.props, ...catalog.fx];
  const entry = entries.find(
    (candidate) =>
      candidate.name === bare && (second === undefined || NAMESPACE[candidate.kind] === first),
  );
  if (entry) return formatEntry(entry);
  const known = [...Object.keys(catalog.voxel), ...entries.map((candidate) => candidate.name)];
  throw new UsageError(`no kit function "${input}"; known: ${known.join(', ')}`);
}

export const kitDocsCommand: Command = {
  name: 'kit-docs',
  summary: 'reference of ctx.kit (voxel tools, environments, props, effects)',
  usage: KIT_DOCS_USAGE,
  run(argv) {
    const { positionals } = parseCommandArgs(argv, COMMON_OPTIONS, true);
    if (positionals.length > 1) throw new UsageError('kit-docs takes at most one name');
    const catalog = kitCatalog();
    const name = positionals[0];
    const text = name === undefined ? formatCatalog(catalog) : describeKitName(catalog, name);
    const json = name === undefined ? catalog : { name, text };
    return Promise.resolve(result(0, [text], json));
  },
};
