/**
 * Status model v2 of the pipeline steps (docs/ux/redesign-2.4.md §3): every row gets one of seven
 * statuses (Not started □, Ready ▶, Working ●, Needs you ◆, Done ■, Built with problems ▲, Out of
 * date ◇; plus Failed ✗ only when nothing usable came out) and one plain sentence
 * "<what exists>. <what is wrong>. <one action>". Rules: usable output wins (never "Failed" beside
 * output that plays), never Done below a step that is not done ("Kept from before"), no
 * "Waiting for …" (a step that cannot start says "Needs: <translated requirement>"), paused and
 * stopped runs are Working variants, errors are translated (raw text behind Details). Pure.
 */
import type { ScenesReport, StoryboardShot } from '@reelforge/shared';
import { plural } from '../../shared/plural.js';
import type { StageErrorInfo, StageInfo, StagesState } from '../../shared/stages-contract.js';
import { nextStep } from './next-step.js';
import { pipelineRows, type RowView } from './pipeline-view.js';
import {
  errorCause,
  needsFromReason,
  shotFailureCause,
  STEP_NAMES,
  STEP_OUTPUTS,
} from './station-reasons.js';

export type StationStatus =
  | 'not-started'
  | 'ready'
  | 'working'
  | 'needs-you'
  | 'done'
  | 'problems'
  | 'out-of-date'
  /** Nothing usable came out (rule 1: never next to usable output). */
  | 'failed';

export const STATION_GLYPHS: Readonly<Record<StationStatus, string>> = {
  'not-started': '□',
  ready: '▶',
  working: '●',
  'needs-you': '◆',
  done: '■',
  problems: '▲',
  'out-of-date': '◇',
  failed: '✗',
};

export interface ShotProblem {
  readonly id: string;
  readonly cause: string;
}

/** What the project's files and the scenes report say about the scenes (rule 6). */
export interface ScenesFacts {
  readonly planned: number;
  /** Shots with a scene file on disk. */
  readonly built: number;
  /** ✗ in the scenes report, with a plain cause. */
  readonly failed: readonly ShotProblem[];
  /** Planned shots without a scene file. */
  readonly missing: readonly string[];
}

export interface StationFacts {
  readonly scenes?: ScenesFacts;
}

export interface StationView {
  readonly rowId: string;
  /** null while the project is read. */
  readonly status: StationStatus | null;
  /** The chip: the status word or its variant (Queued, Paused, Stopped, Kept from before). */
  readonly word: string;
  readonly glyph: string;
  /** Done, but an earlier step is not: shown muted (rule 2). */
  readonly kept: boolean;
  readonly sentence: string;
  /** Colour class of the square dot and the chip (`status-<css>`). */
  readonly css: string;
}

/** Statuses that make the output of a later step "Kept from before". */
const NOT_DONE: ReadonlySet<StationStatus> = new Set([
  'not-started',
  'ready',
  'working',
  'needs-you',
  'out-of-date',
  'failed',
]);

const DONE_TEXT: Readonly<Record<string, string>> = {
  script: 'Script approved',
  voiceover: 'Voiceover in place',
  clean: 'Audio cleaned up',
  words: 'Every word timed',
  storyboard: 'Shots planned',
  assets: 'Photos and footage ready',
  scenes: 'Scenes built',
  sound: 'Sound mixed',
  export: 'Video exported',
};

const READY_TEXT: Readonly<Record<string, string>> = {
  script: 'Write the script from your brief',
  clean: 'Clean up the voiceover audio',
  words: 'Time every spoken word',
  storyboard: 'Plan the shots',
  assets: 'Find the photos and footage the storyboard asks for',
  scenes: 'Build the animated scenes',
  sound: 'Mix the voice, effects and ambience',
  export: 'Export the finished video',
};

/** Joins the parts as sentences: "6 of 7 scenes built. s02 failed: blank frames. Retry s02." */
export function sentence(...parts: readonly (string | null | undefined)[]): string {
  return parts
    .filter((part): part is string => part !== null && part !== undefined && part !== '')
    .map((part) => (/[.!?…]$/.test(part) ? part : `${part}.`))
    .join(' ');
}

