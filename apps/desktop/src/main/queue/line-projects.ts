/**
 * Where the production line makes a film's project (PLAN.md#13.9): the channel's projects folder
 * (Settings → Channels), else the app's projects folder; the channel's style if the app offers it
 * (a preview world needs Settings → Experimental worlds), else the app's default style — the same
 * fallbacks as the New project form; the app's new-project defaults (characters, mascot, scenes
 * per minute, faster checks) as they are when the film starts.
 */
import { err, ok, type Result } from '@reelforge/claude-bridge';
import { loadChannels } from '@reelforge/project';
import type { AppSettings } from '@reelforge/shared';
import {
  createQueueProjectFactory,
  type QueueChannelDefaults,
  type QueueProjectFactory,
} from '@reelforge/stages';
import { isOfferedStyle } from '../../shared/style-choices.js';

export interface LineProjectOptions {
  readonly channelsFile: string;
  /** The app's projects folder (Documents/ReelForge Projects). */
  readonly defaultProjectsDir: () => string;
  readonly settings: () => AppSettings;
  readonly templateDir: string;
  readonly stylesDir: string;
}

export async function lineChannelDefaults(
  options: LineProjectOptions,
  channelId: string,
): Promise<Result<QueueChannelDefaults, string>> {
  const channels = await loadChannels(options.channelsFile);
  if (!channels.ok) return err(`channels cannot be read: ${channels.error.message}`);
  const channel = channels.value.channels.find((candidate) => candidate.id === channelId);
  if (channel === undefined) return err(`there is no channel "${channelId}" any more`);
  const settings = options.settings();
  const own = channel.defaultStyle ?? null;
  const offered = own !== null && isOfferedStyle(own, settings.experimental.worlds);
  return ok({
    projectsDir: channel.projectsDir ?? options.defaultProjectsDir(),
    defaultStyle: offered ? own : settings.defaultStyle,
  });
}

export function lineProjectFactory(options: LineProjectOptions): QueueProjectFactory {
  return {
    create: (request) => {
      const defaults = options.settings().newProjectDefaults;
      return createQueueProjectFactory({
        channel: (channelId) => lineChannelDefaults(options, channelId),
        create: {
          templateDir: options.templateDir,
          stylesDir: options.stylesDir,
          characters: defaults.characters,
          mascot: defaults.mascot,
          shotsPerMinute: defaults.shotsPerMinute,
          fasterChecks: defaults.fasterChecks,
        },
      }).create(request);
    },
  };
}
