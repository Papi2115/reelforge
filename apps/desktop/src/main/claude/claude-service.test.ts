import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  err,
  ok,
  type Clock,
  type ExtraEnv,
  type TurnLifecycleEvent,
} from '@reelforge/claude-bridge';
import { fakeClaudeEnv, fakeClaudeLauncher, type FakeClaudeScript } from '@reelforge/fake-claude';
import { defaultAppSettings, type AppSettings } from '@reelforge/shared';
import { afterEach, describe, expect, it } from 'vitest';
import type { ChatSendRequest, ChatState } from '../../shared/chat-contract.js';
import { createLogger } from '../logger.js';
import { ClaudeService, type ClaudeServiceOptions } from './claude-service.js';
import { chatExtraEnv } from './turn-outcome.js';

class ManualClock implements Clock {
  private time: number;
  private timers: { at: number; callback: () => void }[] = [];
  constructor(start: number) {
    this.time = start;
  }
  now(): number {
    return this.time;
  }
  setTimer(callback: () => void, delayMs: number): () => void {
    const timer = { at: this.time + delayMs, callback };
    this.timers.push(timer);
    return () => {
      this.timers = this.timers.filter((candidate) => candidate !== timer);
    };
  }
  advanceTo(time: number): void {
    this.time = time;
    const due = this.timers.filter((timer) => timer.at <= time);
    this.timers = this.timers.filter((timer) => timer.at > time);
    for (const timer of due) timer.callback();
  }
}

const temps: string[] = [];
const services: ClaudeService[] = [];

