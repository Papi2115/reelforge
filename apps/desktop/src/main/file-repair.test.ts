/**
 * Scenario 3 + 5 of PLAN.md#10.2 at the app level: every damaged project file (truncated, empty,
 * schema-invalid) shows up in the snapshot with its path, error and fix; "Restore from history"
 * brings the last good version back as a new commit, "Reset to defaults" moves app state aside;
 * a damaged project.json fails the open with an actionable message and can be restored.
 */
import { existsSync } from 'node:fs';
import { cp, mkdir, mkdtemp, readdir, readFile, rm, truncate, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  DEFAULT_STYLES_DIR,
  DEFAULT_TEMPLATE_DIR,
  history,
  openProject,
  type GitOptions,
} from '@reelforge/project';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProjectOpenFailure } from '../shared/project-contract.js';
import type { RepairableFile } from '../shared/snapshot-contract.js';
import { checkFileText, repairFile } from './file-repair.js';
import { createLogger } from './logger.js';
import { ProjectService } from './project-service.js';
import { readProjectSnapshot } from './project-snapshot.js';

vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 });

const FIXTURE = path.resolve(
  import.meta.dirname,
  '..',
  '..',
  '..',
  '..',
  'packages',
  'cli',
  'test',
  'fixtures',
  'project',
);

let root: string;
let dir: string;
let git: GitOptions;

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'reelforge repair ż-'));
  const globalConfig = path.join(root, 'global.gitconfig');
  await writeFile(globalConfig, '');
  git = { env: { ...process.env, GIT_CONFIG_GLOBAL: globalConfig, GIT_CONFIG_NOSYSTEM: '1' } };
  dir = path.join(root, 'Mój film');
  await cp(FIXTURE, dir, { recursive: true });
  // First open: "Start history" commits the good files.
  const opened = await openProject(dir, { git, templateDir: DEFAULT_TEMPLATE_DIR });
  if (!opened.ok) throw new Error(opened.error.message);
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true, maxRetries: 5 });
});

const file = (relative: string): string => path.join(dir, ...relative.split('/'));

async function truncateHalf(relative: string): Promise<string> {
  const before = await readFile(file(relative), 'utf8');
  await truncate(file(relative), Math.floor(before.length / 2));
  return before;
}

async function writeState(relative: RepairableFile, content: string): Promise<void> {
  await mkdir(path.dirname(file(relative)), { recursive: true });
  await writeFile(file(relative), content);
}

describe('damaged files in the snapshot', () => {
  it('lists each truncated / empty / invalid file with its path, error and fix', async () => {
    expect((await readProjectSnapshot(dir)).problems).toEqual([]);
    await truncateHalf('storyboard.json');
    await truncateHalf('cues.json');
    await writeFile(file('timing/words.json'), '');
    await writeFile(file('project.json'), '{ "version": 1 }');
    await writeState('.reelforge/pipeline.json', '{ "version": 1, "stag');
    await writeState('.reelforge/sessions.json', '{ "version": "nope", "sessions": [] }');

    const snapshot = await readProjectSnapshot(dir);
    expect(snapshot.problems.map((problem) => [problem.file, problem.fix])).toEqual([
      ['storyboard.json', 'restore'],
      ['timing/words.json', 'restore'],
      ['cues.json', 'restore'],
      ['project.json', 'restore'],
      ['.reelforge/pipeline.json', 'reset'],
      ['.reelforge/sessions.json', 'reset'],
    ]);
    const messages = new Map(snapshot.problems.map((problem) => [problem.file, problem.message]));
    expect(messages.get('storyboard.json')).toMatch(/^storyboard\.json is not valid JSON/);
    expect(messages.get('timing/words.json')).toMatch(/^timing\/words\.json is not valid JSON/);
    expect(messages.get('project.json')).toMatch(/^project\.json does not match its format: /);
    expect(messages.get('.reelforge/pipeline.json')).toMatch(/not valid JSON/);
    expect(messages.get('.reelforge/sessions.json')).toMatch(/does not match its format: version/);
  });

  it('describes an empty file (power loss after the rename) as empty', () => {
    expect(checkFileText('cues.json', '')).toBe('cues.json is not valid JSON (the file is empty)');
  });
});

