import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { WHISPER_BINARIES, WHISPER_MODELS } from '@reelforge/pipeline';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  TEST_WHISPER_MIRROR_ENV,
  TEST_WHISPER_ROOT_ENV,
  diskFreeBytes,
  mirrorFetch,
  whisperTestHooks,
} from './test-hooks.js';
import { writeFakeMirror } from './testing/fake-mirror.js';

let dir = '';
beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'reelforge mirror ż '));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('whisper test hooks', () => {
  it('are off without REELFORGE_TEST_HOOKS', () => {
    expect(whisperTestHooks({ [TEST_WHISPER_ROOT_ENV]: dir }, false)).toEqual({});
  });

  it('serve the mirror folder by file name with a Content-Length, 404 otherwise', async () => {
    await writeFile(path.join(dir, 'ggml-base.bin'), 'model bytes');
    const fetch = mirrorFetch(dir);
    const response = await fetch(WHISPER_MODELS.base.url, {});
    expect(response.headers.get('content-length')).toBe('11');
    expect(await response.text()).toBe('model bytes');
    expect((await fetch(WHISPER_MODELS.small.url, {})).status).toBe(404);
  });

  it('re-pin assets listed in hashes.json and set the root', async () => {
    const hashes = await writeFakeMirror(dir, { models: ['base'] });
    const hooks = whisperTestHooks(
      { [TEST_WHISPER_MIRROR_ENV]: dir, [TEST_WHISPER_ROOT_ENV]: path.join(dir, 'root') },
      true,
    );
    expect(hooks.root).toBe(path.join(dir, 'root'));
    const blas = hooks.assetOverride?.(WHISPER_BINARIES.blas);
    expect(blas?.hash.value).toBe(hashes['whisper-blas-bin-x64.zip']?.sha256);
    expect(hooks.assetOverride?.(WHISPER_MODELS.small)).toEqual(WHISPER_MODELS.small);
    expect(JSON.parse(await readFile(path.join(dir, 'hashes.json'), 'utf8'))).toEqual(hashes);
  });

  it('measure free space through a not-yet-created folder', async () => {
    const free = await diskFreeBytes(path.join(dir, 'not', 'there'));
    expect(free).toBeGreaterThan(0);
  });
});
