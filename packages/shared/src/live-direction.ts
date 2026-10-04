/**
 * Live co-direction (PLAN.md#12.14, ADR-023): short commands typed while the film plays change a
 * shot instantly without rebuilding its scene. `directions.json` (tracked) keeps, per shot, the
 * host-level overrides the engine applies at render time on top of the scene (preview = export):
 *
 * - `rate`: playback-rate feel, applied as anchor-safe time-remap windows between the shot's
 *   visual hits (time-remap.ts; every hit and VO word keeps its time, see `rateWindows`);
 * - `dim`: −1..+1, a palette tone shift darker/lighter inside the style's tone families (the
 *   palette-shift pass of 12.27, every pixel stays a palette colour);
 * - `zoom`: 1.0–1.3, an integer nearest-neighbour crop-scale of the final frame (no blur);
 * - `overlays`: annotation marks (ADR-008 vocabulary) drawn by the host over the frame at a screen
 *   point, timed on a spoken word.
 */
import { z } from 'zod';
import { shotIdSchema } from './storyboard.js';
import type { TimeRemapWindow } from './time-remap.js';

export const DIRECTIONS_FILE_VERSION = 1;
export const DIRECTIONS_FILE = 'directions.json';

export const DIRECTION_RATE_MIN = 0.4;
export const DIRECTION_RATE_MAX = 1.6;
export const DIRECTION_ZOOM_MAX = 1.3;
export const MAX_DIRECTION_OVERLAYS = 8;
/** Shortest rate window (s); shorter gaps between hits are left alone. */
export const RATE_WINDOW_MIN_S = 0.6;
/** Windows per shot (as many as the reveal-moment remap allows). */
export const MAX_RATE_WINDOWS = 4;

export const DIRECTION_OVERLAY_KINDS = [
  'arrow',
  'ring',
  'underline',
  'highlight',
  'callout',
  'badge',
] as const;
export const directionOverlayKindSchema = z.enum(DIRECTION_OVERLAY_KINDS);
export type DirectionOverlayKind = z.infer<typeof directionOverlayKindSchema>;

/** Named screen regions a command can aim at (normalized points inside every safe area). */
export const SCREEN_REGIONS = {
  center: [0.5, 0.5],
  left: [0.28, 0.5],
  right: [0.72, 0.5],
  top: [0.5, 0.3],
  bottom: [0.5, 0.7],
  'top-left': [0.28, 0.3],
  'top-right': [0.72, 0.3],
  'bottom-left': [0.28, 0.7],
  'bottom-right': [0.72, 0.7],
} as const satisfies Record<string, readonly [number, number]>;
export type ScreenRegion = keyof typeof SCREEN_REGIONS;
export const SCREEN_REGION_NAMES = Object.keys(SCREEN_REGIONS) as ScreenRegion[];

/** Clicked points are pulled this far inside the frame edges (labels stay in the safe area). */
export const OVERLAY_EDGE_MARGIN = 0.1;

export const directionOverlaySchema = z
  .object({
    id: z.string().regex(/^[a-z0-9][a-z0-9-]{0,40}$/),
    kind: directionOverlayKindSchema,
    /** Normalized frame point (0..1, top-left origin) the mark points at. */
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
    /** Named region the point came from (absent: a click in the preview). */
    region: z.enum(SCREEN_REGION_NAMES as [ScreenRegion, ...ScreenRegion[]]).optional(),
    /** Film seconds: it appears at `at` (the word's start) and is gone at `until`. */
    at: z.number().nonnegative(),
    until: z.number().positive(),
    /** The spoken word it is timed on (index into words.json and the word as spoken). */
    word: z.object({ index: z.int().nonnegative(), text: z.string().min(1).max(80) }).optional(),
    /** Label of a callout / badge text. */
    text: z.string().min(1).max(40).optional(),
  })
  .refine((overlay) => overlay.until > overlay.at, {
    message: 'until must be > at',
    path: ['until'],
  });
export type DirectionOverlay = z.infer<typeof directionOverlaySchema>;

export const shotDirectionSchema = z.object({
  /** Feel of the playback speed (< 1 slower, > 1 faster); absent = 1. */
  rate: z.number().min(DIRECTION_RATE_MIN).max(DIRECTION_RATE_MAX).optional(),
  /** Tone shift: −1 darker … +1 lighter; absent = 0. */
  dim: z.number().min(-1).max(1).optional(),
  /** Crop-scale of the final frame; absent = 1. */
  zoom: z.number().min(1).max(DIRECTION_ZOOM_MAX).optional(),
  overlays: z.array(directionOverlaySchema).max(MAX_DIRECTION_OVERLAYS).optional(),
});
export type ShotDirection = z.infer<typeof shotDirectionSchema>;

export const directionsFileSchema = z.object({
  version: z.literal(DIRECTIONS_FILE_VERSION),
  /** Shot id -> its overrides; shots without overrides are left out. */
  shots: z.record(shotIdSchema, shotDirectionSchema),
});
export type DirectionsFile = z.infer<typeof directionsFileSchema>;

