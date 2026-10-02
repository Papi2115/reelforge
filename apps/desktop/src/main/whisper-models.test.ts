import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  WhisperManager,
  err,
  ok,
  type InstallOptions,
  type WhisperModelId,
} from '@reelforge/pipeline';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { WhisperProgress } from '../shared/settings-contract.js';
import { createLogger } from './logger.js';
import {
  WhisperModelsService,
  whisperModelStore,
  type WhisperModelStore,
} from './whisper-models.js';

/** In-memory store whose downloads report progress in 4 chunks, or wait to be aborted. */
class FakeStore implements WhisperModelStore {
  readonly modelsDir = 'C:\\models';
  readonly installed = new Set<string>();
  hang = false;

  hasModel(model: WhisperModelId): boolean {
    return this.installed.has(model);
  }
  hasVadModel(): boolean {
    return this.installed.has('vad');
  }
  installModel(
    model: WhisperModelId,
    options: InstallOptions,
  ): ReturnType<WhisperModelStore['installModel']> {
    return this.fetch(model, 400, options);
  }
  installVadModel(options: InstallOptions): ReturnType<WhisperModelStore['installVadModel']> {
    return this.fetch('vad', 40, options);
  }
  deleteModel(model: WhisperModelId): Promise<void> {
    this.installed.delete(model);
    return Promise.resolve();
  }

  private async fetch(
    asset: string,
    total: number,
    options: InstallOptions,
  ): ReturnType<WhisperModelStore['installModel']> {
    if (this.hang) {
      await new Promise<void>((resolve) => {
        options.signal?.addEventListener('abort', () => {
          resolve();
        });
      });
      return err({ kind: 'cancelled', message: `download of ${asset} cancelled` });
    }
    for (let chunk = 1; chunk <= 4; chunk += 1) {
      const receivedBytes = (total / 4) * chunk;
      options.onProgress?.({
        asset,
        receivedBytes,
        totalBytes: total,
        ratio: receivedBytes / total,
      });
      await Promise.resolve();
    }
    this.installed.add(asset);
    return ok(`C:\\models\\${asset}.bin`);
  }
}

function setup(store: WhisperModelStore): {
  service: WhisperModelsService;
  pushes: WhisperProgress[];
} {
  const pushes: WhisperProgress[] = [];
  let now = 0;
  const service = new WhisperModelsService({
    store,
    push: (progress) => pushes.push(progress),
    log: createLogger(() => undefined),
    // Every progress callback is 100 ms later: with a 150 ms gap every second one is pushed.
    now: () => (now += 100),
  });
  return { service, pushes };
}

describe('WhisperModelsService (fake downloader)', () => {
  it('lists the models with sizes and install state', () => {
    const store = new FakeStore();
    store.installed.add('base');
    const { service } = setup(store);
    const state = service.state();
    expect(state.models.map((model) => [model.id, model.installed])).toEqual([
      ['large-v3-turbo-q5_0', false],
      ['small', false],
      ['medium', false],
      ['base', true],
    ]);
    expect(state.models.every((model) => model.approxBytes > 100_000_000)).toBe(true);
    expect(state).toMatchObject({ vadInstalled: false, downloading: null });
  });

  it('downloads the VAD model, then the model, with throttled progress and a final done', async () => {
    const store = new FakeStore();
    const { service, pushes } = setup(store);
    expect(service.download('small')).toEqual({ status: 'started' });
    expect(service.state().downloading).toBe('small');
    expect(service.download('base')).toEqual({ status: 'busy', downloading: 'small' });
    await service.whenIdle();
    expect(pushes[0]).toMatchObject({ phase: 'downloading', receivedBytes: 0 });
    const last = pushes.at(-1);
    expect(last).toMatchObject({
      model: 'small',
      phase: 'done',
      asset: 'small',
      receivedBytes: 400,
    });
    expect(pushes.some((push) => push.asset === 'vad')).toBe(true);
    expect(pushes.length).toBeLessThan(1 + 8 + 1);
    expect(service.state()).toMatchObject({ vadInstalled: true, downloading: null });
    expect(service.download('small')).toEqual({ status: 'installed' });
  });

  it('cancels a running download and refuses to delete it meanwhile', async () => {
    const store = new FakeStore();
    store.hang = true;
    const { service, pushes } = setup(store);
    service.download('medium');
    expect(await service.delete('medium')).toMatchObject({ status: 'error' });
    service.cancel('medium');
    await service.whenIdle();
    expect(pushes.at(-1)).toMatchObject({ model: 'medium', phase: 'cancelled' });
    expect(service.state().downloading).toBeNull();
  });

  it('deletes an installed model', async () => {
    const store = new FakeStore();
    store.installed.add('base');
    const { service } = setup(store);
    expect(await service.delete('base')).toEqual({ status: 'deleted' });
    expect(store.hasModel('base')).toBe(false);
  });
});

describe('WhisperModelsService (real WhisperManager, fake network)', () => {
  let root: string;
  beforeEach(async () => {
    root = await mkdtemp(path.join(tmpdir(), 'reelforge whisper '));
  });
  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('rejects a download whose checksum does not match and leaves no file', async () => {
    const manager = new WhisperManager({
      root,
      fetch: () => Promise.resolve(new Response(new Uint8Array(1024).fill(7))),
    });
    const { service, pushes } = setup(whisperModelStore(manager));
    service.download('base');
    await service.whenIdle();
    expect(pushes.at(-1)).toMatchObject({ phase: 'failed' });
    expect(pushes.at(-1)?.message).toContain('mismatch');
    expect(existsSync(manager.vadModelPath())).toBe(false);
    expect(service.state().models.every((model) => !model.installed)).toBe(true);
  });

  it('deletes the model file and its verification marker', async () => {
    const manager = new WhisperManager({ root });
    const store = whisperModelStore(manager);
    const file = manager.modelPath('base');
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, 'model');
    await writeFile(`${file}.verified`, 'sha256:x:5');
    expect(store.hasModel('base')).toBe(true);
    await store.deleteModel('base');
    expect(existsSync(file)).toBe(false);
    expect(existsSync(`${file}.verified`)).toBe(false);
  });
});
