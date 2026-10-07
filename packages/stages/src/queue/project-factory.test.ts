/**
 * The production line's project factory with genre presets (PLAN.md#13.8, ADR-035): the item's
 * preset beats the channel's (null = none), the item's style is the only explicit choice (the
 * preset replaces the app's defaults), the app's style availability is injected, and the preset is
 * recorded in project.json.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { ok } from '@reelforge/claude-bridge';
import { projectFileSchema, type ProjectFile, type QueueItem } from '@reelforge/shared';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { TestProjects } from '../testing/project.js';
import {
  createQueueProjectFactory,
  queueGenrePresetOptions,
  type QueueChannelDefaults,
} from './project-factory.js';

vi.setConfig({ testTimeout: 60_000 });

const projects = new TestProjects();
afterAll(() => {
  projects.dispose();
});

const AT = '2026-10-07T20:00:00.000Z';
/** The app's new-project default range (the preset replaces it). */
const APP_RANGE = { min: 8, max: 12 };

function item(id: string, extra: Partial<QueueItem> = {}): QueueItem {
  return {
    id,
    topic: 'The heist of the century',
    language: 'en',
    status: 'queued',
    stageProgress: {},
    warnings: [],
    createdAt: AT,
    updatedAt: AT,
    history: [],
    ...extra,
  };
}

async function make(
  name: string,
  film: QueueItem,
  channel: Partial<QueueChannelDefaults>,
  isStyleAvailable?: (id: string) => boolean,
): Promise<ProjectFile | string> {
  const factory = createQueueProjectFactory({
    channel: () =>
      Promise.resolve(
        ok({ projectsDir: path.join(projects.root, name), defaultStyle: null, ...channel }),
      ),
    create: { git: projects.git, seed: 7, shotsPerMinute: APP_RANGE },
    ...(isStyleAvailable === undefined ? {} : { isStyleAvailable }),
  });
  const made = await factory.create({
    channelId: 'voxplain',
    item: film,
    targetMinutes: 6,
    signal: new AbortController().signal,
  });
  if (!made.ok) return made.error;
  const raw: unknown = JSON.parse(
    readFileSync(path.join(made.value.projectPath, 'project.json'), 'utf8'),
  );
  return projectFileSchema.parse(raw);
}

async function project(...args: Parameters<typeof make>): Promise<ProjectFile> {
  const made = await make(...args);
  if (typeof made === 'string') throw new Error(made);
  return made;
}

describe('queueGenrePresetOptions', () => {
  it("passes the item's preset (null = none) and its style as the only explicit field", () => {
    expect(queueGenrePresetOptions({})).toEqual({ explicitFields: [] });
    expect(queueGenrePresetOptions({ genrePreset: null, style: 'soft-480' })).toEqual({
      genrePreset: null,
      explicitFields: ['style'],
    });
    const available = (id: string): boolean => id === 'soft-480';
    expect(queueGenrePresetOptions({ genrePreset: 'history' }, available)).toEqual({
      genrePreset: 'history',
      explicitFields: [],
      isStyleAvailable: available,
    });
  });
});

describe('queue project factory with genre presets', () => {
  it("applies the channel's preset over the app's defaults and records it", async () => {
    const crime = await project('channel preset', item('c1'), { genrePreset: 'true-crime' });
    expect(crime).toMatchObject({
      genrePreset: 'true-crime',
      style: 'noir-voxel',
      shotsPerMinute: { min: 5, max: 8 },
      channelId: 'voxplain',
    });
  });

  it("lets the item's preset win, keeps the item's style, and null means none", async () => {
    const finance = await project(
      'item preset',
      item('f1', { genrePreset: 'finance', style: 'soft-480' }),
      { genrePreset: 'true-crime' },
    );
    expect(finance).toMatchObject({ genrePreset: 'finance', style: 'soft-480' });
    const none = await project('item none', item('n1', { genrePreset: null }), {
      genrePreset: 'true-crime',
      defaultStyle: 'soft-480',
    });
    expect(none).not.toHaveProperty('genrePreset');
    expect(none).toMatchObject({ style: 'soft-480', shotsPerMinute: APP_RANGE });
  });

  it('leaves films without any preset as before', async () => {
    const plain = await project('no preset', item('p1'), {});
    expect(plain).not.toHaveProperty('genrePreset');
    expect(plain).toMatchObject({ style: 'voxel-pixel-crisp640', shotsPerMinute: APP_RANGE });
  });

  it("asks the app which styles it offers and refuses an unknown item's preset", async () => {
    const asked: string[] = [];
    const history = await project('offered', item('h1', { genrePreset: 'history' }), {}, (id) => {
      asked.push(id);
      return id === 'soft-480';
    });
    expect(asked).toEqual(['sketchbook', 'comic', 'soft-480']);
    expect(history).toMatchObject({ genrePreset: 'history', style: 'soft-480' });
    const unknown = await make('unknown', item('u1', { genrePreset: 'tech' }), {});
    expect(unknown).toMatch(/there is no genre preset "tech"/);
  });
});
