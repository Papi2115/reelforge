/**
 * `reelforge kit-docs [name]`: the voxel kit catalog (kitCatalog()) as compact reference text,
 * with the project's own props (`kit-ext/props/*.js`, read without running them) marked
 * project-local, and how to write one (`kit-docs prop-module`).
 */
import { extractPropMeta } from '@reelforge/engine';
import {
  kitCatalog,
  propExtensionCatalogEntry,
  type KitCatalog,
  type KitCatalogEntry,
} from '@reelforge/kit';
import { COMMON_OPTIONS, parseCommandArgs } from '../args.js';
import { result, type Command } from '../command.js';
import { UsageError } from '../errors.js';
import { readKitExtensions } from '../project/kit-ext.js';
import { CTX_TOPICS, describeCtxTopic } from './ctx-docs.js';
import { PROP_MODULE_TOPIC, propModuleDocs } from './prop-module-docs.js';
import { formatParam, paramDocs } from './schema-docs.js';

export { paramDocs, typeSummary } from './schema-docs.js';

export const KIT_DOCS_USAGE = `usage: reelforge kit-docs [--json] [name]
Without a name: every ctx.kit function (kit.voxel.*, kit.env.*, kit.props.*, kit.fx.*) with its
params. With a name (e.g. calculator, props.calculator, fromGrid): details and an example call.
The rest of the scene context: reelforge kit-docs ctx (or camera, text, anchor, sfx, rng, ease, shot).
Project props (kit-ext/props/*.js) are listed as project-local; writing one: reelforge kit-docs prop-module.
Exit code: 0 ok, 2 usage error (unknown name).`;

const NAMESPACE: Readonly<Record<KitCatalogEntry['kind'], string>> = {
  env: 'env',
  prop: 'props',
  fx: 'fx',
};
const EXAMPLE_PARAMS = 3;

function callName(entry: KitCatalogEntry): string {
  return `kit.${NAMESPACE[entry.kind]}.${entry.name}`;
}

function originNote(entry: KitCatalogEntry): string {
  return entry.origin === 'project' ? ' (project-local, kit-ext/props)' : '';
}

function entryLine(entry: KitCatalogEntry): string {
  const params = paramDocs(entry.params).map(formatParam).join(', ');
  return `  ${callName(entry)}({ ${params} })${originNote(entry)} — ${entry.description}`;
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
  lines.push(
    'details + example: reelforge kit-docs <name>; a missing prop can be built: reelforge kit-docs prop-module',
    'camera rigs, ctx.text options, anchors, sfx, rng, easings: reelforge kit-docs ctx (or camera, text, ...)',
  );
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
  const methods = Object.entries(entry.methods ?? {});
  return [
    `${callName(entry)}(params)${originNote(entry)} — ${entry.description}`,
    'params:',
    ...(params.length === 0
      ? ['  (none)']
      : params.map(
          (param) => `  ${formatParam(param)}${param.description ? ` — ${param.description}` : ''}`,
        )),
    `anchors (besides the standard ones):${anchors.length === 0 ? ' none' : ''}`,
    ...anchors.map(([name, meaning]) => `  ${name} — ${meaning}`),
    ...(methods.length === 0
      ? []
      : ['methods:', ...methods.map(([call, meaning]) => `  ${call} — ${meaning}`)]),
    'example (in build(ctx)):',
    `  ${exampleCall(entry)}`,
  ].join('\n');
}

/** `calculator`, `props.calculator`, `kit.props.calculator`, `fromGrid`, `voxel.fromGrid`. */
export function describeKitName(catalog: KitCatalog, input: string): string {
  if (input === PROP_MODULE_TOPIC) return propModuleDocs();
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
  const ctxTopic = describeCtxTopic(name);
  if (ctxTopic !== undefined) return ctxTopic;
  const known = [...Object.keys(catalog.voxel), ...entries.map((candidate) => candidate.name)];
  throw new UsageError(
    `no kit function "${input}"; known: ${known.join(', ')}; scene context: ${CTX_TOPICS.join(', ')}`,
  );
}

/** Catalog entries of the project's props, and one line per prop module that cannot be read. */
export async function projectProps(
  root: string,
): Promise<{ entries: KitCatalogEntry[]; problems: string[] }> {
  const files = await readKitExtensions(root);
  const entries: KitCatalogEntry[] = [];
  const problems = files.ignored.map(
    (file) => `ignored: ${file} (prop file names are camelCase, e.g. kit-ext/props/fileIcon.js)`,
  );
  for (const extension of files.extensions) {
    const meta = extractPropMeta(extension.source, extension.file);
    if (meta.ok && meta.meta.name === extension.name) {
      entries.push(propExtensionCatalogEntry(meta.meta));
    } else {
      const why = meta.ok ? `prop.name is "${meta.meta.name}"` : meta.error;
      problems.push(
        `not loadable: ${extension.file}: ${why} (run reelforge lint ${extension.file})`,
      );
    }
  }
  return { entries, problems };
}

export const kitDocsCommand: Command = {
  name: 'kit-docs',
  summary:
    'reference of ctx.kit (voxel tools, environments, props, effects) and ctx (camera, text, ...)',
  usage: KIT_DOCS_USAGE,
  async run(argv, context) {
    const { positionals } = parseCommandArgs(argv, COMMON_OPTIONS, true);
    if (positionals.length > 1) throw new UsageError('kit-docs takes at most one name');
    const project = await projectProps(context.root);
    const catalog = kitCatalog(project.entries);
    const name = positionals[0];
    const text =
      name === undefined
        ? [formatCatalog(catalog), ...project.problems].join('\n')
        : describeKitName(catalog, name);
    const json = name === undefined ? { ...catalog, problems: project.problems } : { name, text };
    return result(0, [text], json);
  },
};
