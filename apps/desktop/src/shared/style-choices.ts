/**
 * The styles a project can have, as the app names and offers them (PLAN.md#13.6, ADR-029): the
 * built-in presets, the shipped worlds and, only with Settings → "Experimental worlds (preview)",
 * the experimental worlds (Sketchbook). Read from the engine's style registry, so a new world is
 * offered without a UI change once it has a one-line description here. Used by main (which style
 * a new project may get) and the renderer (the New project form, Project settings, the header).
 */
import { STYLE_REGISTRY, type StyleRegistry } from '@reelforge/engine';

export interface StyleChoice {
  readonly id: string;
  /** The style's display name; a world's own name. */
  readonly label: string;
  /** One plain line: what the film looks like. */
  readonly description: string;
  /** The style of a world: its own A/B/C looks and heroes, no voxel looks, pack or mascot. */
  readonly world: boolean;
  /** An experimental world: offered only with Settings → "Experimental worlds (preview)". */
  readonly preview: boolean;
}

/** One line per style id (tests require one for every registered style). */
export const STYLE_DESCRIPTIONS: Readonly<Record<string, string>> = {
  'voxel-pixel-crisp640':
    'Chunky voxel 3D in crisp pixel art: neon on dark, one hero object per shot.',
  'noir-voxel': 'Low-key voxel 3D: mostly shadow, one hard light, red and amber accents.',
  'soft-480': 'Warm, friendly voxel 3D with bigger pixels: rose, plum, sage and peach.',
  sketchbook: 'Hand-drawn notebook: felt-tip pages, graph paper, pop-up and accordion moments.',
};

/** How the app describes style `id`; undefined for a style this build does not ship. */
export function describeStyle(
  id: string,
  registry: StyleRegistry = STYLE_REGISTRY,
): StyleChoice | undefined {
  const entry = registry.entry(id);
  if (entry === undefined) return undefined;
  const world = entry.world;
  return {
    id,
    label: world?.label ?? entry.preset.name,
    description: STYLE_DESCRIPTIONS[id] ?? '',
    world: world !== undefined,
    preview: world?.experimental === true,
  };
}

/** The styles a new project may start with, in registry order (built-ins first). */
export function styleChoices(
  experimentalWorlds: boolean,
  registry: StyleRegistry = STYLE_REGISTRY,
): StyleChoice[] {
  const ids = experimentalWorlds ? registry.allIds : registry.ids;
  return ids.flatMap((id) => describeStyle(id, registry) ?? []);
}

/** True when a new project may get style `id` under the current experimental switch. */
export function isOfferedStyle(
  id: string,
  experimentalWorlds: boolean,
  registry: StyleRegistry = STYLE_REGISTRY,
): boolean {
  return styleChoices(experimentalWorlds, registry).some((choice) => choice.id === id);
}

/** The header's style name: a world's name, a preset's name, or an unknown id as is. */
export function styleLabel(id: string, registry: StyleRegistry = STYLE_REGISTRY): string {
  return describeStyle(id, registry)?.label ?? id;
}
