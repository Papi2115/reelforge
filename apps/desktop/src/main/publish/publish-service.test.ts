import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { PUBLISH_FILES } from '@reelforge/pipeline';
import { assetsFileSchema, type AssetRecord } from '@reelforge/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PUBLISH_FILE_NAMES } from '../../shared/publish-contract.js';
import { createLogger } from '../logger.js';
import { PublishService } from './publish-service.js';

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

function record(overrides: Partial<AssetRecord>): AssetRecord {
  return {
    id: 'nasa-calc',
    kind: 'image',
    source: 'nasa',
    sourceItemId: 'calc',
    sourceUrl: 'https://images.nasa.gov/details/calc',
    downloadUrl: 'https://images.nasa.gov/calc.png',
    title: 'Calculator on a desk',
    author: 'NASA',
    licence: { id: 'Public domain', url: null, verified: true },
    file: '.reelforge/assets/nasa-calc.png',
    sha256: 'a'.repeat(64),
    bytes: 1000,
    mime: 'image/png',
    width: 100,
    height: 100,
    mode: 'ask',
    approved: true,
    fetchedAt: '2026-10-04T12:00:00.000Z',
    ...overrides,
  };
}

let root: string;
let dir: string;
let commits: string[];
let opened: string[];

function service(current: () => string | undefined = () => dir): PublishService {
  return new PublishService({
    currentProject: current,
    commit: (_dir, message) => {
      commits.push(message);
      return Promise.resolve(true);
    },
    openPath: (folder) => {
      opened.push(folder);
      return Promise.resolve('');
    },
    log: createLogger(() => undefined),
  });
}

/** The example storyboard stretched 10x (5 min: valid YouTube chapters). */
async function stretch(): Promise<void> {
  const file = path.join(dir, 'storyboard.json');
  const storyboard = JSON.parse(await readFile(file, 'utf8')) as {
    shots: { t0: number; t1: number }[];
  };
  for (const shot of storyboard.shots) {
    shot.t0 *= 10;
    shot.t1 *= 10;
  }
  await writeFile(file, JSON.stringify(storyboard));
}

async function addAssets(): Promise<void> {
  const used = record({});
  const unverified = record({
    id: 'web-ti84',
    source: 'web',
    sourceItemId: null,
    title: 'TI-84 photo',
    licence: { id: 'unverified', url: null, verified: false },
  });
  const unused = record({ id: 'nasa-unused', title: 'Not in any scene' });
  const file = assetsFileSchema.parse({ version: 1, assets: [used, unverified, unused] });
  await writeFile(path.join(dir, 'assets.json'), JSON.stringify(file));
  const scene = path.join(dir, 'scenes', 's03_exam_bench.js');
  const source = await readFile(scene, 'utf8');
  await writeFile(
    scene,
    `${source}\n// assets: ctx.assets.image('nasa-calc'), ctx.assets.image('web-ti84')\n`,
  );
}

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'reelforge publish ż-'));
  dir = path.join(root, 'Mój film');
  await cp(EXAMPLE, dir, { recursive: true });
  commits = [];
  opened = [];
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true, maxRetries: 5 });
});

describe('PublishService', () => {
  it('uses the pipeline file names', () => {
    expect([...PUBLISH_FILE_NAMES]).toEqual([...PUBLISH_FILES]);
  });

  it('builds the kit of the example project: no chapters at 30 s, script hook, no credits', async () => {
    const result = await service().kit();
    if (result.status !== 'ok') throw new Error(result.message);
    const { kit } = result;
    expect(kit.chapterCount).toBe(0);
    expect(kit.chapterProblem).toMatch(/no split at shot boundaries/);
    expect(kit.metaSource).toBe('none');
    expect(kit.creditedAssets).toBe(0);
    expect(kit.files.map((file) => file.name)).toEqual([...PUBLISH_FILE_NAMES]);
    const description = kit.files[0]?.text ?? '';
    expect(
      description.startsWith('Doom runs on almost anything. Fridges, watches, even a printer.'),
    ).toBe(true);
    expect(description).toContain('Links\n- (add your links here)');
  });

  it('credits only the assets the scenes use and warns about the unverified one', async () => {
    await stretch();
    await addAssets();
    const result = await service().kit();
    if (result.status !== 'ok') throw new Error(result.message);
    const { kit } = result;
    expect(kit.chapterCount).toBe(6);
    expect(kit.creditedAssets).toBe(2);
    expect(kit.unverified).toEqual(['TI-84 photo']);
    expect(kit.warnings[0]).toMatch(/unverified/);
    const credits = kit.files.find((file) => file.name === 'credits.txt')?.text ?? '';
    expect(credits).toMatch(/^!!! WARNING: 1 asset has an UNVERIFIED licence: "TI-84 photo"\./);
    expect(credits).toContain('"Calculator on a desk" by NASA');
    expect(credits).not.toContain('Not in any scene');
    expect(kit.files[0]?.text).toContain('0:49 A school calculator');
  });

  it('saves the four files under publish/ and commits them; opens the folder', async () => {
    await stretch();
    const saved = await service().save();
    expect(saved).toEqual({
      status: 'saved',
      files: PUBLISH_FILES.map((name) => `publish/${name}`),
      committed: true,
    });
    expect(commits).toEqual(['Save the publish kit']);
    const chapters = await readFile(path.join(dir, 'publish', 'chapters.txt'), 'utf8');
    expect(chapters.split('\n')[0]).toBe('0:00 Doom runs on almost anything');
    expect(await service().openFolder()).toEqual({ status: 'opened' });
    expect(opened).toEqual([path.join(dir, 'publish')]);
  });

  it('explains what is missing', async () => {
    expect(await service(() => undefined).kit()).toEqual({
      status: 'error',
      message: 'No project is open.',
    });
    await rm(path.join(dir, 'storyboard.json'));
    expect(await service().save()).toEqual({
      status: 'error',
      message: 'The publish kit needs a storyboard: run the Storyboard stage first.',
    });
  });
});
