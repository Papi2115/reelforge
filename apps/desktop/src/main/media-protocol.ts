/**
 * Serves `reelforge-media://project/<path>` (PLAN.md#6.4): audio of the open project for the
 * player's `<audio>` master clock, streamed with HTTP range support so it can seek, and the QA
 * frames under `.reelforge/frames/` as chat thumbnails (PLAN.md#6.6; `?w=` downscales). Only
 * files strictly inside the open project folder are served (also after following links); there is
 * no file:// access from the renderer.
 */
import { createReadStream } from 'node:fs';
import { open, realpath, stat } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { nativeImage, type Session } from 'electron';
import { describeError, type Logger } from './logger.js';
import { isInsideFolder } from './project-files.js';
import { limitRange, parseByteRange, resolveProjectMedia } from './project-media.js';
import { MEDIA_SCHEME } from '../shared/player-contract.js';

function text(status: number, body: string): Response {
  return new Response(body, { status, headers: { 'content-type': 'text/plain; charset=utf-8' } });
}

function isMissingFile(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT';
}

function fileBody(file: string, start: number, end: number): ReadableStream<Uint8Array> {
  return Readable.toWeb(createReadStream(file, { start, end })) as ReadableStream<Uint8Array>;
}

/** Bytes [start, end] read at once: the file is closed before the response is sent. */
async function fileBytes(file: string, start: number, end: number): Promise<Uint8Array> {
  const handle = await open(file, 'r');
  try {
    const bytes = new Uint8Array(end - start + 1);
    let read = 0;
    while (read < bytes.length) {
      const result = await handle.read(bytes, read, bytes.length - read, start + read);
      if (result.bytesRead === 0) break;
      read += result.bytesRead;
    }
    return bytes.subarray(0, read);
  } finally {
    await handle.close();
  }
}

async function serve(
  request: Request,
  projectDir: string | undefined,
  log: Logger,
): Promise<Response> {
  const media = resolveProjectMedia(projectDir, request.url);
  if (!media.ok || projectDir === undefined) {
    const error = media.ok ? { status: 404, message: 'no project is open' } : media.error;
    log.warn(`refused ${request.url}: ${error.message}`);
    return text(error.status, error.message);
  }
  const { file, contentType } = media.value;
  const [realRoot, realFile] = await Promise.all([realpath(projectDir), realpath(file)]);
  if (!isInsideFolder(realRoot, realFile)) {
    log.warn(`refused ${request.url}: links outside the project`);
    return text(403, 'outside the project');
  }
  const info = await stat(realFile);
  if (!info.isFile()) return text(404, 'not a file');
  if (media.value.thumbnailWidth !== undefined) {
    return thumbnail(realFile, media.value.thumbnailWidth);
  }
  const size = info.size;
  const headers = new Headers({
    'content-type': contentType,
    'accept-ranges': 'bytes',
    'cache-control': 'no-cache',
    'x-content-type-options': 'nosniff',
  });
  const asked = parseByteRange(request.headers.get('range'), size);
  const range = asked === undefined || asked === 'unsatisfiable' ? asked : limitRange(asked);
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
  if (range) return new Response(await fileBytes(realFile, start, end), { status, headers });
  return new Response(fileBody(realFile, start, end), { status, headers });
}

/** A frame PNG scaled down to `width` (small chat thumbnails instead of full 640/1080p frames). */
function thumbnail(file: string, width: number): Response {
  const image = nativeImage.createFromPath(file);
  if (image.isEmpty()) return text(415, 'not a readable image');
  const size = image.getSize();
  const scaled = size.width <= width ? image : image.resize({ width, quality: 'good' });
  return new Response(new Uint8Array(scaled.toPNG()), {
    status: 200,
    headers: {
      'content-type': 'image/png',
      'cache-control': 'no-cache',
      'x-content-type-options': 'nosniff',
    },
  });
}

/** `currentProjectDir` is read per request, so the protocol always follows the open project. */
export function serveMediaProtocol(
  session: Session,
  currentProjectDir: () => string | undefined,
  log: Logger,
): void {
  session.protocol.handle(MEDIA_SCHEME, async (request) => {
    try {
      return await serve(request, currentProjectDir(), log);
    } catch (error) {
      if (isMissingFile(error)) return text(404, 'not found');
      log.error(`cannot serve ${request.url}: ${describeError(error)}`);
      return text(500, 'internal error');
    }
  });
}
