/**
 * View model of the Tension panel (PLAN.md#12.22): curve <-> SVG geometry, snapping to word
 * starts and shot boundaries, point edits (drag, add, remove, keyboard nudges), presets, the
 * shot-length target labels per segment and the status / notice copy. Pure: the panel and its
 * tests use the same functions.
 */
import {
  normalizeTensionPoints,
  targetShotLength,
  tensionAt,
  tensionPreset,
  tensionSpans,
  type TensionFile,
  type TensionPoint,
  type TensionPreset,
  type TensionSpan,
} from '@reelforge/shared';
import type { TensionSaveResult } from '../../shared/tension-contract.js';

export interface TensionGeometry {
  /** Drawing size (px). */
  readonly width: number;
  readonly height: number;
  /** Seconds across the width. */
  readonly durationS: number;
  /** Inner margin (px) so points at the edges stay grabbable. */
  readonly pad: number;
}

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));
const round3 = (value: number): number => Math.round(value * 1000) / 1000;

export function timeToX(geometry: TensionGeometry, t: number): number {
  const inner = Math.max(1, geometry.width - 2 * geometry.pad);
  return geometry.pad + (inner * t) / Math.max(geometry.durationS, 1e-3);
}

export function xToTime(geometry: TensionGeometry, x: number): number {
  const inner = Math.max(1, geometry.width - 2 * geometry.pad);
  return clamp(((x - geometry.pad) / inner) * geometry.durationS, 0, geometry.durationS);
}

export function valueToY(geometry: TensionGeometry, v: number): number {
  const inner = Math.max(1, geometry.height - 2 * geometry.pad);
  return geometry.pad + inner * (1 - clamp(v, 0, 1));
}

export function yToValue(geometry: TensionGeometry, y: number): number {
  const inner = Math.max(1, geometry.height - 2 * geometry.pad);
  return round3(clamp(1 - (y - geometry.pad) / inner, 0, 1));
}

/** SVG path of the curve (straight between points, held flat to both edges). */
export function curvePath(points: readonly TensionPoint[], geometry: TensionGeometry): string {
  const first = points[0];
  const last = points.at(-1);
  if (first === undefined || last === undefined) return '';
  const stops = [{ t: 0, v: first.v }, ...points, { t: geometry.durationS, v: last.v }];
  return stops
    .map((point, index) => {
      const x = timeToX(geometry, point.t).toFixed(1);
      const y = valueToY(geometry, point.v).toFixed(1);
      return `${index === 0 ? 'M' : 'L'}${x} ${y}`;
    })
    .join(' ');
}

/** Times a point snaps to: word starts and shot boundaries (sorted, unique). */
export function snapTimes(
  words: readonly { readonly t: number }[],
  shots: readonly { readonly t0: number; readonly t1: number }[],
): number[] {
  const times = new Set<number>();
  for (const word of words) times.add(round3(word.t));
  for (const shot of shots) {
    times.add(round3(shot.t0));
    times.add(round3(shot.t1));
  }
  return [...times].sort((left, right) => left - right);
}

/** `t` moved to the nearest snap time within `toleranceS` (unchanged when none is that close). */
export function snapTime(t: number, times: readonly number[], toleranceS: number): number {
  let best = t;
  let distance = toleranceS;
  for (const candidate of times) {
    const gap = Math.abs(candidate - t);
    if (gap <= distance) {
      best = candidate;
      distance = gap;
    }
  }
  return best;
}

/** Points never come closer than this (s). */
export const MIN_POINT_GAP_S = 0.25;

export interface PointMove {
  readonly t: number;
  readonly v: number;
  /** Snap times (empty = free move, e.g. with Alt held). */
  readonly snap: readonly number[];
  readonly snapToleranceS: number;
}

/**
 * Point `index` moved: the first and last points keep their time (the curve always spans the
 * film), inner points stay between their neighbours.
 */
export function movePoint(
  points: readonly TensionPoint[],
  index: number,
  move: PointMove,
): TensionPoint[] {
  const point = points[index];
  if (point === undefined) return [...points];
  const edge = index === 0 || index === points.length - 1;
  const previous = points[index - 1];
  const next = points[index + 1];
  const low = (previous?.t ?? 0) + MIN_POINT_GAP_S;
  const high = (next?.t ?? Number.POSITIVE_INFINITY) - MIN_POINT_GAP_S;
  const snapped =
    move.snap.length === 0 ? move.t : snapTime(move.t, move.snap, move.snapToleranceS);
  const t = edge || low > high ? point.t : round3(clamp(snapped, low, high));
  return points.map((other, position) =>
    position === index ? { t, v: round3(clamp(move.v, 0, 1)) } : other,
  );
}

