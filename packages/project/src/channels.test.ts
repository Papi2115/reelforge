import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { channelsFileSchema, projectFileSchema } from '@reelforge/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { projectsInChannel } from './channel-projects.js';
import {
  createChannel,
  deleteChannel,
  getChannelForProject,
  loadChannels,
  reorderChannels,
  updateChannel,
} from './channels.js';
import { createProject } from './create.js';
import { rememberRecentProject } from './recent.js';
import { createGitSandbox, type GitSandbox } from './testing/git-sandbox.js';

vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 });

const NOW = new Date('2026-10-07T10:00:00.000Z');
const options = { now: () => NOW };
let sandbox: GitSandbox;
let store: string;

beforeEach(async () => {
  sandbox = await createGitSandbox();
  store = path.join(sandbox.root, 'app data', 'channels.json');
});

afterEach(async () => {
  await sandbox.dispose();
});

function value<T>(result: { ok: true; value: T } | { ok: false; error: { message: string } }): T {
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
}

describe('channel store', () => {
  it('first read creates the Default channel; existing projects belong to it', async () => {
    const channels = value(await loadChannels(store, options));
    expect(channels.channels.map((channel) => channel.id)).toEqual(['default']);
    expect(channels.defaultChannelId).toBe('default');
    const onDisk = channelsFileSchema.parse(JSON.parse(await readFile(store, 'utf8')));
    expect(onDisk).toEqual(channels);
    const assigned = value(await getChannelForProject(store, {}, options));
    expect(assigned).toMatchObject({ channel: { id: 'default' }, assignment: 'default' });
  });

  it('creates, updates and reorders a dynamic list of channels', async () => {
    const crime = value(await createChannel(store, { name: 'Crime Files' }, options)).value;
    expect(crime).toMatchObject({ id: 'crime-files', tasteProfile: 'crime-files' });
    const tech = value(
      await createChannel(store, { name: 'Voxplain', defaultStyle: 'sketchbook' }, options),
    );
    expect(tech.channels.channels.map((channel) => channel.id)).toEqual([
      'default',
      'crime-files',
      'voxplain',
    ]);
    const renamed = value(
      await updateChannel(store, 'crime-files', { name: 'True Crime', color: '#aa0000' }, options),
    ).value;
    expect(renamed).toMatchObject({ id: 'crime-files', name: 'True Crime', color: '#aa0000' });
    const reordered = value(
      await reorderChannels(store, ['voxplain', 'default', 'crime-files'], options),
    );
    expect(reordered.channels.channels.map((channel) => channel.id)).toEqual([
      'voxplain',
      'default',
      'crime-files',
    ]);
    const reread = value(await loadChannels(store, options));
    expect(reread).toEqual(reordered.channels);
  });

  it('refuses bad input, unknown ids and incomplete orders', async () => {
    const empty = await createChannel(store, { name: '  ' }, options);
    expect(!empty.ok && empty.error.kind).toBe('invalid');
    const missing = await updateChannel(store, 'nope', { name: 'X' }, options);
    expect(!missing.ok && missing.error.kind).toBe('not-found');
    const order = await reorderChannels(store, ['default', 'default'], options);
    expect(!order.ok && order.error.kind).toBe('invalid');
  });

  it('refuses to delete the default channel or a channel with projects', async () => {
    value(await createChannel(store, { name: 'Crime' }, options));
    const byDefault = await deleteChannel(store, 'default', {
      ...options,
      projectsInChannel: () => Promise.resolve([]),
    });
    expect(!byDefault.ok && byDefault.error.kind).toBe('default-channel');
    const busy = await deleteChannel(store, 'crime', {
      ...options,
      projectsInChannel: () => Promise.resolve(['C:\\films\\a']),
    });
    expect(!busy.ok && busy.error).toMatchObject({
      kind: 'has-projects',
      projects: ['C:\\films\\a'],
    });
    const deleted = value(
      await deleteChannel(store, 'crime', {
        ...options,
        projectsInChannel: () => Promise.resolve([]),
      }),
    );
    expect(deleted.channels.channels.map((channel) => channel.id)).toEqual(['default']);
  });

  it('never overwrites a broken or newer channels.json', async () => {
    await mkdir(path.dirname(store), { recursive: true });
    await writeFile(store, '{ broken');
    const corrupt = await createChannel(store, { name: 'A' }, options);
    expect(!corrupt.ok && corrupt.error.kind).toBe('corrupt');
    expect(await readFile(store, 'utf8')).toBe('{ broken');
    await writeFile(store, JSON.stringify({ version: 99, channels: [] }));
    const newer = await loadChannels(store, options);
    expect(!newer.ok && newer.error.kind).toBe('unsupported-version');
  });
});

describe('projects and channels', () => {
  it('createProject writes channelId and applies the channel style when none is given', async () => {
    const dir = path.join(sandbox.root, 'Film kanału');
    const created = value(
      await createProject({
        dir,
        title: 'Film',
        seed: 1,
        channel: { id: 'crime', defaultStyle: 'noir-voxel' },
        git: sandbox.git,
      }),
    );
    expect(created.project).toMatchObject({ channelId: 'crime', style: 'noir-voxel' });
    const onDisk = projectFileSchema.parse(
      JSON.parse(await readFile(path.join(dir, 'project.json'), 'utf8')),
    );
    expect(onDisk.channelId).toBe('crime');

    const explicit = value(
      await createProject({
        dir: path.join(sandbox.root, 'Inny'),
        title: 'Inny',
        seed: 1,
        style: 'soft-480',
        channel: { id: 'crime', defaultStyle: 'noir-voxel' },
        git: sandbox.git,
      }),
    );
    expect(explicit.project.style).toBe('soft-480');
  });

  it('createProject without a channel writes no channelId (behaviour as before)', async () => {
    const created = value(
      await createProject({
        dir: path.join(sandbox.root, 'Bez kanału'),
        title: 'Bez',
        seed: 1,
        git: sandbox.git,
      }),
    );
    expect(created.project).not.toHaveProperty('channelId');
  });

  it('projectsInChannel finds recent and extra projects that name the channel', async () => {
    const recent = path.join(sandbox.root, 'app data', 'recent-projects.json');
    const make = async (name: string, channelId?: string): Promise<string> => {
      const dir = path.join(sandbox.root, name);
      await mkdir(dir, { recursive: true });
      await writeFile(
        path.join(dir, 'project.json'),
        JSON.stringify(channelId === undefined ? { title: name } : { title: name, channelId }),
      );
      return dir;
    };
    const a = await make('A', 'crime');
    const b = await make('B');
    const c = await make('C', 'tech');
    const open = await make('Otwarty', 'crime');
    for (const dir of [a, b, c]) {
      value(await rememberRecentProject(recent, { dir, title: path.basename(dir) }, NOW));
    }
    expect(await projectsInChannel(recent, 'crime', [open, a])).toEqual([a, open]);
    expect(await projectsInChannel(recent, 'none')).toEqual([]);
  });
});
