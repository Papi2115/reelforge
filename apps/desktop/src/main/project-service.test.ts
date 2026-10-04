import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DEFAULT_STYLES_DIR, DEFAULT_TEMPLATE_DIR, type GitOptions } from '@reelforge/project';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createLogger } from './logger.js';
import { newProjectDir, ProjectService, type FolderPurpose } from './project-service.js';

// Each case spawns git several times; Windows is slow at process creation.
vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 });

let root: string;
let git: GitOptions;
let picks: (string | undefined)[];
let purposes: FolderPurpose[];
let lines: string[];

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'reelforge app ś-'));
  const globalConfig = path.join(root, 'global.gitconfig');
  await writeFile(globalConfig, '');
  git = { env: { ...process.env, GIT_CONFIG_GLOBAL: globalConfig, GIT_CONFIG_NOSYSTEM: '1' } };
  picks = [];
  purposes = [];
  lines = [];
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true, maxRetries: 5 });
});

function service(onCurrentChanged?: (dir: string | undefined) => void): ProjectService {
  return new ProjectService({
    ...(onCurrentChanged ? { onCurrentChanged } : {}),
    recentFile: path.join(root, 'user data', 'recent-projects.json'),
    templateDir: DEFAULT_TEMPLATE_DIR,
    stylesDir: DEFAULT_STYLES_DIR,
    pickFolder: (purpose) => {
      purposes.push(purpose);
      return Promise.resolve(picks.shift());
    },
    log: createLogger((line) => lines.push(line)),
    git,
  });
}

