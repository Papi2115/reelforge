/**
 * Beat sync in the stages (PLAN.md#12.21) on fake-claude: with `beatSync: "auto"` the Storyboard
 * stage writes timing/beats.json and the report, snaps unlocked cuts (a locked shot keeps its
 * times) and still validates; with the switch off (no field: every project made before 2.2) the
 * storyboard stays byte for byte as Claude wrote it and nothing new is written. The sound side:
 * beds get the grid tempo, default cues without a grid are unchanged.
 */
import { existsSync } from 'node:fs';
import path from 'node:path';
import {
  BEAT_SYNC_REPORT_FILE,
  BEATS_FILE,
  beatSyncReportSchema,
  beatsFileSchema,
  storyboardFileSchema,
} from '@reelforge/shared';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { StageRunner } from '../runner.js';
import { plannedMusicCues } from '../sound/music.js';
import { detectActs } from '../sound/acts.js';
import { generateDefaultCues } from '../stages/default-cues.js';
import { FakeClaudeHarness, writes } from '../testing/fake-claude.js';
import { TestProjects, goldenFile, readProject, writeProject } from '../testing/project.js';
import { EXAMPLE_SOUND_INPUT } from '../testing/sound-films.js';
import { gridForFilm } from './stage.js';
import { beatSyncCheckOptions } from './storyboard-step.js';

const projects = new TestProjects();
const harnesses: FakeClaudeHarness[] = [];
afterEach(async () => {
  await Promise.all(harnesses.splice(0).map((harness) => harness.dispose()));
});
afterAll(() => {
  projects.dispose();
});

const GOLDEN = goldenFile('storyboard.json');
const LOCKED = 's04_rainbow';
/** Cut 40 ms into the pause before each word (inside the 50 ms tolerance, off the accent). */
const LEAD_S = 0.04;

/** The golden storyboard with every cut except the locked shot's moved LEAD_S earlier. */
function leadedStoryboard(): string {
  const storyboard = JSON.parse(GOLDEN) as { shots: { id: string; t0: number; t1: number }[] };
  const lockedIndex = storyboard.shots.findIndex((shot) => shot.id === LOCKED);
  const moves = (index: number): boolean =>
    index > 0 && index !== lockedIndex && index !== lockedIndex + 1;
  const shots = storyboard.shots.map((shot, index) => ({
    ...shot,
    t0: moves(index) ? Math.round((shot.t0 - LEAD_S) * 1000) / 1000 : shot.t0,
    t1: moves(index + 1) ? Math.round((shot.t1 - LEAD_S) * 1000) / 1000 : shot.t1,
  }));
  return JSON.stringify({ ...storyboard, shots }, null, 2);
}

async function storyboardRun(
  name: string,
  beatSync: 'auto' | undefined,
  written: string,
  lock = false,
) {
  const dir = await projects.create(name, ['script.txt', 'timing/words.json']);
  const project = JSON.parse(readProject(dir, 'project.json')) as Record<string, unknown>;
  delete project['lookMode'];
  delete project['beatSync'];
  if (beatSync !== undefined) project['beatSync'] = beatSync;
  writeProject(dir, 'project.json', JSON.stringify(project, null, 2));
  if (lock) {
    writeProject(
      dir,
      'locks.json',
      JSON.stringify({
        version: 1,
        shots: [{ shotId: LOCKED, lockedAt: '2026-10-04T08:00:00.000Z' }],
      }),
    );
  }
  const harness = new FakeClaudeHarness([writes({ 'storyboard.json': written })]);
  harnesses.push(harness);
  const runner = new StageRunner({
    projectDir: dir,
    claude: harness.runner,
    guard: harness.guard,
    git: projects.git,
  });
  const result = await runner.run({ stage: 'storyboard' });
  return { dir, result };
}

