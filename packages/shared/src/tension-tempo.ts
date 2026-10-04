/**
 * What the tension map (PLAN.md#12.22, ADR-017) steers, as pure functions shared by the
 * storyboard (prompt table, `tension-tempo` validator), the render manifest (ambient budget and
 * background tone per shot) and the UI (shot-length labels): the shot-length target of a tension,
 * the segments of a curve, the measured cut tempo of a storyboard per segment, and the per-shot
 * ambient inputs.
 */
import type { AmbientShot } from './ambient-variation.js';
import {
  meanTension,
  tensionForShot,
  type TensionFile,
  type TensionPoint,
  type TensionSegmentKind,
} from './tension.js';

/** Shot-length target at tension 0 and 1 (s): calm lets shots breathe, peaks cut fast. */
export const CALM_SHOT_S = 7.5;
export const PEAK_SHOT_S = 3;
/** Ambient budget multiplier at tension 0 and 1 (`scale` of the manifest shot). */
export const CALM_AMBIENT_SCALE = 0.6;
export const PEAK_AMBIENT_SCALE = 1.4;
/** Auto segments (unlabelled curves) are about this long (s). */
export const TENSION_WINDOW_S = 15;
/** A segment is "high tension" from this mean up and "calm" up to CALM_BELOW. */
export const HIGH_TENSION = 0.65;
export const CALM_BELOW = 0.35;

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));
const round2 = (value: number): number => Math.round(value * 100) / 100;
const round3 = (value: number): number => Math.round(value * 1000) / 1000;

/** Target shot length L(v) in seconds: 7.5 s at v = 0 down to 3 s at v = 1 (linear). */
export function targetShotLength(tension: number): number {
  return round2(CALM_SHOT_S - (CALM_SHOT_S - PEAK_SHOT_S) * clamp01(tension));
}

/** Ambient variation budget multiplier of a shot: 0.6 (calm) .. 1.4 (peak). */
export function tensionAmbientScale(tension: number): number {
  return round3(CALM_AMBIENT_SCALE + (PEAK_AMBIENT_SCALE - CALM_AMBIENT_SCALE) * clamp01(tension));
}

export interface TensionSpan {
  readonly from: number;
  readonly to: number;
  readonly kind: TensionSegmentKind;
  readonly label?: string | undefined;
  /** Mean tension of the span. */
  readonly mean: number;
  /** Shot-length target of the mean (s). */
  readonly targetS: number;
}

function autoKind(points: readonly TensionPoint[], from: number, to: number): TensionSegmentKind {
  const mean = meanTension(points, from, to);
  const third = (to - from) / 3;
  const slope = meanTension(points, to - third, to) - meanTension(points, from, from + third);
  if (mean >= HIGH_TENSION) return 'peak';
  if (slope > 0.12) return 'rising';
  if (slope < -0.12) return 'release';
  return mean < CALM_BELOW || slope >= 0 ? 'calm' : 'release';
}

function span(
  points: readonly TensionPoint[],
  from: number,
  to: number,
  kind: TensionSegmentKind,
  label?: string,
): TensionSpan {
  const mean = round3(meanTension(points, from, to));
  return {
    from: round3(from),
    to: round3(to),
    kind,
    ...(label === undefined ? {} : { label }),
    mean,
    targetS: targetShotLength(mean),
  };
}

/**
 * Segments of the film [0, durationS]: the curve's labelled segments (gaps between them become
 * auto segments), or windows of about TENSION_WINDOW_S classified from the curve.
 */
