/**
 * Tension map (PLAN.md#12.22, ADR-017): `tension.json` in the project root (tracked) holds the
 * film's tension curve, calm -> escalation -> turn -> resolution, as points `{ t, v }` (seconds,
 * strictly increasing; v in 0..1, piecewise linear between them) with optional labelled
 * segments. Claude proposes it from the script and timed words (`source: 'claude'`), the user
 * draws or edits it (`user` / `edited`). Locked shots keep the tension they were approved with
 * (`pins`). The project switch `tensionMap` (project.json; absent = `off`) decides whether the
 * storyboard, the sound design and the render manifest read it at all.
 */
import { z } from 'zod';
import { shotIdSchema } from './storyboard.js';

export const TENSION_FILE_VERSION = 1;
/** Project-relative location (tracked by git, like storyboard.json). */
export const TENSION_FILE = 'tension.json';

/** Project switch: `off` = nothing reads the curve (projects made before 2.2), `auto` = on. */
export const TENSION_MAP_MODES = ['off', 'auto'] as const;
export const tensionMapModeSchema = z.enum(TENSION_MAP_MODES);
export type TensionMapMode = z.infer<typeof tensionMapModeSchema>;
/** Projects without the field keep their exact behaviour; new projects get `auto`. */
export const DEFAULT_TENSION_MAP: TensionMapMode = 'off';

/** Phases a segment of the curve can be labelled with. */
export const TENSION_SEGMENT_KINDS = ['calm', 'rising', 'peak', 'turn', 'release'] as const;
export const tensionSegmentKindSchema = z.enum(TENSION_SEGMENT_KINDS);
export type TensionSegmentKind = z.infer<typeof tensionSegmentKindSchema>;

/** Who made the curve: Claude's proposal, drawn by the user, or Claude's proposal edited. */
export const TENSION_SOURCES = ['claude', 'user', 'edited'] as const;
export const tensionSourceSchema = z.enum(TENSION_SOURCES);
export type TensionSource = z.infer<typeof tensionSourceSchema>;

/** Points a curve may have (a 15-minute film at one point per 3 s still fits). */
export const MAX_TENSION_POINTS = 400;
const ORDER_EPSILON = 1e-6;

export const tensionPointSchema = z.object({
  /** Seconds on the film timeline. */
  t: z.number().nonnegative(),
  /** Tension 0 (calm) .. 1 (peak). */
  v: z.number().min(0).max(1),
});
export type TensionPoint = z.infer<typeof tensionPointSchema>;

export const tensionSegmentSchema = z
  .object({
    from: z.number().nonnegative(),
    to: z.number().positive(),
    kind: tensionSegmentKindSchema,
    /** Short note on what happens there ("the leak is found"). */
    label: z.string().min(1).max(80).optional(),
  })
  .refine((segment) => segment.to > segment.from, { message: 'to must be > from', path: ['to'] });
export type TensionSegment = z.infer<typeof tensionSegmentSchema>;

/** A locked shot's tension, kept while the curve around it changes (PLAN.md#11.4). */
export const tensionPinSchema = z.object({
  shotId: shotIdSchema,
  v: z.number().min(0).max(1),
});
export type TensionPin = z.infer<typeof tensionPinSchema>;

export const tensionFileSchema = z
  .object({
    version: z.literal(TENSION_FILE_VERSION),
    source: tensionSourceSchema,
    /** The user locked the curve: no proposal replaces it (not even "Propose with Claude"). */
    locked: z.boolean().optional(),
    points: z.array(tensionPointSchema).min(2).max(MAX_TENSION_POINTS),
    segments: z.array(tensionSegmentSchema).max(60).optional(),
    pins: z.array(tensionPinSchema).optional(),
    /** One line on the dramatic arc (Claude's proposal). */
    note: z.string().max(300).optional(),
    /** Claude's last proposal, kept when the user edits it ("Reset" brings it back). */
    proposal: z
      .object({
        points: z.array(tensionPointSchema).min(2).max(MAX_TENSION_POINTS),
        segments: z.array(tensionSegmentSchema).max(60).optional(),
      })
      .optional(),
  })
  .superRefine((file, issues) => {
    file.points.forEach((point, index) => {
      const previous = file.points[index - 1];
      if (previous !== undefined && point.t <= previous.t + ORDER_EPSILON) {
        issues.addIssue({
          code: 'custom',
          message: `points must have strictly increasing t (${String(point.t)} after ${String(previous.t)})`,
          path: ['points', index, 't'],
        });
      }
    });
    (file.segments ?? []).forEach((segment, index) => {
      const previous = file.segments?.[index - 1];
      if (previous !== undefined && segment.from < previous.to - 1e-3) {
        issues.addIssue({
          code: 'custom',
          message: 'segments must be in time order and must not overlap',
          path: ['segments', index, 'from'],
        });
      }
    });
    const ids = new Set<string>();
    (file.pins ?? []).forEach((pin, index) => {
      if (ids.has(pin.shotId)) {
        issues.addIssue({
          code: 'custom',
          message: `shot ${pin.shotId} is pinned twice`,
          path: ['pins', index, 'shotId'],
        });
      }
      ids.add(pin.shotId);
    });
  });
export type TensionFile = z.infer<typeof tensionFileSchema>;

export function projectTensionMap(project: {
  readonly tensionMap?: TensionMapMode | undefined;
}): TensionMapMode {
  return project.tensionMap ?? DEFAULT_TENSION_MAP;
}

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));
const round3 = (value: number): number => Math.round(value * 1000) / 1000;