describe('beat sync in the storyboard stage', { timeout: 60_000 }, () => {
  it('off: the storyboard stays as written and no grid or report appears', async () => {
    const { dir, result } = await storyboardRun('beat sync off', undefined, leadedStoryboard());
    expect(result.ok).toBe(true);
    expect(readProject(dir, 'storyboard.json')).toBe(leadedStoryboard());
    expect(existsSync(path.join(dir, ...BEATS_FILE.split('/')))).toBe(false);
    expect(existsSync(path.join(dir, ...BEAT_SYNC_REPORT_FILE.split('/')))).toBe(false);
  });

  it('auto: grid + report, unlocked cuts snapped within 100 ms, the locked shot untouched', async () => {
    const { dir, result } = await storyboardRun('beat sync auto', 'auto', leadedStoryboard(), true);
    expect(result.ok, JSON.stringify(result)).toBe(true);
    if (!result.ok) return;
    expect(result.value.outputs).toContain(BEATS_FILE);
    const grid = beatsFileSchema.parse(JSON.parse(readProject(dir, BEATS_FILE)));
    expect(grid.beats.length).toBeGreaterThan(10);
    const report = beatSyncReportSchema.parse(JSON.parse(readProject(dir, BEAT_SYNC_REPORT_FILE)));
    expect(report.nudges?.locked).toBe(2);
    const before = storyboardFileSchema.parse(JSON.parse(leadedStoryboard())).shots;
    const after = storyboardFileSchema.parse(JSON.parse(readProject(dir, 'storyboard.json'))).shots;
    expect(after.map((shot) => shot.id)).toEqual(before.map((shot) => shot.id));
    after.forEach((shot, index) => {
      const original = before[index];
      expect(Math.abs(shot.t0 - (original?.t0 ?? 0))).toBeLessThanOrEqual(0.1 + 1e-9);
      if (shot.id === LOCKED) {
        expect([shot.t0, shot.t1]).toEqual([original?.t0, original?.t1]);
      }
    });
    expect(report.nudges?.moved).toBeGreaterThan(0);
    expect(report.nudges?.reverted).toBe(false);
    expect(report.cuts.fraction).toBeGreaterThanOrEqual(0.9);
    expect(report.nudges?.moved).toBe(
      after.filter((shot, index) => shot.t0 !== before[index]?.t0).length,
    );
  });
});

describe('beat sync: sound and validation', () => {
  it('adds the pause rule to the storyboard check only when on', () => {
    const value = {
      version: 1 as const,
      title: 't',
      language: 'en' as const,
      style: 's',
      fps: 30,
      seed: 1,
    };
    expect(beatSyncCheckOptions({ status: 'ok', value })).toEqual({});
    expect(beatSyncCheckOptions({ status: 'ok', value: { ...value, beatSync: 'off' } })).toEqual(
      {},
    );
    expect(beatSyncCheckOptions({ status: 'missing' })).toEqual({});
    expect(beatSyncCheckOptions({ status: 'ok', value: { ...value, beatSync: 'auto' } })).toEqual({
      rules: { pauseLeadS: 0.2 },
    });
  });

  it('locks each act bed to the grid tempo; without a grid the beds are unchanged', () => {
    const { shots, words } = EXAMPLE_SOUND_INPUT;
    const durationS = shots.at(-1)?.t1 ?? 0;
    const acts = detectActs(shots, durationS);
    const request = { acts, moods: ['bright-explainer' as const], seed: 2115, durationS };
    const plain = plannedMusicCues(request);
    expect(plain[0]).not.toHaveProperty('offsetS');
    const grid = gridForFilm({ shots, words, styleId: 'voxel-pixel-crisp640' });
    const locked = plannedMusicCues({ ...request, grid });
    expect(locked[0]?.offsetS).toBeGreaterThanOrEqual(0);
    expect(locked[0]?.file).not.toBe(plain[0]?.file);
    expect({ ...locked[0], offsetS: undefined, file: plain[0]?.file }).toEqual({
      ...plain[0],
      offsetS: undefined,
    });
  });

  it('default cues: no grid = the same cues; a grid only moves hits / risers / emphasis', () => {
    const plain = generateDefaultCues(EXAMPLE_SOUND_INPUT);
    expect(generateDefaultCues({ ...EXAMPLE_SOUND_INPUT, beats: undefined })).toEqual(plain);
    const grid = gridForFilm({ ...EXAMPLE_SOUND_INPUT, styleId: 'voxel-pixel-crisp640' });
    const synced = generateDefaultCues({ ...EXAMPLE_SOUND_INPUT, beats: grid });
    expect(synced.ambience).toEqual(plain.ambience);
    expect(synced.music).toEqual(plain.music);
    expect(synced.sfx?.length).toBe(plain.sfx?.length);
  });
});
