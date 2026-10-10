/**
 * C-CAM cut table schema (PLAN.md#14.6). The single source of truth for the shape of a camera cut:
 * the `Cut` / `Framing` types used by camera.ts are inferred from these schemas, so the runtime
 * validator (scene `meta`, later lint/QA validators) and the drawing code cannot drift apart.
 *
 * Ranges come from the camera guide (docs/concepts/c-cam-style/docs/05-CAMERA_GUIDE.md §1): zoom
 * 0.8-5.4, Dutch roll -7..+7 degrees. The schema rejects anything outside; `applyCamera` clamps as a
 * runtime safety net (eased `back` moves can overshoot a valid endpoint).
 */
import { z } from 'zod';

/** Widest framing used by the films (zoom 1 = the whole 1920x1080 world). */
export const ZOOM_MIN = 0.8;
/** Tightest insert used by the films. */
export const ZOOM_MAX = 5.4;
/** Largest Dutch roll in degrees, either sign. */
export const ROT_MAX = 7;

/** `cut` = no move inside the framing; the rest are `core.ease` curves. */
export const CUT_EASES = ['cut', 'lin', 'inOut', 'out', 'back'] as const;

// zod 4 numbers are finite: NaN and +-Infinity are rejected.
const coordinate = z.number();
const zoom = z.number().min(ZOOM_MIN).max(ZOOM_MAX);
const roll = z.number().min(-ROT_MAX).max(ROT_MAX);

/** A camera framing: world point (x, y) at the frame centre, zoom z, roll rot in degrees (default 0). */
export const framingSchema = z
  .object({
    x: coordinate,
    y: coordinate,
    z: zoom,
    rot: roll.optional(),
  })
  .strict();

/**
 * One framing of the cut table. Shown from `at` (shot seconds) until the next cut (a hard cut). A
 * move from this framing to `to` runs over [at, end] when both are given and `ease` is not `cut`.
 */
export const cutSchema = z
  .object({
    at: z.number().min(0),
    name: z.string().min(1).optional(),
    x: coordinate,
    y: coordinate,
    z: zoom,
    rot: roll.optional(),
    ease: z.enum(CUT_EASES).optional(),
    to: framingSchema.optional(),
    end: z.number().optional(),
  })
  .strict()
  .refine((cut) => cut.end === undefined || cut.end > cut.at, {
    message: '`end` must be after `at`',
    path: ['end'],
  })
  .refine((cut) => cut.to === undefined || cut.end !== undefined, {
    message: 'a move (`to`) needs an `end` time',
    path: ['to'],
  });

/** A shot's cut table: at least one cut, `at` strictly ascending. */
export const cutTableSchema = z
  .array(cutSchema)
  .min(1)
  .refine((cuts) => cuts.every((cut, i) => i === 0 || cut.at > (cuts[i - 1]?.at ?? -Infinity)), {
    message: 'cut times (`at`) must be strictly ascending',
  });

export type CutEase = (typeof CUT_EASES)[number];
export type Framing = z.infer<typeof framingSchema>;
export type Cut = z.infer<typeof cutSchema>;
export type CutTable = z.infer<typeof cutTableSchema>;
