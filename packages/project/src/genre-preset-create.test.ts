/** createProject with genre presets (PLAN.md#13.8, ADR-035): precedence and style fallback. */
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { projectFileSchema, type ProjectFile } from '@reelforge/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createProject, type CreateProjectOptions } from './create.js';
import { createGitSandbox, type GitSandbox } from './testing/git-sandbox.js';

vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 });

let sandbox: GitSandbox;

beforeEach(async () => {
  sandbox = await createGitSandbox();
});

afterEach(async () => {
  await sandbox.dispose();
});

type Options = Omit<CreateProjectOptions, 'dir' | 'title' | 'git'>;

async function create(name: string, options: Options): Promise<ProjectFile> {
  const result = await createProject({
    dir: path.join(sandbox.root, name),
    title: name,
    seed: 3,
    git: sandbox.git,
    ...options,
  });
  if (!result.ok) throw new Error(result.error.message);
  const raw: unknown = JSON.parse(
    await readFile(path.join(result.value.dir, 'project.json'), 'utf8'),
  );
  expect(projectFileSchema.parse(raw)).toEqual(result.value.project);
  return result.value.project;
}

const CHANNEL = { id: 'voxplain', defaultStyle: 'soft-480', genrePreset: 'tech-explainer' };

describe('createProject with a genre preset', () => {
  it('leaves projects without a preset exactly as before', async () => {
    const plain = await create('plain', {});
    expect(plain).not.toHaveProperty('genrePreset');
    expect(plain).not.toHaveProperty('shotsPerMinute');
    expect(plain).toMatchObject({ style: 'voxel-pixel-crisp640', continuityLinks: false });
    const channel = await create('channel without preset', {
      channel: { id: 'voxplain', defaultStyle: 'noir-voxel', genrePreset: null },
    });
    expect(channel).not.toHaveProperty('genrePreset');
    expect(channel).toMatchObject({ style: 'noir-voxel', channelId: 'voxplain' });
  });

  it('writes the preset fields and records its id', async () => {
    const crime = await create('crime', { genrePreset: 'true-crime' });
    expect(crime).toMatchObject({
      genrePreset: 'true-crime',
      style: 'noir-voxel',
      lookMode: 'mixed',
      shotsPerMinute: { min: 5, max: 8 },
      continuityLinks: true,
      researchMode: 'ask',
      tensionMap: 'auto',
      // Not preset fields: the template's.
      characters: 'pack',
      antiSlopGuards: false,
    });
  });

  it('falls back to the next style when a world is not offered', async () => {
    // Default availability = styles with a bible: Sketchbook and Comic have none.
    const history = await create('history built-in', { genrePreset: 'history' });
    expect(history).toMatchObject({ style: 'soft-480', patternInterrupts: 'off' });
    const pop = await create('pop unwired', {
      genrePreset: 'pop-culture',
      isStyleAvailable: (id) => id !== 'game-b2',
    });
    expect(pop.style).toBe('voxel-pixel-crisp640');
  });

  it('a world chosen by the preset brings the world defaults', async () => {
    const history = await create('history sketchbook', {
      genrePreset: 'history',
      isStyleAvailable: (id) => id === 'sketchbook' || id === 'soft-480',
    });
    expect(history).toMatchObject({
      style: 'sketchbook',
      lookMode: 'mixed',
      continuityLinks: true,
      characters: 'classic',
      mascot: 'none',
      antiSlopGuards: true,
    });
    expect(existsSync(path.join(sandbox.root, 'history sketchbook', 'styles', 'sketchbook'))).toBe(
      false,
    );
  });

  it('explicit choices beat the preset; explicitFields lets it replace app defaults', async () => {
    const explicit = await create('explicit', {
      genrePreset: 'tech-explainer',
      style: 'noir-voxel',
      shotsPerMinute: null,
      fasterChecks: false,
    });
    expect(explicit).toMatchObject({ genrePreset: 'tech-explainer', style: 'noir-voxel' });
    expect(explicit).not.toHaveProperty('shotsPerMinute');
    expect(explicit).not.toHaveProperty('fasterChecks');
    // The app's defaults (style, range) passed as non-explicit: the preset replaces them.
    const defaults = await create('app defaults', {
      genrePreset: 'true-crime',
      style: 'soft-480',
      shotsPerMinute: { min: 8, max: 12 },
      explicitFields: [],
    });
    expect(defaults).toMatchObject({ style: 'noir-voxel', shotsPerMinute: { min: 5, max: 8 } });
  });

  it("uses the channel's preset unless the form names one or none", async () => {
    const channel = await create('channel preset', { channel: CHANNEL });
    // The preset's style beats the channel's default style.
    expect(channel).toMatchObject({
      genrePreset: 'tech-explainer',
      style: 'voxel-pixel-crisp640',
      shotsPerMinute: { min: 8, max: 12 },
      channelId: 'voxplain',
    });
    const form = await create('form preset', { channel: CHANNEL, genrePreset: 'finance' });
    expect(form.genrePreset).toBe('finance');
    const none = await create('form none', { channel: CHANNEL, genrePreset: null });
    expect(none).not.toHaveProperty('genrePreset');
    expect(none.style).toBe('soft-480');
  });

  it('ignores an unknown channel preset and refuses an unknown form preset', async () => {
    const unknown = await create('channel unknown', {
      channel: { ...CHANNEL, genrePreset: 'tech' },
    });
    expect(unknown).not.toHaveProperty('genrePreset');
    expect(unknown.style).toBe('soft-480');
    const dir = path.join(sandbox.root, 'form unknown');
    const refused = await createProject({
      dir,
      title: 'X',
      genrePreset: 'tech',
      git: sandbox.git,
    });
    expect(!refused.ok && refused.error).toMatchObject({ kind: 'invalid-argument' });
    expect(existsSync(dir)).toBe(false);
  });
});
