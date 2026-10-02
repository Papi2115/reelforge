import { readFileSync } from 'node:fs';
import path from 'node:path';
import { sessionsFileSchema } from '@reelforge/shared';
import { afterEach, describe, expect, it } from 'vitest';
import { checkConnection } from './detect.js';
import { SessionManager } from './session-manager.js';
import { sessionsFilePath } from './session-store.js';
import { isProcessAlive, waitFor } from './testing/fake-claude.js';
import { Harness, drain, flagValue, probeOf } from './testing/manager-harness.js';

const harness = new Harness();
afterEach(async () => {
  await harness.dispose();
});

const readSessions = (projectDir: string): ReturnType<typeof sessionsFileSchema.parse> =>
  sessionsFileSchema.parse(JSON.parse(readFileSync(sessionsFilePath(projectDir), 'utf8')));

describe('SessionManager: turns on fake-claude', () => {
  it('runs a turn in the project folder, streams events, persists the session id', async () => {
    const { manager, lifecycle } = harness.manager({ FAKE_CLAUDE_PROBE: '1' });
    const projectDir = harness.project();
    const { events, outcome } = await drain(
      manager.enqueue({ projectDir, stage: 'chat', prompt: 'héllo "world"\nline 2' }),
    );
    expect(outcome.status).toBe('completed');
    expect(outcome.view.text).toBe('ok');
    expect(outcome.result?.isError).toBe(false);
    const probe = probeOf(events);
    expect(probe.cwd).toBe(projectDir);
    expect(probe.stdin).toBe('héllo "world"\nline 2');
    expect(flagValue(probe.argv, '--model')).toBe('sonnet');
    expect(flagValue(probe.argv, '--resume')).toBeUndefined();
    expect(probe.argv).not.toContain('--bare');
    const file = readSessions(projectDir);
    expect(file.sessions.main?.sessionId).toBe(outcome.sessionId);
    expect(file.sessions.main?.pendingTurn).toBeUndefined();
    expect(lifecycle.map((event) => event.type).filter((type) => type !== 'stream')).toEqual([
      'queued',
      'started',
      'finished',
    ]);
  });

  it('resumes the stored session on the next turn (same session id, --resume passed)', async () => {
    const stateDir = harness.temps.make('rf fake state ');
    const vars = {
      FAKE_CLAUDE_PROBE: '1',
      FAKE_CLAUDE_SCENARIO: 'resume',
      FAKE_CLAUDE_STATE_DIR: stateDir,
    };
    const { manager } = harness.manager(vars);
    const projectDir = harness.project();
    const first = await drain(
      manager.enqueue({ projectDir, stage: 'chat', prompt: 'Remember PELICAN-42' }),
    );
    const second = await drain(manager.enqueue({ projectDir, stage: 'chat', prompt: 'Codeword?' }));
    expect(flagValue(probeOf(second.events).argv, '--resume')).toBe(first.outcome.sessionId);
    expect(second.outcome.sessionId).toBe(first.outcome.sessionId);
    expect(second.outcome.view.text).toMatch(/PELICAN-42/);
    const fresh = await drain(
      manager.enqueue({ projectDir, stage: 'chat', prompt: 'new', newSession: true }),
    );
    expect(flagValue(probeOf(fresh.events).argv, '--resume')).toBeUndefined();
    expect(fresh.outcome.sessionId).not.toBe(first.outcome.sessionId);
  });

  it('keeps side sessions (script/QA) separate and picks the model per stage', async () => {
    const { manager } = harness.manager(
      { FAKE_CLAUDE_PROBE: '1' },
      { models: { critic: 'sonnet' } },
    );
    const projectDir = harness.project();
    const main = await drain(manager.enqueue({ projectDir, stage: 'scene-build', prompt: 'a' }));
    const qa = await drain(
      manager.enqueue({ projectDir, stage: 'critic', purpose: 'qa', prompt: 'b' }),
    );
    const script = await drain(
      manager.enqueue({
        projectDir,
        stage: 'script',
        purpose: 'script',
        prompt: 'c',
        model: 'haiku',
      }),
    );
    expect(flagValue(probeOf(main.events).argv, '--model')).toBe('opus');
    expect(flagValue(probeOf(qa.events).argv, '--model')).toBe('sonnet');
    expect(flagValue(probeOf(script.events).argv, '--model')).toBe('haiku');
    const sessions = readSessions(projectDir).sessions;
    const ids = [sessions.main?.sessionId, sessions.qa?.sessionId, sessions.script?.sessionId];
    expect(new Set(ids).size).toBe(3);
    expect(sessions.qa?.model).toBe('sonnet');
  });

  it('never leaks billing env vars into the child (fake-claude echoes env names)', async () => {
    const dirty = {
      ANTHROPIC_API_KEY: 'fake-key',
      ANTHROPIC_AUTH_TOKEN: 'fake-token',
      ANTHROPIC_BASE_URL: 'http://127.0.0.1:9',
      CLAUDE_CODE_USE_BEDROCK: '1',
      CLAUDE_CODE_USE_VERTEX: '1',
      CLAUDE_CODE_OAUTH_TOKEN: 'fake-oauth',
      CLAUDECODE: '1',
      CLAUDE_CODE_ENTRYPOINT: 'cli',
    };
    const { manager } = harness.manager({ ...dirty, FAKE_CLAUDE_PROBE: '1' });
    const { events, outcome } = await drain(
      manager.enqueue({ projectDir: harness.project(), stage: 'chat', prompt: 'x' }),
    );
    // Not sanitized -> fake reports apiKeySource=ANTHROPIC_API_KEY -> billing guard would trip.
    expect(outcome.status).toBe('completed');
    const leaked = probeOf(events).claudeEnvKeys;
    for (const key of Object.keys(dirty)) expect(leaked).not.toContain(key);
    const allowed = [
      'CLAUDE_CODE_GIT_BASH_PATH',
      'CLAUDE_CONFIG_DIR',
      'CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC',
    ];
    for (const key of leaked) expect(allowed).toContain(key.toUpperCase());
  });

  it('asks extraEnv per project; the hook cannot smuggle billing vars in', async () => {
    const asked: string[] = [];
    const { manager } = harness.manager(
      { FAKE_CLAUDE_PROBE: '1' },
      {
        extraEnv: (projectDir) => {
          asked.push(projectDir);
          // Untyped data: the allowlist must drop the key, or the billing guard would trip.
          return { ANTHROPIC_API_KEY: 'fake-key' } as unknown as Record<string, never>;
        },
      },
    );
    const projectDir = harness.project();
    const { events, outcome } = await drain(
      manager.enqueue({ projectDir, stage: 'chat', prompt: 'x' }),
    );
    expect(outcome.status).toBe('completed');
    expect(asked).toEqual([projectDir]);
    expect(probeOf(events).claudeEnvKeys).not.toContain('ANTHROPIC_API_KEY');
  });

  it('aborts the turn when init reports an API key source (billing guard)', async () => {
    const { manager } = harness.manager({ FAKE_CLAUDE_SCENARIO: 'api-key' });
    const projectDir = harness.project();
    const { events, outcome } = await drain(
      manager.enqueue({ projectDir, stage: 'chat', prompt: 'x' }),
    );
    expect(outcome.status).toBe('billing-guard');
    expect(events.some((event) => event.kind === 'result' || event.kind === 'init')).toBe(false);
    expect(readSessions(projectDir).sessions.main?.sessionId).toBeUndefined();
    expect(readSessions(projectDir).sessions.main?.pendingTurn).toBeUndefined();
  });

  it('tolerates garbage lines and passes unknown events through', async () => {
    const { manager } = harness.manager({ FAKE_CLAUDE_SCENARIO: 'garbage' });
    const { events, outcome } = await drain(
      manager.enqueue({ projectDir: harness.project(), stage: 'chat', prompt: 'x' }),
    );
    expect(outcome.status).toBe('completed');
    expect(outcome.view.parseErrors).toBe(2);
    expect(
      events.some((event) => event.kind === 'unknown' && event.type === 'brand_new_event'),
    ).toBe(true);
  });
});

