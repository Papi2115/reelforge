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

function info(stage: PipelineStageKey, patch: Partial<StageInfo> = {}): StageInfo {
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
    registered: true,
    runnable: stage !== 'voiceover',
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
    // Main reports Assets only when research is on and needed (PLAN.md#12.10).
    stages: PIPELINE_STAGE_KEYS.filter(
      (stage) => stage !== 'assets' || patches.assets !== undefined,
    ).map((stage) => info(stage, patches[stage])),
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
      'Assets',
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

  it('lists Assets only when main reports it; a package to review asks for the user', () => {
    expect(pipelineRows(state({})).map((view) => view.spec.id)).not.toContain('assets');
    expect(pipelineRows(undefined).map((view) => view.spec.id)).not.toContain('assets');
    const waiting = pipelineRows(
      state({ storyboard: DONE, assets: { ...DONE, awaitingReview: true } }),
    );
    expect(row(waiting, 'assets')).toMatchObject({
      status: 'review',
      detail: 'Open the asset package: approve or reject the photos and footage.',
      open: { enabled: true },
    });
    expect(defaultRow(waiting)?.spec.id).toBe('assets');
    const done = pipelineRows(state({ assets: { ...DONE, awaitingReview: false } }));
    expect(row(done, 'assets').status).toBe('done');
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
            action: null,
            targets: null,
            shots: {},
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
            action: null,
            targets: null,
            shots: {},
          },
        },
      ),
    );
    expect(row(rows, 'storyboard').status).toBe('paused');
    // The clock format follows the user's locale (24 h in Poland, "5:05 PM" in en-US).
    expect(row(rows, 'storyboard').detail).toMatch(
      /^Paused by the Claude usage limit until (17:05|0?5:05\s?PM)/i,
    );
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

  it('runs Scenes built and Video exported from the sidebar; the voice-over needs a recording', () => {
    const rows = pipelineRows(
      state({
        scenes: { hasOutput: true, ready: true },
        export: { reasons: ['audio/mix.wav is missing: run Sound design mixed first.'] },
      }),
    );
    expect(row(rows, 'scenes')).toMatchObject({
      status: 'done',
      redo: { enabled: true },
      open: { enabled: true },
    });
    expect(row(rows, 'export')).toMatchObject({
      status: 'waiting',
      detail: 'audio/mix.wav is missing: run Sound design mixed first.',
      run: { enabled: false },
      // The export dialog and the Sound panel open before there is any output.
      open: { enabled: true },
      spec: { open: { kind: 'export' } },
    });
    expect(row(rows, 'sound')).toMatchObject({
      open: { enabled: true },
      spec: { open: { kind: 'sound' } },
    });
    // Storyboard opens its options (and the Shots panel) before there is a storyboard.
    expect(row(rows, 'storyboard')).toMatchObject({
      open: { enabled: true, hint: 'Storyboard options, the Hook lab and the shots' },
      spec: { open: { kind: 'shots' } },
    });
    expect(row(rows, 'voiceover')).toMatchObject({
      status: 'waiting',
      run: { enabled: false, hint: 'Use Replace or Open → Record to add a recording.' },
      replace: { enabled: true },
      open: { enabled: true },
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
