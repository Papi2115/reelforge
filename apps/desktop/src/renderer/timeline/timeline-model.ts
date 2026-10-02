/**
 * What the timeline draws (PLAN.md#6.5): shots, words (+ sentences, snap boundaries) and cues of
 * the project, with pending edits applied on top (shared/timeline-edits.ts, lenient), and the
 * track rows with hit testing. Pure.
 */
import type { StoryboardShot, TimedWord } from '@reelforge/shared';
import type { CuesView, RangeCueView, SfxCueView } from '../../shared/snapshot-contract.js';
import type { FileEdits, RangeTrack } from '../../shared/timeline-contract.js';
import {
  applyBoundaryEdits,
  applyCueEdits,
  cueLabel,
  type CueAdapter,
} from '../../shared/timeline-edits.js';
import { timeToX, xToTime, type TimelineView } from './timeline-view.js';
import { sentencesOf, visibleSpans, wordBoundaries, type Sentence } from './word-index.js';

export const EMPTY_CUES: CuesView = { sfx: [], ambience: [], music: [] };

export interface TimelineModel {
  readonly shots: readonly StoryboardShot[];
  readonly words: readonly TimedWord[];
  readonly sentences: readonly Sentence[];
  /** Sorted word starts/ends (snapping). */
  readonly boundaries: Float64Array;
  readonly cues: CuesView;
}

/** Words-derived parts, rebuilt only when the words change. */
export function wordParts(
  words: readonly TimedWord[],
): Pick<TimelineModel, 'words' | 'sentences' | 'boundaries'> {
  return { words, sentences: sentencesOf(words), boundaries: wordBoundaries(words) };
}

function numberOr(value: unknown, fallback: number): number {
  return typeof value === 'number' ? value : fallback;
}

const viewAdapter: CueAdapter<SfxCueView, RangeCueView> = {
  sfxFromRaw: (raw) =>
    typeof raw['t'] === 'number'
      ? { t: raw['t'], label: cueLabel(raw, 'sfx'), gainDb: numberOr(raw['gainDb'], 0) }
      : undefined,
  rangeFromRaw: (raw) =>
    typeof raw['from'] === 'number' && typeof raw['to'] === 'number'
      ? {
          from: raw['from'],
          to: raw['to'],
          label: cueLabel(raw, 'range'),
          gainDb: numberOr(raw['gainDb'], 0),
        }
      : undefined,
  toRaw: (item) => ('t' in item ? { t: item.t } : { from: item.from, to: item.to }),
};

/** Applies changes to the view (lenient: an edit that no longer fits is skipped). */
export function applyChanges(
  shots: readonly StoryboardShot[],
  cues: CuesView,
  changes: readonly FileEdits[],
): { readonly shots: readonly StoryboardShot[]; readonly cues: CuesView } {
  let nextShots = shots;
  let nextCues = cues;
  for (const change of changes) {
    if (change.file === 'storyboard') {
      const applied = applyBoundaryEdits(nextShots, change.edits, 'lenient');
      if (applied.ok) nextShots = applied.value.shots;
    } else {
      const applied = applyCueEdits(nextCues, change.edits, viewAdapter, 'lenient');
      if (applied.ok) nextCues = applied.value.cues;
    }
  }
  return { shots: nextShots, cues: nextCues };
}

/** End of the last thing on the timeline (s). */
export function contentEnd(model: TimelineModel): number {
  let end = 0;
  for (const shot of model.shots) end = Math.max(end, shot.t1);
  const lastWord = model.words[model.words.length - 1];
  if (lastWord) end = Math.max(end, lastWord.tEnd);
  for (const cue of model.cues.sfx) end = Math.max(end, cue.t);
  for (const cue of [...model.cues.ambience, ...model.cues.music]) end = Math.max(end, cue.to);
  return end;
}

export type TrackId = 'ruler' | 'shots' | 'narration' | 'cues' | 'audio' | 'cards' | 'ambience';

export interface TrackRow {
  readonly id: TrackId;
  readonly label: string;
  readonly top: number;
  readonly height: number;
}

const ROW_HEIGHTS: readonly (readonly [TrackId, string, number])[] = [
  ['ruler', '', 20],
  ['shots', 'Shots', 28],
  ['narration', 'Narration', 24],
  ['cues', 'Cues', 22],
  ['audio', 'Audio', 30],
  ['cards', 'Cards', 18],
  ['ambience', 'Ambience', 30],
];

export const TRACK_ROWS: readonly TrackRow[] = ROW_HEIGHTS.reduce<TrackRow[]>(
  (rows, [id, label, height]) => {
    const previous = rows[rows.length - 1];
    rows.push({ id, label, height, top: previous ? previous.top + previous.height : 0 });
    return rows;
  },
  [],
);

