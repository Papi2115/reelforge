/**
 * `kit.cast`: the character pack (ADR-024, docs/characters.md). Positional sugar over the
 * registry definitions (validated params, per-call phase, origin stamping):
 * `kit.cast.mascot('bulb', { pose })`, `kit.cast.person('engineer')`, `kit.cast.mannequin()`,
 * `kit.cast.role(spec)`, plus `kit.cast.spec(id)` (a cast member's role spec to derive from).
 * Project roles (ADR-026, `characters/roles/<id>.json`) resolve by id in `person`, `role` and
 * `spec`, like the cast.
 */
import { KitError } from '../errors.js';
import type { BoundRegistry } from '../registry.js';
import { CAST } from './cast-presets.js';
import type { CharacterObject } from './character.js';
import { castSpec, type castDefinitions } from './definitions.js';
import { NO_PROJECT_CAST, type ProjectCast } from './project-roles.js';
import type { RoleSpecInput } from './role-spec.js';
import { didYouMean } from './suggest.js';

export interface CastApi {
  mascot(id: string, params?: Readonly<Record<string, unknown>>): CharacterObject;
  person(id: string, params?: Readonly<Record<string, unknown>>): CharacterObject;
  mannequin(params?: Readonly<Record<string, unknown>>): CharacterObject;
  /** `spec` = a role spec object, or the id of a project role / cast member. */
  role(spec: unknown, params?: Readonly<Record<string, unknown>>): CharacterObject;
  spec(id: string): RoleSpecInput;
}

function paramsOf(call: string, params: unknown): Readonly<Record<string, unknown>> {
  if (params === undefined) return {};
  if (typeof params === 'object' && params !== null && !Array.isArray(params)) {
    return params as Readonly<Record<string, unknown>>;
  }
  throw new KitError('invalid-params', `${call}: params must be an object, e.g. { pose: 'wave' }`);
}

type Bound = BoundRegistry<ReturnType<typeof castDefinitions>>;
type Input<Name extends keyof Bound> = Parameters<Bound[Name]>[0];

/** `police-officer` (the storyboard's kebab-case role ids) -> `policeOfficer`. */
function canonicalId(id: string): string {
  return id.replace(/-([a-z0-9])/g, (_match, letter: string) => letter.toUpperCase());
}

/** Every id `person`/`role`/`spec` accept: the cast, then the project roles. */
function personIds(project: ProjectCast): string[] {
  return [...CAST, ...project.roles.keys()];
}

function unknownPerson(call: string, id: string, project: ProjectCast): KitError {
  const ids = personIds(project);
  const broken = project.problems.find((problem) => problem.file === `characters/roles/${id}.json`);
  if (broken !== undefined) {
    return new KitError(
      'invalid-params',
      `${call}: ${broken.file} is invalid (${broken.errors.join('; ')}); fix it (reelforge cast check ${broken.file}) or use a cast member`,
    );
  }
  return new KitError(
    'invalid-params',
    `${call}: unknown person "${id}"${didYouMean(id, ids)} (cast and project roles: ${ids.join(', ')}); a profession the pack lacks is built on demand as characters/roles/${id}.json (the storyboard's newRoles)`,
  );
}

function specOf(raw: string, project: ProjectCast): RoleSpecInput {
  const id = canonicalId(raw);
  const role = project.roles.get(id);
  if (role !== undefined) return structuredClone(role.spec) as RoleSpecInput;
  if ((CAST as readonly string[]).includes(id)) return castSpec(id);
  throw unknownPerson('kit.cast.spec(id)', id, project);
}

/**
 * Binds the positional API over the bound cast definitions. Scenes are untyped JS: the records
 * are passed on as the factories' input and validated there by the zod schemas.
 */
export function createCastApi(bound: Bound, project: ProjectCast = NO_PROJECT_CAST): CastApi {
  return Object.freeze({
    mascot: (id: string, params?: Readonly<Record<string, unknown>>) =>
      bound.mascot({ ...paramsOf('kit.cast.mascot(id, params)', params), id } as Input<'mascot'>),
    person: (raw: string, params?: Readonly<Record<string, unknown>>) => {
      const own = paramsOf('kit.cast.person(id, params)', params);
      const id = typeof raw === 'string' ? canonicalId(raw) : raw;
      if (typeof id === 'string' && !personIds(project).includes(id)) {
        throw unknownPerson('kit.cast.person(id)', id, project);
      }
      return bound.person({ ...own, id });
    },
    mannequin: (params?: Readonly<Record<string, unknown>>) =>
      bound.mannequin(paramsOf('kit.cast.mannequin(params)', params) as Input<'mannequin'>),
    role: (spec: unknown, params?: Readonly<Record<string, unknown>>) => {
      const own = paramsOf('kit.cast.role(spec, params)', params);
      const resolved = typeof spec === 'string' ? specOf(spec, project) : spec;
      return bound.role({ ...own, spec: resolved } as Input<'role'>);
    },
    spec: (id: string) => specOf(id, project),
  });
}

export {
  ACCESSORY_SLOTS,
  accessoryExtensionSchema,
  SLOT_FRAMES,
  type AccessoryExtension,
  type AccessorySlot,
} from './accessory-extension.js';
export { CAST, type CastId } from './cast-presets.js';
export type { CharacterObject } from './character.js';
export { EXPRESSIONS, POSES, type Expression, type PoseName } from './clips.js';
export { CAST_DEFINITIONS, castDefinitions } from './definitions.js';
export { castListing, charactersDocs, type CastListingEntry } from './docs.js';
export { MASCOTS, type MascotId } from './mascots.js';
export {
  checkProjectCast,
  loadProjectCast,
  NO_PROJECT_CAST,
  PACK_IDS,
  parseAccessoryFile,
  parseRoleFile,
  type CastFileProblem,
  type CastFileSource,
  type ProjectCast,
  type ProjectCastCheck,
  type ProjectCastSources,
  type ProjectRole,
} from './project-roles.js';
export { roleSpecChecks, type RoleSpecCheck, type RoleSpecCheckId } from './role-checks.js';
export {
  MAX_OUTFIT_COLORS,
  outfitColors,
  roleSpecSchema,
  validateRoleSpec,
  type AnyRoleSpec,
  type RoleSpec,
  type RoleSpecInput,
  type RoleSpecResult,
} from './role-spec.js';
export { closestId, didYouMean } from './suggest.js';