/** Tension at `t` (linear between points, held flat before the first and after the last). */
export function tensionAt(points: readonly TensionPoint[], t: number): number {
  const first = points[0];
  const last = points.at(-1);
  if (first === undefined || last === undefined) return 0;
  if (t <= first.t) return first.v;
  if (t >= last.t) return last.v;
  for (let index = 1; index < points.length; index += 1) {
    const right = points[index];
    const left = points[index - 1];
    if (right === undefined || left === undefined || t > right.t) continue;
    const span = right.t - left.t;
    return span <= 0 ? right.v : left.v + ((right.v - left.v) * (t - left.t)) / span;
  }
  return last.v;
}

/** Mean tension over [t0, t1] (exact integral of the piecewise linear curve). */
export function meanTension(points: readonly TensionPoint[], t0: number, t1: number): number {
  if (!(t1 > t0)) return tensionAt(points, t0);
  const stops = [t0, ...points.map((point) => point.t).filter((t) => t > t0 && t < t1), t1];
  let area = 0;
  for (let index = 1; index < stops.length; index += 1) {
    const left = stops[index - 1] ?? t0;
    const right = stops[index] ?? t1;
    area += ((tensionAt(points, left) + tensionAt(points, right)) / 2) * (right - left);
  }
  return area / (t1 - t0);
}

/** A shot's tension: its pin (locked shots) or the curve's mean over the shot, 3 decimals. */
export function tensionForShot(
  file: Pick<TensionFile, 'points' | 'pins'>,
  shot: { readonly id: string; readonly t0: number; readonly t1: number },
): number {
  const pin = file.pins?.find((entry) => entry.shotId === shot.id);
  return round3(pin?.v ?? meanTension(file.points, shot.t0, shot.t1));
}

/**
 * Clean points: t >= 0 and v clamped to 0..1, both rounded to 3 decimals, sorted by time, points
 * at the same time merged (the later one wins). At least two points (a single one is held flat
 * to `durationS`, none = flat 0.5).
 */
export function normalizeTensionPoints(
  points: readonly TensionPoint[],
  durationS: number,
): TensionPoint[] {
  const cleaned = points
    .filter((point) => Number.isFinite(point.t) && Number.isFinite(point.v))
    .map((point, order) => ({
      t: round3(Math.max(0, point.t)),
      v: round3(clamp01(point.v)),
      order,
    }))
    .sort((left, right) => left.t - right.t || left.order - right.order);
  const merged: TensionPoint[] = [];
  for (const point of cleaned) {
    const previous = merged.at(-1);
    if (previous !== undefined && point.t - previous.t < 1e-3) merged[merged.length - 1] = point;
    else merged.push({ t: point.t, v: point.v });
  }
  const end = round3(Math.max(durationS, 1));
  if (merged.length === 0)
    return [
      { t: 0, v: 0.5 },
      { t: end, v: 0.5 },
    ];
  if (merged.length === 1) {
    const only = merged[0] ?? { t: 0, v: 0.5 };
    return only.t < end ? [only, { t: end, v: only.v }] : [{ t: 0, v: only.v }, only];
  }
  return merged.map((point) => ({ t: point.t, v: point.v }));
}

/** `count` (>= 2) evenly spaced points over [0, durationS] that follow the curve. */
export function resampleTension(
  points: readonly TensionPoint[],
  durationS: number,
  count: number,
): TensionPoint[] {
  const steps = Math.max(2, Math.floor(count));
  const end = Math.max(durationS, 1);
  return Array.from({ length: steps }, (_, index) => {
    const t = round3((end * index) / (steps - 1));
    return { t, v: round3(tensionAt(points, t)) };
  });
}

/** Curve shapes the editor starts from. */
export const TENSION_PRESETS = ['flat', 'rising', 'wave', 'three-act'] as const;
export type TensionPreset = (typeof TENSION_PRESETS)[number];

const PRESET_SHAPES: Readonly<Record<TensionPreset, readonly (readonly [number, number])[]>> = {
  flat: [
    [0, 0.45],
    [1, 0.45],
  ],
  rising: [
    [0, 0.15],
    [0.85, 0.85],
    [1, 0.6],
  ],
  wave: [
    [0, 0.25],
    [0.17, 0.6],
    [0.33, 0.3],
    [0.5, 0.7],
    [0.67, 0.35],
    [0.83, 0.85],
    [1, 0.3],
  ],
  'three-act': [
    [0, 0.2],
    [0.25, 0.35],
    [0.6, 0.7],
    [0.72, 0.9],
    [0.8, 0.55],
    [1, 0.2],
  ],
};

/** A preset curve over [0, durationS] (points in shares of the film, see PRESET_SHAPES). */
export function tensionPreset(preset: TensionPreset, durationS: number): TensionPoint[] {
  const end = Math.max(durationS, 1);
  return PRESET_SHAPES[preset].map(([share, v]) => ({ t: round3(share * end), v }));
}

/**
 * Neutral tension: a shot at 0.5 renders exactly as without a tension map (budget scale 1, no
 * darkened tones), so a locked shot pinned to it keeps its approved frame.
 */
export const NEUTRAL_TENSION = 0.5;

/**
 * Pins for the curve that replaces `previous`: a locked shot keeps its pin, or gets the tension
 * it had under the previous curve (NEUTRAL_TENSION when there was none); unlocked shots lose
 * theirs (they follow the new curve).
 */
export function lockedShotPins(
  previous: Pick<TensionFile, 'points' | 'pins'> | undefined,
  shots: readonly { readonly id: string; readonly t0: number; readonly t1: number }[],
  locked: ReadonlySet<string>,
): TensionPin[] {
  return shots
    .filter((shot) => locked.has(shot.id))
    .map((shot) => ({
      shotId: shot.id,
      v: previous === undefined ? NEUTRAL_TENSION : tensionForShot(previous, shot),
    }));
}
