/**
 * Reveal moments (PLAN.md#12.27, ADR-020): for the biggest peaks of the tension map the app
 * proposes a "wow moment" on the key word there — `silence-hit` (the mix ducks to near silence for
 * 250–600 ms, then a hit lands on the word), `palette-shift` (a brief tone flash inside the style
 * palette) or `slow-motion` (a time remap of the shot, time-remap.ts). Proposals are a pure
 * function of the curve, the timed words and the scenes' anchors (sync report); the user accepts
 * or rejects each one and `moments.json` (tracked) keeps the decisions. Only accepted moments are
 * applied: slow motion and palette shifts by the render manifest (preview = export), silence hits
 * by the mix. A locked shot's moment cannot be accepted (the shot is approved as it is).
 */
import { z } from 'zod';
import { shotIdSchema } from './storyboard.js';
import { tensionAt, type TensionPoint } from './tension.js';
import {
  MAX_SHOT_EFFECT_WINDOWS,
  type PaletteShiftWindow,
  type TimeRemapWindow,
} from './time-remap.js';

export const MOMENTS_FILE_VERSION = 1;
export const MOMENTS_FILE = 'moments.json';

export const MOMENT_KINDS = ['silence-hit', 'palette-shift', 'slow-motion'] as const;
export const momentKindSchema = z.enum(MOMENT_KINDS);
export type MomentKind = z.infer<typeof momentKindSchema>;

export const MOMENT_STATUSES = ['proposed', 'accepted', 'rejected'] as const;
export const momentStatusSchema = z.enum(MOMENT_STATUSES);
export type MomentStatus = z.infer<typeof momentStatusSchema>;

/** Silence before the hit (s). */
export const SILENCE_MIN_S = 0.25;
export const SILENCE_MAX_S = 0.6;
/** Slowest speed of a proposed slow motion. */
export const SLOW_MOTION_RATE = 0.4;
const SLOW_MOTION_MAX_S = 2;
const SLOW_MOTION_MIN_S = 1;
const PALETTE_SHIFT_S = 0.5;
/**
 * A visual hit this close after the key word may stay inside a slow motion: the scene lags at
 * most a few ms there (the speed is 1 at the window's edge).
 */
const SLOW_MOTION_GRACE_S = 0.05;
/** Peaks below this tension are no "wow" peaks. */
export const MOMENT_PEAK_MIN = 0.6;
const PEAK_SPACING_S = 30;
const KEY_WINDOW_S = 6;

export const momentSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9][a-z0-9_-]{0,80}$/),
    kind: momentKindSchema,
    shotId: shotIdSchema,
    /** Film time of the key word (where the hit lands / the slow motion starts). */
    at: z.number().nonnegative(),
    /** The key word as spoken. */
    word: z.string().min(1).max(80),
    /** Tension of the peak it was proposed for. */
    tension: z.number().min(0).max(1),
    /** Effect window (film seconds): the silence before the hit, the slow motion, the flash. */
    from: z.number().nonnegative(),
    to: z.number().positive(),
    /** Slowest speed of a slow motion (time-remap.ts). */
    rate: z.number().min(0.25).max(0.9).optional(),
    /** A camera move (PLAN.md#12.28) that would add to it; needs a rebuild of the shot. */
    cameraHint: z.string().max(120).optional(),
    status: momentStatusSchema,
    decidedAt: z.iso.datetime().optional(),
  })
  .refine((moment) => moment.to > moment.from, { message: 'to must be > from', path: ['to'] });
export type Moment = z.infer<typeof momentSchema>;

export const momentsFileSchema = z.object({
  version: z.literal(MOMENTS_FILE_VERSION),
  moments: z.array(momentSchema).max(40),
});
export type MomentsFile = z.infer<typeof momentsFileSchema>;

interface ShotSpan {
  readonly id: string;
  readonly t0: number;
  readonly t1: number;
}

interface TimedWord {
  readonly text: string;
  readonly t: number;
  readonly tEnd: number;
}

/** A visual hit of a scene (sync report `anchor` or scene `sfx` event), film time. */
export interface MomentAnchor {
  readonly shotId: string;
  readonly t: number;
}

export interface MomentInputs {
  readonly shots: readonly ShotSpan[];
  readonly tension: readonly TensionPoint[];
  readonly words: readonly TimedWord[];
  readonly anchors: readonly MomentAnchor[];
  /** At most this many proposals (default: one per 3 minutes, 1..3). */
  readonly maxMoments?: number;
  /**
   * Camera hints per kind instead of the 3D ones (a world whose camera never orbits or dollies,
   * e.g. `PAGE_CAMERA_HINTS`); absent = the 3D hints.
   */
  readonly cameraHints?: Readonly<Record<MomentKind, string>>;
}

const round3 = (value: number): number => Math.round(value * 1000) / 1000;

