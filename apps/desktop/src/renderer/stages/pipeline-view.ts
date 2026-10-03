/**
 * View model of the pipeline sidebar (PLAN.md#6.8): the eight rows of the reference app, each
 * backed by one or more runner stages (one line each in PIPELINE_ROWS), with a status (Done /
 * Review / Running / Paused / Queued / Ready / Waiting / Failed / Stale / Interrupted; the words
 * the UI shows for them are in status-view.ts), a one-line detail and the Open / Replace / Run /
 * Redo / Stop actions with the gating hint. Pure.
 */
import type {
  PipelineStageKey,
  ReplaceableStage,
  StageArtifact,
  StageErrorInfo,
  StageInfo,
  StagesState,
} from '../../shared/stages-contract.js';

export type OpenTarget =
  | { readonly kind: 'script' }
  | { readonly kind: 'voiceover' }
  | { readonly kind: 'words' }
  | { readonly kind: 'shots' }
  | { readonly kind: 'scenes' }
  | { readonly kind: 'sound' }
  | { readonly kind: 'export' }
  | { readonly kind: 'artifact'; readonly artifact: StageArtifact };

export interface PipelineRowSpec {
  readonly id: string;
  readonly label: string;
  /** Runner stages behind the row, in the order Run executes them. */
  readonly stages: readonly PipelineStageKey[];
  readonly open: OpenTarget;
  readonly replace: ReplaceableStage | null;
  /** Shown while the app cannot run the row's stage yet. */
  readonly coming: string;
}

export const PIPELINE_ROWS: readonly PipelineRowSpec[] = [
  {
    id: 'script',
    label: 'Script written',
    stages: ['script'],
    open: { kind: 'script' },
    replace: 'script',
    coming: '',
  },
  {
    id: 'voiceover',
    label: 'Voiceover added',
    stages: ['voiceover'],
    open: { kind: 'voiceover' },
    replace: 'voiceover',
    coming: '',
  },
  {
    id: 'clean',
    label: 'Audio cleaned',
    stages: ['clean'],
    open: { kind: 'artifact', artifact: 'clean' },
    replace: null,
    coming: '',
  },
  {
    id: 'words',
    label: 'Words timed',
    stages: ['words'],
    open: { kind: 'words' },
    replace: null,
    coming: '',
  },
  {
    id: 'storyboard',
    label: 'Storyboard',
    stages: ['storyboard'],
    open: { kind: 'shots' },
    replace: null,
    coming: '',
  },
  {
    id: 'scenes',
    label: 'Scenes built',
    stages: ['scenes'],
    open: { kind: 'scenes' },
    replace: null,
    coming: '',
  },
  {
    id: 'sound',
    label: 'Sound design mixed',
    stages: ['sound-cues', 'mix'],
    open: { kind: 'sound' },
    replace: null,
    coming: '',
  },
  {
    id: 'export',
    label: 'Video exported',
    stages: ['export'],
    open: { kind: 'export' },
    replace: null,
    coming: '',
  },
];

/** Stage names in sentences (same as the runner's titles). */
export const STAGE_LABELS: Readonly<Record<PipelineStageKey, string>> = {
  script: 'Script',
  voiceover: 'Voiceover',
  clean: 'Audio cleaned',
  words: 'Words timed',
  storyboard: 'Storyboard',
  scenes: 'Scenes built',
  'sound-cues': 'Sound cues',
  mix: 'Sound design mixed',
  export: 'Video exported',
};

export type RowStatus =
  | 'loading'
  | 'done'
  | 'review'
  | 'running'
  | 'paused'
  | 'queued'
  | 'ready'
  | 'waiting'
  | 'failed'
  | 'stale'
  | 'interrupted';

export interface ActionView {
  readonly enabled: boolean;
  /** Tooltip: what it does, or why it is not available. */
  readonly hint: string;
}

export interface RowView {
  readonly spec: PipelineRowSpec;
  readonly status: RowStatus;
  /** One line under the actions (step, reason, error summary, result). */
  readonly detail: string | null;
  readonly percent: number | null;
  /** Epoch ms the running stage started. */
  readonly startedAt: number | null;
  /** Epoch ms a usage-limit pause ends (null: unknown or not paused). */
  readonly pausedUntil: number | null;
  readonly error: StageErrorInfo | null;
  readonly warnings: readonly string[];
  /** Stages Run starts (the unfinished ones) and Redo starts (all). */
  readonly runStages: readonly PipelineStageKey[];
  readonly redoStages: readonly PipelineStageKey[];
  /** Later stages a Redo marks out of date. */
  readonly invalidates: readonly PipelineStageKey[];
  readonly busy: boolean;
  readonly open: ActionView;
  readonly replace: ActionView | null;
  readonly run: ActionView & { readonly label: string };
  readonly redo: ActionView;
}

