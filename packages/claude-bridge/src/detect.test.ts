import { afterEach, describe, expect, it } from 'vitest';
import { checkAuth, checkConnection, detectClaude, INSTALL_HINT } from './detect.js';
import { TempDirs, fakeEnv, fakeLauncher } from './testing/fake-claude.js';

const temps = new TempDirs();
afterEach(() => {
  temps.cleanup();
});

describe('detectClaude (fake-claude)', () => {
  it('finds the CLI and reads its version', async () => {
    const detection = await detectClaude({ launcher: fakeLauncher, env: fakeEnv() });
    expect(detection).toEqual({
      status: 'found',
      launcher: fakeLauncher,
      version: '2.1.287',
      aboveTested: false,
    });
  });

  it('flags versions below the minimum as outdated and above the tested max', async () => {
    const old = await detectClaude({
      launcher: fakeLauncher,
      env: fakeEnv({ FAKE_CLAUDE_VERSION: '2.0.1' }),
    });
    expect(old).toMatchObject({ status: 'outdated', version: '2.0.1', installHint: INSTALL_HINT });
    const newer = await detectClaude({
      launcher: fakeLauncher,
      env: fakeEnv({ FAKE_CLAUDE_VERSION: '3.0.0' }),
    });
    expect(newer).toMatchObject({ status: 'found', aboveTested: true });
  });

  it('reports not-installed with the searched dirs and an install hint', async () => {
    const dir = temps.make();
    const detection = await detectClaude({
      env: { PATH: dir, USERPROFILE: dir, HOME: dir },
    });
    expect(detection).toMatchObject({ status: 'not-installed', installHint: INSTALL_HINT });
    expect(detection.status === 'not-installed' && detection.searched).toContain(dir);
  });

  it('never spawns a .cmd shim', async () => {
    const detection = await detectClaude({
      launcher: { command: 'C:\\npm\\claude.cmd', args: [] },
    });
    expect(detection.status).toBe('error');
  });
});

describe('checkAuth (fake-claude)', () => {
  it('logged in: keeps only non-identifying fields (no e-mail, no org)', async () => {
    const auth = await checkAuth(fakeLauncher, { env: fakeEnv() });
    expect(auth).toEqual({
      status: 'logged-in',
      authMethod: 'claude.ai',
      subscriptionType: 'max',
      apiProvider: 'firstParty',
    });
    expect(JSON.stringify(auth)).not.toMatch(/example\.invalid|Organization|orgId/);
  });

  it('not logged in: returns a terminal action, no credential handling', async () => {
    const auth = await checkAuth(fakeLauncher, {
      env: fakeEnv({ FAKE_CLAUDE_AUTH: 'logged-out' }),
    });
    expect(auth).toEqual({
      status: 'not-logged-in',
      loginAction: {
        kind: 'open-terminal',
        command: fakeLauncher.command,
        args: [...fakeLauncher.args, 'auth', 'login'],
        display: 'claude auth login',
      },
    });
  });

  it('an ANTHROPIC_API_KEY in the parent env never reaches the probe', async () => {
    const auth = await checkAuth(fakeLauncher, {
      env: fakeEnv({ ANTHROPIC_API_KEY: 'fake-key-for-test' }),
    });
    expect(auth.status).toBe('logged-in');
  });
});

describe('checkConnection (fake-claude)', () => {
  it('ok / not-logged-in / outdated / not-installed', async () => {
    expect(await checkConnection({ launcher: fakeLauncher, env: fakeEnv() })).toMatchObject({
      state: 'ok',
      version: '2.1.287',
      subscriptionType: 'max',
    });
    expect(
      await checkConnection({
        launcher: fakeLauncher,
        env: fakeEnv({ FAKE_CLAUDE_AUTH: 'logged-out' }),
      }),
    ).toMatchObject({ state: 'not-logged-in', version: '2.1.287' });
    expect(
      await checkConnection({
        launcher: fakeLauncher,
        env: fakeEnv({ FAKE_CLAUDE_VERSION: '1.0.0' }),
      }),
    ).toMatchObject({ state: 'error', reason: 'outdated' });
    const dir = temps.make();
    expect(
      await checkConnection({ env: { PATH: dir, USERPROFILE: dir, HOME: dir } }),
    ).toMatchObject({
      state: 'not-installed',
    });
  });
});
