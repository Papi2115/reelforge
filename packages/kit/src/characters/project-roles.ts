/**
 * Project roles (ADR-026): professions the pack lacks, built on demand inside a video project as
 * `characters/roles/<id>.json` (a role spec + optional `notes`) and, when the vocabulary lacks an
 * essential piece, `characters/accessories/<id>.json` (accessory-extension.ts). The render manifest
 * carries the file texts (`castRoles`); the kit parses them here into a `ProjectCast` that every
 * shot's `kit.cast` resolves ids against (`person('firefighter')`, `role('firefighter')`,
 * `spec('firefighter')`). Pure data: deterministic, no code from the project runs.
 */
import {
  accessoryExtensionSchema,
  accessoryItem,
  ACCESSORY_ID_PATTERN,
  type AccessoryExtension,
} from './accessory-extension.js';
import { CAST } from './cast-presets.js';
import { MASCOTS } from './mascots.js';
import { ACCESSORIES } from './role-accessories.js';
import { KIT_VOCABULARY, type RoleVocabulary } from './role-build.js';
import { roleIssueMessages, type VocabularyLists } from './role-errors.js';
import { HELD_PROPS } from './role-held.js';
import { HAIR_STYLES, HEADGEAR } from './role-head.js';
import { LAYERS } from './role-layers.js';
import { createRoleSpecSchema, type AnyRoleSpec } from './role-spec.js';
import type { HeldItem, RoleItem } from './role-types.js';

/** One project file as the manifest carries it. */
export interface CastFileSource {
  /** Role or accessory id (the file name without `.json`). */
  readonly id: string;
  /** Project-relative path (messages). */
  readonly file: string;
  /** JSON text. */
  readonly source: string;
}

export interface ProjectCastSources {
  readonly roles: readonly CastFileSource[];
  readonly accessories: readonly CastFileSource[];
}

type Ids = readonly [string, ...string[]];
export type ProjectRoleSchema = ReturnType<typeof createRoleSpecSchema<Ids, Ids>>;

export interface ProjectRole {
  readonly spec: AnyRoleSpec;
  readonly notes: string | undefined;
  readonly file: string;
}

/** A project's roles and accessories, ready for `kit.cast`. */
export interface ProjectCast {
  readonly roles: ReadonlyMap<string, ProjectRole>;
  readonly accessories: ReadonlyMap<string, AccessoryExtension>;
  /** Kit vocabulary plus the project accessories. */
  readonly vocabulary: RoleVocabulary;
  readonly lists: VocabularyLists;
  /** Role spec schema that accepts the project accessories. */
  readonly specSchema: ProjectRoleSchema;
  /** Files that did not parse (left out; a scene naming one gets their errors). */
  readonly problems: readonly CastFileProblem[];
}

export interface CastFileProblem {
  readonly file: string;
  readonly errors: readonly string[];
}

/** Ids a project role may not take: the pack's own people. */
export const PACK_IDS: readonly string[] = [...CAST, ...MASCOTS, 'mannequin'];

/** Vocabulary ids an accessory may not take (it would be ambiguous in a spec). */
const VOCABULARY_IDS: ReadonlySet<string> = new Set([
  ...ACCESSORIES,
  ...HELD_PROPS,
  ...HEADGEAR,
  ...LAYERS,
  ...HAIR_STYLES,
]);

export const MAX_ROLE_NOTES = 500;

function castWith(
  roles: ReadonlyMap<string, ProjectRole>,
  accessories: ReadonlyMap<string, AccessoryExtension>,
  problems: readonly CastFileProblem[] = [],
): ProjectCast {
  const extra = [...accessories.values()];
  const worn = extra.filter((entry) => entry.slot !== 'hand').map((entry) => entry.id);
  const held = extra.filter((entry) => entry.slot === 'hand').map((entry) => entry.id);
  const lists: VocabularyLists = {
    accessories: [...ACCESSORIES, ...worn],
    held: [...HELD_PROPS, ...held],
  };
  const items = extra.map(accessoryItem);
  const vocabulary: RoleVocabulary = {
    accessories: new Map<string, RoleItem>([
      ...KIT_VOCABULARY.accessories,
      ...items.filter((item) => !('hand' in item)).map((item) => [item.id, item] as const),
    ]),
    held: new Map<string, HeldItem>([
      ...KIT_VOCABULARY.held,
      ...items
        .filter((item): item is HeldItem => 'hand' in item)
        .map((item) => [item.id, item] as const),
    ]),
  };
  const specSchema = createRoleSpecSchema<Ids, Ids>(
    lists.accessories as unknown as Ids,
    lists.held as unknown as Ids,
  );
  return { roles, accessories, vocabulary, lists, specSchema, problems };
}

/** The kit without project roles (what `kit.cast` uses by default). */
export const NO_PROJECT_CAST: ProjectCast = castWith(new Map(), new Map());

