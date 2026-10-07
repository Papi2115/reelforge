/**
 * The channel a new project goes to (PLAN.md#13.13): the one the New project form names, else the
 * default channel. Its default style applies when the form names none, if the app offers it
 * (a preview world needs Settings → Experimental worlds). Without a channel store (tests, older
 * wiring) nothing changes; a broken store does not block a project of the default channel.
 */
import { err, loadChannels, ok, type Result } from '@reelforge/project';
import type { Channel } from '@reelforge/shared';
import type { ProjectErrorInfo } from '../../shared/project-contract.js';
import { isOfferedStyle } from '../../shared/style-choices.js';
import type { Logger } from '../logger.js';

export interface NewProjectChannel {
  readonly channel: Channel;
  /** The channel's default style when the app offers it; undefined = none / not offered. */
  readonly style: string | undefined;
}

export async function newProjectChannel(
  channelsFile: string | undefined,
  channelId: string | undefined,
  experimentalWorlds: boolean,
  log: Logger,
): Promise<Result<NewProjectChannel | undefined, ProjectErrorInfo>> {
  if (channelsFile === undefined) {
    return channelId === undefined
      ? ok(undefined)
      : err({ kind: 'invalid-argument', message: 'channels are not available in this build' });
  }
  const channels = await loadChannels(channelsFile);
  if (!channels.ok) {
    if (channelId === undefined) {
      log.warn(`channels unreadable, creating the project without one: ${channels.error.message}`);
      return ok(undefined);
    }
    return err({ kind: channels.error.kind, message: channels.error.message });
  }
  const id = channelId ?? channels.value.defaultChannelId;
  const channel = channels.value.channels.find((candidate) => candidate.id === id);
  if (channel === undefined) {
    return err({ kind: 'invalid-argument', message: `there is no channel "${id}"` });
  }
  const style = channel.defaultStyle ?? undefined;
  if (style !== undefined && !isOfferedStyle(style, experimentalWorlds)) {
    log.warn(`channel ${channel.id}: default style "${style}" is not offered; using the app's`);
    return ok({ channel, style: undefined });
  }
  return ok({ channel, style });
}
