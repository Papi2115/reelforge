/**
 * The looks a world project keeps (PLAN.md#14.12, project.json `worldLooks`): a world whose looks
 * are optional (kit `World.optionalLooks`, Grim Ink) may turn some of them off in Project settings
 * → "Looks of this world". The stored list names the looks that stay ON; absent = all of them
 * (every project made before 14.12, and a new one until the user turns a look off). The rolls
 * follow the looks in use: the first look kept is the A roll, the next B, then C.
 */
import { z } from 'zod';

const LOOK_ID = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** At least one look stays on; ids are unique (unknown ids are ignored, see `enabledWorldLooks`). */
export const worldLooksSchema = z
  .array(z.string().max(64).regex(LOOK_ID, 'look ids are kebab-case, e.g. "ink-scene"'))
  .min(1, 'at least one look of the world stays on')
  .max(8)
  .refine((ids) => new Set(ids).size === ids.length, { message: 'a look is listed twice' });
export type WorldLooks = z.infer<typeof worldLooksSchema>;

/**
 * The world's looks a project uses, in the world's order (A roll first): all of them when
 * `chosen` is absent, or when it keeps none of them (a hand-edited list of unknown ids never
 * leaves a film without looks).
 */
export function enabledWorldLooks<T extends { readonly id: string }>(
  looks: readonly T[],
  chosen: readonly string[] | undefined,
): T[] {
  if (chosen === undefined) return [...looks];
  const kept = looks.filter((look) => chosen.includes(look.id));
  return kept.length === 0 ? [...looks] : kept;
}

/** `A`, `B`, `C`, …: the roll of the look at this place among the looks in use. */
export function worldRollLetter(index: number): string {
  return String.fromCharCode('A'.charCodeAt(0) + index);
}
