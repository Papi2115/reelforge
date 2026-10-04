/**
 * The user's own files (PLAN.md#12.12): an image or video picked or dropped in the app is checked
 * like a download (type by magic bytes, size caps, never executed), stored as
 * `.reelforge/assets/<id>.<ext>` and recorded in assets.json with source `own` and licence `own`
 * (verified: the user's file, never flagged, never credited). The same bytes are stored once
 * (sha256). No network, in every research mode.
 */
import { createHash } from 'node:crypto';
import { readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  OWN_LICENCE,
  type AssetMime,
  type AssetRecord,
  type ResearchMode,
} from '@reelforge/shared';
import { ProjectError, UsageError } from '../errors.js';
import { ASSET_LIMITS, maxBytesFor } from './limits.js';
import { imageDimensions, sniffType } from './magic.js';
import { ASSET_PATHS, readCatalogue, storeDir, updateCatalogue } from './store.js';
import { sanitizeText, TEXT_LIMITS } from './untrusted.js';

/** File name extensions the import accepts (the content still decides). */
export const OWN_ASSET_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'mp4', 'webm'] as const;

export interface OwnImportRequest {
  /** Absolute path of the user's file. */
  readonly file: string;
  /** Default: the file name without its extension. */
  readonly title?: string | undefined;
  /** Default: the file name in words (`nokia_3310-front` -> `nokia 3310 front`). */
  readonly description?: string | undefined;
}

export interface OwnImportOutcome {
  readonly record: AssetRecord;
  /** The same bytes were already in the project (nothing copied). */
  readonly existing: boolean;
}

/** A store file of verified media bytes. */
export interface VerifiedBytes {
  readonly bytes: Buffer;
  readonly sha256: string;
  readonly mime: AssetMime;
  readonly kind: 'image' | 'video';
  readonly ext: string;
  readonly width: number | null;
  readonly height: number | null;
}

/** Type, size and pixel size of `bytes` by content; throws a ProjectError when not allowed. */
export function verifyMediaBytes(bytes: Buffer, label: string): VerifiedBytes {
  const type = sniffType(bytes);
  if (type === undefined) {
    throw new ProjectError(
      `${label} is not an allowed media file (png, jpeg, webp, gif, mp4 or webm by its content)`,
      'pick a picture or a video in one of those formats',
    );
  }
  if (bytes.length > maxBytesFor(type.kind)) {
    throw new ProjectError(
      `${label} is too large (${type.kind}s up to ${String(maxBytesFor(type.kind) / (1024 * 1024))} MB)`,
      'make the file smaller first',
    );
  }
  const size = type.kind === 'image' ? imageDimensions(bytes, type.mime) : undefined;
  return {
    bytes,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    mime: type.mime,
    kind: type.kind,
    ext: type.ext,
    width: size?.width ?? null,
    height: size?.height ?? null,
  };
}

/** Writes `bytes` to `.reelforge/assets/<id>.<ext>` (tmp + rename); returns the record path. */
export async function writeStoreFile(
  root: string,
  id: string,
  verified: VerifiedBytes,
): Promise<string> {
  const dir = await storeDir(root, ASSET_PATHS.files);
  const name = `${id}.${verified.ext}`;
  const temporary = path.join(dir, `${id}.${String(process.pid)}.import.tmp`);
  try {
    await writeFile(temporary, verified.bytes, { flag: 'w' });
    await rename(temporary, path.join(dir, name));
  } catch (error) {
    await rm(temporary, { force: true, maxRetries: 5, retryDelay: 50 });
    throw error;
  }
  return `${ASSET_PATHS.files}/${name}`;
}

