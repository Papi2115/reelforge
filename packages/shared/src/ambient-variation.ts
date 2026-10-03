/**
 * Ambient variation (PLAN.md#12.8, ADR-010): inside a film the environments of a look drift from
 * shot to shot (grid tone and density, horizon, sky stops, debris, light direction, camera drift)
 * within a *variation budget* of the style. The budget lives in the engine style preset
 * (`variation.<budget key>`, the key comes from the look, e.g. `voxel`); the switch lives in
 * project.json (`ambientVariation`, absent = off) and reaches the engine through the render
 * manifest (`ambientVariation` + per-shot `ambient`).
 */
import { z } from 'zod';
import { lookIdSchema, rollSchema, type StoryboardShot } from './storyboard.js';

/** `[min, max]` of one continuous axis; `neutral` (the scene's own value) must lie inside. */
function axisRange(lowest: number, highest: number, neutral: number) {
  return z
    .tuple([z.number().min(lowest).max(highest), z.number().min(lowest).max(highest)])
    .refine(([min, max]) => min <= max && min <= neutral && neutral <= max, {
      message: `range must be [min, max] with min <= ${String(neutral)} <= max`,
    });
}

/**
 * One variation budget. Colours are only ever swatch names of the style palette (`tones`), so a
 * varied frame is still the Style; every continuous axis is a range around the scene's own value.
 */
export const variationBudgetSchema = z.object({
  /**
   * Palette families: swatch -> other swatches of its family it may become in a shot (closest
   * first). Only environment colours that the scene did not set explicitly are toned.
   */
  tones: z.record(z.string().min(1), z.array(z.string().min(1)).min(1).max(4)),
  /** Share of the tone families swapped in one shot (at scale 1). */
  toneShare: z.number().min(0).max(1),
  /** Levels of every continuous axis (shots step through them; neighbours always differ). */
  steps: z.int().min(3).max(9),
  /** Multiplier of the neon grid cell (density). */
  cell: axisRange(0.5, 2, 1),
  /** Offset of the sky horizon and gradient top (elevation, sine of the angle). */
  horizon: axisRange(-0.2, 0.2, 0),
  /** Multiplier of the grid fade distance (where the floor melts into the horizon). */
  fade: axisRange(0.5, 2, 1),
  /** Turn of the light rig in degrees (key light direction). */
  lightAzimuth: axisRange(-60, 60, 0),
  /** Offset of the light elevation in degrees. */
  lightElevation: axisRange(-20, 20, 0),
  /** Multiplier of floating debris (cubes, shards) and stars. */
  debris: axisRange(0.25, 2, 1),
  /** Max slow camera drift over a shot: [yaw, pitch] in degrees. */
  cameraDrift: z.tuple([z.number().min(0).max(5), z.number().min(0).max(3)]),
});
export type VariationBudgetInput = z.input<typeof variationBudgetSchema>;
export type VariationBudget = z.infer<typeof variationBudgetSchema>;

/** Budget key (the look's `variationBudget`, e.g. `voxel`). */
export const variationBudgetKeySchema = z
  .string()
  .regex(/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/, 'budget keys are kebab case, e.g. voxel');

/** Budget multiplier range (film-wide and per shot; 0 = no variation, 1 = the style budget). */
export const variationScaleSchema = z.number().min(0).max(2);

/** Manifest `ambientVariation`: the project switch as the engine sees it. */
export const ambientVariationSettingsSchema = z.object({
  enabled: z.boolean(),
  /** Variation seed (uint32); the manifest builders use the project seed. */
  seed: z.int().min(0).max(0xffffffff),
  /** Film-wide budget multiplier (default 1). */
  scale: variationScaleSchema.optional(),
});
export type AmbientVariationSettings = z.infer<typeof ambientVariationSettingsSchema>;

/**
 * Manifest shot `ambient`: where the shot sits in the storyboard. Carried explicitly so a shot
 * rendered alone (`reelforge frames`) varies exactly as in the whole film.
 */
export const ambientShotSchema = z.object({
  /** 0-based position in the storyboard. */
  index: z.int().min(0),
  /** 0-based act: a new act starts at every non-cut transition. */
  act: z.int().min(0),
  roll: rollSchema.optional(),
  /** Look of the shot (absent = voxel): selects the style budget through the look. */
  look: lookIdSchema.optional(),
  /** Per-shot budget multiplier (the tension map, PLAN.md#12.22). */
  scale: variationScaleSchema.optional(),
});
export type AmbientShot = z.infer<typeof ambientShotSchema>;

/** Storyboard fields the per-shot ambient inputs come from. */
export type AmbientShotSource = Pick<StoryboardShot, 'roll' | 'look' | 'transitionIn'>;

/** Per-shot ambient inputs of a storyboard, in shot order. */
export function ambientShotInputs(shots: readonly AmbientShotSource[]): AmbientShot[] {
  let act = 0;
  return shots.map((shot, index) => {
    if (index > 0 && shot.transitionIn !== undefined && shot.transitionIn.type !== 'cut') {
      act += 1;
    }
    return {
      index,
      act,
      ...(shot.roll === undefined ? {} : { roll: shot.roll }),
      ...(shot.look === undefined ? {} : { look: shot.look }),
    };
  });
}

/** Projects without the field (made before 2.0) keep their exact frames. */
export const DEFAULT_AMBIENT_VARIATION = false;
