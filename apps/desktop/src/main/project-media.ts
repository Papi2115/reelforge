/**
 * `reelforge-media://project/<path>` (PLAN.md#6.4): maps a media URL to an audio file of the open
 * project and parses HTTP byte ranges, so the `<audio>` master clock can seek. Also serves the
 * frame PNGs Claude rendered under `.reelforge/frames/` as chat thumbnails (PLAN.md#6.6), downscaled
 * when `?w=<px>` asks for it, and the downloaded asset images and proposal thumbnails under
 * `.reelforge/assets/` (PLAN.md#12.10). Pure (no Electron): the confinement and range rules are
 * unit-tested; links are checked again in media-protocol.ts.
 */
import path from 'node:path';
import { err, ok, type Result } from '@reelforge/claude-bridge';
import { LIBRARY_MEDIA_HOST } from '../shared/library-contract.js';
import { MEDIA_HOST, MEDIA_SCHEME } from '../shared/player-contract.js';
import { isInsideFolder } from './project-files.js';

const MEDIA_TYPES: Readonly<Record<string, string>> = {
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4',
  '.aac': 'audio/aac',
  '.ogg': 'audio/ogg',
  '.opus': 'audio/ogg',
  '.flac': 'audio/flac',
  '.webm': 'audio/webm',
};

const IMAGE_TYPES: Readonly<Record<string, string>> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
};

/** Folders images are served from: QA frames rendered by the `reelforge` CLI, and downloaded
 * assets with the proposal thumbnails of the asset package review (PLAN.md#12.10). */
export const MEDIA_FRAMES_DIR = '.reelforge/frames/';
export const MEDIA_ASSETS_DIR = '.reelforge/assets/';
export const MAX_THUMBNAIL_WIDTH = 1280;

export interface MediaFile {
  readonly file: string;
  readonly contentType: string;
  /** Images only: width to downscale to (`?w=`), when smaller than the image. */
  readonly thumbnailWidth?: number;
}

function thumbnailWidth(url: URL): number | undefined {
  const value = Number(url.searchParams.get('w') ?? '');
  return Number.isInteger(value) && value > 0 ? Math.min(value, MAX_THUMBNAIL_WIDTH) : undefined;
}

export interface MediaError {
  readonly status: 400 | 403 | 404;
  readonly message: string;
}

function failure(status: MediaError['status'], message: string): Result<never, MediaError> {
  return err({ status, message });
}

/** Resolves a media URL inside `projectDir` (lexically; symlinks are checked by the caller). */
export function resolveProjectMedia(
  projectDir: string | undefined,
  requestUrl: string,
): Result<MediaFile, MediaError> {
  if (!URL.canParse(requestUrl)) return failure(400, `not a URL: ${requestUrl}`);
  const url = new URL(requestUrl);
  if (url.protocol !== `${MEDIA_SCHEME}:` || url.host !== MEDIA_HOST) {
    return failure(400, `not a project media URL: ${requestUrl}`);
  }
  if (projectDir === undefined) return failure(404, 'no project is open');
  let relative: string;
  try {
    relative = decodeURIComponent(url.pathname).replace(/^\/+/, '');
  } catch (error) {
    return failure(400, `malformed path in ${requestUrl}: ${String(error)}`);
  }
  if (relative === '' || /[\0\\:]/.test(relative)) {
    return failure(400, `bad media path: ${requestUrl}`);
  }
  const extension = path.extname(relative).toLowerCase();
  const imageType = IMAGE_TYPES[extension];
  // Folder checks on the normalized path (`a/../` cannot leave a served folder).
  const lower = path.posix.normalize(relative).toLowerCase();
  const isFrame = imageType !== undefined && lower.startsWith(MEDIA_FRAMES_DIR);
  const isAsset = imageType !== undefined && lower.startsWith(MEDIA_ASSETS_DIR);
  const contentType = isFrame || isAsset ? imageType : MEDIA_TYPES[extension];
  if (contentType === undefined) return failure(403, `not an audio file or frame: ${relative}`);
  const root = path.resolve(projectDir);
  const file = path.resolve(root, ...relative.split('/'));
  if (!isInsideFolder(root, file)) return failure(403, `${relative} is outside the project`);
  const width = isFrame ? thumbnailWidth(url) : undefined;
  return ok(
    width === undefined ? { file, contentType } : { file, contentType, thumbnailWidth: width },
  );
}

/** True for `reelforge-media://library/…` URLs (pictures of the global asset library). */
export function isLibraryMediaUrl(requestUrl: string): boolean {
  return URL.canParse(requestUrl) && new URL(requestUrl).host === LIBRARY_MEDIA_HOST;
}

/**
 * `reelforge-media://library/<sha256>.<ext>[?w=]` (PLAN.md#12.19): a picture of the global asset
 * library, by its strict file name only (no folders), from `<library>/files/`. PNG/JPEG pictures
 * can be downscaled with `?w=`.
 */
export function resolveLibraryMedia(
  libraryDir: string | undefined,
  requestUrl: string,
): Result<MediaFile, MediaError> {
  if (!URL.canParse(requestUrl)) return failure(400, `not a URL: ${requestUrl}`);
  const url = new URL(requestUrl);
  if (url.protocol !== `${MEDIA_SCHEME}:` || url.host !== LIBRARY_MEDIA_HOST) {
    return failure(400, `not a library media URL: ${requestUrl}`);
  }
  if (libraryDir === undefined) return failure(404, 'no asset library');
  const name = url.pathname.replace(/^\/+/, '');
  const match = /^[0-9a-f]{64}\.(png|jpg|webp|gif)$/.exec(name);
  const contentType = match === null ? undefined : IMAGE_TYPES[`.${match[1] ?? ''}`];
  if (match === null || contentType === undefined) {
    return failure(400, `not a library picture: ${requestUrl}`);
  }
  const file = path.join(libraryDir, 'files', name);
  const width = match[1] === 'png' || match[1] === 'jpg' ? thumbnailWidth(url) : undefined;
  return ok(
    width === undefined ? { file, contentType } : { file, contentType, thumbnailWidth: width },
  );
}

export interface ByteRange {
  readonly start: number;
  /** Inclusive. */
  readonly end: number;
}

/**
 * Parses a single `Range: bytes=…` header against a file of `size` bytes. `undefined` means
 * "send the whole file" (no or unsupported header); 'unsatisfiable' maps to HTTP 416.
 */
export function parseByteRange(
  header: string | null,
  size: number,
): ByteRange | 'unsatisfiable' | undefined {
  if (header === null) return undefined;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match) return undefined;
  const [, first = '', last = ''] = match;
  if (first === '' && last === '') return undefined;
  if (first === '') {
    // Suffix range: the last N bytes.
    const length = Number(last);
    if (length === 0 || size === 0) return 'unsatisfiable';
    return { start: Math.max(size - length, 0), end: size - 1 };
  }
  const start = Number(first);
  if (start >= size) return 'unsatisfiable';
  const end = last === '' ? size - 1 : Math.min(Number(last), size - 1);
  if (end < start) return 'unsatisfiable';
  return { start, end };
}
