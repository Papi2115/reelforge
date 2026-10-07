/**
 * The channel store (PLAN.md#13.13, ADR-031): `<app data>/channels.json` (schema in
 * `@reelforge/shared`), a dynamic, user-ordered list of channels. Updates of the file are
 * serialized and written atomically. The first read creates the file with one "Default" channel;
 * existing projects belong to it virtually (no `channelId` = the default channel), so no project
 * is rewritten. A broken or newer file is never overwritten (it holds the user's configuration):
 * every operation reports it as a typed error until it is fixed. Secrets are NOT here.
 */
import { readFile } from 'node:fs/promises';
import {
  applyChannelPatch,
  CHANNELS_FILE_VERSION,
  channelForProject,
  channelIdFromName,
  channelInputSchema,
  channelPatchSchema,
  channelSchema,
  channelsFileSchema,
  defaultChannelsFile,
  MAX_CHANNELS,
  type Channel,
  type ChannelInput,
  type ChannelPatch,
  type ChannelsFile,
  type ProjectChannel,
} from '@reelforge/shared';
import { z } from 'zod';
import { writeJsonAtomic } from './atomic.js';
import { withLock } from './mutex.js';
import { describeUnknown, err, errorCode, ok, type Result } from './result.js';

export type ChannelErrorKind =
  | 'not-found'
  /** Invalid input (name, patch, order). */
  | 'invalid'
  /** channels.json is not valid JSON or does not match its schema. */
  | 'corrupt'
  /** channels.json was written by a newer app. */
  | 'unsupported-version'
  /** The default channel cannot be deleted (projects without a channel belong to it). */
  | 'default-channel'
  /** The channel still has projects; reassign them first. */
  | 'has-projects'
  | 'limit'
  | 'io';

export interface ChannelError {
  readonly kind: ChannelErrorKind;
  readonly message: string;
  /** `has-projects`: the project folders still in the channel. */
  readonly projects?: readonly string[];
}

function channelError(
  kind: ChannelErrorKind,
  message: string,
  projects?: readonly string[],
): ChannelError {
  return projects === undefined ? { kind, message } : { kind, message, projects };
}

export type ChannelResult<T> = Result<T, ChannelError>;

export interface ChannelStoreOptions {
  /** Clock for `createdAt` (tests). */
  readonly now?: () => Date;
}

function nowOf(options: ChannelStoreOptions): Date {
  return options.now?.() ?? new Date();
}

async function readChannelsFile(storeFile: string): Promise<ChannelResult<ChannelsFile | null>> {
  let text: string;
  try {
    text = await readFile(storeFile, 'utf8');
  } catch (error) {
    if (errorCode(error) === 'ENOENT') return ok(null);
    return err(channelError('io', `${storeFile}: ${describeUnknown(error)}`));
  }
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (error) {
    return err(channelError('corrupt', `${storeFile}: ${describeUnknown(error)}`));
  }
  const version =
    typeof raw === 'object' && raw !== null && 'version' in raw ? raw.version : undefined;
  if (typeof version === 'number' && version > CHANNELS_FILE_VERSION) {
    return err(
      channelError(
        'unsupported-version',
        `${storeFile} is version ${String(version)}, newer than this app (${String(CHANNELS_FILE_VERSION)})`,
      ),
    );
  }
  const parsed = channelsFileSchema.safeParse(raw);
  if (!parsed.success) {
    return err(channelError('corrupt', `${storeFile}: ${z.prettifyError(parsed.error)}`));
  }
  return ok(parsed.data);
}

async function writeChannelsFile(
  storeFile: string,
  data: ChannelsFile,
): Promise<ChannelResult<ChannelsFile>> {
  try {
    await writeJsonAtomic(storeFile, data);
    return ok(data);
  } catch (error) {
    return err(channelError('io', `${storeFile}: ${describeUnknown(error)}`));
  }
}

/** Reads the file; the first read (no file yet) writes the Default channel. Not locked. */
async function loadOrCreate(
  storeFile: string,
  options: ChannelStoreOptions,
): Promise<ChannelResult<ChannelsFile>> {
  const current = await readChannelsFile(storeFile);
  if (!current.ok) return current;
  if (current.value !== null) return ok(current.value);
  return writeChannelsFile(storeFile, defaultChannelsFile(nowOf(options)));
}

/** The channels (created with the Default channel on the first call). */
export function loadChannels(
  storeFile: string,
  options: ChannelStoreOptions = {},
): Promise<ChannelResult<ChannelsFile>> {
  return withLock(storeFile, () => loadOrCreate(storeFile, options));
}

/** Read-modify-write under the store lock; `change` returns the next file or an error. */
function updateChannels<T>(
  storeFile: string,
  options: ChannelStoreOptions,
  change: (current: ChannelsFile) =>
    | Promise<ChannelResult<{ next: ChannelsFile; value: T }>>
    | ChannelResult<{
        next: ChannelsFile;
        value: T;
      }>,
): Promise<ChannelResult<{ channels: ChannelsFile; value: T }>> {
  return withLock(storeFile, async () => {
    const current = await loadOrCreate(storeFile, options);
    if (!current.ok) return current;
    const changed = await change(current.value);
    if (!changed.ok) return changed;
    const valid = channelsFileSchema.safeParse(changed.value.next);
    if (!valid.success) return err(channelError('invalid', z.prettifyError(valid.error)));
    const written = await writeChannelsFile(storeFile, valid.data);
    return written.ok ? ok({ channels: written.value, value: changed.value.value }) : written;
  });
}

