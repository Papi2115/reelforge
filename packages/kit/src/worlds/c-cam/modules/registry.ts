/**
 * `kit.people` / `kit.places` (PLAN.md#14.8): the project's people and places by id, bound into
 * the kit of a Grim Ink (`c-cam`) shot only. Reading an id the project does not define throws a
 * KitError that lists the defined ids (a typo fails loudly instead of `undefined is not a
 * function`); listing (`Object.keys`) shows exactly the defined ids. Ids are camelCase (the file
 * names); a kebab-case spelling of one (`kit.people['night-porter']`, the storyboard's role tags)
 * reads the same module.
 */
import { KitError } from '../../../errors.js';
import type { InkPerson } from './person.js';
import type { InkPlace } from './place.js';

/** The project's people and places of one video (the engine loads them once). */
export interface InkModules {
  readonly people: readonly InkPerson[];
  readonly places: readonly InkPlace[];
}

export const NO_INK_MODULES: InkModules = Object.freeze({ people: [], places: [] });

export type InkRegistry<T> = Readonly<Record<string, T>>;

/** Members JS itself probes (await, JSON, string conversion): read as absent, never an error. */
const PROBED: ReadonlySet<string> = new Set(['then', 'toJSON', 'constructor', 'valueOf']);

/** `night-porter` -> `nightPorter` (other keys unchanged). */
function camelKey(key: string): string {
  return key.replaceAll(/-([a-z0-9])/g, (_match, letter: string) => letter.toUpperCase());
}

function folderOf(label: 'people' | 'places'): string {
  return `kit-ext/${label}`;
}

/** Throws when two modules of one kind share an id. */
function checkUnique(label: 'people' | 'places', items: readonly { readonly id: string }[]): void {
  const seen = new Set<string>();
  for (const item of items) {
    if (seen.has(item.id)) {
      throw new KitError('invalid-extension', `kit.${label}: the id "${item.id}" is defined twice`);
    }
    seen.add(item.id);
  }
}

/** A frozen id -> item registry that throws a helpful KitError for unknown ids. */
export function inkRegistry<T extends { readonly id: string }>(
  label: 'people' | 'places',
  items: readonly T[],
): InkRegistry<T> {
  checkUnique(label, items);
  const target: Record<string, T> = Object.create(null) as Record<string, T>;
  for (const item of items) target[item.id] = item;
  Object.freeze(target);
  return new Proxy(target, {
    get(object, key) {
      if (typeof key === 'symbol' || Object.hasOwn(object, key)) {
        return Reflect.get(object, key) as unknown;
      }
      if (PROBED.has(key)) return undefined;
      const alias = camelKey(key);
      if (Object.hasOwn(object, alias)) return Reflect.get(object, alias) as unknown;
      const ids = Object.keys(object);
      throw new KitError(
        'unknown-definition',
        `kit.${label}.${key} is not defined: ${ids.length > 0 ? `defined ids: ${ids.join(', ')}` : `the project has no ${label} yet`}; write ${folderOf(label)}/${alias}.js (reelforge kit-docs ${label})`,
      );
    },
  });
}

export interface InkModulesApi {
  readonly people: InkRegistry<InkPerson>;
  readonly places: InkRegistry<InkPlace>;
}

export function createInkModulesApi(modules: InkModules = NO_INK_MODULES): InkModulesApi {
  return Object.freeze({
    people: inkRegistry('people', modules.people),
    places: inkRegistry('places', modules.places),
  });
}
