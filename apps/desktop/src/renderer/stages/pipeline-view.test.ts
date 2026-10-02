import { describe, expect, it } from 'vitest';
import {
  PIPELINE_STAGE_KEYS,
  type PipelineStageKey,
  type StageInfo,
  type StagesState,
} from '../../shared/stages-contract.js';
import {
  defaultRow,
  elapsedText,
  PIPELINE_ROWS,
  pipelineRows,
  type RowView,
} from './pipeline-view.js';

const UNREGISTERED: readonly PipelineStageKey[] = ['scenes', 'export'];

function info(stage: PipelineStageKey, patch: Partial<StageInfo> = {}): StageInfo {
  const registered = !UNREGISTERED.includes(stage);
  return {
    stage,
    status: null,
    message: null,
    updatedAt: null,
    stale: false,
    staleReason: null,
    interrupted: false,
    approvedAt: null,
    hasOutput: false,
    registered,
    runnable: registered && stage !== 'voiceover',
    ready: false,
    reasons: [],
    invalidates: [],
    error: null,
    warnings: [],
    ...patch,
  };
}

function state(
  patches: Partial<Record<PipelineStageKey, Partial<StageInfo>>>,
  extra: Partial<StagesState> = {},
): StagesState {
  return {
    projectDir: 'C:\\p',
    stages: PIPELINE_STAGE_KEYS.map((stage) => info(stage, patches[stage])),
    running: null,
    queue: [],
    pause: null,
    ...extra,
  };
}

function row(rows: readonly RowView[], id: string): RowView {
  const found = rows.find((candidate) => candidate.spec.id === id);
  if (found === undefined) throw new Error(`no row ${id}`);
  return found;
}

const DONE = { status: 'done', hasOutput: true } as const;

