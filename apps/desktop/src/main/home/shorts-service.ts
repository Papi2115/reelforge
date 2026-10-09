/**
 * Shorts from Home (PLAN.md#13.18): "New short from a film" makes the 30 s and 60 s Shorts of a
 * film of the Home list (`createShortsForFilm`, with the film's channel for the end card "Full
 * video on YT: <channel>"), next to the film's folder, and adds them to the recent list so Home
 * shows (and may open) them. A Short's captions switch edits its project.json. One creation at a
 * time. Electron-free.
 */
import path from 'node:path';
import { loadChannels, rememberRecentProject } from '@reelforge/project';
import {
  DEFAULT_SHORT_ANGLES,
  MAX_SHORT_ANGLE_LENGTH,
  SHORT_LENGTHS,
  type ShortLength,
} from '@reelforge/shared';
import type { createShortsForFilm } from '@reelforge/stages';
import type { HomeActionResult } from '../../shared/home-contract.js';
import type { ShortsCreateRequest, ShortsCreateResult } from '../../shared/overview-contract.js';
import { describeError, type Logger } from '../logger.js';
import { projectKey } from '../stages/stage-service-model.js';
import type { ProjectLibrary } from './project-library.js';
import { setShortCaptions, type RenameCommit } from './project-rename.js';

export interface ShortsServiceOptions {
  readonly library: Pick<ProjectLibrary, 'list' | 'knownDir'>;
  /** `<userData>/channels.json` */
  readonly channelsFile: string;
  /** `<userData>/recent-projects.json` (the new Shorts are added to it). */
  readonly recentFile: string;
  /** The project template and the style bibles (as new projects get them). */
  readonly templateDir: string;
  readonly stylesDir: string;
  /** `createShortsForFilm` of @reelforge/stages (a fake in tests). */
  readonly createShorts: typeof createShortsForFilm;
  readonly commit: RenameCommit;
  readonly log: Logger;
}

/**
 * The angles of both Shorts with the user's hint: each keeps its own built-in angle (so the two
 * stay different) and is steered toward the hint. No hint = the built-in angles.
 */
export function shortAngles(
  hint: string | undefined,
): Partial<Record<ShortLength, string>> | undefined {
  const steer = hint?.trim() ?? '';
  if (steer === '') return undefined;
  return Object.fromEntries(
    SHORT_LENGTHS.map((length) => [
      length,
      `${DEFAULT_SHORT_ANGLES[length]}; steer it toward: ${steer}`.slice(0, MAX_SHORT_ANGLE_LENGTH),
    ]),
  );
}

export class ShortsService {
  private creating = false;

  constructor(private readonly options: ShortsServiceOptions) {}

  async create(request: ShortsCreateRequest): Promise<ShortsCreateResult> {
    const film = await this.options.library.knownDir(request.dir);
    if (film === undefined) {
      return { status: 'error', message: 'This film is not in your list any more.' };
    }
    const card = (await this.options.library.list()).find(
      (entry) => projectKey(entry.dir) === projectKey(film),
    );
    if (card?.kind === 'short') {
      return { status: 'error', message: 'A Short is made from a film, not from another Short.' };
    }
    if (card !== undefined && !card.hasScript) {
      return { status: 'error', message: 'The film needs a script first.' };
    }
    if (this.creating) return { status: 'error', message: 'Already making Shorts.' };
    this.creating = true;
    try {
      return await this.createFor(film, request, card?.channelId ?? null);
    } catch (error) {
      this.options.log.warn(`shorts of ${film} failed: ${describeError(error)}`);
      return { status: 'error', message: `The Shorts could not be made: ${describeError(error)}` };
    } finally {
      this.creating = false;
    }
  }

  setCaptions(dir: string, captions: boolean): Promise<HomeActionResult> {
    return this.options.library
      .knownDir(dir)
      .then((known) =>
        known === undefined
          ? { status: 'error', message: 'This project is not in your list any more.' }
          : setShortCaptions(known, captions, this.options.commit),
      );
  }

  private async createFor(
    film: string,
    request: ShortsCreateRequest,
    channelId: string | null,
  ): Promise<ShortsCreateResult> {
    const channels = await loadChannels(this.options.channelsFile);
    if (!channels.ok) {
      return { status: 'error', message: `Channels cannot be read: ${channels.error.message}` };
    }
    const angles = shortAngles(request.angleHint);
    const created = await this.options.createShorts({
      parentDir: film,
      projectsRoot: path.dirname(film),
      channels: channels.value,
      options: {
        captions: request.captions,
        ...(angles === undefined ? {} : { angles }),
        create: { templateDir: this.options.templateDir, stylesDir: this.options.stylesDir },
      },
    });
    if (!created.ok) {
      this.options.log.warn(`shorts of ${film} not made: ${created.error}`);
      return { status: 'error', message: `The Shorts could not be made: ${created.error}` };
    }
    // The longest first, so the 30 s Short ends on top of the recent list.
    for (const short of [...created.value].reverse()) {
      const remembered = await rememberRecentProject(this.options.recentFile, {
        dir: short.dir,
        title: short.title,
        ...(channelId === null ? {} : { channelId }),
      });
      if (!remembered.ok) {
        this.options.log.warn(`recent projects not saved: ${remembered.error.message}`);
      }
    }
    this.options.log.info(`made ${String(created.value.length)} shorts of ${film}`);
    return {
      status: 'ok',
      shorts: created.value.map((short) => ({
        dir: short.dir,
        title: short.title,
        lengthS: short.lengthS,
      })),
    };
  }
}
