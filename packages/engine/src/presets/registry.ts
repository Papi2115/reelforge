/**
 * Style registry (PLAN.md#13.1): the built-in presets plus the style of every world
 * (`@reelforge/kit` `WORLDS`, docs/worlds/README.md). Built-in ids keep their order and come
 * first; experimental world styles resolve (showcase renders) but are not listed in `ids`, so
 * style pickers, project checks and prompts see exactly the built-in styles until a world ships.
 */
import type { World, WorldFonts } from '@reelforge/kit';
import { stylePresetSchema, type StylePreset } from '@reelforge/shared';
import { FONT_NAMES } from '../text/options.js';

/** Font ids a world may map its text roles to (the engine's pixel fonts). */
export const STYLE_FONT_IDS: readonly string[] = FONT_NAMES;

/** What a world adds to its preset. */
export interface WorldStyleInfo {
  readonly label: string;
  readonly experimental: boolean;
  readonly fonts: WorldFonts;
  readonly soundPalette: string;
  /** Ids of the world's looks. */
  readonly looks: readonly string[];
}

export interface StyleEntry {
  readonly preset: StylePreset;
  /** Absent for the built-in styles. */
  readonly world?: WorldStyleInfo;
}

export interface StyleRegistry {
  /** Selectable style ids: the built-ins, then the non-experimental worlds. */
  readonly ids: readonly string[];
  /** Every id, experimental world styles included. */
  readonly allIds: readonly string[];
  entry(id: string): StyleEntry | undefined;
  find(id: string): StylePreset | undefined;
  /** True for the style of an experimental world. */
  isExperimental(id: string): boolean;
}

function parsePreset(input: unknown, origin: string): StylePreset {
  const result = stylePresetSchema.safeParse(input);
  if (result.success) return result.data;
  const details = result.error.issues
    .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
    .join('; ');
  throw new Error(`invalid ${origin}: ${details}`);
}

function worldEntry(world: World): StyleEntry {
  const preset = parsePreset(world.style, `style of world "${world.id}"`);
  if (preset.id !== world.id) {
    throw new Error(`world "${world.id}": its style id is "${preset.id}"`);
  }
  for (const role of FONT_NAMES) {
    const font = world.fonts[role];
    if (!STYLE_FONT_IDS.includes(font)) {
      throw new Error(
        `world "${world.id}": fonts.${role} "${font}" is not an engine font (${STYLE_FONT_IDS.join(', ')})`,
      );
    }
  }
  const { label, experimental, fonts, soundPalette } = world;
  const looks = world.looks.map((look) => look.id);
  return { preset, world: { label, experimental, fonts, soundPalette, looks } };
}

/**
 * Why a render may not use style `id` (undefined = it may): unknown ids never, experimental world
 * styles only in showcase renders (`render:frames --experimental`).
 */
export function renderStyleProblem(
  registry: StyleRegistry,
  id: string,
  experimental: boolean,
): string | undefined {
  if (registry.entry(id) === undefined) {
    const known = experimental ? registry.allIds : registry.ids;
    return `unknown style "${id}"; available: ${known.join(', ')}`;
  }
  if (registry.isExperimental(id) && !experimental) {
    return `style "${id}" is an experimental world; pass --experimental (showcase renders only)`;
  }
  return undefined;
}

/** Builds a registry; throws on an invalid preset, a world style mismatch or a repeated id. */
export function createStyleRegistry(
  builtIns: readonly unknown[],
  worlds: readonly World[] = [],
): StyleRegistry {
  const entries = new Map<string, StyleEntry>();
  const add = (entry: StyleEntry): void => {
    if (entries.has(entry.preset.id)) {
      throw new Error(`style id "${entry.preset.id}" is registered twice`);
    }
    entries.set(entry.preset.id, entry);
  };
  for (const raw of builtIns) add({ preset: parsePreset(raw, 'built-in style preset') });
  for (const world of worlds) add(worldEntry(world));
  const allIds = Object.freeze([...entries.keys()]);
  const isExperimental = (id: string): boolean => entries.get(id)?.world?.experimental === true;
  return {
    ids: Object.freeze(allIds.filter((id) => !isExperimental(id))),
    allIds,
    entry: (id) => entries.get(id),
    find: (id) => entries.get(id)?.preset,
    isExperimental,
  };
}
