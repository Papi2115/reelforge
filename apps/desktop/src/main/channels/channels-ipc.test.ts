import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DEFAULT_STYLES_DIR, DEFAULT_TEMPLATE_DIR, type GitOptions } from '@reelforge/project';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IPC } from '../../shared/ipc-contract.js';
import { createLogger } from '../logger.js';
import { ProjectService } from '../project-service.js';
import { ChannelSecretStore } from './channel-secrets.js';
import { channelsHandlers, type ChannelsHandlers } from './channels-ipc.js';
import { fakeSafeStorage } from './fake-safe-storage.js';

// Creating a project spawns git several times; Windows is slow at process creation.
vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 });

const CANARY = 'sk-CANARY-channels-e2e-4d1f0b';
let root: string;
let userData: string;
let git: GitOptions;
let lines: string[];
let picks: string[];

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'reelforge channels ł-'));
  userData = path.join(root, 'user data');
  const globalConfig = path.join(root, 'global.gitconfig');
  await writeFile(globalConfig, '');
  git = { env: { ...process.env, GIT_CONFIG_GLOBAL: globalConfig, GIT_CONFIG_NOSYSTEM: '1' } };
  lines = [];
  picks = [];
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true, maxRetries: 5 });
});

interface Fixture {
  readonly handlers: ChannelsHandlers;
  readonly projects: ProjectService;
  readonly secrets: ChannelSecretStore;
}

function fixture(): Fixture {
  const log = createLogger((line) => lines.push(line));
  const recentFile = path.join(userData, 'recent-projects.json');
  const channelsFile = path.join(userData, 'channels.json');
  const projects = new ProjectService({
    recentFile,
    channelsFile,
    templateDir: DEFAULT_TEMPLATE_DIR,
    stylesDir: DEFAULT_STYLES_DIR,
    pickFolder: () => Promise.resolve(picks.shift()),
    defaultStyle: () => 'voxel-pixel-crisp640',
    log,
    git,
  });
  const secrets = new ChannelSecretStore({
    file: path.join(userData, 'channel-secrets.bin.json'),
    safeStorage: fakeSafeStorage(),
    platform: 'win32',
    log: log.child('channel-secrets'),
  });
  const handlers = channelsHandlers({
    channelsFile,
    recentFile,
    currentProject: () => projects.currentProject()?.dir,
    secrets,
    log: log.child('channels'),
    now: () => new Date('2026-10-07T10:00:00.000Z'),
  });
  return { handlers, projects, secrets };
}

async function filesUnder(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true, recursive: true });
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => path.join(entry.parentPath, entry.name));
}

