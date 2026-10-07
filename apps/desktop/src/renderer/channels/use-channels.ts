/**
 * Channels in the renderer (PLAN.md#13.13, ADR-031): the list loaded once by the app and changed
 * through main (which validates and saves). Every channel call answers with the whole list, so it
 * replaces the state. Key calls answer only whether a key is stored; the value is never kept here.
 */
import { useCallback, useEffect, useState } from 'react';
import type { ChannelInput, ChannelPatch } from '@reelforge/shared';
import type { ChannelsResult } from '../../shared/channels-contract.js';
import { errorMessage, rendererLog } from '../log.js';
import { channelErrorText, secretErrorText, type ChannelList } from './channel-view.js';

const log = rendererLog('channels');

export type ChannelOutcome =
  | { readonly ok: true; readonly changedId: string | null }
  | { readonly ok: false; readonly message: string };

export interface ChannelsController {
  /** Undefined until loaded (or when the list cannot be read: see `loadError`). */
  readonly list: ChannelList | undefined;
  /** Why the list could not be loaded. */
  readonly loadError: string | undefined;
  readonly create: (input: ChannelInput) => Promise<ChannelOutcome>;
  /** `name` names the channel in error sentences. */
  readonly update: (id: string, patch: ChannelPatch) => Promise<ChannelOutcome>;
  readonly remove: (id: string, name: string) => Promise<ChannelOutcome>;
  readonly reorder: (ids: readonly string[]) => Promise<ChannelOutcome>;
  /** Stores the ElevenLabs API key of the channel; the caller forgets the value afterwards. */
  readonly setKey: (channelId: string, value: string) => Promise<ChannelOutcome>;
  readonly removeKey: (channelId: string) => Promise<ChannelOutcome>;
}

const KEY_NAME = 'elevenlabs-api-key';

export function useChannels(): ChannelsController {
  const [list, setList] = useState<ChannelList | undefined>(undefined);
  const [loadError, setLoadError] = useState<string | undefined>(undefined);

  const reload = useCallback((): void => {
    window.reelforge.listChannels().then(
      (result) => {
        if (result.status === 'ok') {
          setList({ defaultChannelId: result.defaultChannelId, channels: result.channels });
          setLoadError(undefined);
        } else {
          setLoadError(channelErrorText(result.error));
        }
      },
      (reason: unknown) => {
        log.error(`listChannels failed: ${errorMessage(reason)}`);
        setLoadError(errorMessage(reason));
      },
    );
  }, []);

  useEffect(reload, [reload]);

  const settle = useCallback(
    async (
      action: string,
      call: () => Promise<ChannelsResult>,
      name?: string,
    ): Promise<ChannelOutcome> => {
      try {
        const result = await call();
        if (result.status === 'ok') {
          setList({ defaultChannelId: result.defaultChannelId, channels: result.channels });
          return { ok: true, changedId: result.changedId };
        }
        if (result.error.kind === 'not-found') reload();
        return { ok: false, message: channelErrorText(result.error, name) };
      } catch (reason) {
        log.error(`${action} failed: ${errorMessage(reason)}`);
        return { ok: false, message: errorMessage(reason) };
      }
    },
    [reload],
  );

  const keyCall = useCallback(
    async (
      action: string,
      call: () => ReturnType<typeof window.reelforge.setChannelSecret>,
    ): Promise<ChannelOutcome> => {
      try {
        const result = await call();
        // The secret flags live in the list: read it again (main answers with booleans only).
        reload();
        return result.status === 'ok'
          ? { ok: true, changedId: null }
          : { ok: false, message: secretErrorText(result.kind) };
      } catch (reason) {
        // The message of a rejected call never echoes the request (preload validates responses).
        log.error(`${action} failed: ${errorMessage(reason)}`);
        return { ok: false, message: 'The key could not be saved. See the log for details.' };
      }
    },
    [reload],
  );

  return {
    list,
    loadError,
    create: (input) => settle('createChannel', () => window.reelforge.createChannel(input)),
    update: (id, patch) => settle('updateChannel', () => window.reelforge.updateChannel(id, patch)),
    remove: (id, name) => settle('deleteChannel', () => window.reelforge.deleteChannel(id), name),
    reorder: (ids) => settle('reorderChannels', () => window.reelforge.reorderChannels(ids)),
    setKey: (channelId, value) =>
      keyCall('setChannelSecret', () =>
        window.reelforge.setChannelSecret({ channelId, name: KEY_NAME, value }),
      ),
    removeKey: (channelId) =>
      keyCall('deleteChannelSecret', () =>
        window.reelforge.deleteChannelSecret({ channelId, name: KEY_NAME }),
      ),
  };
}
