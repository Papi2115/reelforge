/**
 * What the pipeline sidebar says about each step (PLAN.md#11.2): the status words ("Ready to run",
 * "Waiting for Voiceover", "Out of date — rebuild", …), the legend that explains them, the folding
 * of the finished steps at the top into one "steps done" line, and the one-line summary of a
 * collapsed pipeline. Same colour and dot shape per status everywhere. Pure.
 */
import { plural } from '../../shared/plural.js';
import type { RowStatus, RowView } from './pipeline-view.js';

/** Short step names for "Waiting for …" (the row labels are long for a chip). */
export const SHORT_STEP_NAMES: Readonly<Record<string, string>> = {
  script: 'Script',
  voiceover: 'Voiceover',
  clean: 'Cleanup',
  words: 'Words',
  storyboard: 'Storyboard',
  scenes: 'Scenes',
  sound: 'Sound mix',
  export: 'Export',
};

function shortName(row: RowView): string {
  return SHORT_STEP_NAMES[row.spec.id] ?? row.spec.label;
}

function clockTime(epochMs: number): string {
  return new Date(epochMs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/** The nearest earlier step that is not done yet (what this one waits for). */
export function blockingRow(row: RowView, rows: readonly RowView[]): RowView | undefined {
  const index = rows.indexOf(row);
  return rows
    .slice(0, Math.max(index, 0))
    .findLast((candidate) => candidate.status !== 'done' && candidate.status !== 'loading');
}

function waitingText(row: RowView, rows: readonly RowView[]): string {
  const blocker = blockingRow(row, rows);
  if (blocker !== undefined) return `Waiting for ${shortName(blocker)}`;
  if (row.spec.id === 'script') return 'Waiting for the brief';
  if (row.spec.id === 'voiceover') return 'Needs your recording';
  return 'Not ready yet';
}

/** The status words of a row (the chip). */
export function statusLabel(row: RowView, rows: readonly RowView[]): string {
  switch (row.status) {
    case 'loading':
      return '…';
    case 'done':
      return 'Done';
    case 'review':
      return 'Review & approve';
    case 'running':
      return row.percent === null ? 'Running…' : `Running… ${String(Math.round(row.percent))} %`;
    case 'paused':
      return row.pausedUntil === null
        ? 'Paused (usage limit)'
        : `Paused (usage limit) — resumes ${clockTime(row.pausedUntil)}`;
    case 'queued':
      return 'Queued';
    case 'ready':
      return 'Ready to run';
    case 'waiting':
      return waitingText(row, rows);
    case 'failed':
      return 'Failed — see details';
    case 'stale':
      return 'Out of date — rebuild';
    case 'interrupted':
      return 'Interrupted — Resume';
  }
}

/** The legend of the status words (the "?" next to the Pipeline heading). */
export const STATUS_LEGEND: readonly {
  readonly status: RowStatus;
  readonly label: string;
  readonly meaning: string;
}[] = [
  { status: 'done', label: 'Done', meaning: 'Finished; Redo runs it again.' },
  { status: 'ready', label: 'Ready to run', meaning: 'Everything it needs is there: press Run.' },
  { status: 'review', label: 'Review & approve', meaning: 'Read the result, then approve it.' },
  { status: 'running', label: 'Running…', meaning: 'Working now; Stop is next to it.' },
  { status: 'waiting', label: 'Waiting for …', meaning: 'An earlier step has to finish first.' },
  {
    status: 'stale',
    label: 'Out of date — rebuild',
    meaning: 'Something it uses changed: run it again.',
  },
  {
    status: 'paused',
    label: 'Paused (usage limit)',
    meaning: 'Your Claude limit was reached; it resumes on its own.',
  },
  {
    status: 'interrupted',
    label: 'Interrupted — Resume',
    meaning: 'The app closed while it ran: Resume continues.',
  },
  {
    status: 'failed',
    label: 'Failed — see details',
    meaning: 'Select it for the error, then Retry.',
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
export function pipelineSummary(rows: readonly RowView[]): string {
  const done = rows.filter((row) => row.status === 'done').length;
  const progress = `${String(done)} of ${String(rows.length)} steps done`;
  const busy = rows.find((row) => row.busy);
  if (busy !== undefined) return `${progress} · ${busy.spec.label}: ${statusLabel(busy, rows)}`;
  const attention = rows.find((row) =>
    ['failed', 'interrupted', 'stale', 'review'].includes(row.status),
  );
  return attention === undefined
    ? progress
    : `${progress} · ${attention.spec.label}: ${statusLabel(attention, rows)}`;
}
