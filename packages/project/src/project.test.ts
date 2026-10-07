import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { projectFileSchema } from '@reelforge/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createProject } from './create.js';
import { history } from './git-history.js';
import { runGit } from './git-runner.js';
import { openProject, type ProjectMigration } from './open.js';
import {
  DEFAULT_STYLES_DIR,
  DEFAULT_TEMPLATE_DIR,
  projectFolderName,
  toProjectRelative,
} from './paths.js';
import { createGitSandbox, type GitSandbox } from './testing/git-sandbox.js';
import { WORLD_PROJECT_DEFAULTS, worldProjectDefaults } from './world-defaults.js';

// Every case spawns git a dozen times; Windows CI runners are slow at process creation.
vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 });

let sandbox: GitSandbox;

beforeEach(async () => {
  sandbox = await createGitSandbox();
});

afterEach(async () => {
  await sandbox.dispose();
});

function projectDir(name = 'Mój film o kalkulatorze'): string {
  return path.join(sandbox.root, name);
}

async function create(dir = projectDir()) {
  const result = await createProject({
    dir,
    title: 'Mój film',
    language: 'pl',
    seed: 7,
    git: sandbox.git,
  });
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
}

async function gitOutput(dir: string, args: string[]): Promise<{ code: number; stdout: string }> {
  const result = await runGit(dir, args, sandbox.git);
  if (!result.ok) throw new Error(result.error.message);
  return { code: result.value.code, stdout: result.value.stdout.trim() };
}

