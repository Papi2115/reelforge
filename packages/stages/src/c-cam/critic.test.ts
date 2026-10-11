/**
 * PLAN.md#14.19: the Grim Ink scene critic: three QA times per framing of the cut table, the
 * critic on Sonnet at least, two reference frames of the shot's look, two fix turns; other worlds
 * unchanged.
 */
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { WORLDS } from '@reelforge/kit';
import { renderPrompt } from '@reelforge/prompts';
import { afterEach, describe, expect, it } from 'vitest';
import { DEFAULT_SCENE_SETTINGS, fasterSceneSettings } from '../settings.js';
import { atLeastModel } from '../turns.js';
import { criticWorldPromptVars } from '../worlds.js';
import {
  C_CAM_REFERENCE_DIR,
  criticMinModel,
  criticReferenceVars,
  worldQaTimes,
  worldSceneSettings,
} from './critic.js';
import { framingQaTimes, framingStarts, MAX_QA_TIMES } from './framing-times.js';

const C_CAM = { id: 'c-cam' };
const COMIC = { id: 'comic' };

/** The cut table as the prompts teach it (anchors in build, a numeric cut, an offset). */
const SCENE = `export function build(ctx) {
  const stage = ctx.kit.fx.inkStage();
  const s = { stage, knock: ctx.anchor('knocked twice').t, gone: ctx.anchor('already gone').t };
  const late = ctx.anchor('never came');
  s.cuts = [
    { at: 0, name: 'wide', x: 960, y: 560, z: 1 },
    { at: s.knock, name: 'door', x: 1420, y: 610, z: 3.4, rot: -4 },
    { at: s.gone + 0.5, name: 'face', x: 760, y: 430, z: 2.1 },
    { at: late.t, x: 900, y: 500, z: 1.2 },
    { at: 7.5, x: 900, y: 500, z: 1.0 },
  ];
  return s;
}`;
const TIMES: Readonly<Record<string, number>> = {
  'knocked twice': 1,
  'already gone': 2,
  'never came': 4,
};
const anchor = (phrase: string): number | undefined => TIMES[phrase];

describe('Grim Ink QA times per framing (PLAN.md#14.19)', () => {
  it('reads the cut table with anchors, offsets and numbers', () => {
    expect(framingStarts(SCENE, 6, anchor)).toEqual([0, 1, 2.5, 4]);
    expect(framingStarts('export const meta = {};', 6, anchor)).toBeUndefined();
    expect(framingStarts('this does not parse (', 6, anchor)).toBeUndefined();
  });

  it('samples three times inside every framing, with the smoke times', () => {
    const smoke = [0, 1.5, 3, 4.5, 5.9];
    const times = framingQaTimes(SCENE, 6, anchor, smoke);
    for (const [start, end] of [
      [0, 1],
      [1, 2.5],
      [2.5, 4],
      [4, 6],
    ] as const) {
      expect(times.filter((t) => t > start && t < end).length).toBeGreaterThanOrEqual(3);
    }
    expect(times).toEqual(expect.arrayContaining(smoke));
    expect(times.length).toBeLessThanOrEqual(MAX_QA_TIMES);
    expect(framingQaTimes('export function build() {}', 6, anchor, smoke)).toEqual(smoke);
  });

  it('applies to the world only', () => {
    const shot = { t0: 10, t1: 16 };
    const smoke = [0, 1.5, 3, 4.5, 5.9];
    const input = { source: SCENE, shot, anchors: undefined, smoke };
    expect(worldQaTimes({ ...input, world: COMIC })).toEqual(smoke);
    expect(worldQaTimes({ ...input, world: undefined })).toEqual(smoke);
    // No words: the anchored cuts are unknown, the numeric ones still split the shot.
    expect(worldQaTimes({ ...input, world: C_CAM }).length).toBeGreaterThan(smoke.length);
  });
});

describe('Grim Ink critic policy (PLAN.md#14.19)', () => {
  it('runs the critic on Sonnet at least, never weaker than the settings', () => {
    expect(criticMinModel(C_CAM)).toBe('sonnet');
    expect(criticMinModel(COMIC)).toBeUndefined();
    expect(atLeastModel('haiku', 'sonnet')).toBe('sonnet');
    expect(atLeastModel('opus', 'sonnet')).toBe('opus');
    expect(atLeastModel('haiku', undefined)).toBe('haiku');
  });

  it('keeps two fix turns with faster checks in the world only', () => {
    const faster = fasterSceneSettings(DEFAULT_SCENE_SETTINGS);
    expect(faster.maxFixIterations).toBe(1);
    expect(worldSceneSettings(faster, C_CAM).maxFixIterations).toBe(2);
    expect(worldSceneSettings(faster, COMIC)).toBe(faster);
    expect(worldSceneSettings(DEFAULT_SCENE_SETTINGS, C_CAM)).toBe(DEFAULT_SCENE_SETTINGS);
  });
});

describe('Grim Ink critic reference frames (PLAN.md#14.19)', () => {
  let dir: string | undefined;
  afterEach(() => {
    if (dir !== undefined) rmSync(dir, { recursive: true, force: true });
  });

  it('copies two frames of the look into the project and names them in the prompt', async () => {
    dir = mkdtempSync(path.join(tmpdir(), 'reelforge ccam refs '));
    const vars = await criticReferenceVars(dir, C_CAM, 'ink-insert');
    const paths = (vars['referencePaths'] ?? '').split(', ');
    expect(paths).toEqual([
      '.reelforge/frames/qa/reference/ink-insert-1.png',
      '.reelforge/frames/qa/reference/ink-insert-2.png',
    ]);
    for (const file of paths) {
      const copied = path.join(dir, ...file.split('/'));
      expect(readFileSync(copied)).toEqual(
        readFileSync(path.join(C_CAM_REFERENCE_DIR, path.basename(file))),
      );
    }
    for (const look of ['ink-scene', 'ink-poster']) {
      expect(existsSync(path.join(C_CAM_REFERENCE_DIR, `${look}-1.png`))).toBe(true);
      expect(existsSync(path.join(C_CAM_REFERENCE_DIR, `${look}-2.png`))).toBe(true);
    }
  });

  it('gives nothing outside the world, for other looks or without the files', async () => {
    dir = mkdtempSync(path.join(tmpdir(), 'reelforge ccam refs '));
    expect(await criticReferenceVars(dir, COMIC, 'ink-scene')).toEqual({});
    expect(await criticReferenceVars(dir, C_CAM, 'paper-cutout')).toEqual({});
    expect(await criticReferenceVars(dir, C_CAM, 'ink-scene', path.join(dir, 'none'))).toEqual({});
  });

  it('asks the critic to read them as the bar, never to judge them', () => {
    const world = WORLDS.find((entry) => entry.id === 'c-cam');
    const vars = {
      imagePaths: 'sheet.png',
      intent: 'x',
      styleId: 'c-cam',
      ...criticWorldPromptVars(world),
    };
    const plain = renderPrompt('critic', vars);
    const withRefs = renderPrompt('critic', { ...vars, referencePaths: 'a.png, b.png' });
    if (!plain.ok || !withRefs.ok) throw new Error('critic prompt does not render');
    expect(plain.value).not.toContain('Reference frames');
    expect(withRefs.value).toContain(
      "Reference frames (authored frames of this world's concept films in the same look; the bar, not frames to judge: never return a verdict for them): a.png, b.png.",
    );
  });
});
