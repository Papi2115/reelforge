/**
 * Storyboard shots and shot transitions. A shot covers the global time range [t0, t1)
 * (seconds); its scene module renders it in local time `t - t0`.
 */
import { z } from 'zod';

export const STORYBOARD_FILE_VERSION = 1;

/** Treatment taxonomy, PLAN.md §4.3. */
export const treatmentSchema = z.enum([
  'title-card',
  'metaphor-object',
  '3d-reconstruction',
  'map',
  'node-graph/timeline',
  'data-chart-3d',
  'counter/odometer',
  'ui-mockup',
  'character-scene',
  'kinetic-text',
  'montage/transition',
]);
export type Treatment = z.infer<typeof treatmentSchema>;

/** Lower-case id usable in file names, e.g. `s03` or `s03_calc_desk`. */
export const shotIdSchema = z
  .string()
  .regex(/^[a-z0-9][a-z0-9_-]*$/, 'shot id must match ^[a-z0-9][a-z0-9_-]*$');

export const transitionTypeSchema = z.enum(['cut', 'crossfade', 'glitch', 'wipe']);
export type TransitionType = z.infer<typeof transitionTypeSchema>;

/**
 * Transition from the previous shot into this one. It starts at this shot's t0 and lasts
 * `duration` seconds; meanwhile the previous shot keeps rendering past its own t1.
 */
export const transitionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('cut') }),
  z.object({
    type: z.enum(['crossfade', 'glitch', 'wipe']),
    duration: z.number().positive(),
  }),
]);
export type Transition = z.infer<typeof transitionSchema>;

export const CUT: Transition = { type: 'cut' };

export const storyboardShotSchema = z
  .object({
    id: shotIdSchema,
    t0: z.number().nonnegative(),
    t1: z.number().positive(),
    treatment: treatmentSchema,
    /** What the shot must communicate, in plain words. */
    intent: z.string().min(1),
    /** Scene module path relative to the project root, e.g. `scenes/s03_calc_desk.js`. */
    scene: z.string().min(1),
    transitionIn: transitionSchema.optional(),
  })
  .refine((shot) => shot.t1 > shot.t0, { message: 't1 must be > t0', path: ['t1'] });
export type StoryboardShot = z.infer<typeof storyboardShotSchema>;

export const storyboardFileSchema = z.object({
  version: z.literal(STORYBOARD_FILE_VERSION),
  shots: z.array(storyboardShotSchema).min(1),
});
export type StoryboardFile = z.infer<typeof storyboardFileSchema>;
