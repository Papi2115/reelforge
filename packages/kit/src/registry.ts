/**
 * Typed registry of kit content (environments, props, effects). Each entry carries the metadata
 * the docs need (name, description, zod params, anchors): `kitCatalog()` turns it into the
 * kit-docs the runtime Claude reads (PLAN.md#3.3), and calls are validated against the schema.
 */
import { z } from 'zod';
import type { KitContext, KitMaterials } from './context.js';
import { KitError } from './errors.js';
import { isKitObject, type Disposable, type KitObject, type Three } from './object.js';
import type { KitPalette, KitRng } from './types.js';
import type { VoxelApi } from './voxel/api.js';

export type KitKind = 'env' | 'prop' | 'fx';

/**
 * Where a kit object came from: `kit.<namespace>.<name>()`, its `index`-th call (0-based) in the
 * shot. Stamped on every registry result so tools (the preview's object picking) can name what
 * was clicked and point at the call in the scene source. Metadata only: never affects rendering.
 */
export interface KitOrigin {
  readonly kind: KitKind;
  readonly name: string;
  readonly index: number;
  /** The scene-facing call, e.g. `kit.props.calculator()`. */
  readonly call: string;
}

const ORIGIN_KEY = 'reelforgeKitOrigin';
const KIT_KINDS: readonly string[] = ['env', 'prop', 'fx'];

function isKitOrigin(value: unknown): value is KitOrigin {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record['kind'] === 'string' &&
    KIT_KINDS.includes(record['kind']) &&
    typeof record['name'] === 'string' &&
    typeof record['index'] === 'number' &&
    typeof record['call'] === 'string'
  );
}

/** The registry origin of a kit object (undefined for voxel meshes/groups and plain objects). */
export function kitOriginOf(object: {
  readonly userData: Record<string, unknown>;
}): KitOrigin | undefined {
  const value = object.userData[ORIGIN_KEY];
  return isKitOrigin(value) ? value : undefined;
}

/** What a definition's build() receives besides its parsed params. */
export interface KitTools {
  readonly three: Three;
  readonly palette: KitPalette;
  readonly voxel: VoxelApi;
  /** Seeded stream of this call: depends on the shot, the definition and its call index. */
  readonly rng: KitRng;
  /** Shared kit materials (flat Lambert / unlit, vertex or instance colours). */
  materials(): KitMaterials;
  /** Registers a geometry/material/texture so the kit instance frees it on dispose(). */
  track<T extends Disposable>(resource: T): T;
}

export interface KitDefinitionInput<Name extends string, Params extends z.ZodType, Result> {
  /** camelCase; becomes `kit.<kind>.<name>(params)`. */
  readonly name: Name;
  /** One or two sentences for the catalog: what it is and when to use it. */
  readonly description: string;
  /** Params schema; give fields `.describe()` and defaults, it is the documentation. */
  readonly params: Params;
  /** Anchors the result offers beyond the standard ones: name -> what it marks. */
  readonly anchors?: Readonly<Record<string, string>> | undefined;
  /** Methods/animation hooks of the result: signature -> what it does (e.g. 'open(amount)'). */
  readonly methods?: Readonly<Record<string, string>> | undefined;
  build(params: z.output<Params>, tools: KitTools): Result;
}

export interface KitDefinition<
  Name extends string = string,
  Params extends z.ZodType = z.ZodType,
  Result = unknown,
> extends KitDefinitionInput<Name, Params, Result> {
  readonly kind: KitKind;
}

export function defineEnv<
  const Name extends string,
  Params extends z.ZodType,
  Result extends KitObject,
>(definition: KitDefinitionInput<Name, Params, Result>): KitDefinition<Name, Params, Result> {
  return { ...definition, kind: 'env' };
}

export function defineProp<
  const Name extends string,
  Params extends z.ZodType,
  Result extends KitObject,
>(definition: KitDefinitionInput<Name, Params, Result>): KitDefinition<Name, Params, Result> {
  return { ...definition, kind: 'prop' };
}

export function defineFx<
  const Name extends string,
  Params extends z.ZodType,
  Result extends KitObject,
