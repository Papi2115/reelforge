/**
 * Project-local props (PLAN.md#7.4, ADR-007): ES modules `kit-ext/props/<name>.js` that export
 * `prop = { name, description, params, anchors, methods, build(ctx, params) }`, written by the
 * runtime Claude with `ctx.kit.voxel` only. The metadata is plain JSON (checked here with zod,
 * statically by the engine's prop lint); `build` gets a reduced context (`{ kit: { voxel },
 * palette, rng }`) and must return a kit object. Every prop gets the kit's uniform `scale` param.
 */
import { z } from 'zod';
import { KitError } from './errors.js';
import { isKitObject, type KitObject } from './object.js';
import { scaleParam } from './props/shared.js';
import { catalogEntries, type KitCatalogEntry, type KitDefinition } from './registry.js';
import type { KitPalette, KitRng } from './types.js';
import type { VoxelApi } from './voxel/api.js';

const IDENTIFIER = /^[a-z][A-Za-z0-9]{0,39}$/;
const MAX_PARAMS = 12;
/** Names a project prop cannot take besides the kit's own props (object built-ins). */
const RESERVED_NAMES: ReadonlySet<string> = new Set([
  'constructor',
  'prototype',
  'toString',
  'toLocaleString',
  'valueOf',
  'hasOwnProperty',
  'isPrototypeOf',
  'propertyIsEnumerable',
]);

const description = z.string().min(1).max(200);

const numberParam = z
  .strictObject({
    type: z.literal('number'),
    description,
    default: z.number(),
    min: z.number().optional(),
    max: z.number().optional(),
    integer: z.boolean().optional(),
  })
  .refine(
    (spec) => (spec.min ?? -Infinity) <= spec.default && spec.default <= (spec.max ?? Infinity),
    {
      message: 'default must be within min..max',
    },
  );

const enumParam = z
  .strictObject({
    type: z.literal('enum'),
    description,
    values: z.array(z.string().min(1)).min(1).max(20),
    default: z.string(),
  })
  .refine((spec) => spec.values.includes(spec.default), {
    message: 'default must be one of values',
  });

/** One param: `{ type, description, default, ... }`; every param has a default. */
export const propParamSpecSchema = z.union([
  numberParam,
  enumParam,
  z.strictObject({ type: z.literal('boolean'), description, default: z.boolean() }),
  z.strictObject({
    type: z.literal('string'),
    description,
    default: z.string(),
    maxLength: z.int().positive().max(200).optional(),
  }),
  z.strictObject({ type: z.literal('color'), description, default: z.string().min(1) }),
]);
export type PropParamSpec = z.infer<typeof propParamSpecSchema>;

export const PROP_PARAM_TYPES = ['number', 'enum', 'boolean', 'string', 'color'] as const;

const paramName = z.string().regex(IDENTIFIER, 'param names are camelCase identifiers');

/** Everything of `export const prop` except `build`, as plain JSON. */
export const propMetaSchema = z.strictObject({
  name: z
    .string()
    .regex(IDENTIFIER, 'prop names are camelCase identifiers, e.g. "fridge"')
    .refine((name) => !RESERVED_NAMES.has(name), 'this name is reserved'),
  description: z.string().min(10).max(400),
  params: z
    .record(paramName, propParamSpecSchema)
    .refine((params) => Object.keys(params).length <= MAX_PARAMS, {
      message: `at most ${String(MAX_PARAMS)} params`,
    })
    .default({}),
  anchors: z.record(z.string().regex(IDENTIFIER), description).default({}),
  methods: z.record(z.string().min(1).max(60), description).default({}),
});
export type PropMeta = z.output<typeof propMetaSchema>;

/** What a prop module's `build(ctx, params)` receives as ctx. */
export interface PropBuildContext {
  readonly kit: { readonly voxel: VoxelApi };
  readonly palette: KitPalette;
  /** Seeded stream of this call (same params + same call order = same result). */
  readonly rng: KitRng;
}

export type PropBuildFunction = (ctx: PropBuildContext, params: Record<string, unknown>) => unknown;

function paramSchema(spec: PropParamSpec): z.ZodType {
  switch (spec.type) {
    case 'number': {
      let schema = spec.integer === true ? z.number().int() : z.number();
      if (spec.min !== undefined) schema = schema.min(spec.min);
      if (spec.max !== undefined) schema = schema.max(spec.max);
      return schema.default(spec.default).describe(spec.description);
    }
    case 'enum': {
      const [first = '', ...rest] = spec.values;
      return z
        .enum([first, ...rest])
        .default(spec.default)
        .describe(spec.description);
    }
    case 'boolean':
      return z.boolean().default(spec.default).describe(spec.description);
    case 'string': {
      const schema = spec.maxLength === undefined ? z.string() : z.string().max(spec.maxLength);
      return schema.default(spec.default).describe(spec.description);
    }
    case 'color':
      return z.string().min(1).default(spec.default).describe(`${spec.description} (palette name)`);
  }
}

