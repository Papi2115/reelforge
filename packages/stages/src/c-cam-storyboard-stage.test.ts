/**
 * A Grim Ink (`c-cam`) storyboard on fake-claude (PLAN.md#14.12) with experimental worlds on: a
 * project created in the world's style gets its defaults (24 fps, mixed looks), the storyboard turn
 * carries the world's wording and its three looks, and the validator takes a cut-only film in them.
 * With looks turned off (project.json `worldLooks`) the prompt offers only the looks in use,
 * relettered, and a storyboard that still uses a look that is off is refused. The direction plan
 * comes first (PLAN.md#14.16; a valid reply here, the step's own cases in
 * c-cam/direction-stage.test.ts) and the storyboard executes it. No real Claude call.
 */
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { StageRunner } from './runner.js';
import { DEFAULT_STAGE_SETTINGS } from './settings.js';
import type { DirectionFile } from '@reelforge/shared';
import { directedShots, filmPlan } from './testing/c-cam-direction.js';
import { FakeClaudeHarness, writes } from './testing/fake-claude.js';
import { filmShots, writeFilm, type FilmShot } from './testing/film.js';
import { readProject, TestProjects, writeProject } from './testing/project.js';

const projects = new TestProjects();
const harnesses: FakeClaudeHarness[] = [];
afterEach(async () => {
  await Promise.all(harnesses.splice(0).map((harness) => harness.dispose()));
});
afterAll(() => {
  projects.dispose();
});

const SETTINGS = { ...DEFAULT_STAGE_SETTINGS, experimentalWorlds: true };
type Plan = readonly [roll: 'A' | 'B' | 'C', look: string, treatment: string];
/** Poster, scene, insert, scene, insert, scene: every look, never more than two in a row. */
const ALL_LOOKS: readonly Plan[] = [
  ['C', 'ink-poster', 'title-card'],
  ['A', 'ink-scene', 'character-scene'],
  ['B', 'ink-insert', 'metaphor-object'],
  ['A', 'ink-scene', 'character-scene'],
  ['B', 'ink-insert', 'counter/odometer'],
  ['A', 'ink-scene', 'character-scene'],
];
/** The same film without inserts, lettered for the looks in use (scene A, poster B). */
const NO_INSERT: readonly Plan[] = [
  ['B', 'ink-poster', 'title-card'],
  ['A', 'ink-scene', 'character-scene'],
  ['A', 'ink-scene', 'metaphor-object'],
  ['B', 'ink-poster', 'kinetic-text'],
  ['A', 'ink-scene', 'character-scene'],
  ['A', 'ink-scene', 'counter/odometer'],
];

/** A cut on the first word of the shot (the film's words start 0.2 s into each shot). */
const cutAt = (shot: FilmShot): number => (shot.index === 0 ? 0 : shot.t0 + 0.2);

function storyboard(
  shots: readonly FilmShot[],
  plans: readonly Plan[],
  plan: DirectionFile,
): string {
  const cuts = shots.map((shot, index) => ({
    t0: cutAt(shot),
    t1: index + 1 < shots.length ? shot.t1 + 0.2 : shot.t1,
  }));
  const directions = directedShots(cuts, plan);
  return JSON.stringify({
    version: 1,
    shots: shots.map((shot, index) => {
      const [roll, look, treatment] = plans[index] ?? ['A', 'ink-scene', 'character-scene'];
      return {
        id: shot.id,
        ...cuts[index],
        treatment,
        intent: `cast: lead | place: mainPlace. ${shot.intent}`,
        scene: shot.scene,
        roll,
        look,
        transitionIn: { type: 'cut', duration: 0 },
        direction: directions[index],
      };
    }),
  });
}

async function film(name: string, worldLooks?: readonly string[]) {
  const dir = await projects.create(name, [], { style: 'c-cam' });
  const project = JSON.parse(readProject(dir, 'project.json')) as Record<string, unknown>;
  expect(project).toMatchObject({ style: 'c-cam', fps: 24, lookMode: 'mixed' });
  if (worldLooks !== undefined) {
    writeProject(dir, 'project.json', JSON.stringify({ ...project, worldLooks }, null, 2));
  }
  const shots = filmShots(6);
  writeFilm(dir, shots);
  writeFileSync(path.join(dir, 'script.txt'), shots.map((shot) => shot.phrase).join('. '));
  return { dir, shots };
}

function runner(
  dir: string,
  written: string,
  plan: DirectionFile,
): { harness: FakeClaudeHarness; runner: StageRunner } {
  const harness = new FakeClaudeHarness({
    version: 1,
    rules: [
      { scenario: 'ok', reply: JSON.stringify(plan), promptIncludes: 'narrative accents' },
      { ...writes({ 'storyboard.json': written }), promptIncludes: 'storyboard' },
    ],
    default: { scenario: 'tools-write', reply: 'ok' },
  });
  harnesses.push(harness);
  return {
    harness,
    runner: new StageRunner({
      projectDir: dir,
      claude: harness.runner,
      guard: harness.guard,
      git: projects.git,
      settings: SETTINGS,
    }),
  };
}

describe('a Grim Ink storyboard on fake-claude', { timeout: 180_000 }, () => {
  it('plans the film in the three ink looks with the world wording', async () => {
    const { dir, shots } = await film('grim ink storyboard');
    const plan = filmPlan(dir);
    const { harness, runner: stages } = runner(dir, storyboard(shots, ALL_LOOKS, plan), plan);
    const result = await stages.run({ stage: 'storyboard' });
    if (!result.ok) throw new Error(JSON.stringify(result.error));
    expect(harness.specs[0]?.prompt).toContain('narrative accents');
    const prompt = harness.specs[1]?.prompt ?? '';
    expect(prompt).toContain('Direction plan (`direction.json`');
    expect(prompt).toContain('hand-inked grim cartoon video');
    expect(prompt).toContain('- `ink-insert` (Ink insert)');
    expect(prompt).not.toContain('Turned off in this project');
  });

  it('offers only the looks a project keeps on and refuses a look that is off', async () => {
    const kept = await film('grim ink two looks', ['ink-scene', 'ink-poster']);
    const keptPlan = filmPlan(kept.dir);
    const ok = runner(kept.dir, storyboard(kept.shots, NO_INSERT, keptPlan), keptPlan);
    const result = await ok.runner.run({ stage: 'storyboard' });
    if (!result.ok) throw new Error(JSON.stringify(result.error));
    const prompt = ok.harness.specs[1]?.prompt ?? '';
    expect(prompt).toContain('- `ink-poster` (Ink poster)');
    expect(prompt).not.toContain('- `ink-insert` (Ink insert)');
    expect(prompt).toMatch(/Turned off in this project .*`ink-insert`/u);

    const off = await film('grim ink look off', ['ink-scene', 'ink-poster']);
    const offPlan = filmPlan(off.dir);
    const refused = runner(off.dir, storyboard(off.shots, ALL_LOOKS, offPlan), offPlan);
    const rejected = await refused.runner.run({ stage: 'storyboard' });
    expect(rejected.ok).toBe(false);
    expect(JSON.stringify(rejected)).toContain('unknown-look');
  });
});