describe('createProject', () => {
  it('creates the template files, folders and a first commit (space + Polish path)', async () => {
    const dir = projectDir();
    const created = await create(dir);
    expect(created.project).toMatchObject({
      version: 1,
      title: 'Mój film',
      language: 'pl',
      seed: 7,
    });
    const projectJson: unknown = JSON.parse(await readFile(path.join(dir, 'project.json'), 'utf8'));
    expect(projectFileSchema.parse(projectJson)).toEqual(created.project);
    expect(await readFile(path.join(dir, 'CLAUDE.md'))).toEqual(
      await readFile(path.join(DEFAULT_TEMPLATE_DIR, 'CLAUDE.md')),
    );
    for (const folder of ['scenes', 'audio', 'timing', 'out', '.git']) {
      expect(existsSync(path.join(dir, folder))).toBe(true);
    }
    const entries = await history(dir, { git: sandbox.git });
    if (!entries.ok) throw new Error(entries.error.message);
    expect(entries.value).toHaveLength(1);
    expect(entries.value[0]).toMatchObject({
      kind: 'create',
      step: 'create',
      subject: 'Create project "Mój film"',
    });
    expect(entries.value[0]?.files.map((file) => file.path).sort()).toEqual([
      '.gitignore',
      'CLAUDE.md',
      'audio/.keep',
      'project.json',
      'scenes/.keep',
      'styles/noir-voxel/STYLE.md',
      'styles/soft-480/STYLE.md',
      'styles/voxel-pixel-crisp640/STYLE.md',
      'timing/.keep',
    ]);
    expect((await gitOutput(dir, ['branch', '--show-current'])).stdout).toBe('main');
  });

  it('starts with the pack and no mascot, or the characters asked for (PLAN.md#12.20)', async () => {
    const created = await create(projectDir('characters template'));
    expect(created.project).toMatchObject({ characters: 'pack', mascot: 'none' });
    // New projects plan continuity links (PLAN.md#13.2); absent (older projects) = off.
    expect(created.project).toMatchObject({ continuityLinks: false });
    const chosen = await createProject({
      dir: projectDir('characters fox'),
      title: 'Fox',
      characters: 'pack',
      mascot: 'fox',
      git: sandbox.git,
    });
    if (!chosen.ok) throw new Error(chosen.error.message);
    expect(chosen.value.project).toMatchObject({ characters: 'pack', mascot: 'fox' });
  });

  it('gives a world style its defaults: continuity on, mixed looks, no pack (PLAN.md#13.6)', async () => {
    const world = await createProject({
      dir: projectDir('sketchbook world'),
      title: 'Leap year',
      style: 'sketchbook',
      characters: 'pack',
      mascot: 'fox',
      git: sandbox.git,
    });
    if (!world.ok) throw new Error(world.error.message);
    expect(world.value.project).toMatchObject({
      style: 'sketchbook',
      lookMode: 'mixed',
      continuityLinks: true,
      characters: 'classic',
      mascot: 'none',
    });
    // No bible until the world ships; the built-in bibles are copied as for any project.
    expect(existsSync(path.join(world.value.dir, 'styles', 'sketchbook'))).toBe(false);
    expect(existsSync(path.join(world.value.dir, 'styles', 'noir-voxel', 'STYLE.md'))).toBe(true);
    expect(worldProjectDefaults('voxel-pixel-crisp640')).toBeUndefined();
    expect(Object.keys(WORLD_PROJECT_DEFAULTS)).toEqual([
      'sketchbook',
      'comic',
      'game-b2',
      'game-b1',
    ]);
  });

  it('gives the Comic world the same film language (PLAN.md#13.3 part c)', async () => {
    const comic = await createProject({
      dir: projectDir('comic world'),
      title: 'The 1202 alarm',
      style: 'comic',
      git: sandbox.git,
    });
    if (!comic.ok) throw new Error(comic.error.message);
    // 640x360 comes with the world's style preset; the template keeps 30 fps.
    expect(comic.value.project).toMatchObject({
      style: 'comic',
      fps: 30,
      lookMode: 'mixed',
      continuityLinks: true,
      antiSlopGuards: true,
      characters: 'classic',
      mascot: 'none',
    });
    expect(existsSync(path.join(comic.value.dir, 'styles', 'comic'))).toBe(false);
  });

  it.each([
    ['game-b2', 'The E.T. cartridges'],
    ['game-b1', 'The 1983 crash'],
  ])(
    'gives the %s world the same film language (PLAN.md#13.4, #13.5 part c)',
    async (style, title) => {
      const game = await createProject({
        dir: projectDir(`${style} world`),
        title,
        style,
        git: sandbox.git,
      });
      if (!game.ok) throw new Error(game.error.message);
      expect(game.value.project).toMatchObject({
        style,
        fps: 30,
        lookMode: 'mixed',
        continuityLinks: true,
        antiSlopGuards: true,
        characters: 'classic',
        mascot: 'none',
      });
      expect(existsSync(path.join(game.value.dir, 'styles', style))).toBe(false);
    },
  );

  it('writes the scenes per minute and faster checks only when chosen (ADR-027)', async () => {
    const plain = await createProject({
      dir: projectDir('scene count none'),
      title: 'Plain',
      shotsPerMinute: null,
      fasterChecks: false,
      git: sandbox.git,
    });
    if (!plain.ok) throw new Error(plain.error.message);
    const json = await readFile(path.join(plain.value.dir, 'project.json'), 'utf8');
    const raw = JSON.parse(json) as Record<string, unknown>;
    expect(raw).not.toHaveProperty('shotsPerMinute');
    expect(raw).not.toHaveProperty('fasterChecks');
    const calm = await createProject({
      dir: projectDir('scene count calm'),
      title: 'Calm',
      shotsPerMinute: { min: 3, max: 5 },
      fasterChecks: true,
      git: sandbox.git,
    });
    if (!calm.ok) throw new Error(calm.error.message);
    expect(calm.value.project).toMatchObject({
      shotsPerMinute: { min: 3, max: 5 },
      fasterChecks: true,
    });
  });

  it('copies the style bible of every preset (styles/<id>/STYLE.md)', async () => {
    const dir = projectDir();
    const created = await create(dir);
    const bible = path.join('styles', created.project.style, 'STYLE.md');
    expect(await readFile(path.join(dir, bible))).toEqual(
      await readFile(path.join(DEFAULT_STYLES_DIR, created.project.style, 'STYLE.md')),
    );
    expect(existsSync(path.join(dir, 'styles', 'noir-voxel', 'STYLE.md'))).toBe(true);
    expect(existsSync(path.join(dir, 'styles', 'noir-voxel', 'style.json'))).toBe(false);
  });

  it('refuses a styles folder without the bible of the chosen style', async () => {
    const stylesDir = path.join(sandbox.root, 'styles');
    await mkdir(path.join(stylesDir, 'soft-480'), { recursive: true });
    await writeFile(path.join(stylesDir, 'soft-480', 'STYLE.md'), '# Soft');
    const dir = projectDir('no bible');
    const result = await createProject({
      dir,
      title: 'X',
      style: 'noir-voxel',
      stylesDir,
      git: sandbox.git,
    });
    expect(!result.ok && result.error).toMatchObject({
      kind: 'io',
      path: path.join(stylesDir, 'noir-voxel', 'STYLE.md'),
    });
    expect(existsSync(dir)).toBe(false);

    const soft = await createProject({
      dir,
      title: 'X',
      style: 'soft-480',
      stylesDir,
      git: sandbox.git,
    });
    expect(soft.ok).toBe(true);
    expect(await readFile(path.join(dir, 'styles', 'soft-480', 'STYLE.md'), 'utf8')).toBe('# Soft');
  });

  it('sets a repo-local identity only when git has none', async () => {
    const dir = projectDir();
    await create(dir);
    expect((await gitOutput(dir, ['config', '--local', '--get', 'user.name'])).stdout).toBe(
      'ReelForge',
    );
    expect((await gitOutput(dir, ['log', '-1', '--format=%an <%ae>'])).stdout).toBe(
      'ReelForge <reelforge@local>',
    );

    const withIdentity = await createGitSandbox({
      identity: { name: 'Papi', email: 'papi@example.com' },
    });
    try {
      const other = path.join(withIdentity.root, 'p');
      const result = await createProject({ dir: other, title: 'X', git: withIdentity.git });
      expect(result.ok).toBe(true);
      const local = await runGit(
        other,
        ['config', '--local', '--get', 'user.name'],
        withIdentity.git,
      );
      expect(local.ok && local.value.code).toBe(1);
      const author = await runGit(other, ['log', '-1', '--format=%an'], withIdentity.git);
      expect(author.ok && author.value.stdout.trim()).toBe('Papi');
    } finally {
      await withIdentity.dispose();
    }
  });

  it('refuses a folder with files and an invalid title (without creating anything)', async () => {
    const dir = projectDir();
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, 'notes.txt'), 'mine');
    const notEmpty = await createProject({ dir, title: 'X', git: sandbox.git });
    expect(!notEmpty.ok && notEmpty.error.kind).toBe('not-empty');

    const other = projectDir('blank');
    const blank = await createProject({ dir: other, title: '   ', git: sandbox.git });
    expect(!blank.ok && blank.error.kind).toBe('invalid-argument');
    expect(existsSync(other)).toBe(false);
  });
});

