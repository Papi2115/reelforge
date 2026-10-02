/**
 * Sync report (PLAN.md#7.7) and the "Check every visual lands on its spoken word" review
 * (#7.6) on the REAL engine: the anchors and sfx cues come from the scenes' dry run.
 */
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { autocommit } from '@reelforge/project';
import { syncReportSchema } from '@reelforge/shared';
import { afterAll, describe, expect, it } from 'vitest';
import { PlaywrightFrameRenderer } from '../src/cli/playwright-renderer.js';
import { StageRunner } from '../src/runner.js';
import { syncReport } from '../src/scenes/sync-report.js';
import { FakeClaudeHarness, writes } from '../src/testing/fake-claude.js';
import {
  CRITIC_OK,
  filmShots,
  sceneSource,
  writeFilm,
  type SceneVariant,
} from '../src/testing/film.js';
import { TestProjects, readProject } from '../src/testing/project.js';

const projects = new TestProjects();
const renderer = new PlaywrightFrameRenderer();
const VARIANTS: readonly SceneVariant[] = ['ok', 'late-sfx', 'ok'];

afterAll(async () => {
  await renderer.close();
  projects.dispose();
});

async function film(name: string): Promise<string> {
  const dir = await projects.create(name);
  const shots = filmShots(VARIANTS.length);
  writeFilm(dir, shots);
  shots.forEach((shot, index) => {
    writeFileSync(path.join(dir, ...shot.scene.split('/')), sceneSource(shot, VARIANTS[index]));
  });
  // cues.json: one sfx 50 ms after "three lands" (s03 anchor at 4.6 s), one free cue.
  writeFileSync(
    path.join(dir, 'cues.json'),
    JSON.stringify({
      version: 1,
      sfx: [
        { t: 4.65, name: 'click' },
        { t: 5.9, name: 'whoosh' },
      ],
    }),
  );
  expect((await autocommit(dir, 'Scenes', { kind: 'manual', git: projects.git })).ok).toBe(true);
  return dir;
}

describe('sync report and sync check', { timeout: 120_000 }, () => {
  it('lists every event per shot against its spoken word (±150 ms)', async () => {
    const dir = await film('sync report');
    const report = await syncReport({
      projectDir: dir,
      frames: renderer,
      signal: new AbortController().signal,
    });
    if (!report.ok) throw new Error(report.error.message);
    const summary = report.value.shots.map((shot) => [
      shot.shotId,
      shot.events.map(
        (event) => `${event.kind}:${event.label}:${String(event.deltaMs)}:${event.verdict}`,
      ),
    ]);
    expect(summary).toEqual([
      ['s01', ['anchor:one lands:0:ok', 'sfx:hit:0:ok']],
      ['s02', ['anchor:two lands:0:ok', 'sfx:hit:400:off']],
      [
        's03',
        ['anchor:three lands:0:ok', 'sfx:hit:0:ok', 'cue:click:50:ok', 'cue:whoosh:null:free'],
      ],
    ]);
    expect(report.value.summary).toEqual({
      shots: 3,
      events: 8,
      ok: 6,
      problems: 1,
      failedShots: 0,
    });
    const onDisk = syncReportSchema.parse(
      JSON.parse(readProject(dir, '.reelforge/sync-report.json')),
    );
    expect(onDisk.shots[1]).toMatchObject({ shotId: 's02', problems: 1, maxDeltaMs: 400 });
  });

  it('sync-check fixes only the shot whose sfx misses its word, then reports again', async () => {
    const dir = await film('sync check');
    const target = filmShots(VARIANTS.length)[1];
    if (target === undefined) throw new Error('no shot s02');
    const harness = new FakeClaudeHarness({
      version: 1,
      rules: [
        {
          ...writes({ 'scenes/s02.js': sceneSource(target, 'ok') }, 'Moved the hit.'),
          promptIncludes: 'Check every visual lands on its spoken word',
        },
      ],
      default: { scenario: 'tools-write', reply: CRITIC_OK },
    });
    try {
      const runner = new StageRunner({
        projectDir: dir,
        claude: harness.runner,
        guard: harness.guard,
        git: projects.git,
        scenes: { frames: renderer },
      });
      const result = await runner.run({ stage: 'scenes', action: 'sync-check' });
      expect(result.ok && result.value.message).toBe(
        'Review (sync-check): 1 shot flagged, 1 fixed (1 ✓); sync: 0 problems left',
      );
      expect(harness.specs.map((spec) => spec.stage)).toEqual(['scene-fix', 'critic']);
      expect(harness.specs[0]?.prompt).toContain(
        'sfx "hit" at 3.00 s (local 1.00 s) misses "two lands"',
      );
      const after = syncReportSchema.parse(
        JSON.parse(readProject(dir, '.reelforge/sync-report.json')),
      );
      expect(after.summary.problems).toBe(0);
    } finally {
      await harness.dispose();
    }
  });
});
