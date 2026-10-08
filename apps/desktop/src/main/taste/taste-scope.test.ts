/**
 * Which taste profile is meant (PLAN.md#13.13, ADR-031): the default channel keeps taste.json,
 * another channel has taste-<id>.json, a channel with "one per world" has one per style; the open
 * project wins over the picker; a broken channels.json falls back to taste.json.
 */
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  channelsFileSchema,
  defaultAppSettings,
  type AppSettings,
  type ChannelsFile,
} from '@reelforge/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { tasteTarget } from './taste-ipc.js';
import { resolveTasteScope, worldProfiles, type TasteScopeOptions } from './taste-scope.js';

const NOW = new Date('2026-10-07T10:00:00.000Z');
let root: string;
let channelsFile: string;
let settings: AppSettings;
let warnings: string[];

function options(): TasteScopeOptions {
  return {
    dir: root,
    channelsFile,
    settings: () => settings,
    now: () => NOW,
    warn: (message) => {
      warnings.push(message);
    },
  };
}

function channels(extra: { perWorld?: boolean; defaultPerWorld?: boolean } = {}): ChannelsFile {
  return channelsFileSchema.parse({
    version: 1,
    defaultChannelId: 'default',
    channels: [
      {
        id: 'default',
        name: 'Default',
        createdAt: NOW.toISOString(),
        ...(extra.defaultPerWorld === true ? { tastePerWorld: true } : {}),
      },
      {
        id: 'crime',
        name: 'Crime',
        color: '#e5484d',
        tasteProfile: 'crime',
        tasteLearning: 'off',
        defaultStyle: 'notebook',
        createdAt: NOW.toISOString(),
        ...(extra.perWorld === true ? { tastePerWorld: true } : {}),
      },
    ],
  });
}

async function saveChannels(file: ChannelsFile): Promise<void> {
  await writeFile(channelsFile, JSON.stringify(file));
}

async function project(name: string, fields: Record<string, string>): Promise<string> {
  const dir = path.join(root, 'Projekty', name);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, 'project.json'), JSON.stringify({ version: 1, ...fields }));
  return dir;
}

function fileOf(target: Parameters<typeof resolveTasteScope>[1]): string {
  return path.basename(resolveTasteScope(options(), target).file);
}

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'rf taste scope ż '));
  channelsFile = path.join(root, 'channels.json');
  settings = defaultAppSettings();
  warnings = [];
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe('resolveTasteScope', () => {
  it('resolves the profile file per channel and world', async () => {
    const old = await project('old', { style: 'voxel-pixel-crisp640' });
    const crime = await project('crime', { style: 'comic', channelId: 'crime' });
    const gone = await project('gone', { style: 'comic', channelId: 'deleted' });

    await saveChannels(channels());
    expect(fileOf({ kind: 'project', dir: old })).toBe('taste.json');
    expect(fileOf({ kind: 'project', dir: crime })).toBe('taste-crime.json');
    expect(fileOf({ kind: 'project', dir: gone })).toBe('taste.json');
    expect(fileOf({ kind: 'channel' })).toBe('taste.json');
    expect(fileOf({ kind: 'channel', channelId: 'crime', world: 'comic' })).toBe(
      'taste-crime.json',
    );

    await saveChannels(channels({ perWorld: true, defaultPerWorld: true }));
    expect(fileOf({ kind: 'project', dir: old })).toBe('taste--voxel-pixel-crisp640.json');
    expect(fileOf({ kind: 'project', dir: crime })).toBe('taste-crime--comic.json');
    expect(fileOf({ kind: 'channel', channelId: 'crime', world: 'comic' })).toBe(
      'taste-crime--comic.json',
    );
    // No world picked: the channel's style of new projects (no world profile exists yet).
    expect(fileOf({ kind: 'channel', channelId: 'crime' })).toBe('taste-crime--notebook.json');
    expect(fileOf({ kind: 'channel' })).toBe(`taste--${settings.defaultStyle}.json`);
    expect(warnings).toEqual([]);
  });

  it('takes the channel switch, else the app setting', async () => {
    await saveChannels(channels());
    settings = { ...settings, taste: { learning: 'auto' } };
    expect(resolveTasteScope(options(), { kind: 'channel' }).learning).toBe('auto');
    expect(resolveTasteScope(options(), { kind: 'channel', channelId: 'crime' }).learning).toBe(
      'off',
    );
  });

  it('uses the first run list before channels.json exists and taste.json when it is broken', async () => {
    expect(fileOf({ kind: 'channel', channelId: 'crime' })).toBe('taste.json');
    expect(resolveTasteScope(options(), { kind: 'channel' }).channel?.id).toBe('default');
    await writeFile(channelsFile, '{ "version": 1 }');
    const scope = resolveTasteScope(options(), { kind: 'channel' });
    expect(scope.channel).toBeUndefined();
    expect(path.basename(scope.file)).toBe('taste.json');
    expect(warnings.join()).toMatch(/not valid/);
  });

  it('lists the world profiles of a channel and picks the first one', async () => {
    await saveChannels(channels({ perWorld: true }));
    await writeFile(path.join(root, 'taste-crime--zine.json'), '{}');
    await writeFile(path.join(root, 'taste-crime--comic.json'), '{}');
    await writeFile(path.join(root, 'taste-crime--comic.corrupt-2026.json'), '{}');
    await writeFile(path.join(root, 'taste--notebook.json'), '{}');
    expect(worldProfiles(root, { tasteProfile: 'crime' }, () => undefined)).toEqual([
      'comic',
      'zine',
    ]);
    expect(worldProfiles(root, {}, () => undefined)).toEqual(['notebook']);
    expect(fileOf({ kind: 'channel', channelId: 'crime' })).toBe('taste-crime--comic.json');
  });
});

describe('tasteTarget', () => {
  it('uses the open project, else the requested channel and world', () => {
    expect(tasteTarget('C:\\P', { channelId: 'crime' })).toEqual({ kind: 'project', dir: 'C:\\P' });
    expect(tasteTarget(undefined, { channelId: 'crime', world: 'comic' })).toEqual({
      kind: 'channel',
      channelId: 'crime',
      world: 'comic',
    });
    expect(tasteTarget(undefined, {})).toEqual({ kind: 'channel' });
  });
});
