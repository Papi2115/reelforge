/**
 * WhisperSetupService over a real WhisperManager in a temp root, downloading from a local fake
 * mirror (test-hooks.ts) — no network, no real binaries; whisper-cli runs are faked.
 */
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  WhisperManager,
  err,
  ok,
  type DiscoveredWhisper,
  type FetchLike,
  type ProcessRunner,
  type WhisperModelId,
} from '@reelforge/pipeline';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { WhisperProgress } from '../../shared/whisper-contract.js';
import { createLogger } from '../logger.js';
import { mirrorAssetOverride, mirrorFetch } from './test-hooks.js';
import { writeFakeMirror } from './testing/fake-mirror.js';
import { WhisperSetupService, type WhisperSetupOptions } from './whisper-setup.js';

let dir = '';
let root = '';
let mirror = '';
beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'reelforge whisper setup ż '));
  root = path.join(dir, 'root');
  mirror = path.join(dir, 'mirror');
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

const VERSION_LOG = 'load_backend: loaded BLAS backend\nwhisper.cpp version: 1.9.4';

function fakeRun(gpu: boolean): ProcessRunner {
  return vi.fn<ProcessRunner>((command, args) => {
    if (command === 'nvidia-smi') {
      return Promise.resolve(
        gpu
          ? ok({ stdout: 'GPU 0: RTX (UUID: x)\n', stderr: '', durationMs: 1 })
          : err({ kind: 'spawn-failed', message: 'not found', command }),
      );
    }
    if (args.includes('--version')) {
      const cuda = command.includes(`${path.sep}cuda${path.sep}`);
      const stderr = cuda
        ? `ggml_cuda_init: failed to initialize CUDA: no CUDA-capable device is detected\n${VERSION_LOG}`
        : VERSION_LOG;
      return Promise.resolve(ok({ stdout: '', stderr, durationMs: 1 }));
    }
    return Promise.resolve(err({ kind: 'spawn-failed', message: 'unexpected', command }));
  });
}

interface Harness {
  readonly service: WhisperSetupService;
  readonly pushes: WhisperProgress[];
  readonly saved: (string | null)[];
}

async function harness(
  overrides: Partial<WhisperSetupOptions> & {
    readonly gpu?: boolean;
    readonly fetch?: FetchLike;
    readonly delayMs?: number;
    readonly configuredPath?: string;
  } = {},
): Promise<Harness> {
  const hashes = await writeFakeMirror(mirror, { models: ['base', 'large-v3-turbo-q5_0'] });
  const pushes: WhisperProgress[] = [];
  const saved: (string | null)[] = [];
  let configuredPath = overrides.configuredPath;
  const run = fakeRun(overrides.gpu ?? false);
  const manager = (): WhisperManager =>
    new WhisperManager({
      root,
      env: {},
      platform: 'win32',
      run,
      fetch: overrides.fetch ?? mirrorFetch(mirror, overrides.delayMs ?? 0),
      assetOverride: mirrorAssetOverride(hashes),
      ...(configuredPath === undefined ? {} : { configuredPath }),
    });
  let clock = 0;
  const service = new WhisperSetupService({
    manager,
    model: (): WhisperModelId => 'base',
    configured: () => configuredPath !== undefined,
    saveConfiguredPath: (cliPath) => {
      saved.push(cliPath);
      configuredPath = cliPath ?? undefined;
      return Promise.resolve(undefined);
    },
    discover: () => [],
    freeBytes: () => Promise.resolve(null),
    push: (progress) => pushes.push(progress),
    log: createLogger(() => undefined),
    now: () => (clock += 100),
    progressIntervalMs: 0,
    ...overrides,
  });
  return { service, pushes, saved };
}

