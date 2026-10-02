/** StageService on fake stage definitions: queue, gating, Stop, crash recovery, limit pause. */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { err, LimitGuard, PipelineStateStore, ok } from '@reelforge/claude-bridge';
import type { PipelineState } from '@reelforge/shared';
import {
  BUILT_IN_STAGES,
  stageError,
  StageRunner,
  type ClaudeRunner,
  type ClaudeTurnResult,
  type StageRegistry,
} from '@reelforge/stages';
import { afterEach, describe, expect, it } from 'vitest';
import type { StagesState } from '../../shared/stages-contract.js';
import { createLogger } from '../logger.js';
import { StageService, type RunOutcome, type StageServiceOptions } from './stage-service.js';
import { APPROVAL_REASON, INTERRUPTED_MESSAGE, INTERRUPTED_PAUSE_MESSAGE } from './stage-state.js';
import { Gate, gatedRun, SUMMARY, TempProjects, until } from './testing/fixtures.js';

const projects = new TempProjects();
const cleanups: (() => Promise<void> | void)[] = [];

afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
  projects.dispose();
});

const COMPLETED: ClaudeTurnResult = {
  status: 'completed',
  reply: 'Done.',
  sessionId: 'session-1',
  message: 'completed',
  usage: undefined,
  limit: undefined,
};

interface Harness {
  readonly service: StageService;
  readonly dir: string;
  readonly guard: LimitGuard;
  readonly pushes: StagesState[];
  readonly lines: string[];
  readonly state: () => Promise<PipelineState>;
}

async function harness(
  stages: Partial<StageRegistry>,
  options: {
    files?: Record<string, string>;
    brief?: boolean;
    claude?: ClaudeRunner;
    exportRun?: StageServiceOptions['exportRun'];
  } = {},
): Promise<Harness> {
  const dir = projects.create(options.files, options.brief ?? true);
  const store = new PipelineStateStore();
  const guard = new LimitGuard();
  const registry: StageRegistry = { ...BUILT_IN_STAGES, ...stages };
  const pushes: StagesState[] = [];
  const lines: string[] = [];
  const service = new StageService({
    createRunner: (projectDir) =>
      new StageRunner({
        projectDir,
        stages: registry,
        claude: options.claude,
        guard,
        store,
        autocommit: false,
      }),
    ...(options.exportRun === undefined ? {} : { exportRun: options.exportRun }),
    store,
    guard,
    push: (next) => pushes.push(next),
    log: createLogger((line) => lines.push(line)),
    pushDelayMs: 0,
  });
  cleanups.push(() => {
    guard.dispose();
  });
  cleanups.push(() => service.dispose());
  await service.follow(dir);
  const state = async (): Promise<PipelineState> => {
    const read = await store.read(dir);
    if (!read.ok) throw new Error(read.error.message);
    return read.value;
  };
  return { service, dir, guard, pushes, lines, state };
}

async function approve(dir: string): Promise<void> {
  const stamp = new Date().toISOString();
  await new PipelineStateStore().update(dir, (current) => ({
    ...current,
    stages: { script: { status: 'done', updatedAt: stamp, approvedAt: stamp } },
  }));
}

function last(pushes: readonly StagesState[]): StagesState | undefined {
  return pushes.at(-1);
}

