/**
 * The `World` contract (PLAN.md#13.1, docs/worlds/README.md): one Style (engine preset: palette,
 * tokens, post-fx filter, resolution) plus its fonts, sound palette and its own A/B/C looks. A
 * world lives in `worlds/<id>/`; its looks carry `styles: [<id>]`, so they appear only while the
 * world's style is active and nothing changes for the built-in styles.
 */
import { z } from 'zod';
import type { Look } from '../looks/types.js';

/** Engine font id per text role (`ctx.text` `font: 'display' | 'mono'`). */
export interface WorldFonts {
  readonly display: string;
  readonly mono: string;
}

export interface World {
  /** Kebab-case id; also the id of its style preset (`project.json` `style`). */
  readonly id: string;
  readonly label: string;
  /** One or two sentences: what the world looks like and what it is for. */
  readonly description: string;
  /** Hidden from style pickers and prompts; renderable only by showcase renders. */
  readonly experimental: boolean;
  /**
   * The app may offer it: its prompt wording (`@reelforge/prompts` `WORLD_PROMPTS`) and project
   * defaults (`@reelforge/project` `WORLD_PROJECT_DEFAULTS`) exist. An unwired world is render-only
   * (`render:frames --experimental`), even with the Experimental worlds switch on.
   */
  readonly wired: boolean;
  /**
   * The engine style preset (`stylePresetSchema` of @reelforge/shared; `id` = the world id). The
   * kit has no shared dependency: the engine validates it when it registers the world.
   */
  readonly style: Readonly<Record<string, unknown>>;
  readonly fonts: WorldFonts;
  /** Default sound palette id of the world (its looks name their own). */
  readonly soundPalette: string;
  /** The world's looks, A roll first; each lists this world in `styles`. */
  readonly looks: readonly Look[];
}

/** A world module as written: `wired` defaults to false (render-only until its prompts exist). */
export type WorldDefinition = Omit<World, 'wired'> & { readonly wired?: boolean };

const WORLD_ID = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const worldMetaSchema = z.object({
  id: z.string().regex(WORLD_ID, 'world id must be kebab case, e.g. sketchbook'),
  label: z.string().min(1).max(40),
  description: z.string().min(1).max(240),
  experimental: z.boolean(),
  wired: z.boolean().optional(),
  fonts: z.object({ display: z.string().min(1), mono: z.string().min(1) }),
  soundPalette: z.string().min(1),
});

function worldError(id: string, message: string): Error {
  return new Error(`invalid world "${id}": ${message}`);
}

function checkLooks(world: World): void {
  if (world.looks.length === 0)
    throw worldError(world.id, 'looks: a world needs at least one look');
  for (const look of world.looks) {
    if (look.styles?.includes(world.id) !== true) {
      throw worldError(world.id, `look "${look.id}" must list "${world.id}" in styles`);
    }
    if (world.experimental && look.experimental !== true) {
      throw worldError(world.id, `look "${look.id}" of an experimental world must be experimental`);
    }
  }
}

/**
 * Validates a world module at load time: a broken world fails loudly, like a broken look. A world
 * that is not experimental any more must be wired (a shipped world has prompts and defaults).
 */
export function defineWorld(definition: WorldDefinition): World {
  const world: World = { ...definition, wired: definition.wired ?? false };
  const parsed = worldMetaSchema.safeParse(world);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join('.') || '(world)'}: ${issue.message}`)
      .join('; ');
    throw worldError(world.id, details);
  }
  if (world.style['id'] !== world.id) {
    throw worldError(
      world.id,
      `style.id is ${JSON.stringify(world.style['id'])} (expected the world id)`,
    );
  }
  if (!world.experimental && !world.wired) {
    throw worldError(world.id, 'a world that is not experimental must be wired');
  }
  checkLooks(world);
  return Object.freeze(world);
}
