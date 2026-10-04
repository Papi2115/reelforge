/**
 * Storyboard shots and shot transitions. A shot covers the global time range [t0, t1)
 * (seconds); its scene module renders it in local time `t - t0`.
 */
import { z } from 'zod';
import { assetIdSchema } from './assets.js';
import { interruptSchema } from './interrupts.js';

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
 * Transition style id (PLAN.md#12.15, `TRANSITION_STYLES` in transitions.ts), kebab case. Any id
 * parses (forward compatible); the storyboard validator rejects unknown ones and the engine
 * renders an unknown style as its plain `type`.
 */
export const transitionStyleIdSchema = z
  .string()
  .regex(/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/, 'transition style must be kebab case, e.g. pixel-wipe');

/**
 * Transition from the previous shot into this one. It starts at this shot's t0 and lasts
 * `duration` seconds; meanwhile the previous shot keeps rendering past its own t1. `style`
 * (optional, 2.0) selects a pixel transition of the transition kit; without it the plain `type`
 * renders exactly as before.
 */
export const transitionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('cut') }),
  z.object({
    type: z.enum(['crossfade', 'glitch', 'wipe']),
    duration: z.number().positive(),
    style: transitionStyleIdSchema.optional(),
  }),
]);
export type Transition = z.infer<typeof transitionSchema>;

export const CUT: Transition = { type: 'cut' };

/**
 * On-screen forms an annotation plan can ask for (PLAN.md#11.8): the `ctx.annotate.*` marks plus
 * `caption` (small text / lower third), `big-text` (a big title or 3D text) and `counter`;
 * `source-chip` (`ctx.annotate.sourceChip`, PLAN.md#12.18) credits a sourced claim and is not
 * counted as a mark by the variety rules.
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
  'source-chip',
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

/**
 * Roll of a shot (PLAN.md phase 12): `A` = the main visual story (voxel 3D, the anchor), `B` =
 * proof and illustration, `C` = atmosphere and rhythm. See docs/looks.md.
 */
export const ROLLS = ['A', 'B', 'C'] as const;
export const rollSchema = z.enum(ROLLS);
export type Roll = z.infer<typeof rollSchema>;

/** At most this many asset needs per film unless the stage is told otherwise (PLAN.md#12.10). */
export const DEFAULT_MAX_ASSET_NEEDS = 8;

/** Asset need id: lower-case kebab case, unique in the storyboard, e.g. `apollo-launch`. */
export const assetNeedIdSchema = z
  .string()
  .regex(/^[a-z0-9][a-z0-9-]{0,47}$/, 'asset need id must be kebab case, e.g. apollo-launch');

/**
 * A real photo / footage / screenshot a shot would be stronger with (PLAN.md#12.10): written by
 * the storyboard only when the project's research mode is not `off`. The shot always keeps a
 * kit fallback; the Assets stage looks for it per the research mode.
 */
export const assetNeedSchema = z.object({
  id: assetNeedIdSchema,
  kind: z.enum(['image', 'video']),
  /** What is needed, in plain words ("the Apollo 11 launch, 1969, wide"). */
  description: z.string().min(1).max(300),
  /** Search words for the open-licence sources. */
  query: z.string().min(1).max(200).optional(),
  /** How the shot would use it ("photo on the CRT", "framed on the wall"). */
  role: z.string().min(1).max(120).optional(),
});
export type AssetNeed = z.infer<typeof assetNeedSchema>;

/** Existing assets one shot may show (PLAN.md#12.12). */
export const MAX_SHOT_ASSETS = 4;

/** Look a shot is built in when the storyboard names none (ADR-009). */
export const DEFAULT_LOOK_ID = 'voxel';

/** Look id: lower-case kebab case, e.g. `voxel`, `retro-ui`. */
export const lookIdSchema = z
  .string()
  .regex(/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/, 'look id must be kebab case, e.g. retro-ui');

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
    /** A/B/C roll (optional; storyboards written before ReelForge 2.0 have none). */
    roll: rollSchema.optional(),
    /** Look id (optional; absent = `voxel`, see `shotLook`). */
    look: lookIdSchema.optional(),
    /** Real photos/footage the shot asks for (optional; only when asset research is on). */
    assetNeeds: z.array(assetNeedSchema).optional(),
    /**
     * Assets already in `assets.json` (the user's own files, library copies, downloads) the shot
     * shows, by asset id (PLAN.md#12.12). Optional; the validator checks that the ids exist.
     */
    assets: z.array(assetIdSchema).max(MAX_SHOT_ASSETS).optional(),
    /** A planned pattern interrupt at the shot's start (PLAN.md#12.25; optional, switch on). */
    interrupt: interruptSchema.optional(),
  })
  .refine((shot) => shot.t1 > shot.t0, { message: 't1 must be > t0', path: ['t1'] });
export type StoryboardShot = z.infer<typeof storyboardShotSchema>;

/** The look a shot is built in: its `look`, or `voxel` when the storyboard names none. */
export function shotLook(shot: Pick<StoryboardShot, 'look'>): string {
  return shot.look ?? DEFAULT_LOOK_ID;
}

/** An asset need with the shot that asked for it. */
export interface ShotAssetNeed {
  readonly shotId: string;
  readonly need: AssetNeed;
}

/** Every asset need of the storyboard, in shot order. */
export function storyboardAssetNeeds(
  shots: readonly Pick<StoryboardShot, 'id' | 'assetNeeds'>[],
): ShotAssetNeed[] {
  return shots.flatMap((shot) =>
    (shot.assetNeeds ?? []).map((need) => ({ shotId: shot.id, need })),
  );
}

/** Asset ids the shots assign (`shot.assets`), each once, in shot order. */
export function storyboardAssetIds(shots: readonly Pick<StoryboardShot, 'assets'>[]): string[] {
  return [...new Set(shots.flatMap((shot) => shot.assets ?? []))];
}

export const storyboardFileSchema = z.object({
  version: z.literal(STORYBOARD_FILE_VERSION),
  shots: z.array(storyboardShotSchema).min(1),
});
export type StoryboardFile = z.infer<typeof storyboardFileSchema>;