function isDone(info: StageInfo): boolean {
  if (info.stale || info.interrupted) return false;
  if (info.status === 'done') return true;
  return (info.status === null || info.status === 'idle') && info.hasOutput;
}

function isFailed(info: StageInfo): boolean {
  if (info.interrupted) return false;
  if (info.status === 'failed' || info.status === 'blocked') return true;
  return info.error !== null && info.error.kind !== 'not-ready';
}

function clockTime(epochMs: number): string {
  return new Date(epochMs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/** `m:ss` of a running stage. */
export function elapsedText(startedAt: number, now: number): string {
  const seconds = Math.max(0, Math.floor((now - startedAt) / 1000));
  return `${String(Math.floor(seconds / 60))}:${String(seconds % 60).padStart(2, '0')}`;
}

function rowStatus(
  spec: PipelineRowSpec,
  infos: readonly StageInfo[],
  state: StagesState,
): RowStatus {
  const running = state.running;
  if (running !== null && spec.stages.includes(running.stage)) {
    return running.paused === null ? 'running' : 'paused';
  }
  if (state.queue.some((stage) => spec.stages.includes(stage))) return 'queued';
  if (infos.some((info) => info.status === 'running')) return 'running';
  if (infos.some((info) => info.interrupted || info.status === 'paused')) return 'interrupted';
  if (infos.some(isFailed)) return 'failed';
  if (infos.some((info) => info.stale)) return 'stale';
  if (infos.every(isDone)) {
    return spec.id === 'script' && infos[0]?.approvedAt === null ? 'review' : 'done';
  }
  const next = infos.find((info) => !isDone(info));
  return next?.registered === true && next.runnable && next.ready ? 'ready' : 'waiting';
}

function failedInfo(infos: readonly StageInfo[]): StageInfo | undefined {
  return infos.find((info) => isFailed(info) || info.interrupted || info.status === 'paused');
}

function rowDetail(
  status: RowStatus,
  spec: PipelineRowSpec,
  infos: readonly StageInfo[],
  state: StagesState,
): string | null {
  const running = state.running;
  switch (status) {
    case 'loading':
      return null;
    case 'running':
      return running?.label ?? 'Starting…';
    case 'paused': {
      const until = running?.paused?.until ?? null;
      return until === null
        ? 'Paused by the Claude usage limit: resume from the chat.'
        : `Paused by the Claude usage limit until ${clockTime(until)}.`;
    }
    case 'queued': {
      const position = state.queue.findIndex((stage) => spec.stages.includes(stage)) + 1;
      return `Queued: starts when the running step finishes (#${String(position)}).`;
    }
    case 'interrupted':
    case 'failed': {
      const info = failedInfo(infos);
      return info?.error?.message ?? info?.message ?? 'Failed.';
    }
    case 'stale': {
      const reason = infos.find((candidate) => candidate.stale)?.staleReason ?? null;
      return `Out of date${reason === null ? '' : ` (${reason})`}: run it again.`;
    }
    case 'review':
      return 'Read the script, then approve it.';
    case 'done':
      return infos.at(-1)?.message ?? null;
    case 'ready':
      return null;
    case 'waiting': {
      const next = infos.find((info) => !isDone(info));
      if (next === undefined || !next.registered) return spec.coming || null;
      if (!next.runnable) return 'Use Replace or Open → Record to add a recording.';
      return next.reasons[0] ?? null;
    }
  }
}

function runAction(
  spec: PipelineRowSpec,
  todo: readonly StageInfo[],
  busy: boolean,
  status: RowStatus,
): ActionView & { label: string } {
  const label = status === 'interrupted' ? 'Resume' : status === 'failed' ? 'Retry' : 'Run';
  const first = todo[0];
  if (first === undefined)
    return { label, enabled: false, hint: 'Done: use Redo to run it again.' };
  if (!first.registered) return { label, enabled: false, hint: spec.coming };
  if (!first.runnable)
    return { label, enabled: false, hint: 'Use Replace or Open → Record to add a recording.' };
  if (busy) return { label, enabled: false, hint: `${spec.label} is already running or queued.` };
  if (!first.ready) return { label, enabled: false, hint: first.reasons.join(' ') || 'Not ready.' };
  return { label, enabled: true, hint: `Run ${spec.label}` };
}

function redoAction(spec: PipelineRowSpec, infos: readonly StageInfo[], busy: boolean): ActionView {
  const first = infos[0];
  if (first === undefined || !first.registered) return { enabled: false, hint: spec.coming };
  if (!first.runnable) return { enabled: false, hint: 'Use Replace to import another recording.' };
  if (!infos.some((info) => info.hasOutput || info.status === 'done')) {
    return { enabled: false, hint: 'Nothing to redo yet: use Run.' };
  }
  if (busy) return { enabled: false, hint: `${spec.label} is already running or queued.` };
  if (!first.ready) return { enabled: false, hint: first.reasons.join(' ') || 'Not ready.' };
  return { enabled: true, hint: `Run ${spec.label} again (asks first)` };
}

function openAction(spec: PipelineRowSpec, infos: readonly StageInfo[]): ActionView {
  if (spec.open.kind === 'script') return { enabled: true, hint: 'Open the brief and the script' };
  if (spec.open.kind === 'voiceover') {
    return { enabled: true, hint: 'Import, record or replace the voice-over; fit to the script' };
  }
  if (spec.open.kind === 'scenes') {
    return { enabled: true, hint: 'Build progress, missing props and the sync report' };
  }
  if (spec.open.kind === 'sound') {
    return { enabled: true, hint: 'Sound library, levels, ducking, mix render and preview' };
  }
  if (spec.open.kind === 'export') {
    return { enabled: true, hint: 'Export settings, the export queue and YouTube extras' };
  }
  const has = infos.some((info) => info.hasOutput);
  return has
    ? { enabled: true, hint: `Open ${spec.label.toLowerCase()} output` }
    : { enabled: false, hint: 'Nothing to open yet.' };
}

const LOADING_ACTION: ActionView = { enabled: false, hint: 'Reading the project…' };

export function pipelineRows(state: StagesState | undefined): RowView[] {
  return PIPELINE_ROWS.map((spec): RowView => {
    const infos = (state?.stages ?? []).filter((info) => spec.stages.includes(info.stage));
    if (state === undefined || infos.length !== spec.stages.length) {
      return {
        spec,
        status: 'loading',
        detail: null,
        percent: null,
        startedAt: null,
        pausedUntil: null,
        error: null,
        warnings: [],
        runStages: [],
        redoStages: [],
        invalidates: [],
        busy: false,
        open: LOADING_ACTION,
        replace: spec.replace === null ? null : LOADING_ACTION,
        run: { ...LOADING_ACTION, label: 'Run' },
        redo: LOADING_ACTION,
      };
    }
    const status = rowStatus(spec, infos, state);
    const busy = status === 'running' || status === 'paused' || status === 'queued';
    const todo = infos.filter((info) => !isDone(info));
    const running = state.running !== null && spec.stages.includes(state.running.stage);
    const invalidates = [...new Set(infos.flatMap((info) => info.invalidates))].filter(
      (stage) => !spec.stages.includes(stage),
    );
    return {
      spec,
      status,
      detail: rowDetail(status, spec, infos, state),
      percent: running ? (state.running?.percent ?? null) : null,
      startedAt: running ? (state.running?.startedAt ?? null) : null,
      pausedUntil: running ? (state.running?.paused?.until ?? null) : null,
      error: failedInfo(infos)?.error ?? null,
      warnings: infos.flatMap((info) => info.warnings),
      runStages: todo.map((info) => info.stage),
      redoStages: [...spec.stages],
      invalidates,
      busy,
      open: openAction(spec, infos),
      replace:
        spec.replace === null
          ? null
          : busy
            ? { enabled: false, hint: `${spec.label} is running or queued.` }
            : {
                enabled: true,
                hint:
                  spec.replace === 'script'
                    ? 'Use a script from a text file'
                    : 'Import a voice-over recording (wav, mp3, m4a, ogg, flac)',
              },
      run: runAction(spec, todo, busy, status),
      redo: redoAction(spec, infos, busy),
    };
  });
}

/**
 * Row selected by default: the running one, else the first that needs the user, else the first
 * stage still to do, else the last one.
 */
export function defaultRow(rows: readonly RowView[]): RowView | undefined {
  const wanted: readonly RowStatus[] = ['running', 'paused', 'failed', 'interrupted', 'review'];
  return (
    rows.find((row) => wanted.includes(row.status)) ??
    rows.find((row) => row.status === 'ready' || row.status === 'stale') ??
    rows.find((row) => row.status !== 'done') ??
    rows.at(-1)
  );
}