describe('pipelineRows', () => {
  it('has the eight reference rows; Sound design mixed runs sound cues then the mix', () => {
    expect(PIPELINE_ROWS.map((spec) => spec.label)).toEqual([
      'Script written',
      'Voiceover added',
      'Audio cleaned',
      'Words timed',
      'Storyboard',
      'Scenes built',
      'Sound design mixed',
      'Video exported',
    ]);
    const rows = pipelineRows(state({ 'sound-cues': { ready: true } }));
    expect(row(rows, 'sound')).toMatchObject({
      status: 'ready',
      runStages: ['sound-cues', 'mix'],
      run: { enabled: true },
    });
  });

  it('is loading until main answered', () => {
    const rows = pipelineRows(undefined);
    expect(rows.every((candidate) => candidate.status === 'loading')).toBe(true);
    expect(rows[0]?.run.enabled).toBe(false);
  });

  it('shows the gating reason as the Run tooltip of a blocked stage', () => {
    const reasons = ['timing/words.json is missing: run Words timed first.'];
    const rows = pipelineRows(state({ script: { ready: true }, storyboard: { reasons } }));
    expect(row(rows, 'script')).toMatchObject({ status: 'ready', run: { enabled: true } });
    expect(row(rows, 'storyboard')).toMatchObject({
      status: 'waiting',
      detail: reasons[0],
      run: { enabled: false, hint: reasons[0] },
      redo: { enabled: false },
    });
  });

  it('needs approval after the script is written, then is done', () => {
    const written = pipelineRows(state({ script: { ...DONE, message: '84 words' } }));
    expect(row(written, 'script')).toMatchObject({ status: 'review', redo: { enabled: false } });
    const approved = pipelineRows(
      state({
        script: {
          ...DONE,
          ready: true,
          approvedAt: '2026-10-02T10:00:00.000Z',
          message: '84 words',
        },
      }),
    );
    expect(row(approved, 'script')).toMatchObject({
      status: 'done',
      detail: '84 words',
      run: { enabled: false, hint: 'Done: use Redo to run it again.' },
      redo: { enabled: true },
    });
  });

  it('counts files of a project without pipeline.json as done', () => {
    const rows = pipelineRows(state({ storyboard: { hasOutput: true } }));
    expect(row(rows, 'storyboard').status).toBe('done');
    expect(row(rows, 'storyboard').open.enabled).toBe(true);
    expect(row(rows, 'words').open).toEqual({ enabled: false, hint: 'Nothing to open yet.' });
  });

  it('shows the running step, percent and start time; Stop instead of Run', () => {
    const rows = pipelineRows(
      state(
        { script: { status: 'running' } },
        {
          running: {
            stage: 'script',
            label: 'Claude: research',
            percent: 5,
            startedAt: 1_000,
            steps: [],
            paused: null,
          },
        },
      ),
    );
    expect(row(rows, 'script')).toMatchObject({
      status: 'running',
      detail: 'Claude: research',
      percent: 5,
      startedAt: 1_000,
      busy: true,
      run: { enabled: false },
    });
    expect(elapsedText(1_000, 76_500)).toBe('1:15');
  });

  it('shows a usage-limit pause with its reset time', () => {
    const until = new Date(2026, 9, 2, 17, 5).getTime();
    const rows = pipelineRows(
      state(
        { storyboard: { status: 'paused' } },
        {
          running: {
            stage: 'storyboard',
            label: 'Claude: storyboard',
            percent: null,
            startedAt: 0,
            steps: [],
            paused: { until, message: 'limit' },
          },
        },
      ),
    );
    expect(row(rows, 'storyboard').status).toBe('paused');
    expect(row(rows, 'storyboard').detail).toMatch(/^Paused by the Claude usage limit until 17:05/);
  });

  it('marks queued, failed (with details), stale and interrupted stages', () => {
    const error = {
      kind: 'validation',
      message: 'storyboard.json is invalid',
      issues: ['shots.0: x'],
    };
    const rows = pipelineRows(
      state(
        {
          script: { ...DONE, approvedAt: 'x' },
          clean: { status: 'failed', hasOutput: true, error, ready: true },
          words: { ...DONE, stale: true, staleReason: 'voiceover changed', ready: true },
          storyboard: {
            status: 'failed',
            interrupted: true,
            message: 'Interrupted: the app closed.',
            ready: true,
          },
        },
        { queue: ['mix'] },
      ),
    );
    expect(row(rows, 'clean')).toMatchObject({
      status: 'failed',
      detail: 'storyboard.json is invalid',
      error,
      run: { label: 'Retry', enabled: true },
    });
    expect(row(rows, 'words')).toMatchObject({
      status: 'stale',
      detail: 'Out of date (voiceover changed): run it again.',
      run: { enabled: true },
    });
    expect(row(rows, 'storyboard')).toMatchObject({
      status: 'interrupted',
      detail: 'Interrupted: the app closed.',
      run: { label: 'Resume', enabled: true },
    });
    expect(row(rows, 'sound')).toMatchObject({ status: 'queued', busy: true });
  });

  it('keeps not-yet-wired stages visible with their real status and Run disabled', () => {
    const rows = pipelineRows(state({ scenes: { hasOutput: true }, export: {} }));
    expect(row(rows, 'scenes')).toMatchObject({
      status: 'done',
      redo: { enabled: false, hint: 'Coming with the scenes stage.' },
    });
    expect(row(rows, 'export')).toMatchObject({
      status: 'waiting',
      detail: 'Coming with the export stage.',
      run: { enabled: false, hint: 'Coming with the export stage.' },
    });
    expect(row(rows, 'voiceover')).toMatchObject({
      status: 'waiting',
      run: { enabled: false, hint: 'Use Replace to import a recording.' },
      replace: { enabled: true },
    });
  });

  it('lists the later stages a Redo makes stale', () => {
    const rows = pipelineRows(
      state({
        script: { ...DONE, approvedAt: 'x', ready: true, invalidates: ['words', 'storyboard'] },
        'sound-cues': { ...DONE, invalidates: ['mix', 'export'] },
        mix: { ...DONE, invalidates: ['export'] },
      }),
    );
    expect(row(rows, 'script').invalidates).toEqual(['words', 'storyboard']);
    expect(row(rows, 'sound').invalidates).toEqual(['export']);
  });

  it('selects the row that needs the user first', () => {
    const rows = pipelineRows(state({ script: { ...DONE }, voiceover: { ready: true } }));
    expect(defaultRow(rows)?.spec.id).toBe('script');
    const next = pipelineRows(
      state({ script: { ...DONE, approvedAt: 'x' }, clean: { ready: true } }),
    );
    expect(defaultRow(next)?.spec.id).toBe('clean');
    expect(defaultRow(pipelineRows(state({ script: { ...DONE, approvedAt: 'x' } })))?.spec.id).toBe(
      'voiceover',
    );
    expect(defaultRow(pipelineRows(state({})))?.spec.id).toBe('script');
  });
});
