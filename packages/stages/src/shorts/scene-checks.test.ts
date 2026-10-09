import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { StoryboardShot } from '@reelforge/shared';
import { afterAll, describe, expect, it } from 'vitest';
import type { ShotRenderOk } from '../scenes/tools.js';
import {
  loadShortScenes,
  parentSceneHashes,
  sceneShortPromptVars,
  shortCopyFindings,
  shortMotionFindings,
  type ShortSceneSetup,
} from './scene-checks.js';

const root = mkdtempSync(path.join(tmpdir(), 'reelforge short checks '));
afterAll(() => {
  rmSync(root, { recursive: true, force: true });
});

const SCENE = 'export const meta = { id: "s01" };\nexport function build() {}\n';

function setup(parentScenes: ReadonlyMap<string, string> = new Map()): ShortSceneSetup {
  return {
    lengthS: 30,
    format: 'portrait',
    endCardText: 'Full video on YT: Voxplain',
    captions: false,
    parentTitle: 'Parent film',
    parentScenes,
  };
}

function shot(t1: number, extra: Partial<StoryboardShot> = {}): StoryboardShot {
  return {
    id: 's01',
    t0: 10,
    t1,
    treatment: 'metaphor-object',
    intent: 'x',
    scene: 'scenes/s01.js',
    ...extra,
  };
}

function render(times: readonly number[]): ShotRenderOk {
  return {
    ok: true,
    width: 360,
    height: 640,
    frames: [],
    cards: [],
    anchors: [],
    cues: times.map((t) => ({ t, name: 'pop', shotId: 's01' })),
    errors: [],
  };
}

describe('short scene checks', () => {
  it('hash the parent film scenes and catch a byte copy (CRLF too), nothing for a film', async () => {
    const parent = path.join(root, 'film');
    mkdirSync(path.join(parent, 'scenes'), { recursive: true });
    writeFileSync(path.join(parent, 'scenes', 's01.js'), SCENE.replaceAll('\n', '\r\n'));
    writeFileSync(path.join(parent, 'scenes', 'notes.txt'), SCENE);
    const hashes = await parentSceneHashes(parent);
    expect([...hashes.values()]).toEqual(['scenes/s01.js']);
    expect(await parentSceneHashes(path.join(root, 'missing'))).toEqual(new Map());

    const findings = shortCopyFindings(setup(hashes), SCENE, 'scenes/s04.js');
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({ source: 'scene', severity: 'error', fatal: false });
    expect(findings[0]?.message).toContain('is a copy of scenes/s01.js of the full film');
    expect(shortCopyFindings(setup(hashes), `${SCENE}// new\n`, 'scenes/s04.js')).toEqual([]);
    expect(shortCopyFindings(undefined, SCENE, 'scenes/s04.js')).toEqual([]);
  });

  it('warn when a shot of a short holds over 3 s without a beat', () => {
    // 3.5 s shot, beats at 1.0 and 1.4 s local: 2.1 s to the end, fine.
    expect(shortMotionFindings(setup(), shot(13.5), render([11, 11.4]))).toEqual([]);
    // 4 s shot, one beat at 0.5 s: 3.5 s still afterwards.
    const still = shortMotionFindings(setup(), shot(14), render([10.5]));
    expect(still).toHaveLength(1);
    expect(still[0]).toMatchObject({ source: 'scene', severity: 'warning', t: 0.5 });
    // Short shots, end cards and films are never checked.
    expect(shortMotionFindings(setup(), shot(12.9), render([]))).toEqual([]);
    expect(shortMotionFindings(setup(), shot(15, { endCard: true }), render([]))).toEqual([]);
    expect(shortMotionFindings(undefined, shot(15), render([]))).toEqual([]);
  });

  it('load nothing for a film and the short settings for a short', async () => {
    const film = {
      version: 1,
      title: 'Film',
      language: 'en',
      style: 'voxel-pixel-crisp640',
      fps: 30,
      seed: 1,
    } as const;
    expect(await loadShortScenes(film)).toBeUndefined();
    expect(sceneShortPromptVars(undefined)).toEqual({});
    const short = await loadShortScenes({
      ...film,
      kind: 'short',
      format: 'portrait',
      parentProject: { folder: path.join(root, 'film'), title: 'Parent film' },
      short: { lengthS: 60, captions: true, endCardText: 'Full video on YT: Voxplain' },
    });
    expect(short).toMatchObject({ lengthS: 60, format: 'portrait', captions: true });
    expect(short?.parentScenes.size).toBe(1);
    expect(sceneShortPromptVars(short)).toEqual({
      short: true,
      shortLengthS: 60,
      shortParentTitle: 'Parent film',
      shortCaptions: true,
    });
  });
});