/** Local maxima of the curve at or above MOMENT_PEAK_MIN, highest first, 30 s apart. */
export function tensionPeaks(points: readonly TensionPoint[], count: number): TensionPoint[] {
  const maxima = points.filter((point, index) => {
    const before = points[index - 1];
    const after = points[index + 1];
    return (
      point.v >= MOMENT_PEAK_MIN &&
      (before === undefined || point.v >= before.v) &&
      (after === undefined || point.v >= after.v)
    );
  });
  const ordered = [...maxima].sort((left, right) => right.v - left.v || left.t - right.t);
  const chosen: TensionPoint[] = [];
  for (const peak of ordered) {
    if (chosen.length >= count) break;
    if (chosen.every((other) => Math.abs(other.t - peak.t) >= PEAK_SPACING_S)) chosen.push(peak);
  }
  return chosen;
}

/** The word a peak lands on: the spoken word of the nearest anchor, else the weightiest word. */
function keyWord(
  peak: TensionPoint,
  words: readonly TimedWord[],
  anchors: readonly MomentAnchor[],
): TimedWord | undefined {
  const near = anchors
    .filter((anchor) => Math.abs(anchor.t - peak.t) <= KEY_WINDOW_S)
    .sort((left, right) => Math.abs(left.t - peak.t) - Math.abs(right.t - peak.t));
  for (const anchor of near) {
    const word = words.find((candidate) => Math.abs(candidate.t - anchor.t) <= 0.08);
    if (word !== undefined) return word;
  }
  const weight = (word: TimedWord): number =>
    word.text.replace(/[^\p{L}\p{N}]/gu, '').length * (/\d/.test(word.text) ? 2 : 1) -
    0.5 * Math.abs(word.t - peak.t);
  return words
    .filter((word) => Math.abs(word.t - peak.t) <= KEY_WINDOW_S)
    .reduce<TimedWord | undefined>(
      (best, word) => (best === undefined || weight(word) > weight(best) ? word : best),
      undefined,
    );
}

type Window = { readonly from: number; readonly to: number; readonly rate?: number };

/** The effect window of `kind` on the key word, or undefined when it does not fit there. */
function windowFor(
  kind: MomentKind,
  word: TimedWord,
  shot: ShotSpan,
  words: readonly TimedWord[],
  anchors: readonly MomentAnchor[],
): Window | undefined {
  const k = word.t;
  if (kind === 'silence-hit') {
    // Only in a pause of the voice: the VO is never ducked, the bed goes quiet before the word.
    const previous = words.filter((other) => other.tEnd <= k + 1e-6).at(-1);
    const gap = previous === undefined ? k : k - previous.tEnd;
    const length = Math.min(SILENCE_MAX_S, gap - 0.02);
    return length >= SILENCE_MIN_S ? { from: round3(k - length), to: round3(k) } : undefined;
  }
  if (kind === 'slow-motion') {
    // No anchor strictly inside the window: every visual hit keeps its time (s(t) = t there).
    const next = anchors
      .filter((anchor) => anchor.shotId === shot.id && anchor.t > k + SLOW_MOTION_GRACE_S)
      .reduce((first, anchor) => Math.min(first, anchor.t - 0.05), Number.POSITIVE_INFINITY);
    const to = Math.min(k + SLOW_MOTION_MAX_S, shot.t1 - 0.1, next);
    return to - k >= SLOW_MOTION_MIN_S
      ? { from: round3(k), to: round3(to), rate: SLOW_MOTION_RATE }
      : undefined;
  }
  const to = Math.min(k + PALETTE_SHIFT_S, shot.t1);
  return to - k >= 0.2 ? { from: round3(k), to: round3(to) } : undefined;
}

const CAMERA_HINTS: Readonly<Record<MomentKind, string>> = {
  'silence-hit': 'rack focus onto the key object on the word (rebuild the shot to add it)',
  'palette-shift': 'a quick dolly zoom on the key object (rebuild the shot to add it)',
  'slow-motion': 'a slow orbit around the key object (rebuild the shot to add it)',
};

/**
 * Camera hints of a page world (Sketchbook: the camera is the reader's eye over the page, never an
 * orbit, spin or dolly zoom; real run Sketchbook 1).
 */
export const PAGE_CAMERA_HINTS: Readonly<Record<MomentKind, string>> = {
  'silence-hit': 'a held frame on the key drawing (rebuild the shot to add it)',
  'palette-shift': 'a slow push toward the key drawing (rebuild the shot to add it)',
  'slow-motion': 'a slow push toward the key drawing, never an orbit (rebuild the shot to add it)',
};

/** Kinds in the order a peak tries them: rotated by the peak's rank so the film varies. */
const KIND_PREFERENCE: readonly MomentKind[] = ['silence-hit', 'slow-motion', 'palette-shift'];

function kindOrder(rank: number): MomentKind[] {
  return KIND_PREFERENCE.map(
    (_, index) => KIND_PREFERENCE[(index + rank) % KIND_PREFERENCE.length],
  ).filter((kind): kind is MomentKind => kind !== undefined);
}

export function momentId(kind: MomentKind, shotId: string, at: number): string {
  return `${kind}-${shotId}-${String(Math.round(at * 1000))}`;
}

