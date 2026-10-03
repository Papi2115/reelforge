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

/**
 * On-screen forms an annotation plan can ask for (PLAN.md#11.8): the `ctx.annotate.*` marks plus
 * `caption` (small text / lower third), `big-text` (a big title or 3D text) and `counter`.
 */
export const ANNOTATION_PLAN_KINDS = [
  'callout',
  'arrow',
  'ring',
  'bracket',
  'pin',
  'underline',
  'highlight',
  'badge',
  'stamp',
  'dimension',
  'spotlight',
  'caption',
  'big-text',
  'counter',
] as const;
export type AnnotationPlanKind = (typeof ANNOTATION_PLAN_KINDS)[number];

/** What the narration does at the phrase: the meaning the form is chosen for. */
export const ANNOTATION_REASONS = [
  'name',
  'number',
  'definition',
  'place',
  'comparison',
  'list',
  'claim',
  'emphasis',
] as const;
export type AnnotationReason = (typeof ANNOTATION_REASONS)[number];

/** One planned on-screen annotation of a shot: a hint for the scene author, not a command. */
export const annotationPlanSchema = z.object({
  kind: z.enum(ANNOTATION_PLAN_KINDS),
  /** Spoken phrase it lands on, copied from the narration (words.json). */
  phrase: z.string().min(1),
  /** What it points at: an object of the shot ("calculator keypad") or `screen:<region>`. */
  target: z.string().min(1).optional(),
  /** Its text, when it has one (label, value, stamp word). */
  text: z.string().min(1).optional(),
  reason: z.enum(ANNOTATION_REASONS),
});
export type AnnotationPlan = z.infer<typeof annotationPlanSchema>;

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
    /** Planned annotations (optional; storyboards written before PLAN.md#11.8 have none). */
    annotations: z.array(annotationPlanSchema).optional(),
  })
  .refine((shot) => shot.t1 > shot.t0, { message: 't1 must be > t0', path: ['t1'] });
export type StoryboardShot = z.infer<typeof storyboardShotSchema>;

export const storyboardFileSchema = z.object({
  version: z.literal(STORYBOARD_FILE_VERSION),
  shots: z.array(storyboardShotSchema).min(1),
});
export type StoryboardFile = z.infer<typeof storyboardFileSchema>;
