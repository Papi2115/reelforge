import { readdir, readFile, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { PipelineStateStore } from '@reelforge/claude-bridge';
import {
  DEFAULT_STYLES_DIR,
  DEFAULT_TEMPLATE_DIR,
  history,
  type GitOptions,
} from '@reelforge/project';
import { voiceoverRecordSchema } from '@reelforge/shared';
import { readProjectSnapshot } from '@reelforge/stages';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  EXAMPLE_DONE_STAGES,
  EXAMPLE_ID,
  installExampleProject,
  wavDurationS,
} from './example-project.js';
import { createLogger } from './logger.js';
import { ProjectService } from './project-service.js';
import { gateReasons } from './stages/stage-state.js';

vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 });

const EXAMPLES_DIR = path.resolve(
  import.meta.dirname,
  '..',
  '..',
  '..',
  '..',
  'templates',
  'examples',
);
const NOW = new Date('2026-10-02T12:00:00.000Z');

let root: string;
let git: GitOptions;

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'reelforge example ż-'));
  const globalConfig = path.join(root, 'global.gitconfig');
  await writeFile(globalConfig, '');
  git = { env: { ...process.env, GIT_CONFIG_GLOBAL: globalConfig, GIT_CONFIG_NOSYSTEM: '1' } };
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true, maxRetries: 5 });
});

function install(projectsDir: string): ReturnType<typeof installExampleProject> {
  return installExampleProject({
    exampleDir: path.join(EXAMPLES_DIR, EXAMPLE_ID),
    projectsDir,
    templateDir: DEFAULT_TEMPLATE_DIR,
    stylesDir: DEFAULT_STYLES_DIR,
    git,
    now: () => NOW,
  });
}

describe('installExampleProject', () => {
  it('copies the example as a committed project with Script → Scenes done', async () => {
    const projectsDir = path.join(root, 'Documents', 'ReelForge Projects');
    const installed = await install(projectsDir);
    if (!installed.ok) throw new Error(installed.error.message);
    const dir = installed.value;
    expect(dir).toBe(path.join(projectsDir, 'Doom on a calculator'));

    const scenes = (await readdir(path.join(dir, 'scenes'))).filter((name) => name.endsWith('.js'));
    expect(scenes).toHaveLength(7);
    expect(await readFile(path.join(dir, 'CLAUDE.md'), 'utf8')).toContain('ReelForge');
    const bible = path.join(dir, 'styles', 'voxel-pixel-crisp640', 'STYLE.md');
    expect((await readFile(bible, 'utf8')).length).toBeGreaterThan(0);
    const original = await readFile(path.join(dir, 'audio', 'vo.original.wav'));
    expect(await readFile(path.join(dir, 'audio', 'vo.clean.wav'))).toEqual(original);

    const record = voiceoverRecordSchema.parse(
      JSON.parse(await readFile(path.join(dir, '.reelforge', 'voiceover.json'), 'utf8')),
    );
    expect(record.file).toBe('audio/vo.original.wav');
    expect(record.durationS).toBeCloseTo(30.517, 2);

    const state = await new PipelineStateStore().read(dir);
    if (!state.ok) throw new Error(state.error.message);
    for (const stage of EXAMPLE_DONE_STAGES) expect(state.value.stages[stage]?.status).toBe('done');
    expect(state.value.stages['script']?.approvedAt).toBe(NOW.toISOString());

    const snapshot = await readProjectSnapshot(dir);
    expect(snapshot.project.status).toBe('ok');
    expect(snapshot.voiceover?.file).toBe('audio/vo.original.wav');
    expect(gateReasons('mix', snapshot)).toEqual([]);
    expect(gateReasons('export', snapshot)).not.toEqual([]);

    const commits = await history(dir, { limit: 10, git });
    if (!commits.ok) throw new Error(commits.error.message);
    expect(commits.value.map((entry) => entry.subject)).toEqual([
      'Add the example project',
      'Create project "Doom on a calculator"',
    ]);
    const tracked = commits.value[0]?.files.map((file) => file.path) ?? [];
    expect(tracked).toContain('scenes/s03_exam_bench.js');
    expect(tracked).toContain('timing/words.json');
    expect(tracked.some((file) => file.startsWith('audio/'))).toBe(false);
  });

  it('never overwrites an earlier copy: the second one gets a numbered folder', async () => {
    const first = await install(root);
    const second = await install(root);
    expect(first.ok && second.ok).toBe(true);
    if (second.ok) expect(path.basename(second.value)).toBe('Doom on a calculator 2');
  });

  it('fails with a typed error when the example is missing', async () => {
    const result = await installExampleProject({
      exampleDir: path.join(root, 'no such example'),
      projectsDir: root,
      templateDir: DEFAULT_TEMPLATE_DIR,
      stylesDir: DEFAULT_STYLES_DIR,
      git,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toContain('the example project is missing');
  });
});

describe('wavDurationS', () => {
  it('reads the data length of a PCM WAV and rejects other files', () => {
    const header = Buffer.alloc(44);
    header.write('RIFF', 0, 'ascii');
    header.write('WAVE', 8, 'ascii');
    header.write('fmt ', 12, 'ascii');
    header.writeUInt32LE(16, 16);
    header.writeUInt32LE(32_000, 28);
    header.write('data', 36, 'ascii');
    header.writeUInt32LE(64_000, 40);
    expect(wavDurationS(header)).toBe(2);
    expect(wavDurationS(Buffer.from('not a wav file at all'))).toBeNull();
  });
});

describe('ProjectService.openExample', () => {
  function projects(
    installExample?: () => ReturnType<typeof installExampleProject>,
  ): ProjectService {
    return new ProjectService({
      recentFile: path.join(root, 'user data', 'recent-projects.json'),
      templateDir: DEFAULT_TEMPLATE_DIR,
      stylesDir: DEFAULT_STYLES_DIR,
      pickFolder: () => Promise.resolve(undefined),
      log: createLogger(() => undefined),
      git,
      ...(installExample === undefined ? {} : { installExample }),
    });
  }

  it('opens the fresh copy and remembers it as a recent project', async () => {
    const service = projects(() => install(path.join(root, 'Projects')));
    const result = await service.openExample();
    expect(result).toMatchObject({
      status: 'opened',
      project: { title: 'Doom on a calculator', language: 'en', style: 'voxel-pixel-crisp640' },
    });
    expect((await service.recent()).map((entry) => entry.title)).toEqual(['Doom on a calculator']);
  });

  it('reports a build without the example as an error', async () => {
    expect(await projects().openExample()).toMatchObject({ status: 'error' });
  });
});
