import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { ok, type Result } from '@reelforge/claude-bridge';
import type { ProductionQueue } from '@reelforge/shared';
import {
  QueueRunner,
  QueueStore,
  type ExecutorStep,
  type QueueProjectFactory,
  type QueueStepContext,
  type QueueStepExecutor,
  type QueueStepOutcome,
} from '@reelforge/stages';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { QueueState } from '../../shared/queue-contract.js';
import { createLogger } from '../logger.js';
import type { LineNotice } from './line-notices.js';
import { LinePrefsStore } from './line-prefs.js';
import { QueueService } from './queue-service.js';

vi.setConfig({ testTimeout: 30_000 });

/** Generous under a loaded machine (the whole suite runs in parallel). */
const WAIT = { timeout: 10_000, interval: 20 };

/** A step script: the default answers `done`; `approval` waits until approveScript. */
class FakeExecutor implements QueueStepExecutor {
  readonly approved = new Set<string>();
  readonly ran: string[] = [];
  /** Per step: what it answers (a function sees the context). */
  readonly answers = new Map<ExecutorStep, (ctx: QueueStepContext) => Promise<QueueStepOutcome>>();

  async run(step: ExecutorStep, ctx: QueueStepContext): Promise<QueueStepOutcome> {
    this.ran.push(`${ctx.item.topic}:${step}`);
    const answer = this.answers.get(step);
    if (answer !== undefined) return answer(ctx);
    if (step === 'approval') {
      return this.approved.has(ctx.projectDir)
        ? { kind: 'done', message: 'script approved' }
        : { kind: 'waiting', message: 'Approve the script.' };
    }
    if (step === 'export') {
      ctx.progress('Rendering s01', 40);
      // Long enough for a coalesced push to carry the live line.
      await new Promise((resolve) => setTimeout(resolve, 40));
    }
    return { kind: 'done', message: `${step} done` };
  }

  approveScript(projectDir: string): Promise<Result<void, string>> {
    this.approved.add(projectDir);
    return Promise.resolve(ok(undefined));
  }
}

let root: string;
let executor: FakeExecutor;
let notices: LineNotice[];
let pushed: QueueState[];
let opened: string[];
let services: QueueService[];

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'reelforge line ł-'));
  executor = new FakeExecutor();
  notices = [];
  pushed = [];
  opened = [];
  services = [];
});

afterEach(async () => {
  for (const service of services) await service.dispose();
  await rm(root, { recursive: true, force: true, maxRetries: 5 });
});

const queuesDir = (): string => path.join(root, 'queues');

function makeService(channels: readonly string[] = ['voxplain', 'crime']): QueueService {
  const store = new QueueStore(queuesDir());
  const projects: QueueProjectFactory = {
    create: ({ item }) => Promise.resolve(ok({ projectPath: path.join(root, 'films', item.id) })),
  };
  const log = createLogger(() => undefined);
  const service = new QueueService({
    store,
    createRunner: (hooks) =>
      new QueueRunner({ store, projects, executor, lock: false, pollMs: 50, ...hooks }),
    channelIds: () => Promise.resolve(channels),
    voiceReady: (channelId) => Promise.resolve(channelId === 'voxplain'),
    prefs: new LinePrefsStore(path.join(root, 'production-line.json'), log),
    push: (state) => {
      pushed.push(state);
    },
    notify: (notice) => {
      notices.push(notice);
    },
    openProject: (dir) => {
      opened.push(dir);
      return Promise.resolve({ status: 'cancelled' });
    },
    openPath: () => Promise.resolve(''),
    videoFolder: (dir) => path.join(dir, 'out'),
    log,
    pushDelayMs: 5,
    outsideDelayMs: 5,
  });
  services.push(service);
  return service;
}

async function idle(service: QueueService): Promise<QueueState> {
  await vi.waitFor(async () => {
    expect(service.busy).toBe(false);
    expect((await service.state()).line.lastEnd).not.toBeNull();
  }, WAIT);
  return service.state();
}

function items(state: QueueState, channelId = 'voxplain') {
  return state.channels.find((channel) => channel.channelId === channelId)?.items ?? [];
}

async function queueFile(channelId: string): Promise<ProductionQueue> {
  return JSON.parse(
    await readFile(path.join(queuesDir(), `${channelId}.json`), 'utf8'),
  ) as ProductionQueue;
}