/** A new point at `t` (snapped by the caller) on the curve, or at `v` when given. */
export function addPoint(
  points: readonly TensionPoint[],
  t: number,
  v?: number,
): { points: TensionPoint[]; index: number } {
  const value = round3(clamp(v ?? tensionAt(points, t), 0, 1));
  const tooClose = points.some((point) => Math.abs(point.t - t) < MIN_POINT_GAP_S);
  if (tooClose) return { points: [...points], index: -1 };
  const next = [...points, { t: round3(t), v: value }].sort((left, right) => left.t - right.t);
  return { points: next, index: next.findIndex((point) => point.t === round3(t)) };
}

/** Point `index` removed (the first and the last one stay). */
export function removePoint(points: readonly TensionPoint[], index: number): TensionPoint[] {
  if (index <= 0 || index >= points.length - 1) return [...points];
  return points.filter((_, position) => position !== index);
}

export const VALUE_STEP = 0.05;
export const FINE_VALUE_STEP = 0.01;

/**
 * Keyboard edit of a focused point: Up/Down change the tension (Shift: fine), Left/Right move it
 * to the previous/next snap time (Shift: 0.1 s). Undefined for other keys.
 */
export function nudgePoint(
  points: readonly TensionPoint[],
  index: number,
  key: string,
  fine: boolean,
  snap: readonly number[],
): TensionPoint[] | undefined {
  const point = points[index];
  if (point === undefined) return undefined;
  const step = fine ? FINE_VALUE_STEP : VALUE_STEP;
  const free = { snap: [], snapToleranceS: 0 } as const;
  if (key === 'ArrowUp')
    return movePoint(points, index, { ...free, t: point.t, v: point.v + step });
  if (key === 'ArrowDown') {
    return movePoint(points, index, { ...free, t: point.t, v: point.v - step });
  }
  if (key !== 'ArrowLeft' && key !== 'ArrowRight') return undefined;
  const forward = key === 'ArrowRight';
  const target = fine
    ? point.t + (forward ? 0.1 : -0.1)
    : forward
      ? (snap.find((time) => time > point.t + 1e-3) ?? point.t)
      : (snap.findLast((time) => time < point.t - 1e-3) ?? point.t);
  return movePoint(points, index, { ...free, t: target, v: point.v });
}

/** A preset over the film, cleaned like a saved curve. */
export function presetPoints(preset: TensionPreset, durationS: number): TensionPoint[] {
  return normalizeTensionPoints(tensionPreset(preset, durationS), durationS);
}

export const PRESET_LABELS: Readonly<Record<TensionPreset, string>> = {
  flat: 'Flat',
  rising: 'Rising',
  wave: 'Wave',
  'three-act': 'Three acts',
};

/** One label per segment: its phase and the shot length it asks the storyboard for. */
export interface SpanLabel extends TensionSpan {
  readonly text: string;
}

export function spanLabels(
  file: Pick<TensionFile, 'points' | 'segments'>,
  durationS: number,
): SpanLabel[] {
  return tensionSpans(file, durationS).map((span) => ({
    ...span,
    text: `${span.label ?? span.kind} · ~${span.targetS.toFixed(1)} s shots`,
  }));
}

/** Shot-length target of a point's tension, for its tooltip / aria text. */
export function pointText(point: TensionPoint): string {
  return `Tension ${String(Math.round(point.v * 100))} % at ${point.t.toFixed(1)} s, shots ~${targetShotLength(point.v).toFixed(1)} s`;
}

const SOURCE_TEXT: Readonly<Record<TensionFile['source'], string>> = {
  claude: 'Proposed by Claude',
  user: 'Drawn by you',
  edited: "Claude's proposal, edited",
};

export function sourceText(file: TensionFile): string {
  return `${SOURCE_TEXT[file.source]}${file.locked === true ? ' · locked' : ''}`;
}

/** What a saved edit means for the shots (shown under the curve). */
export function saveNotice(result: TensionSaveResult): string {
  if (result.status === 'error') return result.message;
  const parts: string[] = [];
  if (result.changedShots.length > 0) {
    parts.push(
      `${String(result.changedShots.length)} shot${result.changedShots.length === 1 ? '' : 's'} out of date (tension): backgrounds follow in the preview now, cut tempo and looks at the next Storyboard run.`,
    );
  }
  if (result.keptLocked.length > 0) {
    parts.push(`Locked shots keep their tension: ${result.keptLocked.join(', ')}.`);
  }
  if (!result.committed) parts.push('Nothing changed.');
  return parts.join(' ');
}

/** Pixels of pointer movement before a press on the curve becomes a drag. */
export const DRAG_THRESHOLD_PX = 3;
/** Snap tolerance in pixels, converted to seconds for the current width. */
export function snapToleranceS(geometry: TensionGeometry, pixels = 8): number {
  const inner = Math.max(1, geometry.width - 2 * geometry.pad);
  return (pixels / inner) * geometry.durationS;
}
