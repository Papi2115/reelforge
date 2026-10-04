import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { assetProposalSchema, type AssetProposal, type AssetRecord } from '@reelforge/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createLogger } from '../logger.js';
import { assetTestRuntime } from './assets-ipc.js';
import { AssetsService, assetView } from './assets-service.js';

const STAMP = '2026-10-04T12:00:00.000Z';
let root: string;
let fetches: number;
let changes: number;
let service: AssetsService;

function candidate(source: 'nasa' | 'wikimedia', id: string, verified: boolean) {
  return {
    source,
    id,
    kind: 'image' as const,
    title: `<b>Photo</b> ${id}`,
    author: 'Ann‮evil',
    licence: { id: verified ? 'CC0 1.0' : 'unverified', url: null, verified },
    sourceUrl: `https://example.org/${id}`,
    thumbnailUrl: null,
    width: 640,
    height: 480,
    bytes: 1000,
  };
}

const PROPOSAL: AssetProposal = {
  version: 1,
  number: 1,
  createdAt: STAMP,
  items: [
    {
      candidate: candidate('nasa', 'a1', true),
      thumbnail: '.reelforge/assets/thumbnails/p1-1.png',
      approved: false,
    },
    {
      candidate: candidate('wikimedia', '22', false),
      thumbnail: '.reelforge/assets/thumbnails/../../../secret.png',
      approved: false,
    },
  ],
};

const RECORD: AssetRecord = {
  id: 'web-x',
  kind: 'image',
  source: 'web',
  sourceItemId: null,
  sourceUrl: 'https://example.org/x.png',
  downloadUrl: 'https://example.org/x.png',
  title: 'x.png',
  author: 'unknown',
  licence: { id: 'unverified', url: null, verified: false },
  file: '.reelforge/assets/web-x.png',
  sha256: 'a'.repeat(64),
  bytes: 10,
  mime: 'image/png',
  width: 4,
  height: 4,
  mode: 'full-auto',
  approved: false,
  fetchedAt: STAMP,
};

async function write(relative: string, value: unknown): Promise<void> {
  const file = path.join(root, ...relative.split('/'));
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(value));
}

async function proposal(): Promise<AssetProposal> {
  const file = path.join(root, '.reelforge', 'assets', 'proposals', '1.json');
  return assetProposalSchema.parse(JSON.parse(await readFile(file, 'utf8')));
}

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'rf assets service '));
  fetches = 0;
  changes = 0;
  await write('project.json', {
    version: 1,
    title: 'T',
    language: 'en',
    style: 'voxel-pixel-crisp640',
    fps: 30,
    seed: 1,
    researchMode: 'ask',
  });
  await write('.reelforge/assets/proposals/1.json', PROPOSAL);
  service = new AssetsService({
    projectDir: () => root,
    fetchApproved: () => {
      fetches += 1;
      return Promise.resolve({ status: 'queued', message: null });
    },
    changed: () => {
      changes += 1;
    },
    now: () => new Date(STAMP),
    log: createLogger(() => undefined),
  });
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe('AssetsService.state', () => {
  it('shows the pending package with sanitised text and safe thumbnail paths', async () => {
    const state = await service.state();
    expect(state.status).toBe('ok');
    if (state.status !== 'ok') return;
    expect(state.mode).toBe('ask');
    const [item, second] = state.pending[0]?.items ?? [];
    expect(item).toMatchObject({
      key: 'nasa:a1',
      title: 'Photo a1',
      author: 'Ann evil',
      thumbnail: '.reelforge/assets/thumbnails/p1-1.png',
      licence: { verified: true },
    });
    expect(second?.thumbnail).toBeNull();
    expect(state.credits).toEqual({
      markdown: 'Credits\n\n(no external assets used)\n',
      scope: 'all',
      count: 0,
    });
  });

  it('flags unverified downloaded assets and lists them in the credits', async () => {
    await write('assets.json', { version: 1, assets: [RECORD] });
    const state = await service.state();
    if (state.status !== 'ok') throw new Error(state.status);
    expect(state.assets).toEqual([assetView(RECORD)]);
    expect(state.assets[0]?.licence.verified).toBe(false);
    expect(state.assets[0]?.image).toBe('.reelforge/assets/web-x.png');
    expect(state.credits.markdown).toContain('[check licence]');
    expect(state.credits.markdown).toContain('WARNING: 1 asset has an unverified licence');
  });
});

describe('assetView', () => {
  it('cleans author strings as the credits do (Commons "Unknown author" repeats)', () => {
    const commons = { ...RECORD, author: 'Unknown author Unknown author or not provided' };
    expect(assetView(commons).author).toBe('unknown');
    expect(assetView({ ...RECORD, author: 'NASA NASA' }).author).toBe('NASA');
    expect(assetView({ ...RECORD, author: 'Neil Armstrong' }).author).toBe('Neil Armstrong');
  });
});

describe('AssetsService.review', () => {
  it('approves the ticked items, marks the package reviewed and queues the download', async () => {
    await expect(service.review({ number: 1, approve: ['nasa:a1'] })).resolves.toEqual({
      status: 'queued',
      message: 'Downloading 1 approved asset…',
    });
    const reviewed = await proposal();
    expect(reviewed.reviewedAt).toBe(STAMP);
    expect(reviewed.items.map((item) => item.approved)).toEqual([true, false]);
    expect([fetches, changes]).toEqual([1, 1]);
    expect((await service.state()).status === 'ok').toBe(true);
    await expect(service.review({ number: 1, approve: [] })).resolves.toEqual({
      status: 'error',
      message: 'This package was already reviewed.',
    });
  });

  it('rejects all without downloading anything', async () => {
    await expect(service.review({ number: 1, approve: [] })).resolves.toEqual({
      status: 'ok',
      message: 'Package rejected: the shots use kit visuals.',
    });
    expect((await proposal()).reviewedAt).toBe(STAMP);
    expect(fetches).toBe(0);
  });

  it('refuses keys outside the package and unknown packages', async () => {
    await expect(service.review({ number: 1, approve: ['nasa:other'] })).resolves.toEqual({
      status: 'error',
      message: 'Only items of this package can be approved.',
    });
    await expect(service.review({ number: 7, approve: [] })).resolves.toMatchObject({
      status: 'error',
    });
    expect((await proposal()).reviewedAt).toBeUndefined();
  });
});

describe('assetTestRuntime', () => {
  it('only with the test hooks on and a loopback base URL', () => {
    const env = { REELFORGE_TEST_ASSET_SERVER: 'http://127.0.0.1:4567' };
    expect(assetTestRuntime(env, false)).toBeUndefined();
    expect(assetTestRuntime({ REELFORGE_TEST_ASSET_SERVER: 'https://evil.example' }, true)).toBe(
      undefined,
    );
    expect(assetTestRuntime(env, true)?.transport.allowLoopbackHttpForTests).toBe(true);
  });
});
