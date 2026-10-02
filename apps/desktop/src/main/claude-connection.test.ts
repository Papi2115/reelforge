import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  checkConnection,
  err,
  ok,
  type ClaudeLauncher,
  type ConnectionState,
  type LoginAction,
} from '@reelforge/claude-bridge';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  CLAUDE_STATUS_TTL_MS,
  ClaudeConnectionService,
  detectionEnv,
  toClaudeStatus,
} from './claude-connection.js';
import { createLogger } from './logger.js';

/** tools/fake-claude: answers `--version` and `auth status` like the real CLI (no model call). */
const fakeClaude: ClaudeLauncher = {
  command: process.execPath,
  args: [
    path.resolve(
      import.meta.dirname,
      '..',
      '..',
      '..',
      '..',
      'tools',
      'fake-claude',
      'bin',
      'fake-claude.mjs',
    ),
  ],
};

function fakeEnv(vars: Record<string, string>): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (!key.toUpperCase().startsWith('FAKE_CLAUDE_')) env[key] = value;
  }
  return { ...env, ...vars };
}

let emptyDir: string;
beforeEach(async () => {
  emptyDir = await mkdtemp(path.join(tmpdir(), 'reelforge no claude '));
});
afterEach(async () => {
  await rm(emptyDir, { recursive: true, force: true });
});

interface Harness {
  readonly service: ClaudeConnectionService;
  readonly opened: LoginAction[];
  readonly checks: () => number;
  readonly advance: (ms: number) => void;
}

function harness(check: () => Promise<ConnectionState>, openResult: 'ok' | 'fail' = 'ok'): Harness {
  let now = 1_000;
  let checks = 0;
  const opened: LoginAction[] = [];
  const service = new ClaudeConnectionService({
    check: () => {
      checks += 1;
      return check();
    },
    openTerminal: (action) => {
      opened.push(action);
      return Promise.resolve(openResult === 'ok' ? ok(undefined) : err('no console'));
    },
    log: createLogger(() => undefined),
    now: () => now,
  });
  return {
    service,
    opened,
    checks: () => checks,
    advance: (ms) => {
      now += ms;
    },
  };
}

describe('ClaudeConnectionService with fake detection', () => {
  it('not installed: shows the install command, no login terminal', async () => {
    const { service, opened } = harness(() =>
      checkConnection({ env: detectionEnv(process.env, emptyDir) }),
    );
    const status = await service.status(true);
    expect(status).toEqual({
      state: 'not-installed',
      installCommand: 'npm install -g @anthropic-ai/claude-code',
      searchedDirs: expect.any(Number) as number,
    });
    expect(await service.openLogin()).toMatchObject({ status: 'error' });
    expect(opened).toEqual([]);
  });

  it('not logged in: opens the login terminal with the detected CLI', async () => {
    const { service, opened } = harness(() =>
      checkConnection({ launcher: fakeClaude, env: fakeEnv({ FAKE_CLAUDE_AUTH: 'logged-out' }) }),
    );
    expect(await service.status(true)).toEqual({
      state: 'not-logged-in',
      version: '2.1.287',
      loginCommand: 'claude auth login',
    });
    expect(await service.openLogin()).toEqual({ status: 'opened', command: 'claude auth login' });
    expect(opened).toEqual([
      {
        kind: 'open-terminal',
        command: fakeClaude.command,
        args: [...fakeClaude.args, 'auth', 'login'],
        display: 'claude auth login',
      },
    ]);
  });

  it('logged in: connected with version and non-identifying auth fields only', async () => {
    const { service } = harness(() => checkConnection({ launcher: fakeClaude, env: fakeEnv({}) }));
    const status = await service.status(true);
    expect(status).toEqual({
      state: 'connected',
      version: '2.1.287',
      aboveTested: false,
      authMethod: 'claude.ai',
      subscriptionType: 'max',
    });
    expect(JSON.stringify(status)).not.toMatch(/@|example\.invalid|org/i);
    expect(await service.openLogin()).toEqual({
      status: 'error',
      message: 'Claude Code is already logged in',
    });
  });

  it('errors (outdated CLI, thrown check) become an error status', async () => {
    const outdated = harness(() =>
      checkConnection({ launcher: fakeClaude, env: fakeEnv({ FAKE_CLAUDE_VERSION: '1.0.0' }) }),
    );
    expect(await outdated.service.status(true)).toMatchObject({
      state: 'error',
      reason: 'outdated',
    });
    const thrown = harness(() => Promise.reject(new Error('boom')));
    expect(await thrown.service.status(true)).toEqual({
      state: 'error',
      reason: 'spawn',
      message: 'boom',
    });
  });

  it('caches results for focus re-checks and shares concurrent checks', async () => {
    const state: ConnectionState = {
      state: 'not-installed',
      installHint: 'npm install -g @anthropic-ai/claude-code',
      searched: [],
    };
    const { service, checks, advance } = harness(() => Promise.resolve(state));
    await Promise.all([service.status(false), service.status(false)]);
    expect(checks()).toBe(1);
    advance(CLAUDE_STATUS_TTL_MS - 1);
    await service.status(false);
    expect(checks()).toBe(1);
    advance(2);
    await service.status(false);
    expect(checks()).toBe(2);
    await service.status(true);
    expect(checks()).toBe(3);
  });

  it('reports a failing terminal', async () => {
    const { service } = harness(
      () =>
        Promise.resolve({
          state: 'not-logged-in',
          version: '2.1.287',
          loginAction: {
            kind: 'open-terminal',
            command: 'C:\\claude.exe',
            args: ['auth', 'login'],
            display: 'claude auth login',
          },
        }),
      'fail',
    );
    expect(await service.openLogin()).toEqual({ status: 'error', message: 'no console' });
  });
});

describe('toClaudeStatus / detectionEnv', () => {
  it('maps every connection state', () => {
    expect(
      toClaudeStatus({
        state: 'error',
        reason: 'api-key-source',
        message: 'would bill an API key',
      }),
    ).toEqual({ state: 'error', reason: 'api-key-source', message: 'would bill an API key' });
    expect(
      toClaudeStatus({
        state: 'ok',
        version: '2.2.0',
        aboveTested: true,
        launcher: { command: 'claude', args: [] },
        authMethod: undefined,
        subscriptionType: undefined,
      }),
    ).toEqual({
      state: 'connected',
      version: '2.2.0',
      aboveTested: true,
      authMethod: null,
      subscriptionType: null,
    });
  });

  it('points every claude search location at the hook folder', () => {
    const env = detectionEnv(
      { Path: 'C:\\bin', APPDATA: 'C:\\a', USERPROFILE: 'C:\\u', X: '1' },
      emptyDir,
    );
    expect(env).toEqual({
      X: '1',
      PATH: emptyDir,
      APPDATA: emptyDir,
      USERPROFILE: emptyDir,
      HOME: emptyDir,
    });
    const untouched = { PATH: 'C:\\bin' };
    expect(detectionEnv(untouched, undefined)).toBe(untouched);
  });
});
