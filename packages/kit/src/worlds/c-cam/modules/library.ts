/**
 * Project libraries of the Grim Ink world (PLAN.md#14.19): `kit-ext/lib/<name>.js` exports one
 * literal `export const lib = { … }` of pure functions shared by the film's scenes, people and
 * places (the concept films' `acting.js`, `props.js`, `crowd.js`: a seated pose, a ballot slip, a
 * crowd row). Scenes call them as `ctx.kit.lib.<name>.<fn>(…)`, project modules as
 * `ink.lib.<name>.<fn>(…)`.
 *
 * Drawing helpers take `(g, ink, …)`: whatever the caller passes as `ink` (a scene's `cam.env` or
 * `env`, a module's `ink`) reaches the function as the module ink toolbox of that ink width
 * (ink-tools.ts) with `ink.lib` added, so one helper works from a scene and from a module alike.
 * Functions whose first argument is not a painter (a pose helper `(D, side)`) get their arguments
 * unchanged. No library -> nothing is wrapped (projects without `kit-ext/lib` draw exactly as before).
 */
import { KitError } from '../../../errors.js';
import type { Paint2D } from '../draw/paint.js';
import { inkTools, type InkTools } from './ink-tools.js';
import { brushEnvOf } from './person.js';
import { inkRegistry, type InkRegistry } from './registry.js';

/** A library's functions (plain JS: any arguments). */
export type InkLibraryFunctions = Readonly<Record<string, (...args: unknown[]) => unknown>>;

/** One `kit-ext/lib/<name>.js`, checked. */
export interface InkLibrary {
  readonly id: string;
  /** Project-relative module path (messages). */
  readonly file: string;
  readonly functions: InkLibraryFunctions;
}

/** `ink` of a project module with the film's libraries (`ink.lib.<name>`). */
export type LibraryInk = InkTools & { readonly lib: InkRegistry<InkLibraryFunctions> };

/** Toolboxes this module made: passed through unchanged when they come back in. */
const LIBRARY_INKS = new WeakSet<object>();

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

/** A Paint2D: the first argument of a drawing helper. */
function isPainter(value: unknown): value is Paint2D {
  return (
    isObject(value) &&
    typeof value['beginPath'] === 'function' &&
    typeof value['save'] === 'function'
  );
}

/** A module toolbox (ink-tools.ts) rather than a camera / stage env. */
function isToolbox(value: Record<string, unknown>): boolean {
  return typeof value['inkLine'] === 'function' && typeof value['blob'] === 'function';
}

/** Checks a library module value: a plain object of functions (throws `invalid-extension`). */
export function defineLibrary(
  value: unknown,
  id: string,
  file = `kit-ext/lib/${id}.js`,
): InkLibrary {
  if (!isObject(value) || Array.isArray(value)) {
    throw new KitError(
      'invalid-extension',
      `${file}: missing \`export const lib = { name(g, ink, ...) { ... }, ... }\` (reelforge kit-docs lib)`,
    );
  }
  const functions: Record<string, (...args: unknown[]) => unknown> = {};
  for (const [name, entry] of Object.entries(value)) {
    if (typeof entry !== 'function') {
      throw new KitError(
        'invalid-extension',
        `${file}: lib.${name} must be a function (a library holds pure functions only; data goes in a function's body)`,
      );
    }
    functions[name] = entry as (...args: unknown[]) => unknown;
  }
  return Object.freeze({ id, file, functions: Object.freeze(functions) });
}

/** A library module namespace (`{ lib }`) as a checked library; throws `invalid-extension`. */
export function libraryFromModule(namespace: unknown, id: string, file: string): InkLibrary {
  return defineLibrary(isObject(namespace) ? namespace['lib'] : undefined, id, file);
}

/**
 * The film's libraries bound to each other: `kit.lib` of a scene and `ink.lib` of a module, and
 * `toolbox(g, inkOrEnv)`, the `ink` a helper receives (undefined registry without libraries).
 */
export interface BoundLibraries {
  readonly registry: InkRegistry<InkLibraryFunctions>;
  /** The module toolbox at the ink width of `inkOrEnv`, with `lib`. */
  readonly toolbox: (g: Paint2D, inkOrEnv: unknown) => LibraryInk;
}

interface WrappedLibrary {
  readonly id: string;
  readonly functions: InkLibraryFunctions;
}

/** Wraps a function so a `(g, ink, …)` call gets the library toolbox as `ink`. */
function withToolbox(
  fn: (...args: unknown[]) => unknown,
  toolbox: BoundLibraries['toolbox'],
): (...args: unknown[]) => unknown {
  return (...args) => {
    const [g, ink, ...rest] = args;
    if (!isPainter(g) || (ink !== undefined && !isObject(ink))) return fn(...args);
    return fn(g, toolbox(g, ink), ...rest);
  };
}

/** Binds the libraries: every function of every library gets the toolbox convention. */
export function bindLibraries(libraries: readonly InkLibrary[]): BoundLibraries {
  // Filled right below; toolboxes are only made when a wrapped function runs, after binding.
  const none: readonly WrappedLibrary[] = [];
  const bound = { registry: inkRegistry('lib', none, (entry) => entry.functions) };
  const toolbox = (g: Paint2D, inkOrEnv: unknown): LibraryInk => {
    if (isObject(inkOrEnv) && LIBRARY_INKS.has(inkOrEnv)) return inkOrEnv as LibraryInk;
    const base =
      isObject(inkOrEnv) && isToolbox(inkOrEnv)
        ? (inkOrEnv as InkTools)
        : inkTools(g, brushEnvOf(isObject(inkOrEnv) ? inkOrEnv : undefined));
    const ink: LibraryInk = Object.freeze({ ...base, lib: bound.registry });
    LIBRARY_INKS.add(ink);
    return ink;
  };
  const wrapped = libraries.map((library): WrappedLibrary => ({
    id: library.id,
    functions: Object.freeze(
      Object.fromEntries(
        Object.entries(library.functions).map(([name, fn]) => [name, withToolbox(fn, toolbox)]),
      ),
    ),
  }));
  bound.registry = inkRegistry('lib', wrapped, (entry) => entry.functions);
  return { registry: bound.registry, toolbox };
}

/**
 * A project module value (`person` / `place`) whose drawing functions get `ink.lib`: every
 * function called as `(g, ink, …)` receives the library toolbox. Unchanged without libraries.
 */
export function withModuleLibraries(
  value: unknown,
  libraries: BoundLibraries | undefined,
): unknown {
  if (libraries === undefined || !isObject(value)) return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [
      key,
      typeof entry === 'function'
        ? withToolbox(entry as (...args: unknown[]) => unknown, libraries.toolbox)
        : entry,
    ]),
  );
}
