/**
 * Verified downloads: stream to `<dest>.<rand>.part` while hashing, check the published hash, then
 * rename into place (never leaves a partial or unverified file at `dest`). A `<dest>.verified`
 * marker (hash + size) lets later checks skip re-hashing multi-GB models.
 */
import { createHash, randomBytes, type Hash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, open, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { AssetHash, AssetSpec } from './assets.js';
import { systemErrorCode, type WhisperError } from './errors.js';
import { err, ok, type Result } from '../result.js';

/** `fetch`-compatible function (injectable so tests never touch the network). */
export type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

export interface DownloadProgress {
  readonly asset: string;
  readonly receivedBytes: number;
  /** From Content-Length, else the pinned asset size; null when neither is known. */
  readonly totalBytes: number | null;
  readonly ratio: number | null;
}

export interface DownloadOptions {
  readonly fetch?: FetchLike | undefined;
  readonly signal?: AbortSignal | undefined;
  readonly onProgress?: ((progress: DownloadProgress) => void) | undefined;
}

const describe = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);
const isAbort = (error: unknown, signal: AbortSignal | undefined): boolean =>
  signal?.aborted === true || (error instanceof Error && error.name === 'AbortError');

const markerPath = (dest: string): string => `${dest}.verified`;

/** Hashes a file on disk with the asset's algorithm. */
export async function hashFile(filePath: string, algo: AssetHash['algo']): Promise<string> {
  const hash = createHash(algo === 'sha256' ? 'sha256' : 'sha1');
  if (algo === 'git-sha1') {
    const { size } = await stat(filePath);
    hash.update(`blob ${String(size)}\0`);
  }
  for await (const chunk of createReadStream(filePath)) {
    hash.update(chunk as Buffer);
  }
  return hash.digest('hex');
}

/** True when `dest` exists and its marker records the expected hash and current size. */
export async function isVerified(dest: string, expected: AssetHash): Promise<boolean> {
  try {
    const [marker, info] = await Promise.all([readFile(markerPath(dest), 'utf8'), stat(dest)]);
    return marker.trim() === `${expected.algo}:${expected.value}:${String(info.size)}`;
  } catch {
    // Missing file or marker: not verified yet.
    return false;
  }
}

async function writeMarker(dest: string, expected: AssetHash): Promise<void> {
  const { size } = await stat(dest);
  await writeFile(markerPath(dest), `${expected.algo}:${expected.value}:${String(size)}\n`, 'utf8');
}

async function streamToFile(
  response: Response,
  tmp: string,
  asset: AssetSpec,
  options: DownloadOptions,
  hash: Hash | null,
): Promise<number> {
  const header = response.headers.get('content-length');
  const fromHeader = header === null || Number.isNaN(Number(header)) ? null : Number(header);
  const totalBytes = fromHeader ?? (asset.bytes > 0 ? asset.bytes : null);
  const handle = await open(tmp, 'w');
  let receivedBytes = 0;
  try {
    // undici types the body as ReadableStream<any>; fetch bodies are always byte streams.
    const body = response.body as ReadableStream<Uint8Array> | null;
    const reader = body?.getReader();
    if (reader === undefined) throw new Error('response has no body');
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      await handle.write(value);
      hash?.update(value);
      receivedBytes += value.byteLength;
      options.onProgress?.({
        asset: asset.name,
        receivedBytes,
        totalBytes,
        ratio:
          totalBytes === null || totalBytes === 0 ? null : Math.min(1, receivedBytes / totalBytes),
      });
    }
  } finally {
    await handle.close();
  }
  return receivedBytes;
}

/**
 * Ensures `dest` holds the verified asset, downloading it when missing or unverified. Existing
 * files without a marker are re-hashed once (e.g. copied in by hand).
 */
export async function downloadVerified(
  asset: AssetSpec,
  dest: string,
  options: DownloadOptions = {},
): Promise<Result<string, WhisperError>> {
  if (await isVerified(dest, asset.hash)) return ok(dest);
  const existing = await stat(dest).then(
    (info) => info.isFile(),
    () => false,
  );
  if (existing && (await hashFile(dest, asset.hash.algo)) === asset.hash.value) {
    await writeMarker(dest, asset.hash);
    return ok(dest);
  }
  if (options.signal?.aborted === true) {
    return err({ kind: 'cancelled', message: `download of ${asset.name} cancelled` });
  }
  const fetchImpl = options.fetch ?? fetch;
  const tmp = `${dest}.${randomBytes(4).toString('hex')}.part`;
  try {
    await mkdir(path.dirname(dest), { recursive: true });
    const init: RequestInit = { redirect: 'follow' };
    if (options.signal !== undefined) init.signal = options.signal;
    const response = await fetchImpl(asset.url, init);
    if (!response.ok) {
      return err({
        kind: 'download-failed',
        message: `GET ${asset.url} -> HTTP ${String(response.status)}`,
        url: asset.url,
        status: response.status,
      });
    }
    const streamingHash = asset.hash.algo === 'sha256' ? createHash('sha256') : null;
    await streamToFile(response, tmp, asset, options, streamingHash);
    const actual = streamingHash?.digest('hex') ?? (await hashFile(tmp, asset.hash.algo));
    if (actual !== asset.hash.value) {
      await rm(tmp, { force: true });
      return err({
        kind: 'checksum-mismatch',
        message: `${asset.name}: ${asset.hash.algo} mismatch (expected ${asset.hash.value}, got ${actual})`,
        url: asset.url,
        expected: asset.hash.value,
        actual,
      });
    }
    await rm(markerPath(dest), { force: true });
    await rename(tmp, dest);
    await writeMarker(dest, asset.hash);
    return ok(dest);
  } catch (error) {
    await rm(tmp, { force: true });
    if (isAbort(error, options.signal)) {
      return err({ kind: 'cancelled', message: `download of ${asset.name} cancelled` });
    }
    return err({
      kind: 'download-failed',
      message: `download of ${asset.name} failed: ${describe(error)}`,
      url: asset.url,
      status: null,
      code: systemErrorCode(error),
    });
  }
}
