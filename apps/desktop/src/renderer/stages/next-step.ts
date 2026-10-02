/**
 * The "Next: …" hint at the top of the pipeline sidebar (PLAN.md#10.3): the first row that still
 * needs the user, said as an action, so a new user always knows what to press. Pure.
 */
import type { RowView } from './pipeline-view.js';

export interface NextStep {
  /** Row the hint is about (selecting it shows its actions). */
  readonly rowId: string;
  readonly text: string;
}

const NEXT_ACTIONS: Readonly<Record<string, string>> = {
  script: 'fill in the brief, then run Script written',
  voiceover: 'add your voiceover (Voiceover added → Replace to import or record it)',
  clean: 'run Audio cleaned',
  words: 'run Words timed',
  storyboard: 'run Storyboard',
  scenes: 'run Scenes built',
  sound: 'run Sound design mixed to mix the voice, effects and ambience',
  export: 'export the video (Video exported → Run)',
};

/** Rows where something is happening right now: no hint while the app is busy. */
const BUSY = new Set(['running', 'queued', 'paused', 'loading']);

export function nextStep(rows: readonly RowView[]): NextStep | null {
  if (rows.some((row) => BUSY.has(row.status))) return null;
  const row = rows.find((candidate) => candidate.status !== 'done');
  if (row === undefined) {
    const last = rows.at(-1);
    return last === undefined
      ? null
      : { rowId: last.spec.id, text: 'Done: open Video exported to find your MP4.' };
  }
  const label = row.spec.label;
  switch (row.status) {
    case 'review':
      return { rowId: row.spec.id, text: `Next: open ${label} and approve it.` };
    case 'failed':
      return { rowId: row.spec.id, text: `Next: ${label} failed: select it to see why.` };
    case 'stale':
    case 'interrupted':
      return { rowId: row.spec.id, text: `Next: run ${label} again.` };
    default:
      return {
        rowId: row.spec.id,
        text: `Next: ${NEXT_ACTIONS[row.spec.id] ?? `run ${label}`}.`,
      };
  }
}
