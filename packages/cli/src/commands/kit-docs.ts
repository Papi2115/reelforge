/**
 * `reelforge kit-docs [name]`: the kit catalog (kitCatalog()) as compact reference text, with the
 * project's own props (`kit-ext/props/*.js`, read without running them) marked project-local, and
 * how to write one (`kit-docs prop-module`). Without a name: the index, kept short enough for the
 * Bash output limit (kit-docs-index.ts); with a kind or look: that slice (kit-docs-slices.ts).
 */
import { extractPropMeta } from '@reelforge/engine';
import {
  kitCatalog,
  LOOKS,
  propExtensionCatalogEntry,
  type KitCatalog,
  type KitCatalogEntry,
  type ProjectCast,
} from '@reelforge/kit';
import { KIT_EXT_PROPS_DIR, projectFileSchema, type LookMode } from '@reelforge/shared';
import { COMMON_OPTIONS, parseCommandArgs, parseInteger } from '../args.js';
import { result, type Command } from '../command.js';
import { UsageError } from '../errors.js';
import { readCastRoles } from '../project/cast-roles.js';
import { checkJsonFile } from '../project/files.js';
import { extensionsOfKind, readKitExtensions } from '../project/kit-ext.js';
import { readWorldAssetFiles, worldAssetSet } from '../project/world-assets.js';
import { PROJECT_PATHS } from '../project/paths.js';
import { projectCastOf } from './cast-preview.js';
import { CTX_TOPICS, describeCtxTopic } from './ctx-docs.js';
import { C_CAM_TOPIC_NAMES, describeCCamTopic } from './kit-docs-c-cam.js';
import { describeInkModulesTopic, INK_MODULE_TOPICS } from './kit-docs-c-cam-people.js';
import { C_CAM_REFERENCE_TOPICS, describeCCamReferenceTopic } from './kit-docs-c-cam-shots.js';
import { C_CAM_VOCAB_TOPIC_NAMES, describeInkVocabTopic } from './kit-docs-c-cam-vocab.js';
import { CHARACTERS_TOPIC, describeCharacters } from './kit-docs-characters.js';
import { describeGenerators, generatorsTopic, GENERATORS_TOPIC } from './kit-docs-generators.js';
import { formatCatalog } from './kit-docs-index.js';
import {
  describeWorldAssets,
  experimentalWorldsEnabled,
  kitDocsLookMode,
  kitDocsScope,
  WORLD_ASSETS_TOPIC,
} from './kit-docs-world.js';
import { callName, NAMESPACE, originNote } from './kit-docs-lines.js';
import { describeSlice, sliceNames } from './kit-docs-slices.js';
import { PROP_MODULE_TOPIC, propModuleDocs } from './prop-module-docs.js';
import { formatParam, paramDocs } from './schema-docs.js';
import { suggestNames } from './suggest.js';

export { paramDocs, typeSummary } from './schema-docs.js';
export { formatCatalog, INDEX_BUDGETS, OUTPUT_BUDGET } from './kit-docs-index.js';

export const KIT_DOCS_USAGE = `usage: reelforge kit-docs [--json] [name | kind | look] [--full] [--page n]
Without a name: the kit index (kit.voxel.*, kit.env.*, kit.props.*, kit.fx.*), kept short enough
to show in full. With a name (e.g. calculator, props.calculator, fromGrid): details and an example call.
With a kind (props, env, fx, templates, project) or a look id (voxel, retro-ui, diorama, blueprint):
one line per entry of that slice; --full adds every param (long slices come in pages: --page 2).
The rest of the scene context: reelforge kit-docs ctx (or camera, text, annotate, anchor, sfx, rng, ease, shot).
The character pack (kit.cast: mascots, cast, mannequin, role specs): reelforge kit-docs characters.
A world project's own assets (assets/<world>/*.json, ctx.worldAssets): reelforge kit-docs world-assets;
their generators with every option's allowed values: reelforge kit-docs generators (one: generators.<name>).
Project props (kit-ext/props/*.js) are listed as project-local; writing one: reelforge kit-docs prop-module.
Exit code: 0 ok, 2 usage error (unknown name).`;

const EXAMPLE_PARAMS = 3;
const KIT_DOCS_OPTIONS = {
  ...COMMON_OPTIONS,
  full: { type: 'boolean', default: false },
  page: { type: 'string' },
} as const;

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

export interface DescribeOptions {
  readonly lookMode?: LookMode;
  /** The project's roles and accessories (kit-docs characters lists them). */
  readonly cast?: ProjectCast | undefined;
  readonly full?: boolean;
  readonly page?: number;
  /** The project's style and world asset ids (kit-docs world-assets, PLAN.md#13.15). */
  readonly style?: string | undefined;
  readonly worldAssetIds?: Readonly<Record<string, readonly string[]>> | undefined;
}