function parseJson(source: CastFileSource): { ok: true; value: unknown } | CastFileProblem {
  try {
    return { ok: true, value: JSON.parse(source.source) as unknown };
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error;
    return { file: source.file, errors: [`not valid JSON (${error.message})`] };
  }
}

function idProblem(kind: string, id: unknown, source: CastFileSource): string | undefined {
  if (typeof id === 'string' && id !== source.id) {
    return `id is "${id}" but the file is ${source.id}.json: make them equal`;
  }
  if (!ACCESSORY_ID_PATTERN.test(source.id)) {
    return `the file name must be a camelCase ${kind} id (e.g. firefighter.json)`;
  }
  return undefined;
}

/** Parses one accessory file (errors as readable lines). */
export function parseAccessoryFile(
  source: CastFileSource,
): { ok: true; accessory: AccessoryExtension } | { ok: false; problem: CastFileProblem } {
  const json = parseJson(source);
  if (!('ok' in json)) return { ok: false, problem: json };
  const fail = (errors: readonly string[]) => ({
    ok: false as const,
    problem: { file: source.file, errors },
  });
  const id: unknown =
    typeof json.value === 'object' && json.value !== null
      ? (json.value as Record<string, unknown>)['id']
      : undefined;
  const wrongId = idProblem('accessory', id, source);
  if (wrongId !== undefined) return fail([wrongId]);
  if (VOCABULARY_IDS.has(source.id)) {
    return fail([`"${source.id}" is already in the kit vocabulary: use it directly`]);
  }
  const parsed = accessoryExtensionSchema.safeParse(json.value);
  if (!parsed.success) {
    return fail(
      parsed.error.issues.map(
        (issue) => `${issue.path.join('.') || '(accessory)'}: ${issue.message}`,
      ),
    );
  }
  return { ok: true, accessory: parsed.data };
}

/** Parses one role file against `cast`'s vocabulary (errors with "did you mean"). */
export function parseRoleFile(
  source: CastFileSource,
  cast: ProjectCast = NO_PROJECT_CAST,
): { ok: true; role: ProjectRole } | { ok: false; problem: CastFileProblem } {
  const json = parseJson(source);
  if (!('ok' in json)) return { ok: false, problem: json };
  const fail = (errors: readonly string[]) => ({
    ok: false as const,
    problem: { file: source.file, errors },
  });
  if (typeof json.value !== 'object' || json.value === null || Array.isArray(json.value)) {
    return fail(['a role file is one JSON object (a role spec, plus optional "notes")']);
  }
  const { notes, ...spec } = json.value as Record<string, unknown>;
  const wrongId = idProblem('role', spec['id'], source);
  if (wrongId !== undefined) return fail([wrongId]);
  if (PACK_IDS.includes(source.id)) {
    return fail([`"${source.id}" is a member of the pack: use kit.cast.person/mascot directly`]);
  }
  if (notes !== undefined && (typeof notes !== 'string' || notes.length > MAX_ROLE_NOTES)) {
    return fail([`notes: a string of at most ${String(MAX_ROLE_NOTES)} characters`]);
  }
  const parsed = cast.specSchema.safeParse(spec);
  if (!parsed.success) return fail(roleIssueMessages(parsed.error, spec, cast.lists));
  return { ok: true, role: { spec: parsed.data, notes, file: source.file } };
}

export interface ProjectCastCheck {
  /** Everything that parsed (invalid files are left out). */
  readonly cast: ProjectCast;
  readonly problems: readonly CastFileProblem[];
}

/** Parses a project's files, keeping what is valid and reporting the rest. */
export function checkProjectCast(sources: ProjectCastSources): ProjectCastCheck {
  const problems: CastFileProblem[] = [];
  const accessories = new Map<string, AccessoryExtension>();
  for (const source of sources.accessories) {
    const parsed = parseAccessoryFile(source);
    if (parsed.ok) accessories.set(parsed.accessory.id, parsed.accessory);
    else problems.push(parsed.problem);
  }
  const withAccessories = castWith(new Map(), accessories);
  const roles = new Map<string, ProjectRole>();
  for (const source of sources.roles) {
    const parsed = parseRoleFile(source, withAccessories);
    if (parsed.ok) roles.set(parsed.role.spec.id, parsed.role);
    else problems.push(parsed.problem);
  }
  return { cast: castWith(roles, accessories, problems), problems };
}

/**
 * The project cast of a manifest. Invalid files are left out and kept in `problems`: they must not
 * break the shots that do not use them; a scene that names one gets its errors (index.ts).
 */
export function loadProjectCast(sources: ProjectCastSources | undefined): ProjectCast {
  if (sources === undefined || (sources.roles.length === 0 && sources.accessories.length === 0)) {
    return NO_PROJECT_CAST;
  }
  return checkProjectCast(sources).cast;
}