describe('ProjectService', () => {
  it('creates a project in the picked folder, remembers it and lists its history', async () => {
    const projects = service();
    const parent = path.join(root, 'Moje filmy');
    await mkdir(parent);
    picks.push(parent);
    const result = await projects.newProject({ title: 'Kalkulator: historia', language: 'pl' });
    const dir = path.join(parent, 'Kalkulator historia');
    expect(result).toEqual({
      status: 'opened',
      project: {
        dir,
        title: 'Kalkulator: historia',
        language: 'pl',
        style: 'voxel-pixel-crisp640',
        fps: 30,
      },
    });
    expect(purposes).toEqual(['new-project-parent']);
    expect(projects.currentProject()?.dir).toBe(dir);
    expect(await projects.recent()).toMatchObject([
      { dir, title: 'Kalkulator: historia', exists: true },
    ]);
    const historyResult = await projects.history(20);
    expect(
      historyResult.status === 'ok' && historyResult.entries.map((entry) => entry.kind),
    ).toEqual(['create']);
  });

  it('starts new projects with the default style from the app settings', async () => {
    const projects = new ProjectService({
      recentFile: path.join(root, 'user data', 'recent-projects.json'),
      templateDir: DEFAULT_TEMPLATE_DIR,
      stylesDir: DEFAULT_STYLES_DIR,
      pickFolder: () => Promise.resolve(root),
      defaultStyle: () => 'noir-voxel',
      newProjectDefaults: () => ({ characters: 'pack', mascot: 'fox' }),
      log: createLogger((line) => lines.push(line)),
      git,
    });
    const result = await projects.newProject({ title: 'Noir', language: 'en' });
    expect(result).toMatchObject({ status: 'opened', project: { style: 'noir-voxel' } });
    if (result.status !== 'opened') throw new Error('not created');
    // The channel mascot carries over to new projects (PLAN.md#12.20).
    const written: unknown = JSON.parse(
      await readFile(path.join(result.project.dir, 'project.json'), 'utf8'),
    );
    expect(written).toMatchObject({ characters: 'pack', mascot: 'fox' });
  });

  it('takes the scenes per minute and faster checks of the form over the defaults (ADR-027)', async () => {
    const projects = new ProjectService({
      recentFile: path.join(root, 'user data', 'recent-projects.json'),
      templateDir: DEFAULT_TEMPLATE_DIR,
      stylesDir: DEFAULT_STYLES_DIR,
      pickFolder: () => Promise.resolve(root),
      newProjectDefaults: () => ({
        characters: 'pack',
        mascot: 'none',
        shotsPerMinute: { min: 8, max: 12 },
        fasterChecks: false,
      }),
      log: createLogger((line) => lines.push(line)),
      git,
    });
    const read = async (dir: string): Promise<Record<string, unknown>> =>
      JSON.parse(await readFile(path.join(dir, 'project.json'), 'utf8')) as Record<string, unknown>;
    const defaults = await projects.newProject({ title: 'Defaults', language: 'en' });
    if (defaults.status !== 'opened') throw new Error('not created');
    expect(await read(defaults.project.dir)).toMatchObject({ shotsPerMinute: { min: 8, max: 12 } });
    expect(await read(defaults.project.dir)).not.toHaveProperty('fasterChecks');
    const chosen = await projects.newProject({
      title: 'Calm',
      language: 'en',
      shotsPerMinute: { min: 3, max: 5 },
      fasterChecks: true,
    });
    if (chosen.status !== 'opened') throw new Error('not created');
    expect(await read(chosen.project.dir)).toMatchObject({
      shotsPerMinute: { min: 3, max: 5 },
      fasterChecks: true,
    });
    const none = await projects.newProject({ title: 'None', language: 'en', shotsPerMinute: null });
    if (none.status !== 'opened') throw new Error('not created');
    expect(await read(none.project.dir)).not.toHaveProperty('shotsPerMinute');
  });

  it('autocommits for later stages and reverts the scene (restores content, new commit)', async () => {
    const projects = service();
    picks.push(root);
    const created = await projects.newProject({ title: 'Film', language: 'en' });
    if (created.status !== 'opened') throw new Error('not created');
    const scene = path.join(created.project.dir, 'scenes', 's01.js');
    await writeFile(scene, '// v1\n');
    const first = await projects.autocommit('Scenes built', {
      kind: 'pipeline-step',
      step: 'scenes-built',
    });
    if (!first.ok || first.value.status !== 'committed') throw new Error('first commit missing');
    await writeFile(scene, '// v2\n');
    await projects.autocommit('Claude turn', { kind: 'claude-turn' });

    expect(await projects.revert(first.value.hash)).toMatchObject({ status: 'reverted' });
    expect(await readFile(scene, 'utf8')).toBe('// v1\n');
    const after = await projects.history(20);
    expect(after.status === 'ok' && after.entries.map((entry) => entry.kind)).toEqual([
      'revert',
      'claude-turn',
      'pipeline-step',
      'create',
    ]);
  });

  it('opens only recent folders by path, and reports cancel and typed errors', async () => {
    const projects = service();
    expect(await projects.openWithPicker()).toEqual({ status: 'cancelled' });
    expect(await projects.newProject({ title: 'X', language: 'en' })).toEqual({
      status: 'cancelled',
    });

    const elsewhere = path.join(root, 'elsewhere');
    const refused = await projects.openRecent(elsewhere);
    expect(refused).toMatchObject({ status: 'error', error: { kind: 'invalid-argument' } });
    expect(lines.join('')).toContain('not in the recent projects list');

    await mkdir(elsewhere);
    picks.push(elsewhere);
    expect(await projects.openWithPicker()).toMatchObject({
      status: 'error',
      error: { kind: 'not-a-project' },
    });

    picks.push(root);
    const created = await projects.newProject({ title: 'Recent', language: 'en' });
    if (created.status !== 'opened') throw new Error('not created');
    projects.close();
    expect(projects.currentProject()).toBeNull();
    expect(await projects.history(5)).toMatchObject({
      status: 'error',
      error: { kind: 'invalid-argument' },
    });
    expect(await projects.openRecent(created.project.dir)).toMatchObject({ status: 'opened' });
  });

  it('reads the open project for the layout and reports folder changes', async () => {
    const followed: (string | undefined)[] = [];
    const projects = service((dir) => followed.push(dir));
    expect(await projects.snapshot()).toMatchObject({
      status: 'error',
      error: { kind: 'invalid-argument' },
    });
    expect(await projects.manifest()).toEqual({
      status: 'unavailable',
      reason: 'no project is open',
    });
    picks.push(root);
    const created = await projects.newProject({ title: 'Układ', language: 'pl' });
    if (created.status !== 'opened') throw new Error('not created');
    const snapshot = await projects.snapshot();
    expect(snapshot.status === 'ok' && snapshot.snapshot.files).toContain('project.json');
    expect(snapshot.status === 'ok' && snapshot.snapshot.storyboard).toEqual({
      status: 'missing',
    });
    expect(await projects.manifest()).toEqual({ status: 'no-storyboard' });
    projects.close();
    expect(followed).toEqual([created.project.dir, undefined]);
  });

  it('picks a free folder name next to existing ones', async () => {
    await mkdir(path.join(root, 'Film'));
    await mkdir(path.join(root, 'Film 2'));
    expect(newProjectDir(root, 'Film')).toBe(path.join(root, 'Film 3'));
    expect(existsSync(newProjectDir(root, 'Nowy'))).toBe(false);
  });
});
