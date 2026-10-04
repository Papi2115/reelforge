/**
 * Taste learning (PLAN.md#12.13) on fake-claude: a scripted series of variant picks (an orbiting
 * camera on a coloured background chosen twice over a push-in on the sky) and a lock teach the
 * profile; the storyboard prompt then carries the "Taste profile" section and a fake-claude rule
 * keyed on it writes a different storyboard; "Forget everything" brings back the byte-identical
 * prompt and the original proposal. Variant builds never get the profile.
 */
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { LimitGuard } from '@reelforge/claude-bridge';
import { autocommit } from '@reelforge/project';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { StageRunner } from './runner.js';
import { DEFAULT_SCENE_SETTINGS, DEFAULT_STAGE_SETTINGS } from './settings.js';
import { shotTasteSignals } from './taste/signals.js';
import { FakeClaudeHarness, writes } from './testing/fake-claude.js';
import { filmShots, sceneSource, writeFilm, type FilmShot } from './testing/film.js';
import { TestProjects, goldenFile, readProject, writeProject } from './testing/project.js';
import { ScriptedFrameRenderer } from './testing/scripted-renderer.js';
import { MemoryTasteLearner } from './testing/taste.js';
import {
  generateRequest,
  variantFixRule,
  variantRule,
  variantScript,
  variantSource,
} from './testing/variants.js';

const projects = new TestProjects();
const harnesses: FakeClaudeHarness[] = [];
afterEach(async () => {
  await Promise.all(harnesses.splice(0).map((harness) => harness.dispose()));
});
afterAll(() => {
  projects.dispose();
});

const now = (): Date => new Date('2026-10-04T10:00:00.000Z');
const SECTION = 'Taste profile of this user';

/** Variant 2: an orbiting camera on the accent2 background (the user's favourite). */
function orbitSource(shot: FilmShot): string {
  return sceneSource(shot)
    .replace('new three.Color(palette.sky)', 'new three.Color(palette.accent2)')
    .replace('ctx.camera.pushIn(', 'ctx.camera.orbit(');
}

async function variantFilm(learner: MemoryTasteLearner) {
  const shots = filmShots(3);
  const shot = shots[1] as FilmShot;
  const dir = await projects.create('taste variants');
  writeFilm(dir, shots);
  for (const entry of shots) {
    writeFileSync(path.join(dir, ...entry.scene.split('/')), sceneSource(entry));
  }
  const committed = await autocommit(dir, 'Scenes', { kind: 'manual', git: projects.git });
  if (!committed.ok) throw new Error(committed.error.message);
  const lint = sceneSource(shot, 'lint');
  const guard = new LimitGuard({ maxConcurrency: 3, recoverAfter: 100 });
  const harness = new FakeClaudeHarness(
    variantScript([
      variantRule(shot, 1, variantSource(shot, 1)),
      variantRule(shot, 2, orbitSource(shot)),
      variantRule(shot, 3, lint),
      variantFixRule(shot, 3, lint),
    ]),
    { concurrency: 3, guard },
  );
  harnesses.push(harness);
  const runner = new StageRunner({
    projectDir: dir,
    claude: harness.runner,
    guard,
    git: projects.git,
    scenes: { frames: new ScriptedFrameRenderer() },
    settings: { ...DEFAULT_STAGE_SETTINGS, scenes: { ...DEFAULT_SCENE_SETTINGS, concurrency: 3 } },
    taste: learner,
    now,
  });
  return { dir, shot, harness, runner };
}

const GOLDEN = goldenFile('storyboard.json');
/** What the fake storyboard writer proposes when the profile asks for orbiting cameras. */
const TASTEFUL = GOLDEN.replace(
  'A voxel glass of water slides onto the table',
  'A voxel glass of water, the camera orbits it slowly, slides onto the table',
);

describe('taste learning', { timeout: 180_000 }, () => {
  it('learns from picks and a lock, changes the storyboard proposal, resets cleanly', async () => {
    const learner = new MemoryTasteLearner(now);
    const film = await variantFilm(learner);
    for (let round = 0; round < 2; round += 1) {
      expect((await film.runner.run(generateRequest(film.shot.id))).ok).toBe(true);
      const picked = await film.runner.run({
        stage: 'scenes',
        action: 'variants',
        shots: [film.shot.id],
        variants: { kind: 'pick', index: 2 },
      });
      expect(picked.ok).toBe(true);
    }
    expect(readProject(film.dir, film.shot.scene)).toBe(orbitSource(film.shot));
    const locks = await shotTasteSignals(film.dir, [film.shot.id], 'lock');
    expect(locks.ok).toBe(true);
    learner.record(locks.ok ? locks.value : []);
    expect(learner.recorded.map((signal) => signal.kind)).toEqual(['pick', 'pick', 'lock']);
    expect(learner.recorded[0]?.negative).toEqual(
      expect.arrayContaining([
        { feature: 'camera', value: 'pushIn' },
        { feature: 'background', value: 'sky' },
      ]),
    );
    // Variant builds never carry the profile (they must stay genuinely different).
    const builds = film.harness.specs.filter((spec) => spec.stage === 'scene-build');
    expect(builds.some((spec) => spec.prompt.includes(SECTION))).toBe(false);
    const profile = learner.profile();
    expect(profile).toContain('orbit camera moves');
    expect(profile).toContain('accent2 backgrounds');
    expect(profile).toContain('Usually turns down');
    expect(profile).toContain('pushIn camera moves');

    // The storyboard of another project: one runner, the same learner.
    const dir = await projects.create('taste storyboard', [
      'script.txt',
      'timing/words.json',
      'scenes/s06_red_violet.js',
    ]);
    const harness = new FakeClaudeHarness({
      version: 1,
      rules: [{ ...writes({ 'storyboard.json': TASTEFUL }, '7 shots.'), promptIncludes: SECTION }],
      default: writes({ 'storyboard.json': GOLDEN }, '7 shots.'),
    });
    harnesses.push(harness);
    // A voxel-only project: the storyboard is checked exactly as the golden one was written.
    const projectFile = JSON.parse(readProject(dir, 'project.json')) as Record<string, unknown>;
    delete projectFile['lookMode'];
    writeProject(dir, 'project.json', JSON.stringify(projectFile, null, 2));
    const runner = new StageRunner({
      projectDir: dir,
      claude: harness.runner,
      guard: harness.guard,
      git: projects.git,
      taste: learner,
      now,
    });
    const learned = learner.file;
    learner.reset();
    expect((await runner.run({ stage: 'storyboard' })).ok).toBe(true);
    const baseline = readProject(dir, 'storyboard.json');
    learner.file = learned;
    expect((await runner.run({ stage: 'storyboard' })).ok).toBe(true);
    const tasteful = readProject(dir, 'storyboard.json');
    learner.reset();
    expect((await runner.run({ stage: 'storyboard' })).ok).toBe(true);

    const prompts = harness.specs.map((spec) => spec.prompt);
    expect(prompts).toHaveLength(3);
    expect(prompts[0]).not.toContain(SECTION);
    expect(prompts[1]).toContain(`${SECTION} (learned on this computer`);
    expect(prompts[1]).toContain(profile);
    expect(prompts[2]).toBe(prompts[0]);
    expect(baseline).toBe(GOLDEN);
    expect(tasteful).not.toBe(baseline);
    expect(tasteful).toContain('the camera orbits it slowly');
    expect(readProject(dir, 'storyboard.json')).toBe(GOLDEN);
  });
});
