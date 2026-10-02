import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { defaultAppSettings, youtubeMetaFileSchema } from '@reelforge/shared';
import type { ClaudeRunner, ClaudeTurnResult } from '@reelforge/stages';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { ExportJobRequest } from '../../shared/export-contract.js';
import { createLogger } from '../logger.js';
import {
  chaptersFromShots,
  projectChapters,
  sceneMetaTitle,
  shotTitle,
} from './export-chapters.js';
import {
  exportOptions,
  outputFileName,
  outputPath,
  presetOptions,
  validateJob,
} from './export-options.js';
import {
  scriptKeywords,
  templateMeta,
  youtubeMarkdown,
  YoutubeMetaService,
} from './youtube-meta.js';

const FIXTURE = path.resolve(
  import.meta.dirname,
  '..',
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

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'reelforge export ż-'));
  dir = path.join(root, 'Mój film');
  await cp(FIXTURE, dir, { recursive: true });
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true, maxRetries: 5 });
});

/** The fixture stretched to 3 shots of ≥ 10 s (enough for YouTube chapters). */
async function threeShots(): Promise<void> {
  const file = path.join(dir, 'storyboard.json');
  const storyboard = JSON.parse(await readFile(file, 'utf8')) as {
    shots: { id: string; t0: number; t1: number; intent: string; scene: string }[];
  };
  const [title, calc] = storyboard.shots;
  if (title === undefined || calc === undefined) throw new Error('fixture changed');
  storyboard.shots = [
    { ...title, t0: 0, t1: 11 },
    { ...calc, t0: 11, t1: 22 },
    { ...calc, id: 's03', t0: 22, t1: 33, intent: 'Why it matters; the end.' },
  ];
  await writeFile(file, JSON.stringify(storyboard));
}

const REQUEST: ExportJobRequest = {
  preset: '1080p30',
  encoder: 'auto',
  quality: 'standard',
  workers: 1,
  fileName: 'x',
  includeChapters: true,
  includeThumbnail: true,
  thumbnailAt: null,
};

describe('export options', () => {
  it('lists every preset with its integer factor and blocks the impossible ones', () => {
    expect(presetOptions(640, 360).map((preset) => [preset.id, preset.factor])).toEqual([
      ['1080p30', 3],
      ['1440p', 4],
      ['4k', 6],
    ]);
    const odd = presetOptions(480, 270);
    expect(odd.map((preset) => preset.factor)).toEqual([4, null, 8]);
    expect(odd[1]?.problem).toMatch(
      /not an integer multiple of the 480x270 render size \(x5\.33\)/,
    );
  });

  it('builds the options of the project and validates requests against them', async () => {
    const options = await exportOptions({
      dir,
      settings: defaultAppSettings(),
      cores: 8,
      hasMix: false,
      mixStale: false,
    });
    expect(options).toMatchObject({
      title: 'Doom on a calculator',
      defaultFileName: 'Doom on a calculator.mp4',
      outputDir: path.join(dir, 'out'),
      customOutputDir: false,
      render: { width: 640, height: 360, style: 'voxel-pixel-crisp640' },
      blockers: [],
      warnings: ['No audio/mix.wav: the video will be silent (Render mix first).'],
      thumbnailDefaultS: 1.1,
      // 7.5 s of video: too short for YouTube chapters.
      chapters: { text: null },
    });
    expect(validateJob(REQUEST, options)).toBeNull();
    expect(validateJob({ ...REQUEST, workers: 9 }, options)).toMatch(/more than this machine/);
    const blocked = { ...options, presets: presetOptions(480, 270) };
    expect(validateJob({ ...REQUEST, preset: '1440p' }, blocked)).toMatch(/integer multiple/);
    await rm(path.join(dir, 'scenes', 's02_calc.js'));
    const missing = await exportOptions({
      dir,
      settings: defaultAppSettings(),
      cores: 8,
      hasMix: true,
      mixStale: true,
    });
    expect(missing.blockers).toEqual(['Scenes missing for s02: run Scenes built first.']);
    expect(missing.warnings).toEqual(['The cues changed after the last mix render.']);
  });

  it('turns a typed name into a safe MP4 inside the folder', () => {
    expect(outputFileName('My: film?.mp4')).toBe('My film.mp4');
    expect(outputFileName('con')).toBe('video.mp4');
    expect(outputPath(dir, '../../evil')).toBe(path.join(dir, '.. .. evil.mp4'));
  });
});