describe('WhisperSetupService', () => {
  it('"Download and continue": installs engine, VAD and model, then Words timed is ready', async () => {
    const { service, pushes } = await harness();
    const before = await service.state(false);
    expect(before.readiness).toMatchObject({
      ready: false,
      model: 'base',
      missing: ['engine', 'vad', 'model'],
    });
    expect(before.engine).toMatchObject({ installs: [], installBackends: ['blas'] });
    expect(await service.install({ kind: 'setup' })).toEqual({ status: 'started' });
    await service.whenIdle();
    const last = pushes.at(-1);
    expect(last).toMatchObject({ phase: 'done', step: 3, steps: 3, message: null });
    expect(last?.receivedBytes).toBe(last?.totalBytes);
    expect(pushes.map((push) => push.label)).toContain('Unpacking whisper.cpp (CPU build)');
    expect(pushes.map((push) => push.label)).toContain('Downloading the base model');
    const after = await service.state(false);
    expect(after.readiness).toMatchObject({ ready: true, missing: [], bytes: 0 });
    expect(after.engine.installs).toEqual([
      expect.objectContaining({ backend: 'blas', version: '1.9.4', cuda: 'absent' }),
    ]);
    expect(after.job).toBeNull();
    expect(await service.install({ kind: 'setup' })).toEqual({ status: 'installed' });
  });

  it('installs the CUDA build plus the CPU fallback with an NVIDIA GPU and reports CUDA state', async () => {
    const { service } = await harness({ gpu: true });
    const state = await service.state(false);
    expect(state.engine.installBackends).toEqual(['cuda', 'blas']);
    await service.install({ kind: 'engine' });
    await service.whenIdle();
    const after = await service.state(true);
    expect(after.engine.installs.map((install) => [install.backend, install.cuda])).toEqual([
      ['cuda', 'unavailable'],
      ['blas', 'absent'],
    ]);
    expect(after.engine.installs[0]?.cudaReason).toBe('no CUDA-capable device is detected');
    expect(after.readiness.missing).toEqual(['vad', 'model']);
  });

  it('runs one job at a time and cancels', async () => {
    const { service, pushes } = await harness({ delayMs: 20 });
    expect(await service.install({ kind: 'model', model: 'base' })).toEqual({ status: 'started' });
    expect(await service.install({ kind: 'engine' })).toEqual({
      status: 'busy',
      job: { kind: 'model', model: 'base' },
    });
    expect((await service.state(false)).job).toMatchObject({ phase: 'running' });
    service.cancel();
    await service.whenIdle();
    expect(pushes.at(-1)).toMatchObject({ phase: 'cancelled', message: null });
    expect((await service.state(false)).readiness.missing).toContain('model');
  });

  it('turns failures into actionable messages: checksum, offline, disk full', async () => {
    const tampered = await harness({
      fetch: () => Promise.resolve(new Response('tampered')),
    });
    await tampered.service.install({ kind: 'model', model: 'base' });
    await tampered.service.whenIdle();
    expect(tampered.pushes.at(-1)).toMatchObject({
      phase: 'failed',
      message: expect.stringContaining('did not match its published checksum') as unknown,
    });

    const offlineError = Object.assign(new TypeError('fetch failed'), {
      cause: Object.assign(new Error('getaddrinfo ENOTFOUND github.com'), { code: 'ENOTFOUND' }),
    });
    const offline = await harness({ fetch: () => Promise.reject(offlineError) });
    await offline.service.install({ kind: 'engine' });
    await offline.service.whenIdle();
    expect(offline.pushes.at(-1)).toMatchObject({
      phase: 'failed',
      message: expect.stringContaining('Could not reach the download server') as unknown,
      detail: expect.stringContaining('fetch failed') as unknown,
    });

    const full = await harness({ freeBytes: () => Promise.resolve(1_000) });
    await full.service.install({ kind: 'setup' });
    await full.service.whenIdle();
    expect(full.pushes.at(-1)).toMatchObject({
      phase: 'failed',
      message: expect.stringContaining('Not enough free disk space') as unknown,
    });
  });

  it('reports a whisper-cli removed by antivirus software', async () => {
    const hashes = await writeFakeMirror(path.join(dir, 'quarantined'), { withoutCli: true });
    const { service, pushes } = await harness({
      manager: () =>
        new WhisperManager({
          root,
          env: {},
          platform: 'win32',
          run: fakeRun(false),
          fetch: mirrorFetch(path.join(dir, 'quarantined')),
          assetOverride: mirrorAssetOverride(hashes),
        }),
    });
    await service.install({ kind: 'engine' });
    await service.whenIdle();
    expect(pushes.at(-1)).toMatchObject({
      phase: 'failed',
      message: expect.stringContaining('antivirus') as unknown,
    });
  });

  it('drops a broken configured whisper-cli once the app build is installed', async () => {
    const { service, saved } = await harness({ configuredPath: path.join(dir, 'gone.exe') });
    const state = await service.state(false);
    expect(state.engine).toMatchObject({ configured: true, installs: [] });
    expect(state.engine.problem).toContain('configured path');
    await service.install({ kind: 'setup' });
    await service.whenIdle();
    expect(saved).toEqual([null]);
    expect((await service.state(false)).readiness.ready).toBe(true);
  });

  it('uses only detected existing installs and deletes models', async () => {
    const cli = path.join(dir, 'whisper.cpp', 'whisper-cli.exe');
    const found: DiscoveredWhisper[] = [{ cliPath: cli, source: 'common-dir' }];
    const { service, saved } = await harness({ discover: () => found });
    expect(await service.useExisting(path.join(dir, 'evil.exe'))).toMatchObject({
      status: 'invalid',
    });
    expect(saved).toEqual([]);
    expect(await service.useExisting(cli.toUpperCase())).toMatchObject({ status: 'saved' });
    expect(saved).toEqual([cli]);

    await service.install({ kind: 'model', model: 'base' });
    await service.whenIdle();
    expect((await service.state(false)).models.find((m) => m.id === 'base')?.installed).toBe(true);
    expect(await service.delete('base')).toEqual({ status: 'deleted' });
    expect((await service.state(false)).models.find((m) => m.id === 'base')?.installed).toBe(false);
  });

  it('can be told that Words timed is ready (recorded-transcription test hook)', async () => {
    const { service } = await harness({ assumeReady: true });
    expect((await service.state(false)).readiness).toMatchObject({ ready: true, missing: [] });
  });
});