afterEach(async () => {
  for (const service of services.splice(0)) await service.dispose();
  for (const dir of temps.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function tempDir(prefix: string): string {
  const dir = mkdtempSync(path.join(os.tmpdir(), prefix));
  temps.push(dir);
  return dir;
}

function parentEnv(vars: Record<string, string>): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (!key.toUpperCase().startsWith('FAKE_CLAUDE_')) env[key] = value;
  }
  return { ...env, ...vars };
}

function scriptFile(script: FakeClaudeScript): string {
  const file = path.join(tempDir('rf chat script '), 'script.json');
  writeFileSync(file, JSON.stringify(script), 'utf8');
  return file;
}

interface Harness {
  readonly service: ClaudeService;
  readonly project: string;
  readonly commits: string[];
  readonly pushes: ChatState[];
}

function harness(
  vars: Record<string, string>,
  overrides: Partial<ClaudeServiceOptions> = {},
  settings: AppSettings = defaultAppSettings(),
): Harness {
  const project = tempDir('rf chat project ż ');
  const commits: string[] = [];
  const pushes: ChatState[] = [];
  const service = new ClaudeService({
    setup: () =>
      Promise.resolve(
        ok({ launcher: fakeClaudeLauncher(), env: parentEnv(vars), permissions: {} }),
      ),
    settings: () => settings,
    currentProject: () => project,
    renderEnv: () => undefined,
    commit: (_dir, message) => {
      commits.push(message);
      return Promise.resolve(ok({ status: 'committed', hash: `h${String(commits.length)}` }));
    },
    push: (state) => pushes.push(state),
    log: createLogger(() => undefined),
    pushDelayMs: 5,
    exitGraceMs: 2_000,
    ...overrides,
  });
  services.push(service);
  return { service, project, commits, pushes };
}

function message(text: string, patch: Partial<ChatSendRequest> = {}): ChatSendRequest {
  return { text, chip: null, scope: 'video', shotIds: [], selection: null, boost: false, ...patch };
}

async function until(check: () => boolean, timeoutMs = 15_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!check()) {
    if (Date.now() > deadline) throw new Error('timed out waiting');
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}

function idle(service: ClaudeService): boolean {
  const state = service.state();
  return state.running === null && state.queue.length === 0;
}

interface Probe {
  readonly argv: string[];
  readonly stdin: string;
  readonly claudeEnvKeys: string[];
}

function probeOf(events: readonly TurnLifecycleEvent[]): Probe {
  for (const event of events) {
    if (event.type !== 'stream' || event.event.kind !== 'unknown') continue;
    if (event.event.type === 'fake_probe') return event.event.raw as unknown as Probe;
  }
  throw new Error('no fake_probe event');
}

describe('ClaudeService queue', () => {
  it('runs messages one at a time in FIFO order; queued ones can be removed', async () => {
    const { service } = harness(fakeClaudeEnv({ scenario: 'slow', slowTicks: 4, delayMs: 60 }));
    const sent = [];
    for (const text of ['first', 'second', 'third', 'fourth'])
      sent.push(await service.send(message(text)));
    expect(sent.every((result) => result.status === 'queued')).toBe(true);
    const fourth = sent[3]?.status === 'queued' ? sent[3].turnId : '';
    expect(service.state().queue.map((turn) => turn.request.text)).toEqual([
      'second',
      'third',
      'fourth',
    ]);
    expect(service.remove(fourth)).toBe(true);
    expect(service.remove(fourth)).toBe(false);
    await until(() => idle(service));
    const turns = service.state().turns;
    expect(turns.map((turn) => [turn.request.text, turn.status])).toEqual([
      ['first', 'done'],
      ['second', 'done'],
      ['third', 'done'],
    ]);
    for (const [index, turn] of turns.entries()) {
      const next = turns[index + 1];
      if (next) expect(next.startedAt ?? 0).toBeGreaterThanOrEqual(turn.finishedAt ?? Infinity);
    }
    expect(turns[0]?.usage?.outputTokens).toBeGreaterThan(0);
  });

  it('lets the pipeline run two Claude turns at once (scene building), chat stays FIFO', () => {
    expect(harness({}).service.guard.concurrency).toBe(2);
    expect(harness({}, { maxConcurrency: 3 }).service.guard.concurrency).toBe(3);
  });

  it('runs a Whole-video chip as a review mode of the scene stage, with its steps', async () => {
    const modes: string[] = [];
    let finish: (() => void) | undefined;
    let stops = 0;
    const { service } = harness(
      {},
      {
        review: {
          run: (mode, observer) => {
            modes.push(mode);
            observer.onView({
              stage: 'scenes',
              label: 'Review: triage',
              percent: 40,
              startedAt: 0,
              steps: [{ type: 'text', id: 't0-a', text: 'Looking at the sheets.' }],
              paused: null,
              action: mode,
              targets: null,
              shots: {},
            });
            finish = () => {
              observer.onDone({
                status: 'done',
                message: 'Review: 1 shot flagged, 1 fixed',
                warnings: [],
              });
            };
            return Promise.resolve({ status: 'queued', message: null });
          },
          stop: () => {
            stops += 1;
            return true;
          },
        },
      },
    );
    const sent = await service.send(message('', { chip: 'visuals-on-words' }));
    expect(sent.status).toBe('queued');
    expect(modes).toEqual(['sync-check']);
    const running = service.state();
    expect(running.running).toBe(running.turns[0]?.id);
    expect(running.turns[0]?.steps.map((step) => (step.type === 'text' ? step.text : ''))).toEqual([
      'Looking at the sheets.',
      'Review: triage (40 %)',
    ]);
    expect(await service.stop()).toBe(true);
    expect(stops).toBe(1);
    finish?.();
    const done = service.state();
    expect(done.running).toBeNull();
    expect(done.turns[0]).toMatchObject({ status: 'done', request: { chip: 'visuals-on-words' } });
    expect(done.turns[0]?.steps.at(-1)).toEqual({
      type: 'text',
      id: 'review-result',
      text: 'Review: 1 shot flagged, 1 fixed',
    });
  });

  it('a chip whose review cannot start reports why and leaves no turn behind', async () => {
    const { service } = harness(
      {},
      {
        review: {
          run: () =>
            Promise.resolve({
              status: 'error',
              message: 'Scenes built is already running or queued.',
            }),
          stop: () => false,
        },
      },
    );
    expect(await service.send(message('', { chip: 'review-video' }))).toEqual({
      status: 'error',
      error: { kind: 'invalid-request', message: 'Scenes built is already running or queued.' },
    });
    expect(service.state().turns).toEqual([]);
  });

  it('refuses Selection without a picked object and messages without a project', async () => {
    const { service } = harness({});
    const result = await service.send(message('bigger', { scope: 'selection' }));
    expect(result).toMatchObject({ status: 'error', error: { kind: 'invalid-request' } });
    const none = harness({}, { currentProject: () => undefined });
    expect(await none.service.send(message('x'))).toMatchObject({
      status: 'error',
      error: { kind: 'no-project' },
    });
  });

  it('fails the turn with a notice when Claude is not connected, then recovers', async () => {
    let connected = false;
    const vars = fakeClaudeEnv({ scenario: 'ok' });
    const { service } = harness(vars, {
      setup: () =>
        Promise.resolve(
          connected
            ? ok({ launcher: fakeClaudeLauncher(), env: parentEnv(vars), permissions: {} })
            : err({ kind: 'not-connected', message: 'claude is not installed' }),
        ),
    });
    await service.send(message('hello'));
    await until(() => idle(service));
    expect(service.state().turns[0]).toMatchObject({
      status: 'failed',
      error: { kind: 'not-connected' },
    });
    expect(service.state().notice?.kind).toBe('not-connected');
    connected = true;
    await service.send(message('again'));
    await until(() => service.state().turns[1]?.status === 'done');
    expect(service.state().notice).toBeNull();
  });
});

function lockShots(project: string, ids: readonly string[]): void {
  const shots = ids.map((shotId) => ({ shotId, lockedAt: '2026-10-03T10:00:00.000Z' }));
  writeFileSync(path.join(project, 'locks.json'), JSON.stringify({ version: 1, shots }));
}

describe('ClaudeService and shot locks', () => {
  it('refuses a Shot or Selection message on a locked shot', async () => {
    const { service, project } = harness({});
    lockShots(project, ['s02']);
    expect(await service.send(message('bigger', { scope: 'shot', shotIds: ['s02'] }))).toEqual({
      status: 'error',
      error: { kind: 'invalid-request', message: 'Shot s02 is locked — unlock it to change it.' },
    });
    expect(service.state().turns).toEqual([]);
  });

  it('discards a turn’s change to a locked shot before the commit and says so', async () => {
    const script = scriptFile({
      version: 1,
      default: {
        scenario: 'tools-write',
        reply: 'Polished every shot.',
        writes: [
          { path: 'scenes/s01.js', content: '// s01 v2\n' },
          { path: 'scenes/s02.js', content: '// s02 v2\n' },
        ],
      },
    });
    const { service, project, commits } = harness(fakeClaudeEnv({ script }));
    mkdirSync(path.join(project, 'scenes'));
    writeFileSync(path.join(project, 'scenes', 's02.js'), '// s02 v1\n');
    lockShots(project, ['s02']);
    await service.send(message('polish everything'));
    await until(() => idle(service) && commits.length === 1);
    expect(readFileSync(path.join(project, 'scenes', 's02.js'), 'utf8')).toBe('// s02 v1\n');
    expect(readFileSync(path.join(project, 'scenes', 's01.js'), 'utf8')).toBe('// s01 v2\n');
    expect(service.state().turns[0]?.steps.at(-1)).toEqual({
      type: 'text',
      id: 'locks-0',
      text: '⚠ Claude tried to change locked shot s02; change discarded',
    });
  });
});

describe('ClaudeService turns', () => {
  it('autocommits a turn that wrote files; steps show the Write; push follows', async () => {
    const script = scriptFile({
      version: 1,
      default: {
        scenario: 'tools-write',
        reply: 'Made it bigger.',
        writes: [{ path: 'scenes/s02_calc.js', content: 'export const meta = {};\n' }],
      },
    });
    const { service, project, commits, pushes } = harness(fakeClaudeEnv({ script }));
    await service.send(message('make the calculator bigger\nplease'));
    await until(() => idle(service) && service.state().turns[0]?.commit !== null);
    const [turn] = service.state().turns;
    expect(commits).toEqual(['Claude turn: make the calculator bigger']);
    expect(turn?.commit).toEqual({
      hash: 'h1',
      subject: 'Claude turn: make the calculator bigger',
    });
    const write = turn?.steps.find((step) => step.type === 'tool');
    expect(write).toMatchObject({ name: 'Write', status: 'done' });
    expect(write?.type === 'tool' && write.summary).toBe(path.join('scenes', 's02_calc.js'));
    expect(readFileSync(path.join(project, 'scenes', 's02_calc.js'), 'utf8')).toContain('meta');
    await until(() => pushes.at(-1)?.turns[0]?.commit !== null);
  });

  it('Stop kills the process tree, keeps the partial work and commits it', async () => {
    const pidFile = path.join(tempDir('rf chat pid '), 'child.pid');
    const script = scriptFile({
      version: 1,
      rules: [{ promptIncludes: 'after stop', scenario: 'ok' }],
      default: {
        scenario: 'tools-write',
        delayMs: 1_000,
        writes: [{ path: 'scenes/partial.js', content: 'half done\n' }],
      },
    });
    const { service, project, commits } = harness(fakeClaudeEnv({ script, childPidFile: pidFile }));
    await service.send(message('rewrite everything'));
    await service.send(message('after stop'));
    await until(() => existsSync(pidFile) && service.state().turns[0]?.steps.length === 0);
    const grandchild = Number(readFileSync(pidFile, 'utf8'));
    expect(await service.stop()).toBe(true);
    await until(() => idle(service));
    const [stopped, next] = service.state().turns;
    expect(stopped).toMatchObject({ status: 'stopped', error: null });
    expect(next).toMatchObject({ status: 'done' });
    expect(commits[0]).toBe('Claude turn (stopped): rewrite everything');
    expect(readFileSync(path.join(project, 'scenes', 'partial.js'), 'utf8')).toBe('half done\n');
    await until(() => !alive(grandchild), 5_000);
    expect(await service.stop()).toBe(false);
  });

  it('pauses on a usage limit, shows the reset time, re-runs the message after it', async () => {
    const resetsAt = 1_900_000_000;
    const clock = new ManualClock((resetsAt - 3_600) * 1000);
    const script = scriptFile({
      version: 1,
      sequence: [
        { scenario: 'rate-limit', resetsAt },
        { scenario: 'ok', reply: 'Back.' },
      ],
    });
    const { service } = harness(fakeClaudeEnv({ script }), { clock });
    await service.send(message('make it red'));
    await until(() => service.state().pause !== null && service.state().queue.length === 1);
    const paused = service.state();
    expect(paused.pause).toEqual({
      reason: 'limit',
      until: resetsAt * 1000 + 60_000,
      message: expect.stringMatching(/limit/i) as string,
    });
    expect(paused.turns[0]).toMatchObject({ status: 'failed', error: { kind: 'limit' } });
    expect(paused.queue[0]?.request.text).toBe('make it red');
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(service.state().running).toBeNull();
    clock.advanceTo(resetsAt * 1000 + 60_000);
    await until(() => idle(service) && service.state().turns.length === 2);
    expect(service.state().pause).toBeNull();
    expect(service.state().turns[1]).toMatchObject({ status: 'done' });
  });

  it('gives the child only the render vars; no billing vars; boost model', async () => {
    const leaky = {
      REELFORGE_RENDER_URL: 'http://127.0.0.1:9',
      REELFORGE_RENDER_TOKEN: 'token',
      ANTHROPIC_API_KEY: 'sk-test',
    } as unknown as ExtraEnv;
    expect(chatExtraEnv(leaky)).toEqual({
      REELFORGE_RENDER_URL: 'http://127.0.0.1:9',
      REELFORGE_RENDER_TOKEN: 'token',
    });
    const { service } = harness(
      {
        ...fakeClaudeEnv({ scenario: 'ok', probe: true }),
        ANTHROPIC_API_KEY: 'sk-parent',
        CLAUDE_CODE_USE_BEDROCK: '1',
      },
      { renderEnv: () => leaky },
    );
    await service.send(message('warm up'));
    await until(() => idle(service));
    const events: TurnLifecycleEvent[] = [];
    service.sessions?.on('turn', (event) => events.push(event));
    await service.send(message('think hard', { boost: true }));
    await until(() => idle(service) && service.state().turns.length === 2);
    const turn = service.state().turns[1];
    expect(turn).toMatchObject({ status: 'done', request: { model: 'opus' } });
    const probe = probeOf(events);
    expect(probe.claudeEnvKeys).toEqual([]);
    expect(probe.argv[probe.argv.indexOf('--model') + 1]).toBe('opus');
    expect(probe.argv[probe.argv.indexOf('--permission-mode') + 1]).toBe('dontAsk');
    expect(probe.stdin).toContain('Scope: Whole video');
    expect(probe.stdin).toContain('Request: think hard');
  });
});

function alive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}
