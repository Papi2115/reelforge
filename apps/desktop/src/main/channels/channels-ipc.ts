/**
 * IPC handlers of Channels (PLAN.md#13.13, ADR-031), merged into `registerIpc` by main.ts. The
 * channel list comes from the store in `@reelforge/project` (`<userData>/channels.json`); secrets
 * from the ChannelSecretStore. Secret handlers answer with `present` only — a value never goes
 * back to the renderer and never reaches a log line.
 */
import {
  createChannel,
  deleteChannel,
  loadChannels,
  projectsInChannel,
  reorderChannels,
  updateChannel,
  type ChannelError,
  type ChannelResult,
} from '@reelforge/project';
import type { ChannelsFile } from '@reelforge/shared';
import type {
  ChannelSecretFlags,
  ChannelSecretResult,
  ChannelsResult,
  ChannelView,
} from '../../shared/channels-contract.js';
import type { InvokeHandlers } from '../ipc-router.js';
import type { Logger } from '../logger.js';
import type { ChannelSecretStore, SecretResult } from './channel-secrets.js';

export type ChannelsHandlers = Pick<
  InvokeHandlers,
  | 'channelsList'
  | 'channelsCreate'
  | 'channelsUpdate'
  | 'channelsDelete'
  | 'channelsReorder'
  | 'channelSecretsSet'
  | 'channelSecretsHas'
  | 'channelSecretsDelete'
>;

export interface ChannelsHandlerOptions {
  /** `<userData>/channels.json` */
  readonly channelsFile: string;
  /** `<userData>/recent-projects.json`: the known projects a delete checks. */
  readonly recentFile: string;
  /** Folder of the open project (also checked on delete). */
  readonly currentProject: () => string | undefined;
  readonly secrets: ChannelSecretStore;
  readonly log: Logger;
  readonly now?: () => Date;
}

function errorResult(error: ChannelError): ChannelsResult {
  return {
    status: 'error',
    error: {
      kind: error.kind,
      message: error.message,
      ...(error.projects === undefined ? {} : { projects: [...error.projects] }),
    },
  };
}

function secretResult(result: SecretResult<boolean>): ChannelSecretResult {
  return result.ok
    ? { status: 'ok', present: result.value }
    : { status: 'error', kind: result.error.kind, message: result.error.message };
}

export function channelsHandlers(options: ChannelsHandlerOptions): ChannelsHandlers {
  const { channelsFile, secrets, log } = options;
  const storeOptions = options.now === undefined ? {} : { now: options.now };

  async function flags(channelId: string): Promise<ChannelSecretFlags> {
    const names = await secrets.names(channelId);
    if (!names.ok) log.warn(`channel secrets unreadable: ${names.error.message}`);
    const stored = names.ok ? names.value : [];
    return { 'elevenlabs-api-key': stored.includes('elevenlabs-api-key') };
  }

  async function view(channels: ChannelsFile, changedId: string | null): Promise<ChannelsResult> {
    const views: ChannelView[] = [];
    for (const channel of channels.channels) {
      views.push({
        ...channel,
        isDefault: channel.id === channels.defaultChannelId,
        secrets: await flags(channel.id),
      });
    }
    return {
      status: 'ok',
      defaultChannelId: channels.defaultChannelId,
      channels: views,
      changedId,
    };
  }

  async function answer(
    action: string,
    result: ChannelResult<{ channels: ChannelsFile; value: unknown }>,
    changedId: string | null,
  ): Promise<ChannelsResult> {
    if (!result.ok) {
      log.warn(`channel ${action} refused: ${result.error.kind}: ${result.error.message}`);
      return errorResult(result.error);
    }
    if (changedId !== null) log.info(`channel ${action}: ${changedId}`);
    return view(result.value.channels, changedId);
  }

  return {
    channelsList: async () => {
      const channels = await loadChannels(channelsFile, storeOptions);
      if (!channels.ok) {
        log.warn(`channels unreadable: ${channels.error.message}`);
        return errorResult(channels.error);
      }
      return view(channels.value, null);
    },
    channelsCreate: async (input) => {
      const created = await createChannel(channelsFile, input, storeOptions);
      return answer('create', created, created.ok ? created.value.value.id : null);
    },
    channelsUpdate: async (request) =>
      answer(
        'update',
        await updateChannel(channelsFile, request.id, request.patch, storeOptions),
        request.id,
      ),
    channelsDelete: async (request) => {
      const current = options.currentProject();
      const deleted = await deleteChannel(channelsFile, request.id, {
        ...storeOptions,
        projectsInChannel: (id) =>
          projectsInChannel(options.recentFile, id, current === undefined ? [] : [current]),
      });
      if (deleted.ok) {
        const removed = await secrets.deleteChannel(request.id);
        if (!removed.ok) {
          log.warn(`secrets of deleted channel ${request.id} kept: ${removed.error.message}`);
        }
      }
      return answer('delete', deleted, request.id);
    },
    channelsReorder: async (request) =>
      answer('reorder', await reorderChannels(channelsFile, request.ids, storeOptions), null),
    channelSecretsSet: async (request) => {
      const channels = await loadChannels(channelsFile, storeOptions);
      if (!channels.ok) {
        return { status: 'error', kind: 'io', message: channels.error.message };
      }
      if (!channels.value.channels.some((channel) => channel.id === request.channelId)) {
        return {
          status: 'error',
          kind: 'not-found',
          message: `there is no channel "${request.channelId}"`,
        };
      }
      const stored = await secrets.set(request.channelId, request.name, request.value);
      if (!stored.ok) log.warn(`${request.name} not stored: ${stored.error.message}`);
      return secretResult(stored);
    },
    channelSecretsHas: async (request) =>
      secretResult(await secrets.has(request.channelId, request.name)),
    channelSecretsDelete: async (request) => {
      const deleted = await secrets.delete(request.channelId, request.name);
      return secretResult(deleted.ok ? { ok: true, value: false } : deleted);
    },
  };
}
