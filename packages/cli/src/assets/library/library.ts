/**
 * Operations of the global asset library (PLAN.md#12.19, ADR-015): save a project asset into it
 * (deduplicated by sha256, source / author / licence / links kept, so an unverified licence stays
 * flagged), favourite and tag entries, remove them, search, and use an entry in a project: the
 * bytes are copied into the project's store (`fromLibrary`), never downloaded again. No network.
 */
import { existsSync } from 'node:fs';
import { readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  assetIdSchema,
  normaliseLibraryTag,
  type AssetLibraryFile,
  type AssetRecord,
  type LibraryEntry,
  type LibraryLicenceFilter,
  type ResearchMode,
} from '@reelforge/shared';
import { ProjectError, UsageError } from '../../errors.js';
import { resolveInProject } from '../../project/paths.js';
import { uniqueAssetId, verifyMediaBytes, writeStoreFile, type VerifiedBytes } from '../own.js';
import { readCatalogue, updateCatalogue } from '../store.js';
import { sanitizeText } from '../untrusted.js';
import { libraryFilesDir, mutateLibrary } from './store.js';

export interface LibraryAddRequest {
  readonly projectRoot: string;
  readonly record: AssetRecord;
  readonly now: () => Date;
}

export interface LibraryAddOutcome {
  readonly entry: LibraryEntry;
  /** These bytes were already in the library (nothing copied). */
  readonly existing: boolean;
}

function entryFrom(
  record: AssetRecord,
  verified: VerifiedBytes,
  origin: string,
  now: Date,
): LibraryEntry {
  const entry: LibraryEntry = {
    sha256: verified.sha256,
    file: `${verified.sha256}.${verified.ext}`,
    kind: verified.kind,
    mime: verified.mime,
    bytes: verified.bytes.length,
    width: record.width ?? verified.width,
    height: record.height ?? verified.height,
    assetId: record.id,
    source: record.source,
    sourceItemId: record.sourceItemId,
    sourceUrl: record.sourceUrl,
    downloadUrl: record.downloadUrl,
    title: record.title,
    author: record.author,
    licence: record.licence,
    tags: [],
    favorite: false,
    addedAt: now.toISOString(),
    originProject: sanitizeText(origin, 120),
  };
  return record.description === undefined ? entry : { ...entry, description: record.description };
}

async function writeLibraryFile(dir: string, name: string, bytes: Buffer): Promise<void> {
  const target = path.join(libraryFilesDir(dir), name);
  if (existsSync(target)) return;
  const temporary = `${target}.${String(process.pid)}.tmp`;
  try {
    await writeFile(temporary, bytes);
    await rename(temporary, target);
  } catch (error) {
    await rm(temporary, { force: true, maxRetries: 5, retryDelay: 50 });
    throw error;
  }
}

/** Saves a project asset into the library (bytes checked against the record's sha256). */
export function addToLibrary(dir: string, request: LibraryAddRequest): Promise<LibraryAddOutcome> {
  return mutateLibrary<LibraryAddOutcome>(
    dir,
    async (library) => {
      const { record } = request;
      const known = library.entries.find((entry) => entry.sha256 === record.sha256);
      if (known !== undefined) return { result: { entry: known, existing: true } };
      const file = resolveInProject(request.projectRoot, record.file, 'asset file');
      const verified = verifyMediaBytes(await readFile(file), record.id);
      if (verified.sha256 !== record.sha256) {
        throw new ProjectError(
          `the file of ${record.id} changed since it was added (sha256 differs)`,
          'add the file to the project again',
        );
      }
      const entry = entryFrom(
        record,
        verified,
        path.basename(path.resolve(request.projectRoot)),
        request.now(),
      );
      await writeLibraryFile(dir, entry.file, verified.bytes);
      return {
        library: { ...library, entries: [...library.entries, entry] },
        result: { entry, existing: false },
      };
    },
    request.now,
  );
}

/** Removes an entry and its file; false when there was none. */
export function removeFromLibrary(dir: string, sha256: string): Promise<boolean> {
  return mutateLibrary<boolean>(dir, async (library) => {
    const entry = library.entries.find((candidate) => candidate.sha256 === sha256);
    if (entry === undefined) return { result: false };
    await rm(path.join(libraryFilesDir(dir), entry.file), { force: true, maxRetries: 5 });
    const entries = library.entries.filter((candidate) => candidate !== entry);
    return { library: { ...library, entries }, result: true };
  });
}

export interface LibraryEntryEdit {
  readonly favorite?: boolean | undefined;
  /** Replaces the tags (normalised, deduplicated, at most 20). */
  readonly tags?: readonly string[] | undefined;
}

export function normaliseTags(tags: readonly string[]): string[] {
  return [...new Set(tags.map(normaliseLibraryTag).filter((tag) => tag !== ''))].slice(0, 20);
}

/** Favourite / tags of an entry; the updated entry, undefined when there is none. */
export function editLibraryEntry(
  dir: string,
  sha256: string,
  edit: LibraryEntryEdit,
): Promise<LibraryEntry | undefined> {
  return mutateLibrary<LibraryEntry | undefined>(dir, (library) => {
    const entry = library.entries.find((candidate) => candidate.sha256 === sha256);
    if (entry === undefined) return Promise.resolve({ result: undefined });
    const next: LibraryEntry = {
      ...entry,
      ...(edit.favorite === undefined ? {} : { favorite: edit.favorite }),
      ...(edit.tags === undefined ? {} : { tags: normaliseTags(edit.tags) }),
    };
    const entries = library.entries.map((candidate) => (candidate === entry ? next : candidate));
    return Promise.resolve({ library: { ...library, entries }, result: next });
  });
}

