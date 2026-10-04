/**
 * What the Assets panel changes in the open project (PLAN.md#12.12, #12.19): import the user's own
 * files (picked in main's file dialog or dropped on the panel; checked by content like a download,
 * no network), edit an asset's title / description, remove an asset, and save an asset to the
 * global library or take it out. Every change to assets.json is committed. One action at a time.
 * Electron-free (the file picker and the commit are injected).
 */
import path from 'node:path';
import {
  addToLibrary,
  describeUnknown,
  editAssetText,
  importOwnAsset,
  readCatalogue,
  readResearchSettings,
  removeFromCatalogue,
  removeFromLibrary,
} from '@reelforge/cli/assets';
import type { ResearchMode } from '@reelforge/shared';
import type {
  AssetsEditRequest,
  AssetsImportRequest,
  AssetsLibraryRequest,
} from '../../shared/assets-contract.js';
import type { AssetActionResult } from '../../shared/library-contract.js';
import type { Logger } from '../logger.js';

export interface AssetActionsOptions {
  readonly projectDir: () => string | undefined;
  /** The global asset library folder. */
  readonly libraryDir: string;
  /** App setting: own imports go into the library too (default off). */
  readonly saveOwnToLibrary: () => boolean;
  /** Main's file picker (images and videos); undefined when cancelled. */
  readonly pickFiles: () => Promise<readonly string[] | undefined>;
  /** Autocommit of the project after a change of assets.json. */
  readonly commit: (dir: string, message: string) => Promise<void>;
  /** assets.json changed: the pipeline state may have changed. */
  readonly changed: () => void;
  readonly now?: () => Date;
  readonly log: Logger;
}

const NO_PROJECT: AssetActionResult = { status: 'error', message: 'No project is open.' };

function plural(count: number, word: string): string {
  return `${String(count)} ${word}${count === 1 ? '' : 's'}`;
}

/** "Added 2 files." / "Added 1 file; 1 was already in the project; could not add x.txt: …" */
export function importMessage(
  added: number,
  existing: number,
  failures: readonly string[],
): string {
  const parts = [added === 0 ? 'No file added' : `Added ${plural(added, 'file')}`];
  if (existing > 0) {
    parts.push(`${String(existing)} ${existing === 1 ? 'was' : 'were'} already in the project`);
  }
  if (failures.length > 0) parts.push(`could not add ${failures.join('; ')}`);
  return `${parts.join('; ')}.`;
}

export class AssetActions {
  private queue: Promise<unknown> = Promise.resolve();

  constructor(private readonly options: AssetActionsOptions) {}

  private serial(run: (dir: string) => Promise<AssetActionResult>): Promise<AssetActionResult> {
    const dir = this.options.projectDir();
    if (dir === undefined) return Promise.resolve(NO_PROJECT);
    const next = this.queue.then(() =>
      run(dir).catch((error: unknown): AssetActionResult => ({
        status: 'error',
        message: describeUnknown(error),
      })),
    );
    this.queue = next;
    return next;
  }

  private now(): Date {
    return this.options.now?.() ?? new Date();
  }

  private async finish(dir: string, message: string): Promise<void> {
    await this.options.commit(dir, message);
    this.options.changed();
  }

  async import(request: AssetsImportRequest): Promise<AssetActionResult> {
    const paths = request.paths ?? (await this.options.pickFiles());
    if (paths === undefined || paths.length === 0) return { status: 'cancelled', message: null };
    return this.serial(async (dir) => {
      const mode: ResearchMode = await readResearchSettings(dir).then(
        (settings) => settings.mode,
        () => 'off' as const,
      );
      let added = 0;
      let existing = 0;
      const failures: string[] = [];
      for (const file of paths) {
        try {
          const outcome = await importOwnAsset(dir, { file }, mode, () => this.now());
          if (outcome.existing) existing += 1;
          else added += 1;
          if (!outcome.existing && this.options.saveOwnToLibrary()) {
            await addToLibrary(this.options.libraryDir, {
              projectRoot: dir,
              record: outcome.record,
              now: () => this.now(),
            });
          }
        } catch (error) {
          failures.push(`${path.basename(file)}: ${describeUnknown(error)}`);
        }
      }
      this.options.log.info(
        `own assets: ${String(added)} added, ${String(existing)} existing, ${String(failures.length)} failed`,
      );
      if (added > 0) await this.finish(dir, `Assets: added ${plural(added, 'own file')}`);
      return {
        status: added === 0 && existing === 0 ? 'error' : 'ok',
        message: importMessage(added, existing, failures),
      };
    });
  }

  edit(request: AssetsEditRequest): Promise<AssetActionResult> {
    return this.serial(async (dir) => {
      const record = await editAssetText(dir, request.id, {
        title: request.title,
        description: request.description,
      });
      await this.finish(dir, `Assets: described ${record.id}`);
      return { status: 'ok', message: null };
    });
  }

  remove(id: string): Promise<AssetActionResult> {
    return this.serial(async (dir) => {
      const removed = await removeFromCatalogue(dir, id);
      if (removed === undefined) return { status: 'error', message: `No asset "${id}".` };
      await this.finish(dir, `Assets: removed ${id}`);
      return { status: 'ok', message: `Removed ${removed.title || id} from this project.` };
    });
  }

  /** Saves the asset's bytes to the library (on) or removes the library entry (off). */
  setInLibrary(request: AssetsLibraryRequest): Promise<AssetActionResult> {
    return this.serial(async (dir) => {
      const record = (await readCatalogue(dir)).assets.find((asset) => asset.id === request.id);
      if (record === undefined) return { status: 'error', message: `No asset "${request.id}".` };
      if (!request.save) {
        await removeFromLibrary(this.options.libraryDir, record.sha256);
        this.options.changed();
        return { status: 'ok', message: 'Removed from the asset library.' };
      }
      await addToLibrary(this.options.libraryDir, {
        projectRoot: dir,
        record,
        now: () => this.now(),
      });
      this.options.changed();
      return { status: 'ok', message: 'Saved to the asset library.' };
    });
  }
}