describe('StageService', () => {
  it('runs one stage at a time and starts the queued one afterwards', async () => {
    const script = new Gate();
    const voiceover = new Gate();
    const { service, pushes, state } = await harness({
      script: { ...BUILT_IN_STAGES.script, run: gatedRun(script, 'Writing') },
      voiceover: { ...BUILT_IN_STAGES.voiceover, run: gatedRun(voiceover, 'Importing') },
    });
    expect(await service.run(['script'])).toEqual({ status: 'queued', message: null });
    await script.started;
    expect(await service.enqueue([{ stage: 'voiceover', source: 'take.wav' }])).toMatchObject({
      status: 'queued',
    });
    expect(await service.run(['script'])).toMatchObject({ status: 'error' });
    await until(() => last(pushes)?.running?.label === 'Writing');
    expect(last(pushes)).toMatchObject({
      running: { stage: 'script', percent: 10 },
      queue: ['voiceover'],
    });
    expect(service.busy).toBe(true);
    expect(service.isBusyWith(path.join(projects.create(), '..'), 'script')).toBe(false);

    script.release();
    await voiceover.started;
    expect((await state()).stages['script']?.status).toBe('done');
    expect((await state()).stages['voiceover']?.status).toBe('running');
    voiceover.release();
    await service.whenIdle();
    expect((await state()).stages['voiceover']?.status).toBe('done');
    await until(() => last(pushes)?.running === null && last(pushes)?.queue.length === 0);
    const scriptInfo = last(pushes)?.stages.find((info) => info.stage === 'script');
    expect(scriptInfo).toMatchObject({ status: 'done', message: SUMMARY.message, error: null });
  });

  it('refuses a stage that cannot run yet, with the reasons', async () => {
    const { service } = await harness({}, { brief: false });
    const refused = await service.run(['script']);
    expect(refused.status).toBe('error');
    expect(refused.message).toContain('brief.json is missing');
    expect(await service.run(['voiceover'])).toMatchObject({
      status: 'error',
      message: 'Voiceover cannot be started from here.',
    });
    expect(await service.run(['export'])).toMatchObject({ status: 'error' });
  });

  it('keeps stages that read the script waiting for its approval', async () => {
    const { service, dir } = await harness({}, { files: { 'script.txt': 'Hello there.' } });
    const refused = await service.run(['words']);
    expect(refused.message).toContain(APPROVAL_REASON);
    const words = (await service.state()).stages.find((info) => info.stage === 'words');
    expect(words?.reasons).toContain(APPROVAL_REASON);
    expect(words?.ready).toBe(false);
    const store = new PipelineStateStore();
    await store.update(dir, (current) => ({
      ...current,
      stages: {
        script: {
          status: 'done',
          updatedAt: new Date().toISOString(),
          approvedAt: new Date().toISOString(),
        },
      },
    }));
    const after = (await service.state()).stages.find((info) => info.stage === 'words');
    expect(after?.reasons).not.toContain(APPROVAL_REASON);
  });

  it('stops the running stage and drops the rest of its group', async () => {
    const script = new Gate();
    const { service, state, pushes } = await harness({
      script: { ...BUILT_IN_STAGES.script, run: gatedRun(script, 'Writing') },
      voiceover: { ...BUILT_IN_STAGES.voiceover, run: () => Promise.resolve(ok(SUMMARY)) },
    });
    await service.enqueue([{ stage: 'script' }, { stage: 'voiceover', source: 'take.wav' }]);
    await script.started;
    expect(service.stop('voiceover')).toBe(true);
    expect((await service.state()).queue).toEqual([]);
    await service.enqueue([{ stage: 'voiceover', source: 'take.wav' }]);
    expect(service.stop('script')).toBe(true);
    await service.whenIdle();
    const stages = (await state()).stages;
    expect(stages['script']?.status).toBe('idle');
    expect(stages['voiceover']?.status).toBe('done');
    await until(() => last(pushes)?.running === null);
    expect(last(pushes)?.stages.find((info) => info.stage === 'script')?.error).toBeNull();
    expect(service.stop('script')).toBe(false);
  });

  it('keeps the failure with its issues for "Show details"', async () => {
    const { service, pushes } = await harness({
      script: {
        ...BUILT_IN_STAGES.script,
        run: () =>
          Promise.resolve(err(stageError('validation', 'script.txt is invalid', ['too short']))),
      },
    });
    await service.run(['script']);
    await service.whenIdle();
    await until(
      () => last(pushes)?.stages.find((info) => info.stage === 'script')?.status === 'failed',
    );
    expect(last(pushes)?.stages.find((info) => info.stage === 'script')?.error).toEqual({
      kind: 'validation',
      message: 'script.txt is invalid',
      issues: ['too short'],
    });
  });

  it('marks stages a crash left running or paused as interrupted', async () => {
    const stamp = '2026-10-02T08:00:00.000Z';
    const pipeline: PipelineState = {
      version: 1,
      updatedAt: stamp,
      stages: {
        script: { status: 'running', updatedAt: stamp, approvedAt: stamp },
        storyboard: { status: 'paused', updatedAt: stamp, message: 'limit' },
        words: { status: 'done', updatedAt: stamp },
      },
      queue: [],
    };
    const dir = projects.create();
    mkdirSync(path.join(dir, '.reelforge'));
    writeFileSync(path.join(dir, '.reelforge', 'pipeline.json'), JSON.stringify(pipeline));
    const store = new PipelineStateStore();
    const guard = new LimitGuard();
    cleanups.push(() => {
      guard.dispose();
    });
    const service = new StageService({
      createRunner: (projectDir) => new StageRunner({ projectDir, store, autocommit: false }),
      store,
      guard,
      push: () => undefined,
      log: createLogger(() => undefined),
      pushDelayMs: 0,
    });
    cleanups.push(() => service.dispose());
    await service.follow(dir);
    const infos = (await service.state()).stages;
    expect(infos.find((info) => info.stage === 'script')).toMatchObject({
      status: 'failed',
      interrupted: true,
      message: INTERRUPTED_MESSAGE,
    });
    expect(infos.find((info) => info.stage === 'storyboard')).toMatchObject({
      status: 'failed',
      interrupted: true,
      message: INTERRUPTED_PAUSE_MESSAGE,
    });
    expect(infos.find((info) => info.stage === 'words')).toMatchObject({
      status: 'done',
      interrupted: false,
    });
    const saved = JSON.parse(
      readFileSync(path.join(dir, '.reelforge', 'pipeline.json'), 'utf8'),
    ) as PipelineState;
    expect(saved.stages['script']).toMatchObject({ interrupted: true, approvedAt: stamp });
  });

  it('shows a usage-limit pause (shared guard) and continues after "Try now"', async () => {
    const turns: ClaudeTurnResult[] = [
      { ...COMPLETED, status: 'limit', message: 'usage limit reached', limit: undefined },
      COMPLETED,
    ];
    const claude: ClaudeRunner = {
      run: () => Promise.resolve(turns.shift() ?? COMPLETED),
    };
    const { service, guard, pushes, state } = await harness(
      {
        script: {
          ...BUILT_IN_STAGES.script,
          run: async (ctx) => {
            const turn = await ctx.claude({
              prompt: 'research',
              text: 'Research the topic.',
              purpose: 'script',
              newSession: true,
              label: 'research',
            });
            return turn.ok ? ok(SUMMARY) : turn;
          },
        },
      },
      { claude },
    );
    await service.run(['script']);
    await until(() => last(pushes)?.running?.paused != null);
    expect(guard.paused).toBe(true);
    expect(last(pushes)?.pause).toMatchObject({ reason: 'limit' });
    expect(last(pushes)?.running?.paused?.until).toEqual(expect.any(Number));
    expect((await state()).stages['script']?.status).toBe('paused');

    guard.resume();
    await service.whenIdle();
    expect((await state()).stages['script']?.status).toBe('done');
    await until(() => last(pushes)?.pause === null && last(pushes)?.running === null);
  });

  it('runs "Video exported" on the app export: gating, progress, persisted status, output', async () => {
    const files = {
      'storyboard.json': '{}',
      'scenes/s01.js': 'export {}',
      'audio/mix.wav': 'RIFF',
    };
    let release: () => void = () => undefined;
    const exportRun: StageServiceOptions['exportRun'] = {
      start: async (listener) => {
        listener({
          type: 'plan',
          shots: 1,
          cachedShots: 0,
          totalFrames: 60,
          framesToRender: 60,
          workers: 1,
          encoder: 'libx264',
          resumed: false,
        });
        listener({
          type: 'frame',
          shotId: 's01',
          frameInShot: 30,
          shotFrames: 60,
          renderedFrames: 30,
          framesToRender: 60,
          fps: 30,
          etaS: 1,
        });
        await new Promise<void>((resolve) => {
          release = resolve;
        });
        return {
          status: 'done',
          output: path.join(dir, 'out', 'Test.mp4'),
          thumbnail: null,
          renderedShots: ['s01'],
          cachedShots: [],
          totalFrames: 60,
          durationS: 2,
          width: 1920,
          height: 1080,
          encoder: 'libx264',
          gpu: null,
          resumed: false,
          wallMs: 10,
        };
      },
      cancel: () => undefined,
    };
    const { service, pushes, state, dir } = await harness({}, { files, exportRun });
    expect((await service.run(['export'])).message).toContain(APPROVAL_REASON);
    await approve(dir);
    const outcomes: RunOutcome[] = [];
    const views: number[] = [];
    expect(
      await service.enqueue([{ stage: 'export' }], {
        onView: (view) => views.push(view.percent ?? -1),
        onDone: (outcome) => outcomes.push(outcome),
      }),
    ).toMatchObject({ status: 'queued' });
    await until(() => last(pushes)?.running?.label?.startsWith('Rendering s01') === true);
    expect(last(pushes)?.running).toMatchObject({ stage: 'export', percent: 47.5 });
    expect(views).toEqual([5, 47.5]);
    expect((await state()).stages['export']?.status).toBe('running');
    release();
    await service.whenIdle();
    expect((await state()).stages['export']).toMatchObject({
      status: 'done',
      message: 'out/Test.mp4 (1080p, 2.0 s, libx264)',
    });
    expect(outcomes).toEqual([
      { status: 'done', message: 'out/Test.mp4 (1080p, 2.0 s, libx264)', warnings: [] },
    ]);
  });

  it('a scene run carries its review mode and target shots; shot events show per shot', async () => {
    const gate = new Gate();
    const { service, pushes, dir } = await harness(
      {
        scenes: {
          ...BUILT_IN_STAGES.scenes,
          run: async (ctx) => {
            ctx.shot('s02', 'started');
            ctx.shot('s02', 'finished', 'warning');
            const outcome = await gate.wait(ctx.signal);
            return outcome === 'aborted' ? err(stageError('cancelled', 'cancelled')) : ok(SUMMARY);
          },
        },
      },
      { files: { 'storyboard.json': '{}' } },
    );
    await approve(dir);
    expect(
      await service.enqueue([{ stage: 'scenes', action: 'sync-check', shots: ['s02'] }]),
    ).toMatchObject({ status: 'queued' });
    await gate.started;
    await until(() => last(pushes)?.running?.shots['s02'] === 'warning');
    expect(last(pushes)?.running).toMatchObject({ action: 'sync-check', targets: ['s02'] });
    expect(service.stop('scenes')).toBe(true);
    await service.whenIdle();
  });
});
