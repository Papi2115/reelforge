/**
 * The default project factory of the production line: one project per film in the channel's
 * projects folder, `<slug of the topic>-<item id>` (stable, so an interrupted run finds the folder
 * it made), with the channel's defaults (style/world unless the item names one, channelId), the
 * genre preset (the item's, else the channel's; ADR-035) and an initial brief.json (topic,
 * language, target length) the `brief` step refines.
 */
import { access } from 'node:fs/promises';
import path from 'node:path';
import { err, ok, type Result } from '@reelforge/claude-bridge';
import { createProject, type CreateProjectOptions } from '@reelforge/project';
import { briefFileSchema, type GenrePresetField, type QueueItem } from '@reelforge/shared';
import { writeProjectJson } from '../files.js';
import { FILES } from '../paths.js';
import { briefFromUser } from './brief.js';
import type { QueueProjectFactory, QueueProjectRequest } from './types.js';

export interface QueueChannelDefaults {
  /** Folder new films of the channel go to (absolute). */
  readonly projectsDir: string;
  /** Style / world id; null = the app's default. */
  readonly defaultStyle: string | null;
  /** The channel's genre preset (PLAN.md#13.8); absent / null = none, an unknown id is ignored. */
  readonly genrePreset?: string | null | undefined;
}

/**
 * The app's new-project defaults. The film's own choices (`style`, `genrePreset`, which fields
 * are explicit) come from the queue item, style availability from `isStyleAvailable`.
 */
export type CreateProjectDefaults = Omit<
  CreateProjectOptions,
  | 'dir'
  | 'title'
  | 'language'
  | 'style'
  | 'channel'
  | 'genrePreset'
  | 'explicitFields'
  | 'isStyleAvailable'
>;

export interface QueueProjectFactoryOptions {
  /** The channel's folder and default style (from channels.json; the app decides the fallbacks). */
  channel(channelId: string): Promise<Result<QueueChannelDefaults, string>>;
  /**
   * Template, styles, git and the app's new-project defaults (characters, mascot, scenes per
   * minute, faster checks): defaults, so a genre preset replaces them.
   */
  readonly create?: CreateProjectDefaults;
  /**
   * Whether the app offers a style right now (a world needs to be wired and, if experimental, the
   * switch on): the preset's first offered style wins. Omitted = createProject's default (the
   * built-in styles with a bible).
   */
  readonly isStyleAvailable?: (id: string) => boolean;
}

const MAX_SLUG = 40;
const MAX_TITLE = 80;

/** ASCII kebab slug of a topic (Polish letters folded), at most 40 characters. */
export function topicSlug(topic: string): string {
  const folded = topic
    .replaceAll('ł', 'l')
    .replaceAll('Ł', 'L')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
  const slug = folded
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_SLUG)
    .replace(/-+$/g, '');
  return slug === '' ? 'film' : slug;
}

export function projectFolderName(item: Pick<QueueItem, 'id' | 'topic'>): string {
  return `${topicSlug(item.topic)}-${item.id}`;
}

export function projectTitle(topic: string): string {
  const trimmed = topic.trim().replace(/\s+/g, ' ');
  return trimmed.length <= MAX_TITLE ? trimmed : `${trimmed.slice(0, MAX_TITLE - 1).trimEnd()}…`;
}

/**
 * The genre preset options of a film (ADR-035): the item's preset (null = none, not even the
 * channel's), else the channel's; the item's own style is the only explicit choice, so the preset
 * replaces the app's defaults (scenes per minute, faster checks) and the channel's style.
 */
export function queueGenrePresetOptions(
  item: Pick<QueueItem, 'genrePreset' | 'style'>,
  isStyleAvailable?: (id: string) => boolean,
): Pick<CreateProjectOptions, 'genrePreset' | 'explicitFields' | 'isStyleAvailable'> {
  const explicitFields: GenrePresetField[] = item.style === undefined ? [] : ['style'];
  return {
    ...(item.genrePreset === undefined ? {} : { genrePreset: item.genrePreset }),
    explicitFields,
    ...(isStyleAvailable === undefined ? {} : { isStyleAvailable }),
  };
}

async function exists(file: string): Promise<boolean> {
  try {
    await access(file);
    return true;
  } catch {
    return false; // missing (or unreadable: createProject reports the real problem)
  }
}

export function createQueueProjectFactory(
  options: QueueProjectFactoryOptions,
): QueueProjectFactory {
  return {
    create: async (request: QueueProjectRequest) => {
      const { item, channelId, targetMinutes } = request;
      const channel = await options.channel(channelId);
      if (!channel.ok) return channel;
      const dir = path.join(channel.value.projectsDir, projectFolderName(item));
      if (!(await exists(path.join(dir, FILES.project)))) {
        const created = await createProject({
          ...options.create,
          dir,
          title: projectTitle(item.topic),
          language: item.language,
          ...(item.style === undefined ? {} : { style: item.style }),
          channel: {
            id: channelId,
            defaultStyle: channel.value.defaultStyle,
            genrePreset: channel.value.genrePreset ?? null,
          },
          ...queueGenrePresetOptions(item, options.isStyleAvailable),
        });
        if (!created.ok) return err(`cannot create the project: ${created.error.message}`);
      }
      const brief = await writeProjectJson(
        dir,
        FILES.brief,
        briefFileSchema,
        briefFromUser(item, targetMinutes),
      );
      if (!brief.ok) return err(brief.error.message);
      return ok({ projectPath: dir });
    },
  };
}
