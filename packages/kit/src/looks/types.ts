/**
 * The `Look` contract (ADR-009, docs/looks.md): a family of kit content (environments, props,
 * effects, shot templates) plus the docs the runtime Claude builds with, the sound palette and the
 * variation budget it uses. Looks never bring their own post-fx: every frame of every look goes
 * through the same Style (palette LUT, Bayer dither, pixel fonts), so a film stays one film.
 */
import { z } from 'zod';
import type { KitDefinition, KitKind } from '../registry.js';

/** A/B/C roll (same values as `@reelforge/shared` `ROLLS`; the kit has no shared dependency). */
export const LOOK_ROLLS = ['A', 'B', 'C'] as const;
export type LookRoll = (typeof LOOK_ROLLS)[number];

/** Kit content a look contributes, bound into `ctx.kit` next to the voxel kit's own. */
export interface LookKit {
  readonly env?: readonly KitDefinition[];
  readonly props?: readonly KitDefinition[];
  readonly fx?: readonly KitDefinition[];
  /** Whole-shot templates of any kind: bound into their kind's namespace (`kit.fx.<name>`, …). */
  readonly templates?: readonly KitDefinition[];
}

export interface Look {
  /** Kebab-case id, as storyboards write it (`shot.look`). */
  readonly id: string;
  readonly label: string;
  /** One line for the storyboard prompt: what it looks like and what it is good for. */
  readonly description: string;
  /** Rolls it suits. */
  readonly rolls: readonly LookRoll[];
  /** Storyboard treatments it favours (PLAN.md §4.3 taxonomy). */
  readonly treatments: readonly string[];
  /** Markdown for the scene-build prompt: how to build a shot in this look. */
  readonly docs: string;
  /** Sound palette id (consumed by PLAN.md#12.24). */
  readonly soundPalette: string;
  /** Variation budget key in STYLE.md (consumed by PLAN.md#12.8). */
  readonly variationBudget: string;
  /** Registered for storyboards and ctx.kit only when true. */
  readonly available: boolean;
  readonly kit: LookKit;
}

const LOOK_ID = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

/** Metadata checks (the kit definitions are checked by their own registry). */
export const lookMetaSchema = z.object({
  id: z.string().regex(LOOK_ID, 'look id must be kebab case, e.g. retro-ui'),
  label: z.string().min(1).max(40),
  description: z.string().min(1).max(240),
  rolls: z.array(z.enum(LOOK_ROLLS)).min(1),
  treatments: z.array(z.string().min(1)),
  docs: z.string().min(1),
  soundPalette: z.string().min(1),
  variationBudget: z.string().min(1),
  available: z.boolean(),
});

const KIT_SLOTS: readonly (readonly [keyof Omit<LookKit, 'templates'>, KitKind])[] = [
  ['env', 'env'],
  ['props', 'prop'],
  ['fx', 'fx'],
];

/** Every definition a look contributes, in env, props, fx, templates order. */
export function lookDefinitions(look: Look): KitDefinition[] {
  return [
    ...(look.kit.env ?? []),
    ...(look.kit.props ?? []),
    ...(look.kit.fx ?? []),
    ...(look.kit.templates ?? []),
  ];
}

/** Validates a look module at load time: a broken look fails loudly, like a broken preset. */
export function defineLook(look: Look): Look {
  const parsed = lookMetaSchema.safeParse(look);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join('.') || '(look)'}: ${issue.message}`)
      .join('; ');
    throw new Error(`invalid look "${look.id}": ${details}`);
  }
  for (const [slot, kind] of KIT_SLOTS) {
    const wrong = (look.kit[slot] ?? []).find((definition) => definition.kind !== kind);
    if (wrong !== undefined) {
      throw new Error(
        `invalid look "${look.id}": kit.${slot} lists ${wrong.kind} "${wrong.name}" (expected ${kind})`,
      );
    }
  }
  return Object.freeze(look);
}
