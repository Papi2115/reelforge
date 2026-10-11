/**
 * The project overview (PLAN.md#13.16 part B): one project of the Home list with its uploaded
 * YouTube thumbnail, film facts, its Shorts (or, for a Short, its film); uploading / removing the
 * thumbnail (`publish/thumbnail.png|jpg`, one at a time, written atomically and committed) and
 * showing the newest export. Only folders of the Home list are served. Electron-free: the file
 * picker, the picture reader and the file browser are injected.
 */
import { copyFile, mkdir, rename, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { supportsShorts } from '@reelforge/shared';
import type { HomeActionResult, HomeProject } from '../../shared/home-contract.js';
import type {
  OverviewThumbnail,
  ProjectOverview,
  ProjectOverviewResult,
  ThumbnailResult,
} from '../../shared/overview-contract.js';
import { describeError, type Logger } from '../logger.js';
import { projectKey } from '../stages/stage-service-model.js';
import { filmFacts, latestExport } from './film-facts.js';
import { thumbnailOrigin } from './opening-thumbnail.js';
import type { ProjectLibrary } from './project-library.js';
import type { RenameCommit } from './project-rename.js';

/** The uploaded thumbnail's possible files (one at most is kept). */
export const UPLOADED_THUMBNAILS = [
  'publish/thumbnail.png',
  'publish/thumbnail.jpg',
  'publish/thumbnail.jpeg',
] as const;

/** Bigger files are refused (YouTube takes 2 MB; this only stops a wrong pick). */
export const MAX_THUMBNAIL_UPLOAD_BYTES = 50 * 1024 * 1024;

/** A picture read by the app (nativeImage): a scaled data URL and the original size. */
export interface PictureInfo {
  readonly dataUrl: string;
  readonly width: number;
  readonly height: number;
}

export interface OverviewServiceOptions {
  readonly library: Pick<ProjectLibrary, 'list' | 'knownDir'>;
  /** Reads a picture file; null when it is not a picture. */
  readonly picture: (file: string) => Promise<PictureInfo | null>;
  /** The PNG / JPEG file picker; undefined when cancelled. */
  readonly pickImage: () => Promise<string | undefined>;
  /** Shows a file in the system's file browser. */
  readonly showItem: (file: string) => void;
  readonly commit: RenameCommit;
  readonly log: Logger;
}

const NOT_LISTED = 'This project is not in your list any more.';

function folderName(dir: string): string {
  return path.basename(dir) || dir;
}

async function sizeOf(file: string): Promise<number | undefined> {
  try {
    const info = await stat(file);
    return info.isFile() ? info.size : undefined;
  } catch {
    return undefined; // missing: no such thumbnail
  }
}

/** `thumbnail.png` / `thumbnail.jpg` for a picked file; undefined for any other type. */
export function thumbnailTarget(picked: string): string | undefined {
  const extension = path.extname(picked).toLowerCase();
  if (extension === '.png') return 'publish/thumbnail.png';
  if (extension === '.jpg' || extension === '.jpeg') return 'publish/thumbnail.jpg';
  return undefined;
}

export class OverviewService {
  constructor(private readonly options: OverviewServiceOptions) {}

  async overview(dir: string): Promise<ProjectOverviewResult> {
    const known = await this.options.library.knownDir(dir);
    if (known === undefined) return { status: 'error', message: NOT_LISTED };
    try {
      return { status: 'ok', overview: await this.build(known) };
    } catch (error) {
      this.options.log.warn(`overview of ${known} failed: ${describeError(error)}`);
      return {
        status: 'error',
        message: `The overview could not be read: ${describeError(error)}`,
      };
    }
  }

  async uploadThumbnail(dir: string): Promise<ThumbnailResult> {
    const known = await this.options.library.knownDir(dir);
    if (known === undefined) return { status: 'error', message: NOT_LISTED };
    const picked = await this.options.pickImage();
    if (picked === undefined) return { status: 'cancelled' };
    const target = thumbnailTarget(picked);
    if (target === undefined) {
      return { status: 'error', message: 'Pick a PNG or JPEG picture.' };
    }
    const bytes = await sizeOf(picked);
    if (bytes === undefined) return { status: 'error', message: 'The picture cannot be read.' };
    if (bytes > MAX_THUMBNAIL_UPLOAD_BYTES) {
      return { status: 'error', message: 'This file is far too big for a thumbnail.' };
    }
    if ((await this.options.picture(picked)) === null) {
      return { status: 'error', message: 'This file is not a PNG or JPEG picture.' };
    }
    const file = path.join(known, target);
    const temporary = `${file}.tmp`;
    try {
      await mkdir(path.dirname(file), { recursive: true });
      // Copy next to it, then rename: atomic, and the folder's time changes (Home's card cache).
      await copyFile(picked, temporary);
      await rename(temporary, file);
      await this.removeOthers(known, target);
    } catch (error) {
      this.options.log.warn(`thumbnail upload to ${known} failed: ${describeError(error)}`);
      await rm(temporary, { force: true }).catch((cleanup: unknown) => {
        this.options.log.warn(`cannot remove ${temporary}: ${describeError(cleanup)}`);
      });
      return {
        status: 'error',
        message: `The thumbnail could not be saved: ${describeError(error)}`,
      };
    }
    await this.options.commit(known, 'Thumbnail uploaded', UPLOADED_THUMBNAILS);
    return this.thumbnailResult(known);
  }

  async removeThumbnail(dir: string): Promise<ThumbnailResult> {
    const known = await this.options.library.knownDir(dir);
    if (known === undefined) return { status: 'error', message: NOT_LISTED };
    try {
      await this.removeOthers(known, undefined);
    } catch (error) {
      return {
        status: 'error',
        message: `The thumbnail could not be removed: ${describeError(error)}`,
      };
    }
    await this.options.commit(known, 'Thumbnail removed', UPLOADED_THUMBNAILS);
    return this.thumbnailResult(known);
  }

  async showExport(dir: string): Promise<HomeActionResult> {
    const known = await this.options.library.knownDir(dir);
    if (known === undefined) return { status: 'error', message: NOT_LISTED };
    const video = await latestExport(known);
    if (video === undefined) return { status: 'error', message: 'There is no export yet.' };
    this.options.showItem(video.file);
    return { status: 'ok' };
  }

  private async thumbnailResult(dir: string): Promise<ThumbnailResult> {
    const result = await this.overview(dir);
    return result.status === 'ok' ? result : { status: 'error', message: result.message };
  }

  /** Removes every uploaded thumbnail but `keep`. */
  private async removeOthers(dir: string, keep: string | undefined): Promise<void> {
    for (const relative of UPLOADED_THUMBNAILS) {
      if (relative !== keep) await rm(path.join(dir, relative), { force: true });
    }
  }

  private async thumbnail(dir: string): Promise<OverviewThumbnail | null> {
    for (const relative of UPLOADED_THUMBNAILS) {
      const file = path.join(dir, relative);
      const bytes = await sizeOf(file);
      if (bytes === undefined) continue;
      const picture = await this.options.picture(file);
      if (picture === null) {
        this.options.log.warn(`thumbnail ${file} is not a readable picture`);
        return null;
      }
      return {
        fileName: path.basename(file),
        picture: picture.dataUrl,
        width: picture.width,
        height: picture.height,
        bytes,
        origin: await thumbnailOrigin(dir, file),
      };
    }
    return null;
  }

  private async build(dir: string): Promise<ProjectOverview> {
    const cards = await this.options.library.list();
    const key = projectKey(dir);
    const card = cards.find((entry) => projectKey(entry.dir) === key);
    if (card === undefined) throw new Error(NOT_LISTED);
    const [thumbnail, facts] = await Promise.all([this.thumbnail(dir), filmFacts(dir)]);
    return {
      card,
      thumbnail,
      facts,
      shorts: card.kind === 'film' ? shortsOf(key, cards) : [],
      shortsSupported: card.style !== null && supportsShorts(card.style),
      parent: parentOf(card, cards),
    };
  }
}

/** The Shorts of the film `filmKey`, 30 s first. */
export function shortsOf(filmKey: string, cards: readonly HomeProject[]): HomeProject[] {
  return cards
    .filter(
      (entry) =>
        entry.kind === 'short' &&
        entry.parentDir !== null &&
        projectKey(entry.parentDir) === filmKey,
    )
    .sort((first, second) => (first.short?.lengthS ?? 0) - (second.short?.lengthS ?? 0));
}

function parentOf(card: HomeProject, cards: readonly HomeProject[]): ProjectOverview['parent'] {
  if (card.kind !== 'short' || card.parentDir === null) return null;
  const key = projectKey(card.parentDir);
  const film = cards.find((entry) => projectKey(entry.dir) === key);
  return {
    dir: film?.dir ?? card.parentDir,
    title: film?.title ?? card.parentTitle ?? folderName(card.parentDir),
    known: film !== undefined,
  };
}
