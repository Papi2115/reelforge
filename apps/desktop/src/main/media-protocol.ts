/**
 * Serves `reelforge-media://project/<path>` (PLAN.md#6.4): audio of the open project for the
 * player's `<audio>` master clock, streamed with HTTP range support so it can seek, and the QA
 * frames under `.reelforge/frames/` as chat thumbnails (PLAN.md#6.6; `?w=` downscales). Only
 * files strictly inside the open project folder are served (also after following links); there is
 * no file:// access from the renderer. `reelforge-media://library/<sha256>.<ext>` serves pictures of
 * the global asset library (PLAN.md#12.19) from its files folder only.
 */
import { realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import { nativeImage, type Session } from 'electron';
import { describeError, type Logger } from './logger.js';
import { mediaFileResponse } from './media-response.js';
import { isInsideFolder } from './project-files.js';
import { isLibraryMediaUrl, resolveLibraryMedia, resolveProjectMedia } from './project-media.js';
import { MEDIA_SCHEME } from '../shared/player-contract.js';

function text(status: number, body: string): Response {
  return new Response(body, { status, headers: { 'content-type': 'text/plain; charset=utf-8' } });
}

function isMissingFile(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT';
}

async function serve(
  request: Request,
  projectDir: string | undefined,
  libraryDir: string | undefined,
  log: Logger,
): Promise<Response> {
  const library = isLibraryMediaUrl(request.url);
  const libraryFiles = libraryDir === undefined ? undefined : path.join(libraryDir, 'files');
  const root = library ? libraryFiles : projectDir;
  const media = library
    ? resolveLibraryMedia(libraryDir, request.url)
    : resolveProjectMedia(projectDir, request.url);
  if (!media.ok || root === undefined) {
    const error = media.ok ? { status: 404, message: 'no project is open' } : media.error;
    log.warn(`refused ${request.url}: ${error.message}`);
    return text(error.status, error.message);
  }
  const { file, contentType } = media.value;
  const [realRoot, realFile] = await Promise.all([realpath(root), realpath(file)]);
  if (!isInsideFolder(realRoot, realFile)) {
    log.warn(`refused ${request.url}: links outside the ${library ? 'library' : 'project'}`);
    return text(403, 'outside the project');
  }
  const info = await stat(realFile);
  if (!info.isFile()) return text(404, 'not a file');
  if (media.value.thumbnailWidth !== undefined) {
    return thumbnail(realFile, media.value.thumbnailWidth);
  }
  return mediaFileResponse(
    { file: realFile, contentType, size: info.size, mtimeMs: info.mtimeMs },
    { method: request.method, range: request.headers.get('range') },
  );
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

/**
 * `currentProjectDir` is read per request, so the protocol always follows the open project;
 * `libraryDir` serves the pictures of the global asset library (PLAN.md#12.19).
 */
export function serveMediaProtocol(
  session: Session,
  currentProjectDir: () => string | undefined,
  log: Logger,
  libraryDir?: string,
): void {
  session.protocol.handle(MEDIA_SCHEME, async (request) => {
    try {
      return await serve(request, currentProjectDir(), libraryDir, log);
    } catch (error) {
      if (isMissingFile(error)) return text(404, 'not found');
      log.error(`cannot serve ${request.url}: ${describeError(error)}`);
      return text(500, 'internal error');
    }
  });
}
