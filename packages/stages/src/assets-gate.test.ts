import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { ProjectFile, ResearchMode, StageState } from '@reelforge/shared';
import { afterEach, describe, expect, it } from 'vitest';
import {
  ASSETS_REVIEW_REASON,
  assetsReasons,
  assetsStageReasons,
  assetsStep,
  readResearchSnapshot,
  type ResearchSnapshot,
} from './assets-gate.js';

const STAMP = '2026-10-04T10:00:00.000Z';

function input(
  research: Partial<ResearchSnapshot>,
  assets?: Partial<StageState>,
): { research: ResearchSnapshot; stages: Record<string, StageState> } {
  return {
    research: { mode: 'ask', needs: 2, pendingReviews: 0, ...research },
    stages: assets === undefined ? {} : { assets: { status: 'done', updatedAt: STAMP, ...assets } },
  };
}

describe('assetsStep per research mode', () => {
  it('off: the stage does not exist and never blocks Scenes built', () => {
    const off = input({ mode: 'off', needs: 3, pendingReviews: 1 });
    expect(assetsStep(off)).toBe('off');
    expect(assetsReasons(off)).toEqual([]);
    expect(assetsStageReasons(off)[0]).toMatch(/research is off/);
  });

  it.each<ResearchMode>(['ask', 'allowlist', 'full-auto'])(
    '%s: runs only when the storyboard asks for something',
    (mode) => {
      expect(assetsStep(input({ mode, needs: 0 }))).toBe('not-needed');
      expect(assetsReasons(input({ mode, needs: 0 }))).toEqual([]);
      expect(assetsStageReasons(input({ mode, needs: 0 }))).toEqual([
        'The storyboard asks for no photos or footage.',
      ]);
      expect(assetsStep(input({ mode }))).toBe('to-run');
      expect(assetsReasons(input({ mode }))[0]).toMatch(/^Assets: run it first/);
      expect(assetsStep(input({ mode }, {}))).toBe('done');
      expect(assetsReasons(input({ mode }, {}))).toEqual([]);
    },
  );

  it('ask: a package waiting for review blocks Scenes built and the stage', () => {
    const waiting = input({ pendingReviews: 1 }, {});
    expect(assetsStep(waiting)).toBe('review');
    expect(assetsReasons(waiting)).toEqual([ASSETS_REVIEW_REASON]);
    expect(assetsStageReasons(waiting)).toEqual([ASSETS_REVIEW_REASON]);
  });

  it('stale, failed and running Assets keep Scenes built waiting', () => {
    expect(assetsStep(input({}, { stale: true }))).toBe('to-run');
    expect(assetsStep(input({}, { status: 'failed' }))).toBe('to-run');
    expect(assetsStep(input({}, { status: 'running' }))).toBe('running');
    expect(assetsReasons(input({}, { status: 'running' }))).toEqual(['Assets is still running.']);
  });
});

describe('readResearchSnapshot', () => {
  let dir: string | undefined;
  afterEach(() => {
    if (dir !== undefined) rmSync(dir, { recursive: true, force: true });
  });

  const project = (researchMode?: ResearchMode): ProjectFile => ({
    version: 1,
    title: 'T',
    language: 'en',
    style: 'voxel-pixel-crisp640',
    fps: 30,
    seed: 1,
    ...(researchMode === undefined ? {} : { researchMode }),
  });

  it('counts needs and pending packages, and reads nothing when research is off', async () => {
    dir = mkdtempSync(path.join(os.tmpdir(), 'rf assets gate '));
    const shot = {
      id: 's01',
      t0: 0,
      t1: 3,
      treatment: 'title-card',
      intent: 'x',
      scene: 'scenes/s01.js',
    };
    writeFileSync(
      path.join(dir, 'storyboard.json'),
      JSON.stringify({
        version: 1,
        shots: [
          {
            ...shot,
            assetNeeds: [
              { id: 'a', kind: 'image', description: 'a' },
              { id: 'b', kind: 'video', description: 'b' },
            ],
          },
        ],
      }),
    );
    mkdirSync(path.join(dir, '.reelforge', 'assets', 'proposals'), { recursive: true });
    const item = {
      candidate: {
        source: 'nasa',
        id: 'x',
        kind: 'image',
        title: 't',
        author: 'a',
        licence: { id: 'NASA', url: null, verified: true },
        sourceUrl: 'https://images.nasa.gov/x',
        thumbnailUrl: null,
        width: null,
        height: null,
        bytes: null,
      },
      thumbnail: null,
      approved: false,
    };
    const proposal = { version: 1, number: 1, createdAt: STAMP, items: [item] };
    writeFileSync(
      path.join(dir, '.reelforge', 'assets', 'proposals', '1.json'),
      JSON.stringify(proposal),
    );
    writeFileSync(
      path.join(dir, '.reelforge', 'assets', 'proposals', '2.json'),
      JSON.stringify({ ...proposal, number: 2, reviewedAt: STAMP }),
    );
    expect(await readResearchSnapshot(dir, { status: 'ok', value: project('ask') })).toEqual({
      mode: 'ask',
      needs: 2,
      pendingReviews: 1,
    });
    expect(await readResearchSnapshot(dir, { status: 'ok', value: project() })).toEqual({
      mode: 'off',
      needs: 0,
      pendingReviews: 0,
    });
    expect(await readResearchSnapshot(dir, { status: 'missing' })).toMatchObject({ mode: 'off' });
  });
});
