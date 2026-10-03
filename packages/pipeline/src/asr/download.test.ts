import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AssetSpec } from './assets.js';
import {
  downloadVerified,
  hashFile,
  isVerified,
  type DownloadProgress,
  type FetchLike,
} from './download.js';

const PAYLOAD = Buffer.from('ggml model bytes '.repeat(1000), 'utf8');
const sha256 = (data: Buffer): string => createHash('sha256').update(data).digest('hex');
const gitSha1 = (data: Buffer): string =>
  createHash('sha1')
    .update(`blob ${String(data.length)}\0`)
    .update(data)
    .digest('hex');

const ASSET: AssetSpec = {
  name: 'test-model',
  url: 'https://example.invalid/ggml-test.bin',
  fileName: 'ggml-test.bin',
  hash: { algo: 'sha256', value: sha256(PAYLOAD) },
  bytes: PAYLOAD.length,
};

/** Serves `body` in 4 KB chunks with a Content-Length header. */
function serve(body: Buffer, status = 200): FetchLike {
  return vi.fn<FetchLike>((_url, init) => {
    const signal = init.signal ?? undefined;
    let offset = 0;
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (signal?.aborted === true) {
          controller.error(Object.assign(new Error('aborted'), { name: 'AbortError' }));
          return;
        }
        if (offset >= body.length) {
          controller.close();
          return;
        }
        controller.enqueue(new Uint8Array(body.subarray(offset, offset + 4096)));
        offset += 4096;
      },
    });
    return Promise.resolve(
      new Response(stream, { status, headers: { 'content-length': String(body.length) } }),
    );
  });
}

let dir = '';
beforeEach(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), 'reelforge dl żółć '));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('downloadVerified', () => {
  it('downloads, verifies sha256, reports progress and writes a marker', async () => {
    const dest = path.join(dir, 'models', ASSET.fileName);
    const seen: DownloadProgress[] = [];
    const result = await downloadVerified(ASSET, dest, {
      fetch: serve(PAYLOAD),
      onProgress: (progress) => seen.push(progress),
    });
    expect(result).toEqual({ ok: true, value: dest });
    expect(await readFile(dest)).toEqual(PAYLOAD);
    expect(await isVerified(dest, ASSET.hash)).toBe(true);
    expect(seen.length).toBeGreaterThan(1);
    expect(seen.at(-1)).toMatchObject({ receivedBytes: PAYLOAD.length, ratio: 1 });
    expect(await readdir(path.dirname(dest))).toEqual([
      ASSET.fileName,
      `${ASSET.fileName}.verified`,
    ]);
  });

  it('skips the network when the file is already verified', async () => {
    const dest = path.join(dir, ASSET.fileName);
    await downloadVerified(ASSET, dest, { fetch: serve(PAYLOAD) });
    const fetch = serve(PAYLOAD);
    expect((await downloadVerified(ASSET, dest, { fetch })).ok).toBe(true);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('adopts a correct file placed by hand after hashing it once', async () => {
    const dest = path.join(dir, ASSET.fileName);
    await writeFile(dest, PAYLOAD);
    const fetch = serve(PAYLOAD);
    expect((await downloadVerified(ASSET, dest, { fetch })).ok).toBe(true);
    expect(fetch).not.toHaveBeenCalled();
    expect(await isVerified(dest, ASSET.hash)).toBe(true);
  });

  it('rejects a corrupted download and leaves nothing behind', async () => {
    const dest = path.join(dir, ASSET.fileName);
    const result = await downloadVerified(ASSET, dest, { fetch: serve(Buffer.from('evil')) });
    expect(result).toMatchObject({
      ok: false,
      error: { kind: 'checksum-mismatch', expected: ASSET.hash.value },
    });
    expect(await readdir(dir)).toEqual([]);
  });

  it('replaces a wrong existing file', async () => {
    const dest = path.join(dir, ASSET.fileName);
    await writeFile(dest, 'stale');
    expect((await downloadVerified(ASSET, dest, { fetch: serve(PAYLOAD) })).ok).toBe(true);
    expect(await readFile(dest)).toEqual(PAYLOAD);
  });

  it('reports HTTP errors', async () => {
    const result = await downloadVerified(ASSET, path.join(dir, 'x.bin'), {
      fetch: serve(Buffer.alloc(0), 404),
    });
    expect(result).toMatchObject({ ok: false, error: { kind: 'download-failed', status: 404 } });
  });

  it('keeps the system error code of a failed connection (offline)', async () => {
    const offline = Object.assign(new TypeError('fetch failed'), {
      cause: Object.assign(new Error('getaddrinfo ENOTFOUND huggingface.co'), {
        code: 'ENOTFOUND',
      }),
    });
    const result = await downloadVerified(ASSET, path.join(dir, 'x.bin'), {
      fetch: () => Promise.reject(offline),
    });
    expect(result).toMatchObject({
      ok: false,
      error: { kind: 'download-failed', status: null, code: 'ENOTFOUND' },
    });
  });

  it('keeps the code of a failed write (disk full) and removes the partial file', async () => {
    const full = Object.assign(new Error('ENOSPC: no space left on device, write'), {
      code: 'ENOSPC',
    });
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        controller.error(full);
      },
    });
    const result = await downloadVerified(ASSET, path.join(dir, ASSET.fileName), {
      fetch: () => Promise.resolve(new Response(stream)),
    });
    expect(result).toMatchObject({ ok: false, error: { kind: 'download-failed', code: 'ENOSPC' } });
    expect(await readdir(dir)).toEqual([]);
  });

  it('uses the pinned size as the progress total without Content-Length', async () => {
    const seen: DownloadProgress[] = [];
    await downloadVerified(ASSET, path.join(dir, ASSET.fileName), {
      fetch: () => Promise.resolve(new Response(new Blob([PAYLOAD]).stream())),
      onProgress: (progress) => seen.push(progress),
    });
    expect(seen.at(-1)).toMatchObject({ totalBytes: PAYLOAD.length, ratio: 1 });
  });

  it('cancels mid-stream and removes the partial file', async () => {
    const controller = new AbortController();
    const dest = path.join(dir, ASSET.fileName);
    const result = await downloadVerified(ASSET, dest, {
      fetch: serve(PAYLOAD),
      signal: controller.signal,
      onProgress: () => {
        controller.abort();
      },
    });
    expect(result).toMatchObject({ ok: false, error: { kind: 'cancelled' } });
    expect(existsSync(dest)).toBe(false);
    expect(await readdir(dir)).toEqual([]);
  });

  it('verifies git blob SHA-1 assets', async () => {
    const asset: AssetSpec = { ...ASSET, hash: { algo: 'git-sha1', value: gitSha1(PAYLOAD) } };
    const dest = path.join(dir, 'sh.rnnn');
    expect((await downloadVerified(asset, dest, { fetch: serve(PAYLOAD) })).ok).toBe(true);
    expect(await hashFile(dest, 'git-sha1')).toBe(gitSha1(PAYLOAD));
  });
});