export interface LibraryQuery {
  /** Words matched against title, description, author, tags, asset id and origin project. */
  readonly text?: string | undefined;
  readonly tag?: string | undefined;
  readonly kind?: 'image' | 'video' | undefined;
  readonly licence?: LibraryLicenceFilter | undefined;
  readonly favorites?: boolean | undefined;
}

export function licenceGroup(
  entry: Pick<LibraryEntry, 'source' | 'licence'>,
): LibraryLicenceFilter {
  if (entry.source === 'own') return 'own';
  return entry.licence.verified ? 'verified' : 'unverified';
}

/** Matching entries: favourites first, then the newest. Pure. */
export function searchLibrary(library: AssetLibraryFile, query: LibraryQuery): LibraryEntry[] {
  const words = (query.text ?? '').toLowerCase().split(/\s+/).filter(Boolean);
  const tag = query.tag === undefined ? '' : normaliseLibraryTag(query.tag);
  return library.entries
    .filter((entry) => {
      if (query.kind !== undefined && entry.kind !== query.kind) return false;
      if (query.licence !== undefined && licenceGroup(entry) !== query.licence) return false;
      if (query.favorites === true && !entry.favorite) return false;
      if (tag !== '' && !entry.tags.includes(tag)) return false;
      const haystack = [
        entry.title,
        entry.description ?? '',
        entry.author,
        entry.assetId,
        entry.originProject,
        ...entry.tags,
      ]
        .join(' ')
        .toLowerCase();
      return words.every((word) => haystack.includes(word));
    })
    .sort(
      (a, b) =>
        Number(b.favorite) - Number(a.favorite) ||
        b.addedAt.localeCompare(a.addedAt) ||
        a.sha256.localeCompare(b.sha256),
    );
}

/** Short key the CLI prints: the first 12 hex digits of the sha256. */
export function libraryKey(entry: Pick<LibraryEntry, 'sha256'>): string {
  return entry.sha256.slice(0, 12);
}

/** An entry by key: a sha256 prefix (8+ hex digits) or its asset id, when unique. */
export function findLibraryEntry(library: AssetLibraryFile, key: string): LibraryEntry | undefined {
  const lower = key.trim().toLowerCase();
  const matches = /^[0-9a-f]{8,64}$/.test(lower)
    ? library.entries.filter((entry) => entry.sha256.startsWith(lower))
    : library.entries.filter((entry) => entry.assetId === lower);
  return matches.length === 1 ? matches[0] : undefined;
}

export interface LibraryUseRequest {
  /** Asset id in the project (default: the entry's id, suffixed when taken). */
  readonly as?: string | undefined;
  /** The user picked it in the app (true) or the runtime Claude did (false). */
  readonly approved: boolean;
  readonly mode: ResearchMode;
  readonly now: () => Date;
}

export interface LibraryUseOutcome {
  readonly record: AssetRecord;
  /** The project already had these bytes (nothing copied). */
  readonly existing: boolean;
}

function chosenId(entry: LibraryEntry, requested: string | undefined, taken: Set<string>): string {
  if (requested === undefined) return uniqueAssetId(entry.assetId, taken);
  if (!assetIdSchema.safeParse(requested).success) {
    throw new UsageError(`--as "${requested}": use 1–64 lower-case letters, digits and dashes`);
  }
  if (taken.has(requested)) {
    throw new UsageError(`asset id "${requested}" is already used in this project; pick another`);
  }
  return requested;
}

/** Copies a library entry into the project's store and assets.json (zero network). */
export async function useLibraryEntry(
  dir: string,
  projectRoot: string,
  entry: LibraryEntry,
  request: LibraryUseRequest,
): Promise<LibraryUseOutcome> {
  const catalogue = await readCatalogue(projectRoot);
  const same = catalogue.assets.find((asset) => asset.sha256 === entry.sha256);
  if (same !== undefined) return { record: same, existing: true };
  const verified = verifyMediaBytes(
    await readFile(path.join(libraryFilesDir(dir), entry.file)),
    entry.assetId,
  );
  if (verified.sha256 !== entry.sha256) {
    throw new ProjectError(
      `the library file of ${entry.assetId} is damaged (sha256 differs)`,
      'remove it from the library and add it again from a project',
    );
  }
  const id = chosenId(entry, request.as, new Set(catalogue.assets.map((asset) => asset.id)));
  const file = await writeStoreFile(projectRoot, id, verified);
  const record: AssetRecord = {
    id,
    kind: entry.kind,
    source: entry.source,
    sourceItemId: entry.sourceItemId,
    sourceUrl: entry.sourceUrl,
    downloadUrl: entry.downloadUrl,
    title: entry.title,
    author: entry.author,
    licence: entry.licence,
    file,
    sha256: entry.sha256,
    bytes: verified.bytes.length,
    mime: verified.mime,
    width: entry.width,
    height: entry.height,
    mode: request.mode,
    approved: entry.source === 'own' || request.approved,
    fetchedAt: request.now().toISOString(),
    ...(entry.description === undefined ? {} : { description: entry.description }),
    fromLibrary: true,
  };
  await updateCatalogue(projectRoot, (assets) => [...assets, record]);
  return { record, existing: false };
}
