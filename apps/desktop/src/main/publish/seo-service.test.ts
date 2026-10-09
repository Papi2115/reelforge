import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { defaultAppSettings, publishSeoFileSchema } from '@reelforge/shared';
import type { ClaudeRunner, ClaudeTurnSpec } from '@reelforge/stages';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createLogger } from '../logger.js';
import { PublishSeoService, seoChannelOf } from './seo-service.js';

const EXAMPLE = path.resolve(
  import.meta.dirname,
  '..',
  '..',
  '..',
  '..',
  '..',
  'templates',
  'examples',
  'doom-on-a-calculator',
);
const NOW = new Date('2026-10-09T12:00:00.000Z');
const CREATED = '2026-10-01T00:00:00.000Z';

let root: string;
let dir: string;
let channelsFile: string;
let commits: string[];
let specs: ClaudeTurnSpec[];

function service(): PublishSeoService {
  const claude: ClaudeRunner = {
    run: (spec) => {
      specs.push(spec);
      return Promise.resolve({
        status: 'blocked',
        reply: '',
        sessionId: undefined,
        message: 'not logged in',
        usage: undefined,
        limit: undefined,
      });
    },
  };
  return new PublishSeoService({
    currentProject: () => dir,
    claude,
    settings: () => defaultAppSettings(),
    channelsFile,
    now: () => NOW,
    commit: (_dir, message, paths) => {
      commits.push(`${message}: ${paths.join(', ')}`);
      return Promise.resolve(true);
    },
    log: createLogger(() => undefined),
  });
}

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'rf seo service żółw '));
  dir = path.join(root, 'project');
  await cp(EXAMPLE, dir, { recursive: true });
  channelsFile = path.join(root, 'channels.json');
  const channels = {
    version: 1,
    defaultChannelId: 'default',
    channels: [
      { id: 'default', name: 'Default', createdAt: CREATED },
      {
        id: 'voxplain',
        name: 'Voxplain',
        genrePreset: 'science',
        publishDefaults: { tags: ['science explained'] },
        notes: 'Pop-science explainers.',
        createdAt: CREATED,
      },
    ],
  };
  await writeFile(channelsFile, JSON.stringify(channels));
  const projectFile = path.join(dir, 'project.json');
  const project = JSON.parse(await readFile(projectFile, 'utf8')) as Record<string, unknown>;
  await writeFile(projectFile, JSON.stringify({ ...project, channelId: 'voxplain' }));
  commits = [];
  specs = [];
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe('PublishSeoService', () => {
  it("describes the project's channel for the channel-wide tags", async () => {
    expect(await seoChannelOf(dir, channelsFile)).toEqual({
      name: 'Voxplain',
      genre: 'science',
      style: 'voxel-pixel-crisp640',
      tags: ['science explained'],
      notes: 'Pop-science explainers.',
    });
  });

  it('has no seo.json before the first generation', async () => {
    const state = await service().state();
    expect(state).toMatchObject({ status: 'ok', seo: null, generating: false, problem: null });
    expect(state.status === 'ok' && state.durationS).toBeGreaterThan(0);
  });

  it('writes and commits the fallback when Claude is not available', async () => {
    const result = await service().generate();
    if (result.status !== 'ok') throw new Error(result.message);
    expect(result.fallbackReason).toBe('Claude: not logged in');
    expect(specs).toHaveLength(1);
    expect(specs[0]).toMatchObject({ stage: 'critic', model: 'sonnet', newSession: true });
    expect(specs[0]?.prompt).toContain('- name: Voxplain');
    expect(commits).toEqual(['Write the tags and timestamps: publish/seo.json']);
    const file = publishSeoFileSchema.parse(
      JSON.parse(await readFile(path.join(dir, 'publish', 'seo.json'), 'utf8')),
    );
    expect(file.source).toBe('fallback');
    expect(file.tags.twoWord).toContain('science explained');
    expect(result.state).toMatchObject({ status: 'ok', seo: file, generating: false });
  });

  it('says when no project is open', async () => {
    const none = new PublishSeoService({
      currentProject: () => undefined,
      claude: { run: () => Promise.reject(new Error('unused')) },
      settings: () => defaultAppSettings(),
      channelsFile,
      now: () => NOW,
      commit: () => Promise.resolve(true),
      log: createLogger(() => undefined),
    });
    expect(await none.generate()).toEqual({ status: 'error', message: 'No project is open.' });
  });
});
