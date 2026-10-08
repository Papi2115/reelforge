/**
 * The Library dialog of the app (PLAN.md#12.19, ADR-015): search the global asset library with
 * filters, favourite / tag / remove entries and "Use in project" (a copy into the open project's
 * assets with provenance `fromLibrary`, no download). Every text is cleaned again before it is
 * shown. Electron-free.
 */
import {
  describeUnknown,
  editLibraryEntry,
  licenceGroup,
  readCatalogue,
  readLibrary,
  readResearchSettings,
  removeFromLibrary,
  sanitizeText,
  sanitizeUrl,
  searchLibrary,
  TEXT_LIMITS,
  useLibraryEntry,
} from '@reelforge/cli/assets';
import type { LibraryEntry } from '@reelforge/shared';
import { FILES } from '@reelforge/stages';
import type {
  AssetActionResult,
  LibraryEditRequest,
  LibraryEntryView,
  LibraryQueryRequest,
  LibraryState,
} from '../../shared/library-contract.js';
import type { Logger } from '../logger.js';

export interface LibraryServiceOptions {
  readonly libraryDir: string;
  readonly projectDir: () => string | undefined;
  /** Autocommit of `paths` (assets.json) of the open project after "Use in project". */
  readonly commit: (dir: string, message: string, paths: readonly string[]) => Promise<void>;
  readonly changed: () => void;
  readonly now?: () => Date;
  readonly log: Logger;
}

export function libraryEntryView(entry: LibraryEntry, inProject: boolean): LibraryEntryView {
  return {
    sha256: entry.sha256,
    assetId: entry.assetId,
    kind: entry.kind,
    title: sanitizeText(entry.title, TEXT_LIMITS.title) || entry.assetId,
    description: sanitizeText(entry.description ?? '', TEXT_LIMITS.description),
    author: sanitizeText(entry.author, TEXT_LIMITS.author),
    source: entry.source,
    sourceUrl: sanitizeUrl(entry.sourceUrl),
    licence: {
      id: sanitizeText(entry.licence.id, TEXT_LIMITS.licence) || 'unknown',
      url: entry.licence.url === null ? null : sanitizeUrl(entry.licence.url),
      verified: entry.licence.verified,
    },
    group: licenceGroup(entry),
    tags: [...entry.tags],
    favorite: entry.favorite,
    originProject: sanitizeText(entry.originProject, 120),
    addedAt: entry.addedAt,
    width: entry.width,
    height: entry.height,
    image: entry.kind === 'image' ? entry.file : null,
    inProject,
  };
}

async function projectSha(dir: string | undefined): Promise<ReadonlySet<string>> {
  if (dir === undefined) return new Set();
  try {
    return new Set((await readCatalogue(dir)).assets.map((asset) => asset.sha256));
  } catch {
    return new Set(); // a damaged assets.json: the Assets panel reports it
  }
}

function failed(error: unknown): AssetActionResult {
  return { status: 'error', message: describeUnknown(error) };
}

export class LibraryService {
  constructor(private readonly options: LibraryServiceOptions) {}

  async state(query: LibraryQueryRequest): Promise<LibraryState> {
    try {
      const dir = this.options.projectDir();
      const [{ library, problem }, inProject] = await Promise.all([
        readLibrary(this.options.libraryDir, { recover: true, now: () => this.now() }),
        projectSha(dir),
      ]);
      const entries = searchLibrary(library, query);
      return {
        status: 'ok',
        entries: entries.map((entry) => libraryEntryView(entry, inProject.has(entry.sha256))),
        total: library.entries.length,
        tags: [...new Set(library.entries.flatMap((entry) => entry.tags))].sort(),
        projectOpen: dir !== undefined,
        problem,
      };
    } catch (error) {
      return { status: 'error', message: describeUnknown(error) };
    }
  }

  private now(): Date {
    return this.options.now?.() ?? new Date();
  }

  async edit(request: LibraryEditRequest): Promise<AssetActionResult> {
    try {
      const entry = await editLibraryEntry(this.options.libraryDir, request.sha256, {
        favorite: request.favorite,
        tags: request.tags,
      });
      return entry === undefined
        ? { status: 'error', message: 'This asset is no longer in the library.' }
        : { status: 'ok', message: null };
    } catch (error) {
      return failed(error);
    }
  }

  async remove(sha256: string): Promise<AssetActionResult> {
    try {
      const removed = await removeFromLibrary(this.options.libraryDir, sha256);
      this.options.changed();
      return removed
        ? { status: 'ok', message: 'Removed from the library (projects keep their copies).' }
        : { status: 'error', message: 'This asset is no longer in the library.' };
    } catch (error) {
      return failed(error);
    }
  }

  async use(sha256: string): Promise<AssetActionResult> {
    const dir = this.options.projectDir();
    if (dir === undefined) return { status: 'error', message: 'No project is open.' };
    try {
      const { library } = await readLibrary(this.options.libraryDir);
      const entry = library.entries.find((candidate) => candidate.sha256 === sha256);
      if (entry === undefined) {
        return { status: 'error', message: 'This asset is no longer in the library.' };
      }
      const mode = await readResearchSettings(dir).then(
        (settings) => settings.mode,
        () => 'off' as const,
      );
      const outcome = await useLibraryEntry(this.options.libraryDir, dir, entry, {
        approved: true,
        mode,
        now: () => this.now(),
      });
      if (outcome.existing) {
        return { status: 'ok', message: `Already in this project as ${outcome.record.id}.` };
      }
      await this.options.commit(dir, `Assets: ${outcome.record.id} from the library`, [
        FILES.assets,
      ]);
      this.options.changed();
      this.options.log.info(`library: ${outcome.record.id} copied into the project`);
      return { status: 'ok', message: `Added to this project as ${outcome.record.id}.` };
    } catch (error) {
      return failed(error);
    }
  }
}