function unknownName(catalog: KitCatalog, input: string, name: string): UsageError {
  const entries = [...catalog.env, ...catalog.props, ...catalog.fx];
  const known = [
    ...Object.keys(catalog.voxel),
    ...entries.map((entry) => entry.name),
    ...sliceNames(catalog),
    ...CTX_TOPICS,
    PROP_MODULE_TOPIC,
    CHARACTERS_TOPIC,
    WORLD_ASSETS_TOPIC,
    GENERATORS_TOPIC,
    ...C_CAM_TOPIC_NAMES,
    ...INK_MODULE_TOPICS,
    ...C_CAM_REFERENCE_TOPICS,
    ...C_CAM_VOCAB_TOPIC_NAMES,
  ];
  const bare = name.split('.').at(-1) ?? name;
  const guesses = suggestNames(bare, known);
  return new UsageError(
    [
      `no kit function "${input}"`,
      guesses.length === 0 ? '' : `; did you mean: ${guesses.join(', ')}?`,
      `\nkinds: ${sliceNames(catalog).slice(0, 5).join(', ')}`,
      `; looks: ${catalog.looks.map((look) => look.id).join(', ')}`,
      `; scene context: ${CTX_TOPICS.join(', ')}`,
      `; characters (mascots, cast, roles): ${CHARACTERS_TOPIC}`,
      '\nthe index: reelforge kit-docs; one kind with every param: reelforge kit-docs props --full',
    ].join(''),
  );
}

/**
 * `calculator`, `props.calculator`, `kit.props.calculator`, `fromGrid`, `voxel.fromGrid`, a kind
 * (`props`, `env`, `fx`, `templates`, `project`), a look id, a ctx topic or `prop-module`.
 */
export function describeKitName(
  catalog: KitCatalog,
  input: string,
  options: DescribeOptions = {},
): string {
  if (input === PROP_MODULE_TOPIC) return propModuleDocs();
  const inkModules = describeInkModulesTopic(input);
  if (inkModules !== undefined) return inkModules;
  const grimInk = describeCCamTopic(input);
  if (grimInk !== undefined) return grimInk;
  const grimInkReference = describeCCamReferenceTopic(input);
  if (grimInkReference !== undefined) return grimInkReference;
  const grimInkVocab = describeInkVocabTopic(input);
  if (grimInkVocab !== undefined) return grimInkVocab;
  if (input === WORLD_ASSETS_TOPIC)
    return describeWorldAssets(options.style, options.worldAssetIds);
  const generators = generatorsTopic(input);
  if (generators !== undefined) return describeGenerators(options.style, generators.name);
  const name = input.replace(/^kit\./, '');
  const slice = describeSlice(catalog, name, {
    lookMode: options.lookMode ?? 'voxel-only',
    full: options.full ?? false,
    page: options.page ?? 1,
  });
  if (slice !== undefined) return slice;
  const characters = describeCharacters(name, options.cast);
  if (characters !== undefined) return characters;
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
  throw unknownName(catalog, input, name);
}

/** Catalog entries of the project's props, and one line per prop module that cannot be read. */
export async function projectProps(
  root: string,
): Promise<{ entries: KitCatalogEntry[]; problems: string[] }> {
  const files = await readKitExtensions(root);
  const entries: KitCatalogEntry[] = [];
  const problems = files.ignored
    .filter((file) => file.startsWith(`${KIT_EXT_PROPS_DIR}/`))
    .map(
      (file) => `ignored: ${file} (prop file names are camelCase, e.g. kit-ext/props/fileIcon.js)`,
    );
  for (const extension of extensionsOfKind(files.extensions, 'props')) {
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

/**
 * The project's look mode (voxel-only without a valid project.json, the default; a world's style
 * is always mixed, PLAN.md#13.6) and style (its world's looks join the catalog, PLAN.md#13.1; none
 * without a project).
 */
async function readLookSettings(
  root: string,
): Promise<{ lookMode: LookMode; style: string | undefined }> {
  const project = await checkJsonFile(root, PROJECT_PATHS.project, projectFileSchema);
  return project.status === 'ok'
    ? { lookMode: kitDocsLookMode(project.data), style: project.data.style }
    : { lookMode: 'voxel-only', style: undefined };
}

/** The project's world asset ids per kind (only for kit-docs world-assets). */
async function worldAssetIds(
  root: string,
  style: string | undefined,
): Promise<Readonly<Record<string, readonly string[]>> | undefined> {
  const files = await readWorldAssetFiles(root, style);
  return files === undefined ? undefined : worldAssetSet(files).ids.byKind;
}

export const kitDocsCommand: Command = {
  name: 'kit-docs',
  summary:
    'reference of ctx.kit (voxel tools, environments, props, effects) and ctx (camera, text, annotate, ...)',
  usage: KIT_DOCS_USAGE,
  async run(argv, context) {
    const { positionals, values } = parseCommandArgs(argv, KIT_DOCS_OPTIONS, true);
    if (positionals.length > 1) throw new UsageError('kit-docs takes at most one name');
    const project = await projectProps(context.root);
    const { cast } = projectCastOf(await readCastRoles(context.root));
    const { lookMode, style } = await readLookSettings(context.root);
    const catalog = kitCatalog(
      project.entries,
      LOOKS,
      kitDocsScope(style, experimentalWorldsEnabled()),
    );
    const name = positionals[0];
    if (name === undefined && (values.full || values.page !== undefined)) {
      throw new UsageError(
        `--full and --page need a kind or look, e.g. reelforge kit-docs props --full (${sliceNames(catalog).join(', ')})`,
      );
    }
    const page = values.page === undefined ? 1 : parseInteger(values.page, '--page', 1, 99);
    const text =
      name === undefined
        ? formatCatalog(catalog, { lookMode, problems: project.problems })
        : describeKitName(catalog, name, {
            lookMode,
            full: values.full,
            page,
            cast,
            style,
            ...(name === WORLD_ASSETS_TOPIC
              ? { worldAssetIds: await worldAssetIds(context.root, style) }
              : {}),
          });
    const json = name === undefined ? { ...catalog, problems: project.problems } : { name, text };
    return result(0, [text], json);
  },
};
