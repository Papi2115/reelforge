/**
 * Which taste profile is meant (PLAN.md#13.13, ADR-031): taste belongs to the CHANNEL, optionally
 * one profile per world. A film uses the profile of its project's channel (and of its style when
 * the channel keeps one per world); Settings → Taste shows the open project's profile, or the
 * picked channel's when no project is open. The default channel keeps `taste.json`.
 *
 * Resolved synchronously on every use (the stage prompts ask for the profile text synchronously)
 * from two small files, so a channel switch, a moved project or a changed style counts at once.
 * An unreadable channels.json falls back to the default channel's `taste.json` and the app
 * setting, like before channels existed.
 */
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { errorCode } from '@reelforge/claude-bridge';
import { PROJECT_JSON } from '@reelforge/project';
import {
  channelForProject,
  channelTasteProfileFile,
  channelsFileSchema,
  defaultChannelsFile,
  projectFileSchema,
  stylePresetIdSchema,
  type AppSettings,
  type Channel,
  type ChannelsFile,
  type TasteLearning,
} from '@reelforge/shared';
import { describeError } from '../logger.js';

/** What a profile is wanted for. */
export type TasteTarget =
  | { readonly kind: 'project'; readonly dir: string }
  /** No project open: the picked channel (absent = the default one) and world. */
  | { readonly kind: 'channel'; readonly channelId?: string; readonly world?: string };

export interface ResolvedTasteScope {
  /** Absolute path of the profile file. */
  readonly file: string;
  /** undefined when channels.json cannot be read (the default channel's profile is used). */
  readonly channel: Channel | undefined;
  readonly channels: ChannelsFile | undefined;
  /** The style the profile is kept for (only when the channel keeps one per world). */
  readonly world: string | undefined;
  readonly learning: TasteLearning;
  readonly fromProject: boolean;
}

export interface TasteScopeOptions {
  /** App data folder (the profiles live there). */
  readonly dir: string;
  readonly channelsFile: string;
  readonly settings: () => AppSettings;
  readonly now: () => Date;
  /** A file that exists but is not valid (logged, then ignored). */
  readonly warn: (message: string) => void;
}

const projectTasteFieldsSchema = projectFileSchema.pick({ style: true, channelId: true });

function readJson(file: string, warn: (message: string) => void): unknown {
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch (error) {
    if (errorCode(error) !== 'ENOENT') warn(`${file}: ${describeError(error)}`);
    return undefined;
  }
}

/** channels.json; the first run's list when it does not exist yet; undefined when broken. */
function readChannels(options: TasteScopeOptions): ChannelsFile | undefined {
  const raw = readJson(options.channelsFile, options.warn);
  if (raw === undefined) return defaultChannelsFile(options.now());
  const parsed = channelsFileSchema.safeParse(raw);
  if (!parsed.success) options.warn(`${options.channelsFile} is not valid; using taste.json`);
  return parsed.success ? parsed.data : undefined;
}

function readProjectFields(
  dir: string,
  warn: (message: string) => void,
): { style?: string | undefined; channelId?: string | undefined } {
  const parsed = projectTasteFieldsSchema.safeParse(readJson(path.join(dir, PROJECT_JSON), warn));
  return parsed.success ? parsed.data : {};
}

/**
 * The channel the target means and the style its per-world profile would be kept for. A picked
 * channel without a picked world shows its first world profile, else the style its new projects
 * start with.
 */
function targetChannel(
  options: TasteScopeOptions,
  channels: ChannelsFile,
  target: TasteTarget,
): { channel: Channel; style: string | undefined } {
  if (target.kind === 'project') {
    const fields = readProjectFields(target.dir, options.warn);
    return { channel: channelForProject(channels, fields).channel, style: fields.style };
  }
  const { channel } = channelForProject(channels, { channelId: target.channelId });
  if (target.world !== undefined || channel.tastePerWorld !== true) {
    return { channel, style: target.world };
  }
  const first = worldProfiles(options.dir, channel, options.warn)[0];
  return {
    channel,
    style: first ?? channel.defaultStyle ?? options.settings().defaultStyle,
  };
}

export function resolveTasteScope(
  options: TasteScopeOptions,
  target: TasteTarget,
): ResolvedTasteScope {
  const appLearning = options.settings().taste.learning;
  const fromProject = target.kind === 'project';
  const channels = readChannels(options);
  if (channels === undefined) {
    return {
      file: path.join(options.dir, channelTasteProfileFile({})),
      channel: undefined,
      channels: undefined,
      world: undefined,
      learning: appLearning,
      fromProject,
    };
  }
  const { channel, style } = targetChannel(options, channels, target);
  const world = channel.tastePerWorld === true ? style : undefined;
  return {
    file: path.join(options.dir, channelTasteProfileFile(channel, world)),
    channel,
    channels,
    world,
    learning: channel.tasteLearning ?? appLearning,
    fromProject,
  };
}

/**
 * Styles that already have a per-world profile of the channel (`taste-<id>--<style>.json`, or
 * `taste--<style>.json` for a channel without its own profile), sorted.
 */
export function worldProfiles(
  dir: string,
  channel: Pick<Channel, 'tasteProfile'>,
  warn: (message: string) => void,
): string[] {
  const prefix = channel.tasteProfile === undefined ? 'taste--' : `taste-${channel.tasteProfile}--`;
  let names: string[];
  try {
    names = readdirSync(dir);
  } catch (error) {
    if (errorCode(error) !== 'ENOENT') warn(`${dir}: ${describeError(error)}`);
    return [];
  }
  return names
    .filter((name) => name.startsWith(prefix) && name.endsWith('.json'))
    .map((name) => name.slice(prefix.length, -'.json'.length))
    .filter((style) => stylePresetIdSchema.safeParse(style).success)
    .sort();
}
