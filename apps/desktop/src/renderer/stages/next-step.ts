/**
 * The "next step" card at the top of the pipeline sidebar (PLAN.md#10.3, #11.2): the first step
 * that still needs the user, as one short sentence plus a button named after the action ("Add your
 * voiceover", "Run Words timed", "Open the script"); the reason goes into the info tooltip. Pure.
 */
import type { PipelineStageKey } from '../../shared/stages-contract.js';
import type { OpenTarget, RowView } from './pipeline-view.js';

export type NextAction =
  /** The brief form (a new project). */
  | { readonly kind: 'brief' }
  | { readonly kind: 'open'; readonly target: Exclude<OpenTarget, { kind: 'artifact' }> }
  | { readonly kind: 'run'; readonly stages: readonly PipelineStageKey[] }
  /** Selects the row (its actions and details explain the rest). */
  | { readonly kind: 'select' };

export interface NextStep {
  /** Row the step is about (the button selects it too). */
  readonly rowId: string;
  /** "Next", or "All done" once the video is exported. */
  readonly heading: string;
  readonly text: string;
  /** Label of the primary button: names the action. */
  readonly button: string;
  readonly action: NextAction;
  /** Why this step (the info tooltip). */
  readonly why: string;
}

const WHY: Readonly<Record<string, string>> = {
  script: 'The script is what you read aloud; everything after it follows the approved text.',
  voiceover: 'ReelForge animates to your own voice: record it here or import a file.',
  clean: 'Removes noise and evens out the level, so every word can be timed.',
  words: 'Times every spoken word, so the visuals land exactly on them.',
  storyboard: 'Claude splits the video into shots and plans what each one shows.',
  assets: 'Real photos and footage the storyboard asked for; you decide what gets downloaded.',
  scenes: 'Claude writes the animation of every shot and checks its frames.',
  sound: 'Adds sound effects, ambience and music under your voice.',
  export: 'Renders the finished MP4 for YouTube.',
};

const TEXT: Readonly<Record<string, string>> = {
  script: 'Describe the video in the brief, then write the script.',
  voiceover: 'Record or import your voiceover.',
  clean: 'Clean up the voiceover audio.',
  words: 'Time every spoken word.',
  storyboard: 'Plan the shots.',
  assets: 'Find the photos and footage the storyboard asks for.',
  scenes: 'Build the animated scenes.',
  sound: 'Mix the voice, effects and ambience.',
  export: 'Export the finished video.',
};

/** Rows where something is happening right now: no card while the app is busy. */
const BUSY = new Set(['running', 'queued', 'paused', 'loading']);

function runOrSelect(row: RowView, button: string): Pick<NextStep, 'button' | 'action'> {
  return row.run.enabled
    ? { button, action: { kind: 'run', stages: row.runStages } }
    : { button: `Show ${row.spec.label}`, action: { kind: 'select' } };
}

function firstStep(row: RowView): Pick<NextStep, 'text' | 'button' | 'action'> {
  const text = TEXT[row.spec.id] ?? `Run ${row.spec.label}.`;
  switch (row.spec.id) {
    case 'script':
      return { text, button: 'Open the brief', action: { kind: 'brief' } };
    case 'voiceover':
      return {
        text,
        button: 'Add your voiceover',
        action: { kind: 'open', target: { kind: 'voiceover' } },
      };
    case 'export':
      return {
        text,
        button: 'Export the video',
        action: { kind: 'open', target: { kind: 'export' } },
      };
    default:
      return { text, ...runOrSelect(row, `Run ${row.spec.label}`) };
  }
}

function attentionStep(row: RowView): Pick<NextStep, 'text' | 'button' | 'action'> | null {
  const label = row.spec.label;
  switch (row.status) {
    case 'review':
      if (row.spec.id === 'assets') {
        return {
          text: 'Review the asset package: approve the photos and footage you want.',
          button: 'Review the assets',
          action: { kind: 'open', target: { kind: 'assets' } },
        };
      }
      return {
        text: 'Read the script and approve it.',
        button: 'Open the script',
        action: { kind: 'open', target: { kind: 'script' } },
      };
    case 'failed':
      // Never "failed" next to output that still plays (docs/ux/redesign-2.4.md §3, rule 1).
      return {
        text: `${label} stopped with a problem.`,
        button: 'See what went wrong',
        action: { kind: 'select' },
      };
    case 'stale':
      return {
        text: `${label} is out of date: something it uses changed.`,
        ...runOrSelect(row, `Rebuild ${label}`),
      };
    case 'interrupted':
      return { text: `${label} was interrupted.`, ...runOrSelect(row, `Resume ${label}`) };
    default:
      return null;
  }
}

export function nextStep(rows: readonly RowView[]): NextStep | null {
  if (rows.some((row) => BUSY.has(row.status))) return null;
  const row = rows.find((candidate) => candidate.status !== 'done');
  if (row === undefined) {
    const last = rows.at(-1);
    return last === undefined
      ? null
      : {
          rowId: last.spec.id,
          heading: 'All done',
          text: 'Your video is exported.',
          button: 'Open the export',
          action: { kind: 'open', target: { kind: 'export' } },
          why: 'The MP4 is in the project folder under out/; the export dialog lists it.',
        };
  }
  const step = attentionStep(row) ?? firstStep(row);
  return { rowId: row.spec.id, heading: 'Next', ...step, why: WHY[row.spec.id] ?? '' };
}
