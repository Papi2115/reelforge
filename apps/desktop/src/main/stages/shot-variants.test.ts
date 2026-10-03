import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { ShotBuildRecord, ShotVariantSet } from '@reelforge/shared';
import type { FrameRenderer, ShotRenderRequest } from '@reelforge/stages';
import { afterAll, describe, expect, it } from 'vitest';
import { recordNotes, setView, variantManifest, variantRequest } from './shot-variants.js';
import { CLIP_MAX_FRAMES, VariantClips, clipFps, clipTimes, halfSize } from './variant-clips.js';

const root = mkdtempSync(path.join(os.tmpdir(), 'rf variants main '));
afterAll(() => {
  rmSync(root, { recursive: true, force: true });
});

const STAMP = '2026-10-03T10:00:00.000Z';

const record: ShotBuildRecord = {
  shotId: 's01',
  scene: '.reelforge/variants/s01/v1.js',
  status: 'warning',
  findings: [{ source: 'cards', severity: 'warning', fatal: false, message: 'title is small' }],
  fixIterations: 0,
  missingProps: [],
  critic: [{ verdict: 'ok', note: 'calm and clear' }],
  notes: [],
  updatedAt: STAMP,
};

const set: ShotVariantSet = {
  version: 1,
  shotId: 's01',
  round: 0,
  note: 'calmer',
  base: { scene: 'scenes/s01.js', sceneHash: 'a', shotHash: 'b' },
  variants: [
    {
      index: 1,
      direction: { id: 'hero-push', label: 'Hero object, slow push-in' },
      status: 'ready',
      file: '.reelforge/variants/s01/v1.js',
      record,
      updatedAt: STAMP,
    },
    {
      index: 2,
      direction: { id: 'orbit-depth', label: 'Orbit, layered depth' },
      status: 'dropped',
      reason: 'failed QA ✗: lint',
      updatedAt: STAMP,
    },
  ],
  createdAt: STAMP,
  updatedAt: STAMP,
};

function writeProject(dir: string): void {
  mkdirSync(path.join(dir, 'scenes'), { recursive: true });
  mkdirSync(path.join(dir, '.reelforge', 'variants', 's01'), { recursive: true });
  writeFileSync(
    path.join(dir, 'project.json'),
    JSON.stringify({
      version: 1,
      title: 'T',
      language: 'en',
      style: 'voxel-pixel-crisp640',
      fps: 30,
      seed: 1,
    }),
  );
  writeFileSync(
    path.join(dir, 'storyboard.json'),
    JSON.stringify({
      version: 1,
      shots: [
        { id: 's01', t0: 0, t1: 2, treatment: 'title-card', intent: 'A', scene: 'scenes/s01.js' },
        { id: 's02', t0: 2, t1: 9, treatment: 'title-card', intent: 'B', scene: 'scenes/s02.js' },
      ],
    }),
  );
  writeFileSync(path.join(dir, 'scenes', 's01.js'), '// current s01');
  writeFileSync(path.join(dir, 'scenes', 's02.js'), '// current s02');
  writeFileSync(path.join(dir, '.reelforge', 'variants', 's01', 'v1.js'), '// variant 1');
}

describe('variant cards', () => {
  it('shows the current scene first, then the variants with direction, QA and notes', () => {
    const view = setView(set, { ...record, scene: 'scenes/s01.js', status: 'ok', critic: [] });
    expect(view.note).toBe('calmer');
    expect(view.cards.map((card) => [card.key, card.status, card.qa])).toEqual([
      ['current', 'current', 'ok'],
      ['v1', 'ready', 'warning'],
      ['v2', 'dropped', null],
    ]);
    expect(view.cards[1]?.notes).toEqual(['Critic: calm and clear', 'title is small']);
    expect(view.cards[2]?.reason).toBe('failed QA ✗: lint');
    expect(setView(set, undefined).cards[0]?.qa).toBeNull();
    expect(recordNotes(undefined)).toEqual([]);
  });

  it('maps an operation to a Scenes built request on one shot', () => {
    expect(variantRequest('s03', { kind: 'pick', index: 2, lock: false })).toEqual({
      stage: 'scenes',
      action: 'variants',
      shots: ['s03'],
      variants: { kind: 'pick', index: 2, lock: false },
    });
  });
});