function slug(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** `own-<file name>` (kebab case, at most 64 characters), suffixed `-2`, `-3`… when taken. */
export function uniqueAssetId(base: string, taken: ReadonlySet<string>): string {
  const stem = base.slice(0, 58).replace(/-+$/, '');
  if (!taken.has(stem)) return stem;
  for (let suffix = 2; ; suffix += 1) {
    const candidate = `${stem}-${String(suffix)}`;
    if (!taken.has(candidate)) return candidate;
  }
}

export function ownAssetBaseId(fileName: string, sha256: string): string {
  const name = slug(path.parse(fileName).name);
  return name === '' ? `own-${sha256.slice(0, 10)}` : `own-${name}`;
}

/** `nokia_3310-front` -> `nokia 3310 front`. */
function words(fileName: string): string {
  return path
    .parse(fileName)
    .name.replace(/[_\-.]+/g, ' ')
    .trim();
}

async function readUserFile(file: string): Promise<Buffer> {
  if (!path.isAbsolute(file)) throw new UsageError(`not an absolute path: ${file}`);
  const extension = path.extname(file).slice(1).toLowerCase();
  if (!(OWN_ASSET_EXTENSIONS as readonly string[]).includes(extension)) {
    throw new ProjectError(
      `${path.basename(file)}: only ${OWN_ASSET_EXTENSIONS.join(', ')} files can be added`,
      'pick a picture or a video in one of those formats',
    );
  }
  const info = await stat(file);
  if (!info.isFile()) throw new ProjectError(`${path.basename(file)} is not a file`, 'pick a file');
  if (info.size > ASSET_LIMITS.videoBytes) {
    throw new ProjectError(
      `${path.basename(file)} is too large (at most ${String(ASSET_LIMITS.videoBytes / (1024 * 1024))} MB)`,
      'make the file smaller first',
    );
  }
  return readFile(file);
}

/** Imports one of the user's files into the project (`mode` = the project's research mode). */
export async function importOwnAsset(
  root: string,
  request: OwnImportRequest,
  mode: ResearchMode,
  now: () => Date,
): Promise<OwnImportOutcome> {
  const name = path.basename(request.file);
  const verified = verifyMediaBytes(await readUserFile(request.file), name);
  const catalogue = await readCatalogue(root);
  const same = catalogue.assets.find((asset) => asset.sha256 === verified.sha256);
  if (same !== undefined) return { record: same, existing: true };
  const id = uniqueAssetId(
    ownAssetBaseId(name, verified.sha256),
    new Set(catalogue.assets.map((asset) => asset.id)),
  );
  const file = await writeStoreFile(root, id, verified);
  const title = sanitizeText(request.title ?? path.parse(name).name, TEXT_LIMITS.title) || id;
  const description = sanitizeText(request.description ?? words(name), TEXT_LIMITS.description);
  const record: AssetRecord = {
    id,
    kind: verified.kind,
    source: 'own',
    sourceItemId: null,
    sourceUrl: '',
    downloadUrl: '',
    title,
    author: '',
    licence: OWN_LICENCE,
    file,
    sha256: verified.sha256,
    bytes: verified.bytes.length,
    mime: verified.mime,
    width: verified.width,
    height: verified.height,
    mode,
    approved: true,
    fetchedAt: now().toISOString(),
    ...(description === '' ? {} : { description }),
  };
  await updateCatalogue(root, (assets) => [...assets.filter((asset) => asset.id !== id), record]);
  return { record, existing: false };
}

export interface AssetTextEdit {
  readonly title?: string | undefined;
  readonly description?: string | undefined;
}

/** Changes the title / description of asset `id` (the app's Assets panel). */
export async function editAssetText(
  root: string,
  id: string,
  edit: AssetTextEdit,
): Promise<AssetRecord> {
  const catalogue = await updateCatalogue(root, (assets) =>
    assets.map((asset) => {
      if (asset.id !== id) return asset;
      const next: AssetRecord = { ...asset };
      if (edit.title !== undefined) {
        next.title = sanitizeText(edit.title, TEXT_LIMITS.title) || asset.title;
      }
      if (edit.description !== undefined) {
        const description = sanitizeText(edit.description, TEXT_LIMITS.description);
        if (description === '') delete next.description;
        else next.description = description;
      }
      return next;
    }),
  );
  const updated = catalogue.assets.find((asset) => asset.id === id);
  if (updated === undefined) throw new UsageError(`no asset "${id}" in assets.json`);
  return updated;
}