export function emptyDirections(): DirectionsFile {
  return { version: DIRECTIONS_FILE_VERSION, shots: {} };
}

const round3 = (value: number): number => Math.round(value * 1000) / 1000;

/**
 * The direction without neutral values (rate 1, dim 0, zoom 1, no overlays), rounded to ms /
 * thousandths; undefined when nothing is left (the shot renders exactly as authored).
 */
export function normalizeDirection(
  direction: ShotDirection | undefined,
): ShotDirection | undefined {
  if (direction === undefined) return undefined;
  const rate = direction.rate === undefined ? 1 : round3(direction.rate);
  const dim = direction.dim === undefined ? 0 : round3(direction.dim);
  const zoom = direction.zoom === undefined ? 1 : round3(direction.zoom);
  const overlays = direction.overlays ?? [];
  const next: ShotDirection = {
    ...(rate === 1 ? {} : { rate }),
    ...(dim === 0 ? {} : { dim }),
    ...(zoom === 1 ? {} : { zoom }),
    ...(overlays.length === 0 ? {} : { overlays: [...overlays] }),
  };
  return Object.keys(next).length === 0 ? undefined : next;
}

export function hasDirection(direction: ShotDirection | undefined): boolean {
  return normalizeDirection(direction) !== undefined;
}

/** `file` with `shotId`'s direction replaced (normalized; neutral = removed). Pure. */
export function withShotDirection(
  file: DirectionsFile,
  shotId: string,
  direction: ShotDirection | undefined,
): DirectionsFile {
  const normalized = normalizeDirection(direction);
  const entries = Object.entries(file.shots).filter(([id]) => id !== shotId);
  if (normalized !== undefined) entries.push([shotId, normalized]);
  entries.sort(([first], [second]) => (first < second ? -1 : first > second ? 1 : 0));
  return { version: DIRECTIONS_FILE_VERSION, shots: Object.fromEntries(entries) };
}

/** Shot ids (in `shots` order) that carry overrides. */
export function directedShotIds(
  file: DirectionsFile | undefined,
  shots: readonly { readonly id: string }[],
): string[] {
  if (file === undefined) return [];
  return shots.filter((shot) => hasDirection(file.shots[shot.id])).map((shot) => shot.id);
}

/**
 * The manifest `direction` of each storyboard shot that has one (normalized). Directions of shots
 * no longer in the storyboard are ignored.
 */
export function manifestDirections(
  file: DirectionsFile | undefined,
  shots: readonly { readonly id: string }[],
): Map<string, ShotDirection> {
  const directions = new Map<string, ShotDirection>();
  if (file === undefined) return directions;
  for (const shot of shots) {
    const direction = normalizeDirection(file.shots[shot.id]);
    if (direction !== undefined) directions.set(shot.id, direction);
  }
  return directions;
}

/**
 * Time-remap windows realising a `rate` direction on a shot without moving any visual hit: the
 * gaps between consecutive hits (scene anchors and sfx cues, film seconds; the shot edges bound
 * the first and last gap) of at least RATE_WINDOW_MIN_S, the MAX_RATE_WINDOWS longest, in time
 * order. Inside a window the motion runs at `rate` and catches up (or, faster, runs ahead and
 * settles), s(from) = from and s(to) = to, so hits on its edges and outside it keep their times.
 * A shot without hits gets one window over the whole shot (the anchor-safe "uniform hold").
 */
export function rateWindows(
  shot: { readonly t0: number; readonly t1: number },
  rate: number,
  hits: readonly number[],
): TimeRemapWindow[] {
  if (rate === 1) return [];
  const inside = hits.filter((hit) => hit > shot.t0 && hit < shot.t1).sort((a, b) => a - b);
  const edges = [shot.t0, ...inside, shot.t1];
  const gaps: TimeRemapWindow[] = [];
  for (let index = 1; index < edges.length; index += 1) {
    const from = edges[index - 1] ?? shot.t0;
    const to = edges[index] ?? shot.t1;
    if (to - from >= RATE_WINDOW_MIN_S) gaps.push({ from, to, rate });
  }
  return gaps
    .sort(
      (first, second) =>
        second.to - second.from - (first.to - first.from) || first.from - second.from,
    )
    .slice(0, MAX_RATE_WINDOWS)
    .sort((first, second) => first.from - second.from);
}

/** Normalized point of a named region. */
export function regionPoint(region: ScreenRegion): { x: number; y: number } {
  const [x, y] = SCREEN_REGIONS[region];
  return { x, y };
}

/** A clicked point pulled inside the frame margins (marks and labels stay readable). */
export function clampOverlayPoint(x: number, y: number): { x: number; y: number } {
  const clamp = (value: number): number =>
    round3(Math.min(1 - OVERLAY_EDGE_MARGIN, Math.max(OVERLAY_EDGE_MARGIN, value)));
  return { x: clamp(x), y: clamp(y) };
}