/** zod schema of a prop's params (strict: a misspelt param name is an error) plus `scale`. */
export function propParamsSchema(params: PropMeta['params']): z.ZodType<Record<string, unknown>> {
  const shape: Record<string, z.ZodType> = {};
  for (const [name, spec] of Object.entries(params)) shape[name] = paramSchema(spec);
  return z.strictObject({ ...shape, scale: scaleParam });
}

function issuesText(error: z.ZodError): string {
  return error.issues
    .map((issue) => `${issue.path.join('.') || 'prop'}: ${issue.message}`)
    .join('; ');
}

/** The checked metadata of a prop object (throws an `invalid-extension` KitError). */
export function parsePropMeta(value: unknown, file: string): PropMeta {
  const params: unknown =
    typeof value === 'object' && value !== null ? (value as Record<string, unknown>)['params'] : {};
  if (typeof params === 'object' && params !== null && Object.hasOwn(params, 'scale')) {
    throw new KitError(
      'invalid-extension',
      `${file}: params.scale: scale is added to every prop automatically (remove it)`,
    );
  }
  const parsed = propMetaSchema.safeParse(value);
  if (parsed.success) return parsed.data;
  throw new KitError(
    'invalid-extension',
    `${file}: \`export const prop\` is invalid (${issuesText(parsed.error)}); see reelforge kit-docs prop-module`,
  );
}

function describeValue(value: unknown): string {
  if (value === null || value === undefined) return String(value);
  return typeof value === 'object' ? 'a plain object' : typeof value;
}

/** Registry definition of a project prop: validates params, builds, applies `scale`. */
export function propExtensionDefinition(
  meta: PropMeta,
  build: PropBuildFunction,
  file: string,
): KitDefinition<string, z.ZodType<Record<string, unknown>>, KitObject> {
  return {
    kind: 'prop',
    name: meta.name,
    description: meta.description,
    params: propParamsSchema(meta.params),
    anchors: meta.anchors,
    methods: meta.methods,
    build(params, tools) {
      const { scale, ...own } = params;
      const context: PropBuildContext = Object.freeze({
        kit: Object.freeze({ voxel: tools.voxel }),
        palette: tools.palette,
        rng: tools.rng,
      });
      const result = build(context, own);
      if (!isKitObject(result)) {
        throw new KitError(
          'invalid-extension',
          `${file}: prop.build(ctx, params) must return a kit object (ctx.kit.voxel.mesh(...) or ctx.kit.voxel.group()), got ${describeValue(result)}`,
        );
      }
      if (typeof scale === 'number') result.scale.multiplyScalar(scale);
      if (!('update' in result) || typeof result.update !== 'function') {
        Object.assign(result, { update: () => undefined });
      }
      return result;
    },
  };
}

/** A prop module namespace (`{ prop }`) as a registry definition; throws `invalid-extension`. */
export function propDefinitionFromModule(
  namespace: unknown,
  file: string,
): KitDefinition<string, z.ZodType<Record<string, unknown>>, KitObject> {
  const prop: unknown =
    typeof namespace === 'object' && namespace !== null
      ? (namespace as Record<string, unknown>)['prop']
      : undefined;
  if (typeof prop !== 'object' || prop === null) {
    throw new KitError(
      'invalid-extension',
      `${file}: missing \`export const prop = { name, description, params, anchors, build(ctx, params) }\``,
    );
  }
  const { build, ...meta } = prop as Record<string, unknown>;
  if (typeof build !== 'function') {
    throw new KitError(
      'invalid-extension',
      `${file}: prop.build must be a function build(ctx, params)`,
    );
  }
  const checked = parsePropMeta(meta, file);
  const call = (ctx: PropBuildContext, params: Record<string, unknown>): unknown =>
    (build as PropBuildFunction)(ctx, params);
  return propExtensionDefinition(checked, call, file);
}

/** Throws when a project prop would shadow a kit prop or is listed twice. */
export function checkExtensionNames(
  builtIn: readonly string[],
  extensions: readonly { readonly name: string }[],
): void {
  const taken = new Set(builtIn);
  for (const extension of extensions) {
    if (taken.has(extension.name) || RESERVED_NAMES.has(extension.name)) {
      throw new KitError(
        'invalid-extension',
        `kit-ext prop "${extension.name}" has the name of a kit prop; the kit's own ${extension.name} is used as is - pick another name (or use kit.props.${extension.name})`,
      );
    }
    taken.add(extension.name);
  }
}

/** Catalog entry of a project prop (kit-docs), from its metadata only (no code runs). */
export function propExtensionCatalogEntry(meta: PropMeta): KitCatalogEntry {
  const notCallable: PropBuildFunction = () => undefined;
  const [entry] = catalogEntries([propExtensionDefinition(meta, notCallable, '')]);
  if (entry === undefined) throw new KitError('invalid-extension', 'no catalog entry');
  return { ...entry, origin: 'project' };
}