function findChannel(channels: ChannelsFile, id: string): ChannelResult<Channel> {
  const found = channels.channels.find((channel) => channel.id === id);
  return found === undefined
    ? err(channelError('not-found', `there is no channel "${id}"`))
    : ok(found);
}

/**
 * Adds a channel at the end of the list. Its id comes from the name (stable after renames); it
 * gets its own taste profile unless the input names one.
 */
export function createChannel(
  storeFile: string,
  input: ChannelInput,
  options: ChannelStoreOptions = {},
): Promise<ChannelResult<{ channels: ChannelsFile; value: Channel }>> {
  return updateChannels(storeFile, options, (current) => {
    const parsed = channelInputSchema.safeParse(input);
    if (!parsed.success) return err(channelError('invalid', z.prettifyError(parsed.error)));
    if (current.channels.length >= MAX_CHANNELS) {
      return err(channelError('limit', `at most ${String(MAX_CHANNELS)} channels`));
    }
    const id = channelIdFromName(
      parsed.data.name,
      new Set(current.channels.map((channel) => channel.id)),
    );
    const channel = channelSchema.parse({
      tasteProfile: id,
      ...parsed.data,
      id,
      createdAt: nowOf(options).toISOString(),
    });
    return ok({ next: { ...current, channels: [...current.channels, channel] }, value: channel });
  });
}

export function updateChannel(
  storeFile: string,
  id: string,
  patch: ChannelPatch,
  options: ChannelStoreOptions = {},
): Promise<ChannelResult<{ channels: ChannelsFile; value: Channel }>> {
  return updateChannels(storeFile, options, (current) => {
    const parsed = channelPatchSchema.safeParse(patch);
    if (!parsed.success) return err(channelError('invalid', z.prettifyError(parsed.error)));
    const found = findChannel(current, id);
    if (!found.ok) return found;
    let next: Channel;
    try {
      next = applyChannelPatch(found.value, parsed.data);
    } catch (error) {
      return err(channelError('invalid', describeUnknown(error)));
    }
    const channels = current.channels.map((channel) => (channel.id === id ? next : channel));
    return ok({ next: { ...current, channels }, value: next });
  });
}

export interface DeleteChannelOptions extends ChannelStoreOptions {
  /** Project folders that name the channel in their project.json (channel-projects.ts). */
  readonly projectsInChannel: (channelId: string) => Promise<readonly string[]>;
}

/**
 * Removes a channel. Refused for the default channel and for a channel that still has projects
 * (`has-projects` lists them; reassigning comes with the UI). The caller removes its secrets.
 */
export function deleteChannel(
  storeFile: string,
  id: string,
  options: DeleteChannelOptions,
): Promise<ChannelResult<{ channels: ChannelsFile; value: Channel }>> {
  return updateChannels(storeFile, options, async (current) => {
    const found = findChannel(current, id);
    if (!found.ok) return found;
    if (current.defaultChannelId === id) {
      return err(
        channelError(
          'default-channel',
          `"${found.value.name}" is the default channel; projects without a channel belong to it`,
        ),
      );
    }
    const projects = await options.projectsInChannel(id);
    if (projects.length > 0) {
      return err(
        channelError(
          'has-projects',
          `"${found.value.name}" still has ${String(projects.length)} project(s); move them to another channel first`,
          projects,
        ),
      );
    }
    const channels = current.channels.filter((channel) => channel.id !== id);
    return ok({ next: { ...current, channels }, value: found.value });
  });
}

/** New order: `ids` must be exactly the current ids, each once. */
export function reorderChannels(
  storeFile: string,
  ids: readonly string[],
  options: ChannelStoreOptions = {},
): Promise<ChannelResult<{ channels: ChannelsFile; value: null }>> {
  return updateChannels(storeFile, options, (current) => {
    const byId = new Map(current.channels.map((channel) => [channel.id, channel]));
    const unique = new Set(ids);
    if (unique.size !== ids.length || ids.length !== byId.size || ids.some((id) => !byId.has(id))) {
      return err(channelError('invalid', 'the new order must list every channel exactly once'));
    }
    const channels = ids.flatMap((id) => {
      const channel = byId.get(id);
      return channel === undefined ? [] : [channel];
    });
    return ok({ next: { ...current, channels }, value: null });
  });
}

/** The channel of a project (absent or unknown `channelId` = the default channel). */
export async function getChannelForProject(
  storeFile: string,
  project: { readonly channelId?: string | undefined },
  options: ChannelStoreOptions = {},
): Promise<ChannelResult<ProjectChannel>> {
  const channels = await loadChannels(storeFile, options);
  return channels.ok ? ok(channelForProject(channels.value, project)) : channels;
}
