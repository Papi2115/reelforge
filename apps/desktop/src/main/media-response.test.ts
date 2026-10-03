import { mkdtemp, rename, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  MEDIA_CHUNK_BYTES,
  MediaFileChangedError,
  chunkedFileStream,
  mediaFileResponse,
  type MediaFileInfo,
} from './media-response.js';

/** Larger than the old 4 MB cap and not a multiple of the chunk size. */
const SIZE = 9 * 1024 * 1024 + 12_345;
const FOUR_MB = 4 * 1024 * 1024;

let dir: string;
let file: string;
let bytes: Buffer;

function pattern(size: number, seed: number): Buffer {
  const buffer = Buffer.alloc(size);
  for (let index = 0; index < size; index += 1) buffer[index] = (index * 31 + seed) & 0xff;
  return buffer;
}

async function infoOf(target: string): Promise<MediaFileInfo> {
  const info = await stat(target);
  return { file: target, contentType: 'audio/wav', size: info.size, mtimeMs: info.mtimeMs };
}

async function answer(range: string | null, method = 'GET'): Promise<Response> {
  return mediaFileResponse(await infoOf(file), { method, range });
}

async function body(response: Response): Promise<Buffer> {
  return Buffer.from(await response.arrayBuffer());
}

beforeAll(async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'reelforge media ż-'));
  file = path.join(dir, 'mix.wav');
  bytes = pattern(SIZE, 7);
  await writeFile(file, bytes);
});

afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('mediaFileResponse', () => {
  it('sends the whole file without a Range header', async () => {
    const response = await answer(null);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-length')).toBe(String(SIZE));
    expect(response.headers.get('accept-ranges')).toBe('bytes');
    expect(response.headers.get('content-range')).toBeNull();
    expect((await body(response)).equals(bytes)).toBe(true);
  });

  it('answers an open range with all of the rest, not a capped part (the 21.8 s bug)', async () => {
    const response = await answer('bytes=0-');
    expect(response.status).toBe(206);
    expect(response.headers.get('content-range')).toBe(
      `bytes 0-${String(SIZE - 1)}/${String(SIZE)}`,
    );
    expect(response.headers.get('content-length')).toBe(String(SIZE));
    expect((await body(response)).equals(bytes)).toBe(true);

    const rest = await answer(`bytes=${String(FOUR_MB)}-`);
    expect(rest.status).toBe(206);
    expect(rest.headers.get('content-range')).toBe(
      `bytes ${String(FOUR_MB)}-${String(SIZE - 1)}/${String(SIZE)}`,
    );
    expect(rest.headers.get('content-length')).toBe(String(SIZE - FOUR_MB));
    expect((await body(rest)).equals(bytes.subarray(FOUR_MB))).toBe(true);
  });

  it('answers closed, mid-file and suffix ranges exactly', async () => {
    const middle = await answer('bytes=5000000-5000999');
    expect(middle.status).toBe(206);
    expect(middle.headers.get('content-range')).toBe(`bytes 5000000-5000999/${String(SIZE)}`);
    expect(middle.headers.get('content-length')).toBe('1000');
    expect((await body(middle)).equals(bytes.subarray(5_000_000, 5_001_000))).toBe(true);

    const suffix = await answer('bytes=-1000');
    expect(suffix.headers.get('content-range')).toBe(
      `bytes ${String(SIZE - 1000)}-${String(SIZE - 1)}/${String(SIZE)}`,
    );
    expect((await body(suffix)).equals(bytes.subarray(SIZE - 1000))).toBe(true);

    const pastEnd = await answer(`bytes=${String(SIZE - 10)}-${String(SIZE + 10_000)}`);
    expect(pastEnd.headers.get('content-length')).toBe('10');
    expect((await body(pastEnd)).equals(bytes.subarray(SIZE - 10))).toBe(true);
  });

  it('answers 416 for an unsatisfiable range and no body for HEAD', async () => {
    const unsatisfiable = await answer(`bytes=${String(SIZE)}-`);
    expect(unsatisfiable.status).toBe(416);
    expect(unsatisfiable.headers.get('content-range')).toBe(`bytes */${String(SIZE)}`);
    const head = await answer('bytes=0-', 'HEAD');
    expect(head.status).toBe(206);
    expect(head.headers.get('content-length')).toBe(String(SIZE));
    expect(head.body).toBeNull();
  });
});

describe('chunkedFileStream', () => {
  it('reads lazily, chunk by chunk, holding no handle: the file can be replaced mid-stream', async () => {
    const target = path.join(dir, 'replaced.wav');
    const original = pattern(3 * MEDIA_CHUNK_BYTES, 1);
    await writeFile(target, original);
    const reader = chunkedFileStream(await infoOf(target), 0, original.length - 1).getReader();
    const first = await reader.read();
    expect(first.value?.length).toBe(MEDIA_CHUNK_BYTES);
    expect(Buffer.from(first.value ?? []).equals(original.subarray(0, MEDIA_CHUNK_BYTES))).toBe(
      true,
    );
    // Like a Render mix: tmp + rename over the file being streamed (EPERM on Windows if open).
    const tmp = path.join(dir, 'replaced.wav.tmp');
    await writeFile(tmp, pattern(2 * MEDIA_CHUNK_BYTES, 2));
    await rename(tmp, target);
    // The stream does not mix two files: it fails, and the player loads the new one.
    await expect(reader.read()).rejects.toBeInstanceOf(MediaFileChangedError);
  });

  it('streams an empty range as an empty body', async () => {
    const reader = chunkedFileStream(await infoOf(file), 10, 9).getReader();
    expect((await reader.read()).done).toBe(true);
  });
});