describe('openProject', () => {
  it('opens a created project', async () => {
    const dir = projectDir();
    const created = await create(dir);
    const opened = await openProject(dir, { git: sandbox.git });
    expect(opened).toEqual({ ok: true, value: { ...created, initializedGit: false } });
  });

  it('returns typed errors for missing folders, non-projects and broken project.json', async () => {
    const missing = await openProject(projectDir('nope'), { git: sandbox.git });
    expect(!missing.ok && missing.error.kind).toBe('not-found');

    const plain = projectDir('plain');
    await mkdir(plain);
    const notProject = await openProject(plain, { git: sandbox.git });
    expect(!notProject.ok && notProject.error.kind).toBe('not-a-project');

    const dir = projectDir();
    await create(dir);
    const file = path.join(dir, 'project.json');
    await writeFile(file, '{ "version": 1, "title": ');
    const corrupt = await openProject(dir, { git: sandbox.git });
    expect(!corrupt.ok && corrupt.error).toMatchObject({ kind: 'corrupt', path: file });

    await writeFile(
      file,
      JSON.stringify({ version: 1, title: 'X', language: 'de', style: 'a', fps: 30, seed: 1 }),
    );
    const invalid = await openProject(dir, { git: sandbox.git });
    expect(!invalid.ok && invalid.error.kind).toBe('invalid');
    expect(!invalid.ok && invalid.error.details?.[0]).toMatch(/^language:/);

    await writeFile(file, JSON.stringify({ version: 99, title: 'X' }));
    const newer = await openProject(dir, { git: sandbox.git });
    expect(!newer.ok && newer.error.kind).toBe('unsupported-version');
  });

  it('migrates an old project.json through the migration hook and commits it', async () => {
    const dir = projectDir();
    await create(dir);
    const file = path.join(dir, 'project.json');
    await writeFile(
      file,
      JSON.stringify({
        version: 0,
        name: 'Old',
        language: 'en',
        style: 'voxel-pixel-crisp640',
        fps: 30,
        seed: 3,
      }),
    );
    const fromV0: ProjectMigration = ({ name, ...rest }) => ({ ...rest, title: name });
    const opened = await openProject(dir, { git: sandbox.git, migrations: new Map([[0, fromV0]]) });
    expect(opened.ok && opened.value.migratedFrom).toBe(0);
    expect(opened.ok && opened.value.project.title).toBe('Old');
    expect(JSON.parse(await readFile(file, 'utf8'))).toMatchObject({ version: 1, title: 'Old' });
    const entries = await history(dir, { git: sandbox.git });
    expect(entries.ok && entries.value[0]?.step).toBe('migrate');

    await writeFile(file, JSON.stringify({ version: 0, name: 'Old' }));
    const noMigration = await openProject(dir, { git: sandbox.git });
    expect(!noMigration.ok && noMigration.error.kind).toBe('unsupported-version');
  });

  it('starts git history (with the template .gitignore) for a folder without it', async () => {
    const dir = projectDir('hand made');
    await mkdir(path.join(dir, 'audio'), { recursive: true });
    await writeFile(path.join(dir, 'audio', 'vo.original.wav'), 'RIFF');
    await writeFile(
      path.join(dir, 'project.json'),
      JSON.stringify({
        version: 1,
        title: 'Hand',
        language: 'en',
        style: 'voxel-pixel-crisp640',
        fps: 30,
        seed: 1,
      }),
    );
    const opened = await openProject(dir, { git: sandbox.git });
    expect(opened.ok && opened.value.initializedGit).toBe(true);
    const entries = await history(dir, { git: sandbox.git });
    if (!entries.ok) throw new Error(entries.error.message);
    expect(entries.value[0]?.subject).toBe('Start history');
    expect(entries.value[0]?.files.map((change) => change.path).sort()).toEqual([
      '.gitignore',
      'project.json',
    ]);
  });
});

describe('paths', () => {
  it('derives Windows-safe folder names from titles', () => {
    expect(projectFolderName('Jak działa: kalkulator?')).toBe('Jak działa kalkulator');
    expect(projectFolderName('  a/b\\c  ')).toBe('a b c');
    expect(projectFolderName('con')).toBe('con video');
    expect(projectFolderName('...')).toBe('Untitled video');
    expect(projectFolderName('dots...')).toBe('dots');
  });

  it('confines files to the project', () => {
    const dir = projectDir();
    expect(toProjectRelative(dir, 'scenes/s01.js')).toEqual({ ok: true, value: 'scenes/s01.js' });
    expect(toProjectRelative(dir, path.join(dir, 'scenes', 's01.js'))).toEqual({
      ok: true,
      value: 'scenes/s01.js',
    });
    for (const bad of ['../x.js', '.git/config', dir, path.join(sandbox.root, 'other.js')]) {
      expect(toProjectRelative(dir, bad).ok).toBe(false);
    }
  });
});
