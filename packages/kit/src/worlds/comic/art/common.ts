/**
 * Shared option schemas and seeded choices of the comic art layer (PLAN.md#13.15a): colours are
 * the 22 comic swatch names (readable error listing them), every generator takes where it stands
 * (`x`, `y`), how tall it is (`size`), which way it faces (`flip`), a `seed` for its variation
 * and an optional time `t` (defaults to the panel clock).
 */
import { z } from 'zod';
import { KitError } from '../../../errors.js';
import { rnd } from '../draw/math.js';
import { SWATCH_NAMES } from '../inks.js';
import type { ComicPen } from '../page/pen.js';

const SWATCHES: readonly string[] = SWATCH_NAMES;

/** A comic swatch name ('ink', 'cyanDeep', 'phosphor', ...). */
export const colorSchema = z.string().refine((name) => SWATCHES.includes(name), {
  error: (issue) =>
    `unknown colour ${JSON.stringify(issue.input)}; comic inks: ${SWATCHES.join(', ')}`,
});

export const pointSchema = z.tuple([z.number(), z.number()]);

export const seedSchema = z.union([z.int(), z.string().max(40)]).default(0);

/** Options every generator takes. */
export const placeShape = {
  x: z.number().describe('Where it stands (bottom centre), pen units'),
  y: z.number(),
  flip: z.boolean().default(false).describe('Face left'),
  angle: z.number().min(-7).max(7).default(0).describe('Tilt in radians (floating, falling)'),
  seed: seedSchema,
  t: z.number().optional().describe('Animation time (default: the panel clock)'),
};

/** Colour-only paint for art specs: a swatch name or 'none'. */
export const fillSchema = z.union([z.literal('none'), colorSchema]);

/** Parses generator options with a readable `art.<name>` error. */
export function parseArt<S extends z.ZodType>(
  schema: S,
  value: unknown,
  where: string,
): z.output<S> {
  const result = schema.safeParse(value ?? {});
  if (result.success) return result.data;
  const details = result.error.issues
    .map((issue) => `${issue.path.join('.') || '(options)'}: ${issue.message}`)
    .join('; ');
  throw new KitError('invalid-params', `${where}: ${details}`);
}

/** The seeded key of one generator call. */
export function artKey(kind: string, seed: number | string): string {
  return `art:${kind}:${String(seed)}`;
}

/** A seeded pick from a list. */
export function pick<T>(list: readonly T[], key: string, index: number): T {
  const item = list[Math.floor(rnd(key, index) * list.length) % list.length];
  if (item === undefined) throw new KitError('invalid-params', 'pick from an empty list');
  return item;
}

/** The time a generator animates at: its `t` option or the panel clock. */
export function timeOf(g: ComicPen, t: number | undefined): number {
  return t ?? g.t;
}