export function tensionSpans(
  file: Pick<TensionFile, 'points' | 'segments'>,
  durationS: number,
): TensionSpan[] {
  const end = Math.max(durationS, 1e-3);
  const auto = (from: number, to: number): TensionSpan[] => {
    if (to - from < 1e-3) return [];
    const count = Math.max(1, Math.round((to - from) / TENSION_WINDOW_S));
    return Array.from({ length: count }, (_, index) => {
      const left = from + ((to - from) * index) / count;
      const right = from + ((to - from) * (index + 1)) / count;
      return span(file.points, left, right, autoKind(file.points, left, right));
    });
  };
  const labelled = (file.segments ?? [])
    .map((segment) => ({
      ...segment,
      from: Math.max(0, segment.from),
      to: Math.min(end, segment.to),
    }))
    .filter((segment) => segment.to - segment.from > 1e-3);
  if (labelled.length === 0) return auto(0, end);
  const spans: TensionSpan[] = [];
  let cursor = 0;
  for (const segment of labelled) {
    const from = Math.max(cursor, segment.from);
    spans.push(...auto(cursor, from));
    if (segment.to > from)
      spans.push(span(file.points, from, segment.to, segment.kind, segment.label));
    cursor = Math.max(cursor, segment.to);
  }
  spans.push(...auto(cursor, end));
  return spans;
}

export interface TempoShot {
  readonly id: string;
  readonly t0: number;
  readonly t1: number;
}

export interface SegmentTempo extends TensionSpan {
  /** Shots whose middle lies in the segment. */
  readonly shotIds: readonly string[];
  /** Shot starts per minute in the segment. */
  readonly shotsPerMinute: number;
  /** Mean length of the segment's shots (s; 0 without shots). */
  readonly meanShotS: number;
  /** meanShotS / targetS (1 = on target; 0 without shots). */
  readonly ratio: number;
}

export interface CutTempoReport {
  readonly segments: readonly SegmentTempo[];
  readonly shotsPerMinute: number;
  readonly meanShotS: number;
}

/** Measured cut tempo of a storyboard against the tension curve, per segment. */
export function cutTempoReport(
  shots: readonly TempoShot[],
  file: Pick<TensionFile, 'points' | 'segments'>,
  durationS = shots.at(-1)?.t1 ?? 0,
): CutTempoReport {
  const spans = tensionSpans(file, durationS);
  const segments = spans.map((segment, index): SegmentTempo => {
    const last = index === spans.length - 1;
    const inside = shots.filter((shot) => {
      const middle = (shot.t0 + shot.t1) / 2;
      return middle >= segment.from && (middle < segment.to || last);
    });
    const starts = shots.filter(
      (shot) =>
        shot.t0 >= segment.from && (shot.t0 < segment.to || (last && shot.t0 <= segment.to)),
    ).length;
    const meanShotS =
      inside.length === 0
        ? 0
        : inside.reduce((sum, shot) => sum + (shot.t1 - shot.t0), 0) / inside.length;
    const minutes = (segment.to - segment.from) / 60;
    return {
      ...segment,
      shotIds: inside.map((shot) => shot.id),
      shotsPerMinute: minutes > 0 ? round2(starts / minutes) : 0,
      meanShotS: round2(meanShotS),
      ratio: inside.length === 0 ? 0 : round2(meanShotS / segment.targetS),
    };
  });
  const total = Math.max(durationS, 1e-3);
  return {
    segments,
    shotsPerMinute: round2((shots.length * 60) / total),
    meanShotS: round2(
      shots.length === 0
        ? 0
        : shots.reduce((sum, shot) => sum + shot.t1 - shot.t0, 0) / shots.length,
    ),
  };
}

/**
 * The per-shot ambient inputs with the shot's tension and the budget multiplier it gives
 * (manifest builders; `inputs[i]` belongs to `shots[i]`).
 */
export function withShotTension(
  inputs: readonly AmbientShot[],
  shots: readonly TempoShot[],
  file: Pick<TensionFile, 'points' | 'pins'>,
): AmbientShot[] {
  return inputs.map((input, index) => {
    const shot = shots[index];
    if (shot === undefined) return input;
    const tension = tensionForShot(file, shot);
    return { ...input, tension, scale: tensionAmbientScale(tension) };
  });
}
