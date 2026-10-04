/**
 * Downloads a file into the project's asset store under the guards: streamed into a temporary
 * file inside `.reelforge/assets/`, type checked by magic bytes, then renamed to
 * `<name>.<safe ext>` (the server's file name is never used). Any failure deletes the partial file.
 */
import { open, rename, rm } from 'node:fs/promises';
import path from 'node:path';
import type { AssetKind, AssetMime } from '@reelforge/shared';
import { downloadToFile, FetchRefused, type TransportOptions, type UrlPolicy } from './http.js';
import { imageDimensions, sniffType, SNIFF_BYTES } from './magic.js';
import { storeDir } from './store.js';

export interface DownloadRequest {
  readonly root: string;
  /** Project-relative store folder, e.g. `.reelforge/assets`. */
  readonly folder: string;
  /** File name without extension (an asset id or a thumbnail name; already safe). */
  readonly name: string;
  readonly url: string;
  readonly policy: UrlPolicy;
  readonly transport: TransportOptions;
  readonly kind: AssetKind;
  readonly maxBytes: number;
  readonly deadlineMs: number;
}

export interface StoredFile {
  /** Project-relative path with forward slashes. */
  readonly file: string;
  readonly sha256: string;
  readonly bytes: number;
  readonly mime: AssetMime;
  readonly width: number | null;
  readonly height: number | null;
  readonly finalUrl: string;
}

async function readHead(file: string, length: number): Promise<Uint8Array> {
  const handle = await open(file, 'r');
  try {
    const buffer = new Uint8Array(length);
    const { bytesRead } = await handle.read(buffer, 0, length, 0);
    return buffer.subarray(0, bytesRead);
  } finally {
    await handle.close();
  }
}

export async function downloadVerified(request: DownloadRequest): Promise<StoredFile> {
  if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(request.name)) {
    throw new Error(`unsafe store name: ${request.name}`);
  }
  const dir = await storeDir(request.root, request.folder);
  const temporary = path.join(dir, `${request.name}.${String(process.pid)}.download.tmp`);
  try {
    await rm(temporary, { force: true });
    const download = await downloadToFile(
      request.url,
      request.policy,
      request.transport,
      temporary,
      request.maxBytes,
      request.deadlineMs,
    );
    // Images are at most 25 MB: read them whole for the pixel size; videos only need the head.
    const head = await readHead(temporary, request.kind === 'image' ? download.bytes : SNIFF_BYTES);
    const type = sniffType(head);
    if (type === undefined) {
      throw new FetchRefused(
        'the file is not an allowed media type (png, jpeg, webp, gif, mp4, webm by its content); deleted',
      );
    }
    if (type.kind !== request.kind) {
      throw new FetchRefused(`expected ${request.kind} but the file is ${type.mime}; deleted`);
    }
    const size = type.kind === 'image' ? imageDimensions(head, type.mime) : undefined;
    const fileName = `${request.name}.${type.ext}`;
    await rename(temporary, path.join(dir, fileName));
    return {
      file: `${request.folder}/${fileName}`,
      sha256: download.sha256,
      bytes: download.bytes,
      mime: type.mime,
      width: size?.width ?? null,
      height: size?.height ?? null,
      finalUrl: download.finalUrl,
    };
  } catch (error) {
    // Retries cover Windows releasing the write handle a moment after the stream was destroyed.
    await rm(temporary, { force: true, maxRetries: 5, retryDelay: 50 });
    throw error;
  }
}