describe('repairFile', () => {
  it('restores a truncated storyboard.json from history as a new commit', async () => {
    const good = await truncateHalf('storyboard.json');
    const result = await repairFile(dir, 'storyboard.json', { git });
    expect(result).toMatchObject({ status: 'repaired' });
    expect(result.status === 'repaired' && result.message).toMatch(
      /^Restored storyboard\.json from commit [0-9a-f]{7}/,
    );
    expect(await readFile(file('storyboard.json'), 'utf8')).toBe(good);
    const entries = await history(dir, { git });
    expect(entries.ok && entries.value.map((entry) => entry.kind).slice(0, 2)).toEqual([
      'revert',
      'manual',
    ]);
    expect((await readProjectSnapshot(dir)).problems).toEqual([]);
  });

  it('restores cues.json and words.json too', async () => {
    const cues = await truncateHalf('cues.json');
    const words = await readFile(file('timing/words.json'), 'utf8');
    await writeFile(file('timing/words.json'), '');
    expect((await repairFile(dir, 'cues.json', { git })).status).toBe('repaired');
    expect((await repairFile(dir, 'timing/words.json', { git })).status).toBe('repaired');
    expect(await readFile(file('cues.json'), 'utf8')).toBe(cues);
    expect(await readFile(file('timing/words.json'), 'utf8')).toBe(words);
  });

  it('resets damaged app state by moving it aside (nothing is deleted)', async () => {
    const now = (): Date => new Date('2026-10-02T06:31:00.000Z');
    await writeState('.reelforge/pipeline.json', '{ "version": 1, "stag');
    await writeState('.reelforge/sessions.json', '');
    for (const state of ['.reelforge/pipeline.json', '.reelforge/sessions.json'] as const) {
      const result = await repairFile(dir, state, { git, now });
      expect(result.status === 'repaired' && result.message).toMatch(
        /^Reset .+ to defaults; the damaged file was kept as .+\.corrupt-2026-10-02T06-31-00-000Z\.json\.$/,
      );
      expect(existsSync(file(state))).toBe(false);
    }
    const kept = (await readdir(file('.reelforge'))).filter((name) => name.includes('.corrupt-'));
    expect(kept.sort()).toEqual([
      'pipeline.corrupt-2026-10-02T06-31-00-000Z.json',
      'sessions.corrupt-2026-10-02T06-31-00-000Z.json',
    ]);
    expect((await readProjectSnapshot(dir)).problems).toEqual([]);
  });

  it('refuses to touch a file that is not damaged', async () => {
    const result = await repairFile(dir, 'storyboard.json', { git });
    expect(result).toEqual({
      status: 'error',
      error: { kind: 'invalid-argument', message: 'storyboard.json is not damaged.' },
    });
  });
});

describe('ProjectService with a damaged project.json', () => {
  function service(failures: ProjectOpenFailure[]): ProjectService {
    return new ProjectService({
      recentFile: path.join(root, 'user data', 'recent-projects.json'),
      templateDir: DEFAULT_TEMPLATE_DIR,
      stylesDir: DEFAULT_STYLES_DIR,
      pickFolder: () => Promise.resolve(dir),
      log: createLogger(() => undefined),
      git,
      onOpenFailed: (failure) => failures.push(failure),
    });
  }

  it('fails the open with file + error + hint, offers the restore and opens after it', async () => {
    const failures: ProjectOpenFailure[] = [];
    const projects = service(failures);
    await truncateHalf('project.json');

    const result = await projects.openWithPicker();
    expect(result.status).toBe('error');
    const message = result.status === 'error' ? result.error.message : '';
    expect(message).toContain('project.json is not valid JSON');
    expect(message).toContain(file('project.json'));
    expect(message).toContain('Restore it from the project history');
    expect(failures).toEqual([
      expect.objectContaining({ dir, file: file('project.json'), canRestore: true }),
    ]);
    expect(projects.currentProject()).toBeNull();

    const restored = await projects.restoreFailedOpen();
    expect(restored).toMatchObject({ status: 'opened', project: { dir } });
    // Nothing failed any more: a second restore has nothing to do.
    expect((await projects.restoreFailedOpen()).status).toBe('error');
  });

  it('repairs project.json of the open project and keeps it open', async () => {
    const projects = service([]);
    expect((await projects.openWithPicker()).status).toBe('opened');
    await writeFile(file('project.json'), '');
    const snapshot = await projects.snapshot();
    expect(snapshot.status === 'ok' && snapshot.snapshot.problems.map((p) => p.file)).toEqual([
      'project.json',
    ]);
    expect((await projects.repairFile('project.json')).status).toBe('repaired');
    expect(projects.currentProject()?.title).toBe('Doom on a calculator');
  });
});