describe('chapters', () => {
  it('titles shots with meta.title (sentence case) or the first clause of the intent', () => {
    expect(sceneMetaTitle("export const meta = { id: 's1', title: 'DOOM ON IT', x: 1 };")).toBe(
      'DOOM ON IT',
    );
    expect(sceneMetaTitle('export const meta = { id: "s1" };')).toBeNull();
    expect(shotTitle('ignored', 'DOOM ON IT')).toBe('Doom on it');
    expect(shotTitle('A calculator with 61 KB, still runs Doom.', null)).toBe(
      'A calculator with 61 KB',
    );
  });

  it('merges shots shorter than 10 s and writes YouTube chapters', async () => {
    expect(
      chaptersFromShots(
        [
          { t0: 0, title: 'A' },
          { t0: 4, title: 'B' },
          { t0: 12, title: 'C' },
          { t0: 30, title: 'D' },
          { t0: 41, title: 'E' },
        ],
        45,
      ),
    ).toEqual([
      { t: 0, title: 'A' },
      { t: 12, title: 'C' },
      { t: 30, title: 'D' },
    ]);
    await threeShots();
    const storyboard = JSON.parse(await readFile(path.join(dir, 'storyboard.json'), 'utf8')) as {
      shots: Parameters<typeof projectChapters>[1];
    };
    const chapters = await projectChapters(dir, storyboard.shots, 33);
    expect(chapters).toEqual({
      // Titles from the scenes' meta.title (s03 reuses the s02 scene).
      text: '0:00 Doom runs everywhere\n0:11 Calculator with 61 KB\n0:22 Calculator with 61 KB\n',
    });
  });
});

function runner(reply: ClaudeTurnResult['reply'], status: ClaudeTurnResult['status']) {
  const prompts: string[] = [];
  const claude: ClaudeRunner = {
    run: (spec) => {
      prompts.push(spec.prompt);
      return Promise.resolve({
        status,
        reply,
        sessionId: undefined,
        message: status === 'completed' ? 'ok' : 'claude is not logged in',
        usage: undefined,
        limit: undefined,
      });
    },
  };
  return { claude, prompts };
}

describe('YouTube suggestions', () => {
  const service = (claude: ClaudeRunner): YoutubeMetaService =>
    new YoutubeMetaService({
      currentProject: () => dir,
      claude,
      settings: defaultAppSettings,
      now: () => new Date('2026-10-02T10:00:00Z'),
      log: createLogger(() => undefined),
    });

  it('builds a deterministic template with the chapters in the description', () => {
    const meta = templateMeta({
      title: 'Doom on a calculator',
      script:
        'Doom runs on almost anything. Even a calculator runs Doom. Calculator memory is tiny.',
      chapters: '0:00 A\n0:11 B\n0:22 C',
    });
    expect(meta.titles).toEqual([
      'Doom on a calculator',
      'Doom on a calculator: explained',
      'Doom on a calculator (calculator)',
    ]);
    expect(meta.description).toBe(
      'Doom runs on almost anything. Even a calculator runs Doom.\n\n0:00 A\n0:11 B\n0:22 C',
    );
    expect(meta.tags[0]).toBe('doom on a calculator');
    expect(scriptKeywords('alpha beta gamma gamma delta', 2)).toEqual(['gamma', 'alpha']);
    expect(templateMeta({ title: 'T', script: 'Words here.', chapters: null }).titles).toHaveLength(
      3,
    );
  });

  it("writes Claude's validated suggestion as metadata.json + youtube.md", async () => {
    await threeShots();
    const reply = JSON.stringify({
      titles: ['Doom on a calculator', 'Can a calculator run Doom?', '61 KB of Doom'],
      description: 'A calculator with 61 KB of memory runs Doom.',
      tags: ['doom', 'calculator'],
    });
    const { claude, prompts } = runner(reply, 'completed');
    const result = await service(claude).generate();
    expect(result).toMatchObject({ status: 'ok', fallback: null, meta: { source: 'claude' } });
    expect(prompts[0]).toContain('Working title: Doom on a calculator');
    const json = youtubeMetaFileSchema.parse(
      JSON.parse(await readFile(path.join(dir, 'out', 'metadata.json'), 'utf8')),
    );
    expect(json.titles[1]).toBe('Can a calculator run Doom?');
    const markdown = await readFile(path.join(dir, 'out', 'youtube.md'), 'utf8');
    expect(markdown).toBe(youtubeMarkdown(json));
    expect(markdown).toContain('2. Can a calculator run Doom?');
    // An export afterwards keeps Claude's suggestion.
    expect(await service(claude).ensureTemplate(dir)).toEqual([]);
  });

  it('falls back to the template when Claude is unavailable or replies badly', async () => {
    const offline = await service(runner('', 'blocked').claude).generate();
    expect(offline).toMatchObject({
      status: 'ok',
      fallback: 'Claude: claude is not logged in',
      meta: { source: 'template' },
    });
    const prose = await service(runner('Here you go!', 'completed').claude).generate();
    expect(prose).toMatchObject({ status: 'ok', meta: { source: 'template' } });
    expect(prose.status === 'ok' && prose.fallback).toMatch(/not usable/);
    expect(await service(runner('', 'blocked').claude).ensureTemplate(dir)).toEqual([
      'out/metadata.json',
      'out/youtube.md',
    ]);
  });
});
