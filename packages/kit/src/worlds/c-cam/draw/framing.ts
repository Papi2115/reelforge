/**
 * C-CAM framing helper (PLAN.md#14.17, quality lab): `frameOn(subject, size, options)` returns the
 * framing part of a cut (`x, y, z, rot` and, for a push-in or pull-back, `to` + `end` + `ease`) that
 * puts a WORLD subject on a third of the frame at the size's zoom. The lab's first round showed
 * extreme close-ups that missed their object (a palm with coins, a collar, a sword in the bars):
 * the cut table was guessed in build() while the contact was solved in the painter. With this the
 * scene frames the solved point itself (`stage.ink` in build(), `env.ink` in the painter):
 *   { at: s.sum, ...frameOn(palm, 'ecu', { rot: 6, push: 0.1, end: s.ret }) }
 * A subject is one point or a list of points (a face: forehead and chin; a hand and what it
 * holds); for a list the zoom makes their box fill `fill` of the frame height, inside the size's
 * zoom range. A push keeps the subject on its screen spot while the zoom changes. Pure.
 *
 * Public API: `FRAMING_SIZES`, `FramingSize`, `FRAMING_ZOOM`, `FrameOnOptions`, `FramedCut`,
 * `frameOn`.
 */
import { KitError } from '../../../errors.js';
import { H, W } from '../core.js';
import { ROT_MAX, ZOOM_MAX, ZOOM_MIN, type CutEase, type Framing } from './camera-schema.js';

export const FRAMING_SIZES = ['wide', 'medium', 'close', 'ecu'] as const;
export type FramingSize = (typeof FRAMING_SIZES)[number];

/** Zoom range and default box fill (share of the frame height) per size (kit-docs ink-camera). */
export const FRAMING_ZOOM: Readonly<
  Record<FramingSize, { readonly min: number; readonly max: number; readonly fill: number }>
> = {
  wide: { min: ZOOM_MIN, max: 1.2, fill: 0.85 },
  medium: { min: 1.3, max: 1.6, fill: 0.7 },
  close: { min: 1.7, max: 2.6, fill: 0.42 },
  ecu: { min: 2.4, max: ZOOM_MAX, fill: 0.55 },
};

/** Where the subject sits across the frame. */
const SIDES = { left: 1 / 3, centre: 1 / 2, right: 2 / 3 } as const;

export interface FrameOnOptions {
  /** The third the subject sits on (default left: the focal point off-centre). */
  readonly side?: keyof typeof SIDES;
  /** Subject height on screen, 0-1 of the frame (default 0.45: a little above the middle). */
  readonly height?: number;
  /** Box fill for a list of points (share of the frame height; default per size). */
  readonly fill?: number;
  /** A fixed zoom (wins over the size's default, still clamped to the size's range). */
  readonly z?: number;
  /** Dutch roll in degrees (tense beats only). */
  readonly rot?: number;
  /** Zoom change over [at, end]: +0.15 = a 15 % push-in, -0.15 = a pull-back. Needs `end`. */
  readonly push?: number;
  /** When the push ends (shot seconds). */
  readonly end?: number;
  readonly ease?: CutEase;
}

/** Spread into a cut: `{ at, ...frameOn(...) }`. */
export interface FramedCut extends Framing {
  readonly to?: Framing;
  readonly end?: number;
  readonly ease?: CutEase;
}

type Pt = readonly [number, number];

const clamp = (value: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, value));

function isPoint(value: unknown): value is Pt {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    typeof value[0] === 'number' &&
    typeof value[1] === 'number' &&
    Number.isFinite(value[0]) &&
    Number.isFinite(value[1])
  );
}

/** The subject's points: one point, or a list (null entries, e.g. a missing face anchor, skipped). */
function pointsOf(subject: unknown): Pt[] {
  if (isPoint(subject)) return [subject];
  const list: Pt[] = [];
  if (Array.isArray(subject))
    for (const entry of subject as unknown[]) if (isPoint(entry)) list.push(entry);
  if (list.length === 0) {
    throw new KitError(
      'invalid-params',
      'frameOn(subject, size): subject must be a world point [x, y] or a list of points (e.g. [palm, tip])',
    );
  }
  return list;
}

function zoomFor(points: readonly Pt[], size: FramingSize, options: FrameOnOptions): number {
  const range = FRAMING_ZOOM[size];
  if (options.z !== undefined) return clamp(options.z, range.min, range.max);
  const ys = points.map((p) => p[1]);
  const span = Math.max(...ys) - Math.min(...ys);
  if (points.length < 2 || span < 1) return (range.min + range.max) / 2;
  return clamp(((options.fill ?? range.fill) * H) / span, range.min, range.max);
}

/** The camera centre that shows world point (sx, sy) at screen (px, py) at zoom z. */
const centreFor = (sx: number, sy: number, px: number, py: number, z: number) => ({
  x: sx - (px - W / 2) / z,
  y: sy - (py - H / 2) / z,
});

const isSize = (value: unknown): value is FramingSize =>
  typeof value === 'string' && (FRAMING_SIZES as readonly string[]).includes(value);

/** A framing (and an optional push) that puts the subject on a third at the size's zoom. */
export function frameOn(subject: unknown, size: unknown, options: FrameOnOptions = {}): FramedCut {
  if (!isSize(size)) {
    throw new KitError(
      'invalid-params',
      `frameOn(subject, size): size must be one of ${FRAMING_SIZES.join(', ')} (got ${JSON.stringify(size)})`,
    );
  }
  const points = pointsOf(subject);
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  const sx = (Math.min(...xs) + Math.max(...xs)) / 2;
  const sy = (Math.min(...ys) + Math.max(...ys)) / 2;
  const px = W * SIDES[options.side ?? 'left'];
  const py = H * clamp(options.height ?? 0.45, 0.15, 0.85);
  const z = zoomFor(points, size, options);
  const rot = clamp(options.rot ?? 0, -ROT_MAX, ROT_MAX);
  const start = { ...centreFor(sx, sy, px, py, z), z, ...(rot === 0 ? {} : { rot }) };
  if (options.push === undefined || options.push === 0 || options.end === undefined) return start;
  const z2 = clamp(z * (1 + options.push), ZOOM_MIN, ZOOM_MAX);
  const to = { ...centreFor(sx, sy, px, py, z2), z: z2, ...(rot === 0 ? {} : { rot }) };
  return { ...start, to, end: options.end, ease: options.ease ?? 'out' };
}
