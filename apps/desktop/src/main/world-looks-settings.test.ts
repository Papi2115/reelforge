/** Project settings → "Looks of this world" in project.json (PLAN.md#14.12, Grim Ink). */
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createLogger } from './logger.js';
import { lookSummaries, projectStyle } from './project-settings-ipc.js';
import { applyProjectSettingsPatch, ProjectSettingsService } from './project-settings-service.js';

const PROJECT = {
  version: 1,
  title: 'The night shift',
  language: 'en',
  style: 'c-cam',
  fps: 24,
  seed: 7,
  lookMode: 'mixed',
};

let root: string;
let commits: string[];
let service: ProjectSettingsService;

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'reelforge world looks ż-'));
  commits = [];
  service = new ProjectSettingsService({
    projectDir: () => root,
    commit: (message) => {
      commits.push(message);
      return Promise.resolve(true);
    },
    looks: (style) => lookSummaries(style, true),
    style: (style) => projectStyle(style, true),
    log: createLogger(() => undefined),
  });
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true, maxRetries: 5 });
});

async function writeProject(value: unknown): Promise<void> {
  await writeFile(path.join(root, 'project.json'), JSON.stringify(value, null, 2));
}

async function readProject(): Promise<Record<string, unknown>> {
  const parsed: unknown = JSON.parse(await readFile(path.join(root, 'project.json'), 'utf8'));
  if (typeof parsed !== 'object' || parsed === null) throw new Error('not an object');
  return { ...parsed };
}

describe('looks of this world in Project settings', () => {
  it('reads all looks on when project.json has no field', async () => {
    await writeProject(PROJECT);
    const state = await service.get();
    if (state.status !== 'ok') throw new Error(state.message);
    expect(state.settings.worldLooks).toBeNull();
    expect(state.style).toMatchObject({ id: 'c-cam', optionalLooks: true, enabled: true });
    expect(state.looks.map((look) => look.id)).toEqual(['ink-scene', 'ink-insert', 'ink-poster']);
  });

  it('writes the looks kept on, and removes the field when all are on again', async () => {
    await writeProject(PROJECT);
    const off = await service.update({ worldLooks: ['ink-scene', 'ink-poster'] });
    expect(off).toMatchObject({ status: 'ok', committed: true });
    expect((await readProject())['worldLooks']).toEqual(['ink-scene', 'ink-poster']);
    const on = await service.update({ worldLooks: null });
    expect(on).toMatchObject({ status: 'ok', committed: true });
    expect(await readProject()).not.toHaveProperty('worldLooks');
    expect(commits).toEqual([
      'Project settings: looks of this world ink-scene, ink-poster',
      'Project settings: looks of this world all',
    ]);
  });

  it('refuses a look of another world, none at all, and a style without optional looks', async () => {
    await writeProject(PROJECT);
    expect(await service.update({ worldLooks: ['comic-story'] })).toEqual({
      status: 'error',
      message: 'not a look of this world: comic-story',
    });
    expect((await service.update({ worldLooks: [] })).status).toBe('error');
    await writeProject({ ...PROJECT, style: 'comic' });
    expect(await service.update({ worldLooks: ['comic-story'] })).toEqual({
      status: 'error',
      message: 'the style of this project has no looks to turn off',
    });
    expect(commits).toEqual([]);
  });

  it('keeps key order and unknown keys when it sets the field', () => {
    const raw = { version: 1, custom: true };
    expect(Object.keys(applyProjectSettingsPatch(raw, { worldLooks: ['ink-scene'] }))).toEqual([
      'version',
      'custom',
      'worldLooks',
    ]);
  });
});
