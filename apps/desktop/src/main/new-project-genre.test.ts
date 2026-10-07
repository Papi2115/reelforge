/**
 * New project + genre presets (PLAN.md#13.8, ADR-035): the form's untouched fields give way to the
 * preset, touched ones win, the channel's genre applies when the form names none, and an unknown
 * preset is refused before the folder picker.
 */
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  DEFAULT_STYLES_DIR,
  DEFAULT_TEMPLATE_DIR,
  updateChannel,
  type GitOptions,
} from '@reelforge/project';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createLogger } from './logger.js';
import { explicitFormFields } from './new-project-options.js';
import { ProjectService } from './project-service.js';

vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 });

let root: string;
let git: GitOptions;
let picks: number;

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'reelforge genre ż-'));
  const globalConfig = path.join(root, 'global.gitconfig');
  await writeFile(globalConfig, '');
  git = { env: { ...process.env, GIT_CONFIG_GLOBAL: globalConfig, GIT_CONFIG_NOSYSTEM: '1' } };
  picks = 0;
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true, maxRetries: 5 });
});

function service(options: { channelsFile?: string; experimental?: boolean } = {}): ProjectService {
  return new ProjectService({
    recentFile: path.join(root, 'user data', 'recent-projects.json'),
    ...(options.channelsFile === undefined ? {} : { channelsFile: options.channelsFile }),
    templateDir: DEFAULT_TEMPLATE_DIR,
    stylesDir: DEFAULT_STYLES_DIR,
    pickFolder: () => {
      picks += 1;
      return Promise.resolve(root);
    },
    defaultStyle: () => 'voxel-pixel-crisp640',
    experimentalWorlds: () => options.experimental === true,
    newProjectDefaults: () => ({
      characters: 'pack',
      mascot: 'none',
      shotsPerMinute: { min: 8, max: 12 },
      fasterChecks: false,
    }),
    log: createLogger(() => undefined),
    git,
  });
}

async function projectJson(result: Awaited<ReturnType<ProjectService['newProject']>>) {
  if (result.status !== 'opened') throw new Error(`not created: ${JSON.stringify(result)}`);
  const raw: unknown = JSON.parse(
    await readFile(path.join(result.project.dir, 'project.json'), 'utf8'),
  );
  return raw as Record<string, unknown>;
}

describe('explicitFormFields', () => {
  it('takes the request’s list, else every form field the request carries', () => {
    const base = { title: 'A', language: 'en' as const };
    expect(explicitFormFields({ ...base, style: 'soft-480', explicitFields: [] })).toEqual([]);
    expect(
      explicitFormFields({ ...base, explicitFields: ['style', 'style', 'fasterChecks'] }),
    ).toEqual(['style', 'fasterChecks']);
    expect(explicitFormFields({ ...base, style: 'soft-480', shotsPerMinute: null })).toEqual([
      'style',
      'shotsPerMinute',
    ]);
    expect(explicitFormFields(base)).toEqual([]);
  });
});

describe('ProjectService.newProject with a genre preset', () => {
  it('lets the preset replace the fields the user did not touch', async () => {
    const written = await projectJson(
      await service().newProject({
        title: 'Heist',
        language: 'en',
        style: 'voxel-pixel-crisp640',
        shotsPerMinute: { min: 8, max: 12 },
        fasterChecks: false,
        genrePreset: 'true-crime',
        explicitFields: [],
      }),
    );
    expect(written).toMatchObject({
      genrePreset: 'true-crime',
      style: 'noir-voxel',
      shotsPerMinute: { min: 5, max: 8 },
      lookMode: 'mixed',
      continuityLinks: true,
      tensionMap: 'auto',
      researchMode: 'ask',
    });
  });

  it('keeps the style and range the user chose', async () => {
    const written = await projectJson(
      await service().newProject({
        title: 'Heist',
        language: 'en',
        style: 'soft-480',
        shotsPerMinute: { min: 8, max: 12 },
        genrePreset: 'true-crime',
        explicitFields: ['style', 'shotsPerMinute'],
      }),
    );
    expect(written).toMatchObject({
      genrePreset: 'true-crime',
      style: 'soft-480',
      shotsPerMinute: { min: 8, max: 12 },
      continuityLinks: true,
    });
  });

  it('skips a preferred world the app does not offer', async () => {
    const off = await projectJson(
      await service().newProject({ title: 'Rome', language: 'en', genrePreset: 'history' }),
    );
    expect(off).toMatchObject({ style: 'soft-480', patternInterrupts: 'off' });
    const on = await projectJson(
      await service({ experimental: true }).newProject({
        title: 'Rome 2',
        language: 'en',
        genrePreset: 'history',
      }),
    );
    expect(on).toMatchObject({ style: 'sketchbook', genrePreset: 'history' });
  });

  it('uses the channel’s genre unless the form names one or None', async () => {
    const channelsFile = path.join(root, 'user data', 'channels.json');
    const updated = await updateChannel(channelsFile, 'default', {
      defaultStyle: 'noir-voxel',
      genrePreset: 'finance',
    });
    expect(updated.ok).toBe(true);
    const projects = service({ channelsFile });
    // The onboarding form sends only a title and language.
    const fromChannel = await projectJson(
      await projects.newProject({ title: 'Money', language: 'en' }),
    );
    expect(fromChannel).toMatchObject({
      genrePreset: 'finance',
      style: 'voxel-pixel-crisp640',
      shotsPerMinute: { min: 5, max: 8 },
      channelId: 'default',
    });
    const none = await projectJson(
      await projects.newProject({ title: 'Plain', language: 'en', genrePreset: null }),
    );
    expect(none).not.toHaveProperty('genrePreset');
    expect(none).toMatchObject({ style: 'noir-voxel', shotsPerMinute: { min: 8, max: 12 } });
    const other = await projectJson(
      await projects.newProject({ title: 'Space', language: 'en', genrePreset: 'science' }),
    );
    expect(other).toMatchObject({ genrePreset: 'science' });
  });

  it('refuses an unknown preset before the folder picker', async () => {
    const result = await service().newProject({
      title: 'Nope',
      language: 'en',
      genrePreset: 'western',
    });
    expect(result).toEqual({
      status: 'error',
      error: { kind: 'invalid-argument', message: 'there is no genre preset "western"' },
    });
    expect(picks).toBe(0);
  });
});
