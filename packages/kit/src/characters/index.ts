/**
 * `kit.cast`: the character pack (ADR-024, docs/characters.md). Positional sugar over the
 * registry definitions (validated params, per-call phase, origin stamping):
 * `kit.cast.mascot('bulb', { pose })`, `kit.cast.person('engineer')`, `kit.cast.mannequin()`,
 * `kit.cast.role(spec)`, plus `kit.cast.spec(id)` (a cast member's role spec to derive from).
 */
import { KitError } from '../errors.js';
import type { BoundRegistry } from '../registry.js';
import type { CharacterObject } from './character.js';
import { castSpec, CAST_DEFINITIONS } from './definitions.js';
import type { RoleSpecInput } from './role-spec.js';

export interface CastApi {
  mascot(id: string, params?: Readonly<Record<string, unknown>>): CharacterObject;
  person(id: string, params?: Readonly<Record<string, unknown>>): CharacterObject;
  mannequin(params?: Readonly<Record<string, unknown>>): CharacterObject;
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

type Bound = BoundRegistry<typeof CAST_DEFINITIONS>;
type Input<Name extends keyof Bound> = Parameters<Bound[Name]>[0];

/**
 * Binds the positional API over the bound cast definitions. Scenes are untyped JS: the records
 * are passed on as the factories' input and validated there by the zod schemas.
 */
export function createCastApi(bound: Bound): CastApi {
  return Object.freeze({
    mascot: (id: string, params?: Readonly<Record<string, unknown>>) =>
      bound.mascot({ ...paramsOf('kit.cast.mascot(id, params)', params), id } as Input<'mascot'>),
    person: (id: string, params?: Readonly<Record<string, unknown>>) =>
      bound.person({ ...paramsOf('kit.cast.person(id, params)', params), id } as Input<'person'>),
    mannequin: (params?: Readonly<Record<string, unknown>>) =>
      bound.mannequin(paramsOf('kit.cast.mannequin(params)', params) as Input<'mannequin'>),
    role: (spec: unknown, params?: Readonly<Record<string, unknown>>) =>
      bound.role({ ...paramsOf('kit.cast.role(spec, params)', params), spec } as Input<'role'>),
    spec: castSpec,
  });
}

export { CAST, type CastId } from './cast-presets.js';
export type { CharacterObject } from './character.js';
export { EXPRESSIONS, POSES, type Expression, type PoseName } from './clips.js';
export { CAST_DEFINITIONS } from './definitions.js';
export { castListing, charactersDocs, type CastListingEntry } from './docs.js';
export { MASCOTS, type MascotId } from './mascots.js';
export {
  roleSpecSchema,
  validateRoleSpec,
  type RoleSpec,
  type RoleSpecInput,
  type RoleSpecResult,
} from './role-spec.js';
