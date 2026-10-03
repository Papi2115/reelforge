/**
 * The HTTP answer for a project audio file of `reelforge-media://` (PLAN.md#6.4, #11.1): the whole
 * file (200) or exactly the asked byte range (206 / 416), streamed.
 *
 * The answer always carries the full asked range. Observed with Electron 44 (Chromium 152): for
 * this custom scheme the media loader ignores `Content-Range` and takes the body length as the
 * length of the file, and never asks for the rest. A shortened 206 (the earlier 4 MB cap, with a
 * correct `Content-Range`) made a 48 kHz stereo mix "end" after 21.8 s, so the preview fell silent
 * there while the picture went on (the P0 bug of PLAN.md#11.1).
 *
 * The body is read in chunks and the file is opened for each chunk only: no handle stays open
 * while Chromium reads lazily during playback, because on Windows an open file cannot be replaced
 * (a Render mix renames a new mix.wav over the old one). A file that changes while it is streamed
 * fails the stream instead of mixing two files; the player reloads it by its new URL.
 */
import { open } from 'node:fs/promises';
import { parseByteRange } from './project-media.js';

/** Bytes read per chunk of a streamed body. */
export const MEDIA_CHUNK_BYTES = 512 * 1024;

export interface MediaFileInfo {
  readonly file: string;
  readonly contentType: string;
  /** From the `stat` done before answering: the identity of the version being served. */
  readonly size: number;
  readonly mtimeMs: number;
}

export interface MediaRequest {
  readonly method: string;
  /** The `Range` header, or null. */
  readonly range: string | null;
}

export class MediaFileChangedError extends Error {
  constructor(file: string) {
    super(`${file} changed while it was streamed`);
    this.name = 'MediaFileChangedError';
  }
}

/** Reads bytes [position, position + length) of `file`, closing it again right away. */
async function readChunk(
  info: MediaFileInfo,
  position: number,
  length: number,
): Promise<Uint8Array> {
  const handle = await open(info.file, 'r');
  try {
    const now = await handle.stat();
    if (now.size !== info.size || now.mtimeMs !== info.mtimeMs) {
      throw new MediaFileChangedError(info.file);
    }
    const bytes = new Uint8Array(length);
    let read = 0;
    while (read < length) {
      const result = await handle.read(bytes, read, length - read, position + read);
      if (result.bytesRead === 0) throw new MediaFileChangedError(info.file);
      read += result.bytesRead;
    }
    return bytes;
  } finally {
    await handle.close();
  }
}

/** Bytes [start, end] (inclusive) of the file, as a pull stream that holds no open handle. */
export function chunkedFileStream(
  info: MediaFileInfo,
  start: number,
  end: number,
  chunkBytes: number = MEDIA_CHUNK_BYTES,
): ReadableStream<Uint8Array> {
  let position = start;
  return new ReadableStream<Uint8Array>(
    {
      async pull(controller) {
        const length = Math.min(chunkBytes, end + 1 - position);
        if (length <= 0) {
          controller.close();
          return;
        }
        const bytes = await readChunk(info, position, length);
        position += length;
        controller.enqueue(bytes);
        if (position > end) controller.close();
      },
    },
    // Pull only when the reader wants more: nothing is read ahead of playback.
    { highWaterMark: 0 },
  );
}

/** 200 with the whole file, 206 with exactly the asked range, or 416 for an unsatisfiable one. */
export function mediaFileResponse(info: MediaFileInfo, request: MediaRequest): Response {
  const { size } = info;
  const headers = new Headers({
    'content-type': info.contentType,
    'accept-ranges': 'bytes',
    'cache-control': 'no-cache',
    'x-content-type-options': 'nosniff',
  });
  const range = parseByteRange(request.range, size);
  if (range === 'unsatisfiable') {
    headers.set('content-range', `bytes */${String(size)}`);
    return new Response(null, { status: 416, headers });
  }
  const start = range?.start ?? 0;
  const end = range?.end ?? size - 1;
  headers.set('content-length', String(Math.max(end - start + 1, 0)));
  if (range) headers.set('content-range', `bytes ${String(start)}-${String(end)}/${String(size)}`);
  const status = range ? 206 : 200;
  if (request.method === 'HEAD' || size === 0) return new Response(null, { status, headers });
  return new Response(chunkedFileStream(info, start, end), { status, headers });
}