describe('channels IPC handlers', () => {
  it('lists the Default channel first, then creates, updates and reorders', async () => {
    const { handlers } = fixture();
    const listed = await handlers.channelsList(null);
    expect(listed).toMatchObject({
      status: 'ok',
      defaultChannelId: 'default',
      channels: [
        {
          id: 'default',
          name: 'Default',
          isDefault: true,
          secrets: { 'elevenlabs-api-key': false },
        },
      ],
    });
    const created = await handlers.channelsCreate({ name: 'Crime', defaultStyle: 'noir-voxel' });
    expect(created).toMatchObject({ status: 'ok', changedId: 'crime' });
    const updated = await handlers.channelsUpdate({ id: 'crime', patch: { notes: 'weekly' } });
    expect(updated.status === 'ok' && updated.channels[1]).toMatchObject({ notes: 'weekly' });
    const reordered = await handlers.channelsReorder({ ids: ['crime', 'default'] });
    expect(reordered.status === 'ok' && reordered.channels.map((channel) => channel.id)).toEqual([
      'crime',
      'default',
    ]);
    // Every response is valid for the preload's check.
    for (const response of [listed, created, updated, reordered]) {
      expect(IPC.channelsList.response.safeParse(response).success).toBe(true);
    }
  });

  it("new projects take the channel's id and default style; delete is refused while they exist", async () => {
    const { handlers, projects } = fixture();
    await handlers.channelsCreate({ name: 'Crime', defaultStyle: 'noir-voxel' });
    const parent = path.join(root, 'Filmy');
    await mkdir(parent);
    picks.push(parent);
    const opened = await projects.newProject({
      title: 'Sprawa',
      language: 'pl',
      channelId: 'crime',
    });
    expect(opened).toMatchObject({
      status: 'opened',
      project: { style: 'noir-voxel', channelId: 'crime' },
    });
    expect(await projects.recent()).toMatchObject([{ title: 'Sprawa', channelId: 'crime' }]);
    const refused = await handlers.channelsDelete({ id: 'crime' });
    expect(refused).toMatchObject({ status: 'error', error: { kind: 'has-projects' } });
    expect(refused.status === 'error' && refused.error.projects).toEqual([
      path.join(parent, 'Sprawa'),
    ]);
    const defaultDelete = await handlers.channelsDelete({ id: 'default' });
    expect(defaultDelete).toMatchObject({ status: 'error', error: { kind: 'default-channel' } });
    const unknown = await projects.newProject({ title: 'X', language: 'en', channelId: 'nope' });
    expect(unknown).toMatchObject({ status: 'error', error: { kind: 'invalid-argument' } });
  });

  it('a project without a channel request goes to the default channel', async () => {
    const { projects } = fixture();
    const parent = path.join(root, 'Filmy');
    await mkdir(parent);
    picks.push(parent);
    const opened = await projects.newProject({ title: 'Plain', language: 'en' });
    expect(opened).toMatchObject({
      status: 'opened',
      project: { style: 'voxel-pixel-crisp640', channelId: 'default' },
    });
  });

  it('deleting an empty channel removes its secrets; secrets need an existing channel', async () => {
    const { handlers, secrets } = fixture();
    await handlers.channelsCreate({ name: 'Tech' });
    const request = { channelId: 'tech', name: 'elevenlabs-api-key' } as const;
    expect(await handlers.channelSecretsSet({ ...request, value: CANARY })).toEqual({
      status: 'ok',
      present: true,
    });
    expect(await handlers.channelSecretsHas(request)).toEqual({ status: 'ok', present: true });
    expect(await handlers.channelsDelete({ id: 'tech' })).toMatchObject({ status: 'ok' });
    expect(await secrets.has('tech', 'elevenlabs-api-key')).toEqual({ ok: true, value: false });
    expect(await handlers.channelSecretsSet({ ...request, value: CANARY })).toMatchObject({
      status: 'error',
      kind: 'not-found',
    });
  });

  it('canary: the key never reaches a response, a log line, channels.json or a project', async () => {
    const { handlers, projects, secrets } = fixture();
    const responses: unknown[] = [];
    const keep = <T>(response: T): T => {
      responses.push(response);
      return response;
    };
    keep(await handlers.channelsCreate({ name: 'Crime' }));
    const request = { channelId: 'crime', name: 'elevenlabs-api-key' } as const;
    keep(await handlers.channelSecretsSet({ ...request, value: CANARY }));
    keep(await handlers.channelSecretsSet({ ...request, value: `${CANARY}-2` }));
    keep(await handlers.channelSecretsHas(request));
    keep(await handlers.channelsList(null));
    keep(await handlers.channelsUpdate({ id: 'crime', patch: { name: 'True Crime' } }));
    const parent = path.join(root, 'Filmy');
    await mkdir(parent);
    picks.push(parent);
    keep(await projects.newProject({ title: 'Sprawa', language: 'pl', channelId: 'crime' }));
    keep(await projects.recent());
    keep(projects.currentProject());
    // Main can still read it (for the ElevenLabs call in 13.14).
    expect(await secrets.get('crime', 'elevenlabs-api-key')).toEqual({
      ok: true,
      value: `${CANARY}-2`,
    });
    keep(await handlers.channelSecretsDelete(request));

    for (const response of responses) expect(JSON.stringify(response)).not.toContain(CANARY);
    expect(lines.join('')).not.toContain(CANARY);
    const written = await filesUnder(root);
    expect(written.some((file) => file.endsWith('channel-secrets.bin.json'))).toBe(true);
    expect(written.some((file) => file.endsWith('channels.json'))).toBe(true);
    for (const file of written) {
      const bytes = await readFile(file);
      expect(bytes.includes(CANARY), file).toBe(false);
    }
  });
});
