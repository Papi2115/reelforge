/**
 * What the pipeline sidebar says around the steps (PLAN.md#11.2, docs/ux/redesign-2.4.md §3): the
 * legend of the status words (stations-view.ts), the folding of the finished steps at the top into
 * one "steps done" line, and the one-line summary of a collapsed pipeline. Same colour and square
 * dot per status everywhere. Pure.
 */
import { plural } from '../../shared/plural.js';
import type { RowView } from './pipeline-view.js';
import { STATION_GLYPHS, type StationStatus, type StationView } from './stations-view.js';

/** The legend of the status words (the "?" next to the Pipeline heading). */
export const STATUS_LEGEND: readonly {
  readonly status: StationStatus | 'kept';
  readonly glyph: string;
  /** Colour class of the dot and the chip (`status-<css>`). */
  readonly css: string;
  readonly label: string;
  readonly meaning: string;
}[] = [
  {
    status: 'not-started',
    glyph: STATION_GLYPHS['not-started'],
    css: 'waiting',
    label: 'Not started',
    meaning: 'Its turn has not come; hover for what it needs.',
  },
  {
    status: 'ready',
    glyph: STATION_GLYPHS.ready,
    css: 'ready',
    label: 'Ready',
    meaning: 'Everything it needs is there: press Run.',
  },
  {
    status: 'working',
    glyph: STATION_GLYPHS.working,
    css: 'running',
    label: 'Working',
    meaning:
      'Running now, queued, paused by your usage limit or stopped: Stop or Resume is next to it.',
  },
  {
    status: 'needs-you',
    glyph: STATION_GLYPHS['needs-you'],
    css: 'review',
    label: 'Needs you',
    meaning: 'Your turn: approve, review or record.',
  },
  {
    status: 'done',
    glyph: STATION_GLYPHS.done,
    css: 'done',
    label: 'Done',
    meaning: 'Finished; Redo runs it again.',
  },
  {
    status: 'kept',
    glyph: STATION_GLYPHS.done,
    css: 'kept',
    label: 'Kept from before',
    meaning: 'Its result still plays; it updates after the earlier step that is not done.',
  },
  {
    status: 'problems',
    glyph: STATION_GLYPHS.problems,
    css: 'problems',
    label: 'Built with problems',
    meaning: 'Most of it works; the sentence names what failed and the retry.',
  },
  {
    status: 'out-of-date',
    glyph: STATION_GLYPHS['out-of-date'],
    css: 'stale',
    label: 'Out of date',
    meaning: 'Something it uses changed: run it again.',
  },
  {
    status: 'failed',
    glyph: STATION_GLYPHS.failed,
    css: 'failed',
    label: 'Failed',
    meaning: 'Nothing usable came out: select it for the reason, then Retry.',
  },
];

/** Finished steps at the top fold into one line from this many on. */
export const FOLD_MIN_DONE = 3;

export interface FoldedRows {
  /** The leading finished rows shown as "N steps done" (empty: nothing folds). */
  readonly done: readonly RowView[];
  readonly rest: readonly RowView[];
}

export function foldDoneRows(rows: readonly RowView[]): FoldedRows {
  const firstOpen = rows.findIndex((row) => row.status !== 'done');
  const leading = firstOpen === -1 ? rows.length : firstOpen;
  // Everything done: keep the last step (export) visible under the fold.
  const count = Math.min(leading, rows.length - 1);
  if (count < FOLD_MIN_DONE) return { done: [], rest: rows };
  return { done: rows.slice(0, count), rest: rows.slice(count) };
}

export function foldText(done: readonly RowView[]): string {
  return `${plural(done.length, 'step')} done`;
}

/** One line for a collapsed pipeline: progress and what happens now. */
export function pipelineSummary(
  rows: readonly RowView[],
  stations: readonly StationView[],
): string {
  const done = rows.filter((row) => row.status === 'done').length;
  const progress = `${String(done)} of ${String(rows.length)} steps done`;
  const wordOf = (row: RowView): string =>
    stations.find((station) => station.rowId === row.spec.id)?.word ?? '';
  const busy = rows.find((row) => row.busy);
  if (busy !== undefined) return `${progress} · ${busy.spec.label}: ${wordOf(busy)}`;
  const attention = rows.find((row) =>
    ['failed', 'interrupted', 'stale', 'review'].includes(row.status),
  );
  return attention === undefined
    ? progress
    : `${progress} · ${attention.spec.label}: ${wordOf(attention)}`;
}