describe('SessionManager: queue, cancellation, watchdogs', () => {
  it('cancel kills the whole process tree (grandchild included)', async () => {
    const pidFile = path.join(harness.temps.make(), 'child.pid');
    const { manager } = harness.manager({
      FAKE_CLAUDE_SCENARIO: 'hang',
      FAKE_CLAUDE_CHILD_PID_FILE: pidFile,
    });
    const handle = manager.enqueue({ projectDir: harness.project(), stage: 'chat', prompt: 'x' });
    const iterator = handle[Symbol.asyncIterator]();
    const first = await iterator.next();
    expect(first.done === true ? undefined : first.value.kind).toBe('init');
    expect(await waitFor(() => readPid(pidFile) !== undefined)).toBe(true);
    const grandchild = readPid(pidFile) ?? -1;
    expect(isProcessAlive(grandchild)).toBe(true);
    await handle.cancel();
    expect((await handle.outcome).status).toBe('cancelled');
    expect(await waitFor(() => !isProcessAlive(grandchild))).toBe(true);
  });

  it('cancels queued turns without spawning them', async () => {
    const { manager, lifecycle } = harness.manager({ FAKE_CLAUDE_SCENARIO: 'hang' });
    const first = manager.enqueue({ projectDir: harness.project(), stage: 'chat', prompt: 'a' });
    const second = manager.enqueue({ projectDir: harness.project(), stage: 'chat', prompt: 'b' });
    await second.cancel();
    expect((await second.outcome).status).toBe('cancelled');
    expect(
      lifecycle.some((event) => event.turnId === second.turnId && event.type === 'started'),
    ).toBe(false);
    await first.cancel();
    expect((await first.outcome).status).toBe('cancelled');
  });

  it('enforces the per-turn timeout and the idle watchdog', async () => {
    const { manager } = harness.manager({
      FAKE_CLAUDE_SCENARIO: 'slow',
      FAKE_CLAUDE_DELAY_MS: '100',
    });
    const slow = manager.enqueue({
      projectDir: harness.project(),
      stage: 'chat',
      prompt: 'x',
      timeoutMs: 600,
    });
    expect((await slow.outcome).status).toBe('timeout');
    const { manager: hanging } = harness.manager({ FAKE_CLAUDE_SCENARIO: 'hang' });
    const idle = hanging.enqueue({
      projectDir: harness.project(),
      stage: 'chat',
      prompt: 'x',
      idleTimeoutMs: 400,
    });
    const outcome = await idle.outcome;
    expect(outcome.status).toBe('idle-timeout');
    expect(outcome.sessionId).toBeDefined();
  });

  it('runs at most `concurrency` turns and serializes turns of one session', async () => {
    const vars = {
      FAKE_CLAUDE_SCENARIO: 'slow',
      FAKE_CLAUDE_DELAY_MS: '40',
      FAKE_CLAUDE_SLOW_TICKS: '3',
    };
    const { manager, lifecycle } = harness.manager(vars, { concurrency: 2 });
    const shared = harness.project();
    const handles = [
      manager.enqueue({ projectDir: shared, stage: 'chat', prompt: '1' }),
      manager.enqueue({ projectDir: shared, stage: 'chat', prompt: '2' }),
      manager.enqueue({ projectDir: harness.project(), stage: 'chat', prompt: '3' }),
      manager.enqueue({ projectDir: harness.project(), stage: 'chat', prompt: '4' }),
    ];
    const outcomes = await Promise.all(handles.map((handle) => handle.outcome));
    await manager.whenIdle();
    expect(outcomes.map((outcome) => outcome.status)).toEqual(Array(4).fill('completed'));
    let running = 0;
    let peak = 0;
    const order: string[] = [];
    for (const event of lifecycle) {
      if (event.type === 'started') running += 1;
      if (event.type === 'finished') running -= 1;
      if (event.type === 'started' || event.type === 'finished')
        order.push(`${event.type}:${event.turnId}`);
      peak = Math.max(peak, running);
    }
    expect(peak).toBeLessThanOrEqual(2);
    const [one, two] = handles;
    expect(order.indexOf(`finished:${one?.turnId ?? ''}`)).toBeLessThan(
      order.indexOf(`started:${two?.turnId ?? ''}`),
    );
  });
});

function readPid(file: string): number | undefined {
  try {
    const pid = Number(readFileSync(file, 'utf8'));
    return Number.isInteger(pid) && pid > 0 ? pid : undefined;
  } catch {
    return undefined; // not written yet
  }
}

describe.runIf(process.env['REELFORGE_REAL_CLAUDE'] === '1')(
  'real CLI smoke (opt-in, 1 haiku call)',
  () => {
    it('runs one trivial haiku turn on the subscription', async () => {
      const connection = await checkConnection();
      if (connection.state !== 'ok') throw new Error(`claude not ready: ${connection.state}`);
      const manager = new SessionManager({ launcher: connection.launcher });
      const projectDir = harness.project();
      const outcome = await manager.enqueue({
        projectDir,
        stage: 'critic',
        model: 'haiku',
        prompt: 'Reply with the single word ok',
      }).outcome;
      await manager.whenIdle();
      expect(outcome.status).toBe('completed');
      expect(outcome.view.text.toLowerCase()).toContain('ok');
    }, 120_000);
  },
);
