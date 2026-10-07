/**
 * Project defaults of the world styles (PLAN.md#13.6, ADR-029/030): a new project in a world's
 * style gets its film language from the start — continuity links on (the worlds' signature), mixed
 * looks (the world's A/B/C), no character pack or mascot (worlds draw their own heroes) and the
 * anti-slop guards on (PLAN.md#13.7). The built-in styles keep the template as it is. Keyed by
 * world id (= style id); this package does not depend on the kit, so `@reelforge/stages` tests
 * keep the keys in sync with `WORLDS`.
 * World styles have no style bible (`styles/<id>/STYLE.md`) until they ship: their prompts carry
 * the world brief instead.
 */
import type { ProjectFile } from '@reelforge/shared';

export type WorldProjectDefaults = Readonly<
  Pick<ProjectFile, 'lookMode' | 'continuityLinks' | 'characters' | 'mascot' | 'antiSlopGuards'>
>;

const WORLD_DEFAULTS: WorldProjectDefaults = {
  lookMode: 'mixed',
  continuityLinks: true,
  characters: 'classic',
  mascot: 'none',
  antiSlopGuards: true,
};

/** The world styles and the project fields they set (over the template and the user's choices). */
export const WORLD_PROJECT_DEFAULTS: Readonly<Record<string, WorldProjectDefaults>> = Object.freeze(
  { sketchbook: WORLD_DEFAULTS },
);

/** The defaults of a world style; undefined for every built-in style. */
export function worldProjectDefaults(style: string): WorldProjectDefaults | undefined {
  return Object.hasOwn(WORLD_PROJECT_DEFAULTS, style) ? WORLD_PROJECT_DEFAULTS[style] : undefined;
}
