/**
 * "Tags and timestamps" of the open project (PLAN.md#13.17): reads `publish/seo.json` and
 * (re)generates it through the stages' `generatePublishSeo` (one Sonnet turn, read-only tools, no
 * web; the deterministic fallback when Claude is unavailable), with the project's channel (name,
 * genre, default tags, notes) as the niche of the channel-wide tags. One generation at a time; the
 * file is committed. Electron-free.
 */
import { loadChannels } from '@reelforge/project';
import { promptModel } from '@reelforge/prompts';
import type { SeoChannelInfo } from '@reelforge/pipeline';
import {
  channelForProject,
  projectFileSchema,
  PUBLISH_SEO_FILE,
  publishSeoFileSchema,
  storyboardFileSchema,
  type AppSettings,
} from '@reelforge/shared';
import { FILES, generatePublishSeo, type ClaudeRunner } from '@reelforge/stages';
import type { PublishSeoGenerateResult, PublishSeoState } from '../../shared/publish-contract.js';
import { describeError, type Logger } from '../logger.js';
import { readProjectJson } from '../project-files.js';

export interface PublishSeoServiceOptions {
  readonly currentProject: () => string | undefined;
  readonly claude: ClaudeRunner;
  readonly settings: () => AppSettings;
  /** `<app data>/channels.json`. */
  readonly channelsFile: string;
  readonly now: () => Date;
  /** Commits publish/seo.json (project autocommit, step `publish`); false when it failed. */
  readonly commit: (dir: string, message: string, paths: readonly string[]) => Promise<boolean>;
  readonly log: Logger;
}

/** The project's channel as the SEO turn sees it; null when the channels cannot be read. */
export async function seoChannelOf(
  dir: string,
  channelsFile: string,
): Promise<SeoChannelInfo | null> {
  const [project, channels] = await Promise.all([
    readProjectJson(dir, FILES.project, projectFileSchema),
    loadChannels(channelsFile),
  ]);
  if (!channels.ok) return null;
  const channelId = project.status === 'ok' ? project.data.channelId : undefined;
  const { channel } = channelForProject(channels.value, { channelId });
  return {
    name: channel.name,
    genre: channel.genrePreset ?? undefined,
    style: channel.defaultStyle ?? (project.status === 'ok' ? project.data.style : undefined),
    tags: channel.publishDefaults?.tags,
    notes: channel.notes,
  };
}

export class PublishSeoService {
  private generating: string | null = null;

  constructor(private readonly options: PublishSeoServiceOptions) {}

  async state(): Promise<PublishSeoState> {
    const dir = this.options.currentProject();
    if (dir === undefined) return { status: 'error', message: 'No project is open.' };
    return this.stateOf(dir);
  }

  async generate(): Promise<PublishSeoGenerateResult> {
    const dir = this.options.currentProject();
    if (dir === undefined) return { status: 'error', message: 'No project is open.' };
    if (this.generating !== null) {
      return { status: 'error', message: 'Already writing the tags and timestamps.' };
    }
    this.generating = dir;
    try {
      const settings = this.options.settings();
      const generated = await generatePublishSeo({
        projectDir: dir,
        claude: this.options.claude,
        model: promptModel('publish-seo', { economy: settings.economy }),
        channel: await seoChannelOf(dir, this.options.channelsFile),
        now: this.options.now,
      });
      if (!generated.ok) return { status: 'error', message: generated.error };
      const { file, fallbackReason, warnings } = generated.value;
      this.options.log.info(
        `tags and timestamps: ${file.source}, ${String(file.chapters.length)} chapters${fallbackReason === null ? '' : ` (${fallbackReason})`}`,
      );
      await this.options.commit(dir, 'Write the tags and timestamps', [PUBLISH_SEO_FILE]);
      this.generating = null;
      return {
        status: 'ok',
        state: await this.stateOf(dir),
        fallbackReason,
        warnings: [...warnings],
      };
    } catch (error) {
      return { status: 'error', message: describeError(error) };
    } finally {
      this.generating = null;
    }
  }

  private async stateOf(dir: string): Promise<PublishSeoState> {
    const [seo, storyboard] = await Promise.all([
      readProjectJson(dir, PUBLISH_SEO_FILE, publishSeoFileSchema),
      readProjectJson(dir, FILES.storyboard, storyboardFileSchema),
    ]);
    return {
      status: 'ok',
      seo: seo.status === 'ok' ? seo.data : null,
      durationS: storyboard.status === 'ok' ? (storyboard.data.shots.at(-1)?.t1 ?? 0) : 0,
      generating: this.generating === dir,
      problem: seo.status === 'error' ? seo.error.message : null,
    };
  }
}