/** Proposals for the biggest tension peaks (see the module comment); pure and deterministic. */
export function proposeMoments(inputs: MomentInputs): Moment[] {
  const durationS = inputs.shots.at(-1)?.t1 ?? 0;
  const count = inputs.maxMoments ?? Math.min(3, Math.max(1, Math.round(durationS / 180)));
  const peaks = tensionPeaks(inputs.tension, count);
  return peaks
    .flatMap((peak, rank): Moment[] => {
      const word = keyWord(peak, inputs.words, inputs.anchors);
      if (word === undefined) return [];
      const shot = inputs.shots.find(
        (candidate) => word.t >= candidate.t0 && word.t < candidate.t1,
      );
      if (shot === undefined) return [];
      for (const kind of kindOrder(rank)) {
        const window = windowFor(kind, word, shot, inputs.words, inputs.anchors);
        if (window === undefined) continue;
        return [
          {
            id: momentId(kind, shot.id, word.t),
            kind,
            shotId: shot.id,
            at: round3(word.t),
            word: word.text.slice(0, 80),
            tension: round3(Math.max(peak.v, tensionAt(inputs.tension, word.t))),
            from: window.from,
            to: window.to,
            ...(window.rate === undefined ? {} : { rate: window.rate }),
            cameraHint: (inputs.cameraHints ?? CAMERA_HINTS)[kind],
            status: 'proposed',
          },
        ];
      }
      return [];
    })
    .sort((left, right) => left.at - right.at);
}

/**
 * Proposals merged with the stored decisions: a stored moment wins over the proposal with its
 * id; stored accepted/rejected moments that are no longer proposed stay listed. Sorted by time.
 */
export function mergeMoments(proposals: readonly Moment[], stored: readonly Moment[]): Moment[] {
  const byId = new Map<string, Moment>();
  for (const moment of proposals) byId.set(moment.id, moment);
  for (const moment of stored) {
    if (moment.status !== 'proposed' || byId.has(moment.id)) byId.set(moment.id, moment);
  }
  return [...byId.values()].sort(
    (left, right) => left.at - right.at || left.id.localeCompare(right.id),
  );
}

export interface ShotMomentEffects {
  readonly timeRemap?: TimeRemapWindow[];
  readonly paletteShift?: PaletteShiftWindow[];
}

const byFrom = <T extends { readonly from: number }>(left: T, right: T): number =>
  left.from - right.from;

/** Render effects of the accepted moments per shot id (slow motion, palette shifts). */
export function momentRenderEffects(
  moments: readonly Moment[],
  shots: readonly ShotSpan[],
): Map<string, ShotMomentEffects> {
  const effects = new Map<string, ShotMomentEffects>();
  for (const shot of shots) {
    const accepted = moments.filter(
      (moment) =>
        moment.status === 'accepted' &&
        moment.shotId === shot.id &&
        moment.from >= shot.t0 &&
        moment.to <= shot.t1,
    );
    const remap = withoutOverlaps(
      accepted
        .filter((moment) => moment.kind === 'slow-motion')
        .map((moment) => ({
          from: moment.from,
          to: moment.to,
          rate: moment.rate ?? SLOW_MOTION_RATE,
        }))
        .sort(byFrom),
      MAX_SHOT_EFFECT_WINDOWS,
    );
    const shift = withoutOverlaps(
      accepted
        .filter((moment) => moment.kind === 'palette-shift')
        .map((moment) => ({ from: moment.from, to: moment.to }))
        .sort(byFrom),
      MAX_SHOT_EFFECT_WINDOWS,
    );
    if (remap.length === 0 && shift.length === 0) continue;
    effects.set(shot.id, {
      ...(remap.length === 0 ? {} : { timeRemap: remap }),
      ...(shift.length === 0 ? {} : { paletteShift: shift }),
    });
  }
  return effects;
}

function withoutOverlaps<T extends { readonly from: number; readonly to: number }>(
  windows: readonly T[],
  max = Number.POSITIVE_INFINITY,
): T[] {
  const kept: T[] = [];
  for (const window of windows) {
    const last = kept.at(-1);
    if (kept.length < max && (last === undefined || window.from >= last.to)) kept.push(window);
  }
  return kept;
}

/** A silence of the bed (music, ambience, SFX) before a hit; the VO is never touched. */
export interface MixSilence {
  readonly from: number;
  readonly to: number;
}

/** Mix inputs of the accepted silence hits: the silences and the hit times. */
export function momentMixEffects(moments: readonly Moment[]): {
  readonly silences: MixSilence[];
  readonly hits: number[];
} {
  const accepted = moments
    .filter((moment) => moment.status === 'accepted' && moment.kind === 'silence-hit')
    .sort((left, right) => left.from - right.from);
  return {
    silences: withoutOverlaps(accepted.map((moment) => ({ from: moment.from, to: moment.to }))),
    hits: accepted.map((moment) => moment.at),
  };
}