>(definition: KitDefinitionInput<Name, Params, Result>): KitDefinition<Name, Params, Result> {
  return { ...definition, kind: 'fx' };
}

/** Scene-facing factory of a definition: params are optional when the schema has defaults. */
export type KitFactory<Definition> =
  Definition extends KitDefinition<string, infer Params, infer Result>
    ? (params?: z.input<Params>) => Result
    : never;

/** A registry without definitions (nothing to call yet). */
export type EmptyRegistry = Readonly<Record<string, never>>;

/** `kit.env` / `kit.props` / `kit.fx`: one factory per definition, keyed by name. */
export type BoundRegistry<Definitions extends readonly KitDefinition[]> =
  Definitions extends readonly []
    ? EmptyRegistry
    : {
        readonly [Definition in Definitions[number] as Definition['name']]: KitFactory<Definition>;
      };

const NAMESPACE: Readonly<Record<KitKind, string>> = { env: 'env', prop: 'props', fx: 'fx' };

function formatIssues(error: z.ZodError): string {
  return error.issues
    .map((issue) => `${issue.path.join('.') || '(params)'}: ${issue.message}`)
    .join('; ');
}

/** Binds definitions to a kit instance: validation, build-phase guard and per-call rng. */
export function bindRegistry<const Definitions extends readonly KitDefinition[]>(
  context: KitContext,
  voxel: VoxelApi,
  definitions: Definitions,
): BoundRegistry<Definitions> {
  const calls = new Map<string, number>();
  const factories = definitions.map((definition) => {
    const call = `kit.${NAMESPACE[definition.kind]}.${definition.name}()`;
    const factory = (params?: unknown): unknown => {
      context.assertBuildPhase(call);
      const parsed = definition.params.safeParse(params ?? {});
      if (!parsed.success) {
        throw new KitError(
          'invalid-params',
          `${call}: invalid params (${formatIssues(parsed.error)})`,
        );
      }
      const index = calls.get(definition.name) ?? 0;
      calls.set(definition.name, index + 1);
      const rng = context.rng.fork(`${definition.kind}:${definition.name}:${String(index)}`);
      const result = definition.build(parsed.data, {
        three: context.three,
        palette: context.palette,
        voxel,
        rng,
        materials: () => context.materials(),
        track: (resource) => context.track(resource),
      });
      if (isKitObject(result)) {
        const origin: KitOrigin = { kind: definition.kind, name: definition.name, index, call };
        result.userData[ORIGIN_KEY] = origin;
      }
      return result;
    };
    return [definition.name, factory] as const;
  });
  // The mapped type cannot be produced by Object.fromEntries; each factory matches its entry.
  return Object.freeze(Object.fromEntries(factories)) as BoundRegistry<Definitions>;
}

export interface KitCatalogEntry {
  readonly kind: KitKind;
  readonly name: string;
  readonly description: string;
  /** JSON Schema of the accepted params (input side: defaults are optional). */
  readonly params: Readonly<Record<string, unknown>>;
  readonly anchors: Readonly<Record<string, string>>;
  /** Methods/animation hooks (signature -> what it does); optional for hand-written entries. */
  readonly methods?: Readonly<Record<string, string>>;
  /** `project`: a project-local prop (`kit-ext/props/<name>.js`); absent for the kit's own. */
  readonly origin?: 'project';
  /** Look the entry belongs to (ADR-009); absent for project props. */
  readonly look?: string;
}

/** Catalog entries of definitions, tagged with their look when `look` is given. */
export function catalogEntries(
  definitions: readonly KitDefinition[],
  look?: string,
): KitCatalogEntry[] {
  return definitions.map((definition) => ({
    kind: definition.kind,
    name: definition.name,
    description: definition.description,
    // Function-valued params (e.g. neonGrid's scroll) have no JSON Schema: emitted as {} and
    // documented by their .describe() text on the enclosing union.
    params: z.toJSONSchema(definition.params, { io: 'input', unrepresentable: 'any' }),
    anchors: definition.anchors ?? {},
    methods: definition.methods ?? {},
    ...(look === undefined ? {} : { look }),
  }));
}
