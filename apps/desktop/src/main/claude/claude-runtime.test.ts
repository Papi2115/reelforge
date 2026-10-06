import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { ConnectionState } from '@reelforge/claude-bridge';
import type { CliShimOptions } from '@reelforge/cli/shims';
import { afterAll, describe, expect, it } from 'vitest';
import { appLayout, TEST_CLAUDE_LAUNCHER_ENV } from '../app-paths.js';
import { createLogger } from '../logger.js';
import {
  claudeChildEnv,
  claudeSetup,
  cliShimEnv,
  launcherOf,
  prepareShims,
  testLauncher,
} from './claude-runtime.js';

const root = mkdtempSync(path.join(os.tmpdir(), 'rf runtime ż '));
afterAll(() => {
  rmSync(root, { recursive: true, force: true });
});

const CONNECTED: ConnectionState = {
  state: 'ok',
  version: '2.1.287',
  aboveTested: false,
  launcher: { command: 'C:\\claude\\claude.exe', args: [] },
  authMethod: 'claude.ai',
  subscriptionType: 'max',
};

describe('testLauncher', () => {
  const hook = JSON.stringify({ command: 'node.exe', args: ['fake-claude.mjs'] });
  it('is honoured only in unpackaged runs and only when well-formed', () => {
    expect(testLauncher({ [TEST_CLAUDE_LAUNCHER_ENV]: hook }, false)).toEqual({
      command: 'node.exe',
      args: ['fake-claude.mjs'],
    });
    expect(testLauncher({ [TEST_CLAUDE_LAUNCHER_ENV]: hook }, true)).toBeUndefined();
    expect(testLauncher({ [TEST_CLAUDE_LAUNCHER_ENV]: '{nope' }, false)).toBeUndefined();
    expect(testLauncher({ [TEST_CLAUDE_LAUNCHER_ENV]: '{"command":""}' }, false)).toBeUndefined();
    expect(testLauncher({}, false)).toBeUndefined();
  });
});

describe('launcherOf', () => {
  it('maps the connection check to a launcher or a not-connected error', () => {
    expect(launcherOf(CONNECTED)).toEqual({ ok: true, value: CONNECTED.launcher });
    const missing = launcherOf({ state: 'not-installed', installHint: 'npm i', searched: [] });
    expect(missing).toMatchObject({ ok: false, error: { kind: 'not-connected' } });
    const loggedOut = launcherOf({
      state: 'not-logged-in',
      version: '2.1.287',
      loginAction: { kind: 'open-terminal', command: 'c', args: [], display: 'claude auth login' },
    });
    expect(!loggedOut.ok && loggedOut.error.message).toContain('claude auth login');
  });
});

describe('claudeChildEnv', () => {
  it('puts the shim folder first on PATH (any case) and runs the app binary as Node', () => {
    const env = claudeChildEnv({ Path: 'C:\\Windows', OTHER: 'x' }, 'C:\\data\\bin', 'win32');
    expect(env).toEqual({
      Path: 'C:\\data\\bin;C:\\Windows',
      OTHER: 'x',
      ELECTRON_RUN_AS_NODE: '1',
    });
    expect(claudeChildEnv({ PATH: '/usr/bin' }, '/data/bin', 'linux')['PATH']).toBe(
      '/data/bin:/usr/bin',
    );
    expect(claudeChildEnv({}, undefined, 'linux')).toEqual({ ELECTRON_RUN_AS_NODE: '1' });
  });
});

describe('claudeSetup', () => {
  const layout = appLayout({
    appPath: path.join(root, 'app'),
    resourcesPath: path.join(root, 'resources'),
    isPackaged: true,
  });
  const written: CliShimOptions[] = [];
  const setup = (connection: ConnectionState) =>
    claudeSetup({
      layout,
      shimDir: path.join(root, 'bin'),
      env: { PATH: 'base' },
      execPath: path.join(root, 'ReelForge.exe'),
      isPackaged: true,
      platform: 'win32',
      connection: () => Promise.resolve(connection),
      writeShims: (options) => {
        written.push(options);
        return Promise.resolve([]);
      },
      log: createLogger(() => undefined),
    });

  it('needs the shipped bash guard; then wires hook, shims and env', async () => {
    expect(await setup(CONNECTED)()).toMatchObject({ ok: false, error: { kind: 'setup' } });
    mkdirSync(path.dirname(layout.bashGuardHook), { recursive: true });
    writeFileSync(layout.bashGuardHook, '// guard');
    const withoutCli = await setup(CONNECTED)();
    expect(withoutCli.ok && withoutCli.value.env['PATH']).toBe('base');
    mkdirSync(path.dirname(layout.cliBundle), { recursive: true });
    writeFileSync(layout.cliBundle, '// cli');
    const result = await setup(CONNECTED)();
    if (!result.ok) throw new Error(result.error.message);
    expect(result.value.launcher).toEqual(CONNECTED.launcher);
    expect(result.value.permissions).toEqual({
      hookRuntime: path.join(root, 'ReelForge.exe'),
      hookScriptPath: layout.bashGuardHook,
    });
    expect(result.value.env['PATH']).toBe(`${path.join(root, 'bin')};base`);
    expect(written.at(-1)).toMatchObject({
      dir: path.join(root, 'bin'),
      script: layout.cliBundle,
      env: { ELECTRON_RUN_AS_NODE: '1' },
    });
    const offline = await setup({ state: 'error', reason: 'spawn', message: 'boom' })();
    expect(offline).toMatchObject({ ok: false, error: { kind: 'not-connected' } });
  });

  it('adds only the experimental worlds var to the launchers, and only when on (PLAN.md#13.6)', async () => {
    expect(cliShimEnv(false)).toEqual({ ELECTRON_RUN_AS_NODE: '1' });
    expect(cliShimEnv(true)).toEqual({
      ELECTRON_RUN_AS_NODE: '1',
      REELFORGE_EXPERIMENTAL_WORLDS: '1',
    });
    mkdirSync(path.dirname(layout.cliBundle), { recursive: true });
    writeFileSync(layout.cliBundle, '// cli');
    let experimental = true;
    const options = {
      layout,
      shimDir: path.join(root, 'bin'),
      env: { PATH: 'base' },
      execPath: path.join(root, 'ReelForge.exe'),
      isPackaged: true,
      platform: 'win32' as const,
      connection: () => Promise.resolve(CONNECTED),
      writeShims: (shim: CliShimOptions) => {
        written.push(shim);
        return Promise.resolve([]);
      },
      experimentalWorlds: () => experimental,
      log: createLogger(() => undefined),
    };
    expect(await prepareShims(options)).toBe(path.join(root, 'bin'));
    expect(written.at(-1)?.env).toEqual(cliShimEnv(true));
    experimental = false;
    await prepareShims(options);
    expect(written.at(-1)?.env).toEqual({ ELECTRON_RUN_AS_NODE: '1' });
  });
});