describe('QueueService', () => {
  it('adds English topics with their own length, refuses an unknown channel', async () => {
    const service = makeService();
    await service.init();
    const added = await service.addTopics('voxplain', [
      { topic: 'Why is the sky blue' },
      { topic: 'How magnets work', targetMinutes: 6 },
    ]);
    expect(added).toEqual({ status: 'ok', message: '2 topics added.' });
    const file = await queueFile('voxplain');
    expect(file.items.map((item) => [item.topic, item.language, item.targetMinutes])).toEqual([
      ['Why is the sky blue', 'en', undefined],
      ['How magnets work', 'en', 6],
    ]);
    const state = await service.state();
    expect(state.channels.map((channel) => [channel.channelId, channel.voiceReady])).toEqual([
      ['voxplain', true],
      ['crime', false],
    ]);
    expect(items(state).map((item) => [item.status, item.targetMinutes, item.step])).toEqual([
      ['queued', 8, 'project'],
      ['queued', 6, 'project'],
    ]);
    expect(await service.addTopics('gone', [{ topic: 'x' }])).toEqual({
      status: 'error',
      message: 'This channel does not exist any more.',
    });
  });

  it('scripts every film first, waits for approval, then builds after an approval', async () => {
    const service = makeService();
    await service.init();
    await service.addTopics('voxplain', [{ topic: 'Sky' }, { topic: 'Magnets' }]);
    expect(service.start({ kind: 'idle' }).status).toBe('ok');
    let state = await idle(service);
    expect(items(state).map((item) => item.status)).toEqual(['needs-approval', 'needs-approval']);
    expect(state.line).toMatchObject({ wanted: true, lastEnd: 'idle', activity: 'stopped' });
    expect(state.attention.map((entry) => [entry.kind, entry.topic])).toEqual([
      ['approve-script', 'Sky'],
      ['approve-script', 'Magnets'],
    ]);
    expect(notices.map((notice) => notice.title)).toEqual([
      'Script to approve',
      'Script to approve',
      'Production line waits for you',
    ]);
    expect(notices[0]?.ref).toEqual({ channelId: 'voxplain', itemId: items(state)[0]?.id });

    // Approving restarts the line that ran out of work (it was not stopped by the user).
    const first = items(state)[0];
    if (first === undefined) throw new Error('no item');
    notices.length = 0;
    expect(await service.approveScript({ channelId: 'voxplain', itemId: first.id })).toEqual({
      status: 'ok',
      message: 'Script approved.',
    });
    await vi.waitFor(async () => {
      expect(items(await service.state())[0]?.status).toBe('done');
    }, WAIT);
    state = await idle(service);
    expect(items(state).map((item) => item.status)).toEqual(['done', 'needs-approval']);
    expect(items(state)[0]).toMatchObject({ step: null, stepsDone: 16, stepsTotal: 16 });
    expect(notices.map((notice) => notice.title)).toContain('Film ready');
    expect(executor.ran).toContain('Sky:export');
    expect(executor.ran).not.toContain('Magnets:voiceover');
    // The live line of a running step reached the renderer at least once.
    expect(
      pushed.some((pushedState) =>
        items(pushedState).some((item) => item.live?.label === 'Rendering s01'),
      ),
    ).toBe(true);
  });

  it('a stopped line stays stopped; changes do not restart it', async () => {
    const service = makeService();
    await service.init();
    await service.addTopics('voxplain', [{ topic: 'Sky' }]);
    service.start({ kind: 'idle' });
    await idle(service);
    await service.stop();
    expect((await service.state()).line.wanted).toBe(false);
    const [item] = items(await service.state());
    if (item === undefined) throw new Error('no item');
    await service.approveScript({ channelId: 'voxplain', itemId: item.id });
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(service.busy).toBe(false);
    expect(items(await service.state())[0]?.status).toBe('needs-approval');
  });

  it('surfaces a usage-limit pause with its resume time', async () => {
    const service = makeService();
    await service.init();
    const until = Date.now() + 3_600_000;
    executor.answers.set('brief', () =>
      Promise.resolve({ kind: 'limit', message: 'usage limit', until }),
    );
    await service.addTopics('voxplain', [{ topic: 'Sky' }]);
    service.start({ kind: 'idle' });
    await vi.waitFor(async () => {
      expect((await service.state()).line).toMatchObject({ activity: 'limit', until });
    }, WAIT);
    expect(notices.map((notice) => notice.title)).toContain('Production line paused');
    // The pause is the line's, persisted: it survives a restart of the app.
    const line = JSON.parse(await readFile(path.join(queuesDir(), 'line.json'), 'utf8')) as {
      limitPause?: { until?: string };
    };
    expect(line.limitPause?.until).toBe(new Date(until).toISOString());
    expect(items(await service.state())[0]?.step).toBe('brief');
    await service.stop();
    expect(service.busy).toBe(false);
  });

  it('closing the app aborts the running step; it is pending again, a crash leftover too', async () => {
    const service = makeService();
    await service.init();
    let started = false;
    executor.answers.set(
      'brief',
      ({ signal }) =>
        new Promise((resolve) => {
          started = true;
          if (signal.aborted) resolve({ kind: 'cancelled' });
          signal.addEventListener('abort', () => {
            resolve({ kind: 'cancelled' });
          });
        }),
    );
    await service.addTopics('voxplain', [{ topic: 'Sky' }]);
    service.start({ kind: 'idle' });
    await vi.waitFor(async () => {
      expect((await service.state()).line.current?.step).toBe('brief');
    }, WAIT);
    // The step runs (persisted as running) before the app closes.
    await vi.waitFor(async () => {
      expect(started).toBe(true);
      expect(items(await service.state())[0]?.stepState).toBe('running');
    }, WAIT);
    await service.dispose();
    expect(service.busy).toBe(false);
    const file = await queueFile('voxplain');
    expect(file.items[0]?.stageProgress['brief']).toBeUndefined();
    expect(file.items[0]?.stageProgress['project']?.state).toBe('done');

    // A crash leaves `running` on disk: the next start of the app makes it pending again.
    const crashed = {
      ...file,
      items: file.items.map((item) => ({
        ...item,
        status: 'brief',
        stageProgress: {
          ...item.stageProgress,
          brief: { state: 'running', at: new Date().toISOString() },
        },
      })),
    };
    await mkdir(queuesDir(), { recursive: true });
    await writeFile(path.join(queuesDir(), 'voxplain.json'), JSON.stringify(crashed));
    const next = makeService();
    await next.init();
    const [item] = items(await next.state());
    expect(item).toMatchObject({ step: 'brief', stepState: null, status: 'brief' });
    expect((await queueFile('voxplain')).items[0]?.history.at(-1)?.message).toBe('interrupted');
  });

  it('respects the notification switch and opens a film only once it has a project', async () => {
    const service = makeService();
    await service.init();
    await service.updatePrefs({ notifications: false });
    await service.addTopics('voxplain', [{ topic: 'Sky' }]);
    const [before] = items(await service.state());
    if (before === undefined) throw new Error('no item');
    const ref = { channelId: 'voxplain', itemId: before.id };
    expect(await service.openProject(ref)).toMatchObject({ status: 'error' });
    service.start({ kind: 'idle' });
    await idle(service);
    expect(notices).toEqual([]);
    await service.openProject(ref);
    expect(opened).toEqual([path.join(root, 'films', before.id)]);
    expect((await service.state()).prefs.notifications).toBe(false);
  });

  it('holds, resumes, retries, moves and removes films', async () => {
    const service = makeService();
    await service.init();
    executor.answers.set('brief', ({ item }) =>
      Promise.resolve(
        item.topic === 'Broken'
          ? { kind: 'failed', message: 'the brief did not pass the checks' }
          : { kind: 'done', message: 'brief written' },
      ),
    );
    await service.addTopics('voxplain', [{ topic: 'Broken' }, { topic: 'Sky' }, { topic: 'Held' }]);
    const [broken, sky, held] = items(await service.state());
    if (broken === undefined || sky === undefined || held === undefined) throw new Error('items');
    await service.hold({ channelId: 'voxplain', itemId: held.id });
    service.start({ kind: 'idle' });
    let state = await idle(service);
    expect(items(state).map((item) => item.status)).toEqual(['failed', 'needs-approval', 'paused']);
    expect(items(state)[0]?.message).toBe('the brief did not pass the checks');
    expect(state.attention.map((entry) => entry.kind)).toEqual(['failed', 'approve-script']);
    expect(notices.map((notice) => notice.title)).toContain('Film stopped with a problem');

    executor.answers.delete('brief');
    await service.retry({ channelId: 'voxplain', itemId: broken.id });
    await service.resume({ channelId: 'voxplain', itemId: held.id });
    await vi.waitFor(async () => {
      expect(items(await service.state()).map((item) => item.status)).toEqual([
        'needs-approval',
        'needs-approval',
        'needs-approval',
      ]);
    }, WAIT);
    await idle(service);
    await service.move({ channelId: 'voxplain', itemId: held.id }, 0);
    await service.remove({ channelId: 'voxplain', itemId: sky.id });
    state = await service.state();
    expect(items(state).map((item) => item.topic)).toEqual(['Held', 'Broken']);
  });
});