function capitalized(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function clockTime(epochMs: number): string {
  return new Date(epochMs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/** The scenes facts from the scenes report and the scene files on disk. */
export function stationFacts(
  report: ScenesReport | null,
  shots: readonly StoryboardShot[],
  built: ReadonlySet<string>,
): StationFacts {
  if (shots.length === 0) return {};
  const planned = new Set(shots.map((shot) => shot.id));
  return {
    scenes: {
      planned: shots.length,
      built: shots.filter((shot) => built.has(shot.id)).length,
      failed: (report?.shots ?? [])
        .filter((record) => record.status === 'failed' && planned.has(record.shotId))
        .map((record) => ({ id: record.shotId, cause: shotFailureCause(record) })),
      missing: shots.filter((shot) => !built.has(shot.id)).map((shot) => shot.id),
    },
  };
}

interface Base {
  readonly status: StationStatus;
  readonly word: string;
  readonly sentence: string;
  readonly css: string;
}

function base(status: StationStatus, word: string, text: string, css: string): Base {
  return { status, word, sentence: text, css };
}

/**
 * Usable output that is not all right: failed or missing shots (rules 1 and 6). `run`: the failed
 * build run (Retry is offered), or null after a finished build (rebuild single shots instead).
 */
function scenesProblems(
  scenes: ScenesFacts,
  run: { readonly error: StageErrorInfo | null } | null,
): Base {
  const exists = `${String(scenes.built)} of ${plural(scenes.planned, 'scene')} built`;
  const [first] = scenes.failed;
  const more = scenes.failed.length > 1 ? ` (+${String(scenes.failed.length - 1)} more)` : '';
  if (first !== undefined) {
    const retry = scenes.failed.length === 1 ? `Retry ${first.id}` : 'Retry';
    const action = run === null ? `Rebuild ${first.id} from the Shots list` : retry;
    return base(
      'problems',
      'Built with problems',
      sentence(exists, `${first.id} failed: ${first.cause}${more}`, action),
      'problems',
    );
  }
  const missing = scenes.missing.join(', ');
  const parts =
    run === null
      ? [`${missing} not built`, `Build ${missing} from the Shots list`]
      : [`The build stopped: ${errorCause(run.error)}`, 'Retry'];
  return base('problems', 'Built with problems', sentence(exists, ...parts), 'problems');
}

function failedBase(row: RowView, infos: readonly StageInfo[], facts: StationFacts): Base {
  const scenes = row.spec.id === 'scenes' ? facts.scenes : undefined;
  if (scenes !== undefined && scenes.built > 0) return scenesProblems(scenes, { error: row.error });
  const cause = errorCause(row.error);
  if (infos.some((info) => info.hasOutput)) {
    return base(
      'problems',
      'Built with problems',
      sentence('The result from before is kept', `The last run failed: ${cause}`, 'Retry'),
      'problems',
    );
  }
  return base(
    'failed',
    'Failed',
    sentence('Nothing usable came out', capitalized(cause), 'Retry'),
    'failed',
  );
}

function doneBase(row: RowView, infos: readonly StageInfo[], facts: StationFacts): Base {
  const scenes = row.spec.id === 'scenes' ? facts.scenes : undefined;
  if (scenes !== undefined && scenes.built > 0) {
    if (scenes.failed.length > 0 || scenes.missing.length > 0) return scenesProblems(scenes, null);
  }
  const message = infos.at(-1)?.message ?? null;
  return base('done', 'Done', sentence(message ?? DONE_TEXT[row.spec.id]), 'done');
}

/** "Needs: …" of a step that cannot start: its own gating first, else the nearest earlier step. */
function needsText(row: RowView, rows: readonly RowView[]): string {
  for (const reason of row.reasons) {
    const text = needsFromReason(reason);
    if (text !== undefined) return text;
  }
  const blocker = blockingRow(row, rows);
  if (blocker === undefined) return 'Needs: an earlier step';
  if (blocker.spec.id === 'script') return 'Needs: an approved script';
  return `Needs: ${STEP_OUTPUTS[blocker.spec.id] ?? blocker.spec.label}`;
}

/** The nearest earlier step that is not done yet. */
function blockingRow(row: RowView, rows: readonly RowView[]): RowView | undefined {
  const index = rows.indexOf(row);
  return rows
    .slice(0, Math.max(index, 0))
    .findLast((candidate) => candidate.status !== 'done' && candidate.status !== 'loading');
}

function waitingBase(row: RowView, rows: readonly RowView[]): Base {
  const knownReason = row.reasons.some((reason) => needsFromReason(reason) !== undefined);
  const unblocked = blockingRow(row, rows) === undefined;
  if (row.spec.id === 'script' && (unblocked || knownReason)) {
    const missing = row.reasons.some((reason) => reason.startsWith('brief.json is missing'));
    const text = missing
      ? 'Describe your video in a few sentences (the brief), then write the script'
      : 'Fill in the brief, then write the script';
    return base('needs-you', 'Needs you', sentence(text), 'review');
  }
  if (row.spec.id === 'voiceover' && unblocked && !knownReason) {
    const text = 'Record your voiceover (read the approved script) or import a file';
    return base('needs-you', 'Needs you', sentence(text), 'review');
  }
  return base('not-started', 'Not started', sentence(needsText(row, rows)), 'waiting');
}

function workingBase(row: RowView, infos: readonly StageInfo[], state: StagesState): Base {
  switch (row.status) {
    case 'paused':
      return base(
        'working',
        'Paused',
        row.pausedUntil === null
          ? sentence('Paused by your Claude usage limit', 'Resume it from the chat')
          : sentence(
              `Paused by your Claude usage limit — resumes at ${clockTime(row.pausedUntil)}`,
            ),
        'paused',
      );
    case 'queued': {
      const position = state.queue.findIndex((stage) => row.spec.stages.includes(stage)) + 1;
      const line = `Starts when the running step finishes (#${String(position)} in line)`;
      return base('working', 'Queued', sentence(line), 'queued');
    }
    case 'interrupted': {
      const kept = infos.some((info) => info.hasOutput) ? 'The result from before is kept' : null;
      return base(
        'working',
        'Stopped',
        sentence(kept, 'Stopped when the app closed', 'Resume continues it'),
        'interrupted',
      );
    }
    default: {
      const percent = row.percent === null ? '' : ` · ${String(Math.round(row.percent))} %`;
      return base('working', `Working${percent}`, sentence(row.detail ?? 'Starting…'), 'running');
    }
  }
}

function baseOf(
  row: RowView,
  rows: readonly RowView[],
  state: StagesState,
  facts: StationFacts,
): Base | null {
  const infos = state.stages.filter((info) => row.spec.stages.includes(info.stage));
  switch (row.status) {
    case 'loading':
      return null;
    case 'running':
    case 'paused':
    case 'queued':
    case 'interrupted':
      return workingBase(row, infos, state);
    case 'failed':
      return failedBase(row, infos, facts);
    case 'stale': {
      const reason = infos.find((info) => info.stale)?.staleReason ?? null;
      const why = reason === null ? 'a change it depends on' : `a change (${reason})`;
      return base(
        'out-of-date',
        'Out of date',
        sentence(`Made before ${why}`, 'Run it again'),
        'stale',
      );
    }
    case 'review':
      return row.spec.id === 'assets'
        ? base(
            'needs-you',
            'Needs you',
            sentence('An asset package is ready', 'Approve or reject the photos and footage'),
            'review',
          )
        : base(
            'needs-you',
            'Needs you',
            sentence('The script is written', 'Read it and approve it'),
            'review',
          );
    case 'done':
      return doneBase(row, infos, facts);
    case 'ready': {
      const scenes = row.spec.id === 'scenes' ? facts.scenes : undefined;
      const text =
        scenes === undefined ? READY_TEXT[row.spec.id] : `Build ${plural(scenes.planned, 'scene')}`;
      return base('ready', 'Ready', sentence(text ?? `Run ${row.spec.label}`), 'ready');
    }
    case 'waiting':
      return waitingBase(row, rows);
  }
}

const LOADING: Omit<StationView, 'rowId'> = {
  status: null,
  word: '…',
  glyph: '',
  kept: false,
  sentence: '',
  css: 'loading',
};

/** One station per pipeline row, in the same order. */
export function stations(
  rows: readonly RowView[],
  state: StagesState | undefined,
  facts: StationFacts = {},
): StationView[] {
  const bases = rows.map((row) => (state === undefined ? null : baseOf(row, rows, state, facts)));
  return rows.map((row, index): StationView => {
    const own = bases[index] ?? null;
    if (own === null) return { rowId: row.spec.id, ...LOADING };
    // The earliest step that is not done: the root of what this output waits for.
    const blocker =
      own.status === 'done'
        ? bases
            .slice(0, index)
            .findIndex((candidate) => candidate !== null && NOT_DONE.has(candidate.status))
        : -1;
    const blockerId = blocker === -1 ? undefined : rows[blocker]?.spec.id;
    if (blockerId !== undefined) {
      const after = STEP_NAMES[blockerId] ?? 'an earlier step';
      return {
        rowId: row.spec.id,
        status: 'done',
        word: 'Kept from before',
        glyph: STATION_GLYPHS.done,
        kept: true,
        sentence: sentence(`Kept from before: it updates after ${after}`, own.sentence),
        css: 'kept',
      };
    }
    return { rowId: row.spec.id, ...own, glyph: STATION_GLYPHS[own.status], kept: false };
  });
}

/** Stations straight from the pipeline state (tests, one-off callers). */
export function stationsOf(
  state: StagesState | undefined,
  facts: StationFacts = {},
): StationView[] {
  return stations(pipelineRows(state), state, facts);
}

/** What the empty preview stage suggests (docs/ux/redesign-2.4.md §5): the next step's sentence. */
export function emptyStageHint(state: StagesState | undefined): string | undefined {
  return nextStep(pipelineRows(state))?.text;
}