describe('variant preview manifest', () => {
  it('puts the variant in place of the shot scene and leaves the other shots', async () => {
    const dir = path.join(root, 'manifest');
    writeProject(dir);
    const result = await variantManifest(dir, 's01', 'v1');
    if (result.status !== 'ready') throw new Error(JSON.stringify(result));
    expect(result.manifest.shots.map((shot) => [shot.scene.file, shot.scene.source])).toEqual([
      ['.reelforge/variants/s01/v1.js', '// variant 1'],
      ['scenes/s02.js', '// current s02'],
    ]);
    const current = await variantManifest(dir, 's01', 'current');
    expect(current.status === 'ready' && current.manifest.shots[0]?.scene.source).toBe(
      '// current s01',
    );
    expect(await variantManifest(dir, 's01', 'v3')).toMatchObject({ status: 'unavailable' });
    expect(await variantManifest(undefined, 's01', 'v1')).toMatchObject({ status: 'unavailable' });
  });
});

describe('variant clips', () => {
  it('spreads 8–24 frames over the shot and loops in at most 4 s', () => {
    expect(clipTimes(2)).toHaveLength(12);
    expect(clipTimes(2)[0]).toBe(0);
    expect(clipTimes(2).at(-1)).toBe(1.95);
    expect(clipTimes(0.5)).toHaveLength(8);
    expect(clipTimes(30)).toHaveLength(CLIP_MAX_FRAMES);
    expect(clipFps(2, 12)).toBe(6);
    expect(clipFps(30, 24)).toBe(6);
  });

  it('halves frames with nearest-neighbour sampling', () => {
    const data = new Uint8Array(4 * 4 * 4).map((_, index) => index % 256);
    const half = halfSize({ width: 4, height: 4, data });
    expect([half.width, half.height]).toEqual([2, 2]);
    expect([...half.data.subarray(0, 4)]).toEqual([0, 1, 2, 3]);
    expect([...half.data.subarray(4, 8)]).toEqual([8, 9, 10, 11]);
  });

  it('renders a card through the frame renderer once and reuses the clip', async () => {
    const dir = path.join(root, 'clips');
    writeProject(dir);
    const calls: ShotRenderRequest[] = [];
    const frames: FrameRenderer = {
      renderShot: (request) => {
        calls.push(request);
        return Promise.resolve({
          ok: true,
          width: 8,
          height: 4,
          frames: request.times.map((t) => ({
            t,
            image: { width: 8, height: 4, data: new Uint8Array(8 * 4 * 4).fill(200) },
          })),
          cards: [],
          anchors: [],
          cues: [],
          errors: [],
        });
      },
    };
    const clips = new VariantClips(frames);
    const first = await clips.clip(dir, 's01', 'v1');
    if (first.status !== 'ok') throw new Error(first.message);
    expect(first.frames).toHaveLength(12);
    expect(first.frames[0]).toBe('.reelforge/frames/variants/s01/v1/f00.png');
    const png = readFileSync(path.join(dir, ...(first.frames[0] ?? '').split('/')));
    expect(png.subarray(1, 4).toString()).toBe('PNG');
    expect(calls[0]).toMatchObject({ shotId: 's01', scene: '.reelforge/variants/s01/v1.js' });
    expect(await clips.clip(dir, 's01', 'v1')).toEqual(first);
    expect(calls).toHaveLength(1);
    await clips.clip(dir, 's01', 'current');
    expect(calls[1]?.scene).toBeUndefined();
    writeFileSync(path.join(dir, '.reelforge', 'variants', 's01', 'v1.js'), '// changed');
    await clips.clip(dir, 's01', 'v1');
    expect(calls).toHaveLength(3);
    expect(await clips.clip(dir, 's09', 'v1')).toMatchObject({ status: 'error' });
  });
});