export const LANES_HEIGHT = TRACK_ROWS.reduce((sum, row) => sum + row.height, 0);

export function trackRow(id: TrackId): TrackRow {
  const row = TRACK_ROWS.find((candidate) => candidate.id === id);
  if (!row) throw new Error(`unknown track ${id}`);
  return row;
}

/** Ambience row halves: ambience on top, music below. */
export function rangeLane(track: RangeTrack): { readonly top: number; readonly height: number } {
  const row = trackRow('ambience');
  const half = row.height / 2;
  return { top: row.top + (track === 'ambience' ? 0 : half), height: half };
}

/** Grab distance of boundaries, markers and range edges (CSS px). */
export const HANDLE_PX = 5;

export type TimelineHit =
  | { readonly kind: 'ruler' }
  | { readonly kind: 'boundary'; readonly left: number }
  | { readonly kind: 'shot'; readonly index: number }
  | { readonly kind: 'word'; readonly index: number }
  | { readonly kind: 'sentence'; readonly index: number }
  | { readonly kind: 'sfx'; readonly index: number }
  | {
      readonly kind: 'range-edge';
      readonly track: RangeTrack;
      readonly index: number;
      readonly edge: 'from' | 'to';
    }
  | { readonly kind: 'range'; readonly track: RangeTrack; readonly index: number }
  | { readonly kind: 'lane'; readonly track: TrackId };

function nearest(
  xs: readonly number[],
  x: number,
): { readonly index: number; readonly distance: number } | undefined {
  let best: { index: number; distance: number } | undefined;
  xs.forEach((candidate, index) => {
    const distance = Math.abs(candidate - x);
    if (distance <= HANDLE_PX && (!best || distance < best.distance)) best = { index, distance };
  });
  return best;
}

function hitShots(model: TimelineModel, view: TimelineView, x: number): TimelineHit {
  const ends = model.shots.slice(0, -1).map((shot) => timeToX(view, shot.t1));
  const boundary = nearest(ends, x);
  if (boundary) return { kind: 'boundary', left: boundary.index };
  const t = xToTime(view, x);
  const index = model.shots.findIndex((shot) => t >= shot.t0 && t < shot.t1);
  return index >= 0 ? { kind: 'shot', index } : { kind: 'lane', track: 'shots' };
}

function hitNarration(
  model: TimelineModel,
  view: TimelineView,
  x: number,
  wordsLevel: boolean,
): TimelineHit {
  const t = xToTime(view, x);
  const spans = wordsLevel ? model.words : model.sentences;
  const { start, end } = visibleSpans(spans, t, t);
  for (let index = start; index < end; index += 1) {
    const span = spans[index];
    if (span && t >= span.t && t <= span.tEnd) {
      return wordsLevel ? { kind: 'word', index } : { kind: 'sentence', index };
    }
  }
  return { kind: 'lane', track: 'narration' };
}

function hitRanges(model: TimelineModel, view: TimelineView, x: number, y: number): TimelineHit {
  const track: RangeTrack = y < rangeLane('music').top ? 'ambience' : 'music';
  const ranges = model.cues[track];
  for (const edge of ['from', 'to'] as const) {
    const hit = nearest(
      ranges.map((range) => timeToX(view, range[edge])),
      x,
    );
    if (hit) return { kind: 'range-edge', track, index: hit.index, edge };
  }
  const t = xToTime(view, x);
  const index = ranges.findIndex((range) => t >= range.from && t <= range.to);
  return index >= 0 ? { kind: 'range', track, index } : { kind: 'lane', track: 'ambience' };
}

/** What is under lane position (x, y). */
export function hitTest(
  model: TimelineModel,
  view: TimelineView,
  x: number,
  y: number,
  wordsLevel: boolean,
): TimelineHit | undefined {
  const row = TRACK_ROWS.find(
    (candidate) => y >= candidate.top && y < candidate.top + candidate.height,
  );
  if (!row) return undefined;
  switch (row.id) {
    case 'ruler':
      return { kind: 'ruler' };
    case 'shots':
      return hitShots(model, view, x);
    case 'narration':
      return hitNarration(model, view, x, wordsLevel);
    case 'cues': {
      const marker = nearest(
        model.cues.sfx.map((cue) => timeToX(view, cue.t)),
        x,
      );
      return marker ? { kind: 'sfx', index: marker.index } : { kind: 'lane', track: 'cues' };
    }
    case 'ambience':
      return hitRanges(model, view, x, y);
    case 'audio':
    case 'cards':
      return { kind: 'lane', track: row.id };
  }
}
