/**
 * The Grim Ink direction step on fake-claude (PLAN.md#14.16): the Storyboard stage plans
 * `direction.json` first (one Sonnet turn, JSON reply), hands it to the storyboard prompt and checks
 * the storyboard against it; the same script keeps the plan; an invalid plan gets ONE fix turn; a
 * failed Claude turn or a fix that still fails gives the minimal plan (⚠) and the film still
 * builds; the `direction` action plans again with the status kept; a storyboard without the title
 * frame is refused; another style never runs the step. No real Claude call.
 */
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import type { FakeClaudeStep } from '@reelforge/fake-claude';
import { directionFileSchema, projectFileSchema, type DirectionFile } from '@reelforge/shared';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { StageRunner } from '../runner.js';
import { DEFAULT_STAGE_SETTINGS } from '../settings.js';
import { directedShots, filmPlan } from '../testing/c-cam-direction.js';
import { FakeClaudeHarness, writes } from '../testing/fake-claude.js';
import { filmShots, writeFilm, type FilmShot } from '../testing/film.js';
import { readProject, TestProjects } from '../testing/project.js';
import { activeWorld } from '../worlds.js';
import { loadSceneDirection } from './direction-stage.js';

const projects = new TestProjects();
const harnesses: FakeClaudeHarness[] = [];
afterEach(async () => {
  await Promise.all(harnesses.splice(0).map((harness) => harness.dispose()));
});
afterAll(() => {
  projects.dispose();
});

const SETTINGS = { ...DEFAULT_STAGE_SETTINGS, experimentalWorlds: true };
const DIRECTION = 'narrative accents';
const DIRECTION_FIX = 'Your direction plan does not pass';
const LOOKS = ['ink-poster', 'ink-scene', 'ink-insert', 'ink-scene', 'ink-insert', 'ink-scene'];
const ROLLS: Readonly<Record<string, string>> = {
  'ink-poster': 'C',
  'ink-scene': 'A',
  'ink-insert': 'B',
};

const TREATMENTS = [
  'title-card',
  'character-scene',
  'metaphor-object',
  'character-scene',
  'counter/odometer',
  'character-scene',
];

type Rule = FakeClaudeStep & { readonly promptIncludes: string };

/** A cut on the first word of the shot (the film's words start 0.2 s into each shot). */
const cutAt = (shot: FilmShot): number => (shot.index === 0 ? 0 : shot.t0 + 0.2);

function storyboard(shots: readonly FilmShot[], plan: DirectionFile, titleFrame = true): string {
  const cuts = shots.map((shot, index) => ({
    t0: cutAt(shot),
    t1: index + 1 < shots.length ? shot.t1 + 0.2 : shot.t1,
  }));
  const directions = directedShots(cuts, plan);
  return JSON.stringify({
    version: 1,
    shots: shots.map((shot, index) => {
      const look = LOOKS[index] ?? 'ink-scene';
      const direction = directions[index];
      return {
        id: shot.id,
        ...cuts[index],
        treatment: TREATMENTS[index] ?? 'character-scene',
        intent: `cast: lead | place: mainPlace. ${shot.intent}`,
        scene: shot.scene,
        roll: ROLLS[look],
        look,
        transitionIn: { type: 'cut', duration: 0 },
        ...(index === 0 && !titleFrame ? {} : { direction }),
      };
    }),
  });
}

async function film(name: string, style = 'c-cam') {
  const dir = await projects.create(name, [], { style });
  const shots = filmShots(6);
  writeFilm(dir, shots);
  writeFileSync(path.join(dir, 'script.txt'), shots.map((shot) => shot.phrase).join('. '));
  return { dir, shots, plan: filmPlan(dir) };
}

function run(
  dir: string,
  rules: readonly Rule[],
): { harness: FakeClaudeHarness; stages: StageRunner } {
  const harness = new FakeClaudeHarness({ version: 1, rules: [...rules], default: 'ok' });
  harnesses.push(harness);
  const stages = new StageRunner({
    projectDir: dir,
    claude: harness.runner,
    guard: harness.guard,
    git: projects.git,
    settings: SETTINGS,
  });
  return { harness, stages };
}

const reply = (needle: string, value: unknown): Rule => ({
  scenario: 'ok',
  reply: typeof value === 'string' ? value : JSON.stringify(value),
  promptIncludes: needle,
});
const storyboardRule = (written: string): Rule => ({
  ...writes({ 'storyboard.json': written }),
  promptIncludes: 'storyboard',
});

function planOn(dir: string): DirectionFile {
  return directionFileSchema.parse(JSON.parse(readProject(dir, 'direction.json')));
}

const prompts = (harness: FakeClaudeHarness, needle: string): number =>
  harness.specs.filter((spec) => spec.prompt.includes(needle)).length;

describe('the Grim Ink direction step on fake-claude', { timeout: 180_000 }, () => {
  it('plans first, steers the storyboard and keeps the plan for the same script', async () => {
    const { dir, shots, plan } = await film('direction planned');
    const { harness, stages } = run(dir, [
      reply(DIRECTION, `The plan:\n${JSON.stringify(plan)}`),
      storyboardRule(storyboard(shots, plan)),
    ]);
    const result = await stages.run({ stage: 'storyboard' });
    if (!result.ok) throw new Error(JSON.stringify(result.error));
    expect(harness.specs[0]?.prompt).toContain(DIRECTION);
    expect(harness.specs[0]?.stage).toBe('storyboard');
    expect(harness.specs[1]?.prompt).toContain('Direction plan (`direction.json`');
    expect(result.value.outputs).toContain('direction.json');
    const saved = planOn(dir);
    expect(saved).toMatchObject({ source: 'claude', climax: plan.climax });
    expect(saved.inputsHash).toMatch(/^[0-9a-f]{64}$/);

    const again = await stages.run({ stage: 'storyboard' });
    if (!again.ok) throw new Error(JSON.stringify(again.error));
    expect(prompts(harness, DIRECTION)).toBe(1);

    // The scenes read the plan of a Grim Ink film only.
    const project = projectFileSchema.parse(JSON.parse(readProject(dir, 'project.json')));
    const world = activeWorld('c-cam', { experimental: true });
    expect((await loadSceneDirection(dir, project, world))?.climax).toEqual(plan.climax);
    expect(await loadSceneDirection(dir, project, undefined)).toBeUndefined();
  });

  it('fixes an invalid plan with one turn', async () => {
    const { dir, shots, plan } = await film('direction repaired');
    const { harness, stages } = run(dir, [
      reply(DIRECTION_FIX, plan),
      reply(DIRECTION, { ...plan, accidents: [] }),
      storyboardRule(storyboard(shots, plan)),
    ]);
    const result = await stages.run({ stage: 'storyboard' });
    if (!result.ok) throw new Error(JSON.stringify(result.error));
    const fix = harness.specs.find((spec) => spec.prompt.includes(DIRECTION_FIX));
    expect(fix?.prompt).toContain('direction-accident');
    expect(planOn(dir).source).toBe('claude');
  });

  it('falls back to the minimal plan when Claude fails, and the film still builds', async () => {
    const { dir, shots, plan } = await film('direction fallback');
    const { stages } = run(dir, [
      { scenario: 'crash', promptIncludes: DIRECTION },
      storyboardRule(storyboard(shots, plan)),
    ]);
    const result = await stages.run({ stage: 'storyboard' });
    if (!result.ok) throw new Error(JSON.stringify(result.error));
    expect(result.value.warnings.join('\n')).toContain('⚠ direction');
    expect(planOn(dir)).toMatchObject({ source: 'fallback', beats: plan.beats });
  });

  it('falls back when the fix still fails', async () => {
    const { dir, shots, plan } = await film('direction fix fails');
    const { harness, stages } = run(dir, [
      reply(DIRECTION_FIX, 'still no plan'),
      reply(DIRECTION, 'no plan'),
      storyboardRule(storyboard(shots, plan)),
    ]);
    const result = await stages.run({ stage: 'storyboard' });
    if (!result.ok) throw new Error(JSON.stringify(result.error));
    expect(prompts(harness, DIRECTION_FIX)).toBe(1);
    expect(planOn(dir).source).toBe('fallback');
  });

  it('plans again on the direction action and keeps the stage status', async () => {
    const { dir, plan } = await film('direction action');
    const { harness, stages } = run(dir, [reply(DIRECTION, { ...plan, motifs: [] })]);
    const result = await stages.run({ stage: 'storyboard', action: 'direction' });
    if (!result.ok) throw new Error(JSON.stringify(result.error));
    expect(result.value).toMatchObject({ keepStatus: true, outputs: ['direction.json'] });
    expect(result.value.message).toContain('direction planned:');
    expect(prompts(harness, DIRECTION)).toBe(1);
    const again = await stages.run({ stage: 'storyboard', action: 'direction' });
    if (!again.ok) throw new Error(JSON.stringify(again.error));
    expect(prompts(harness, DIRECTION)).toBe(2);
  });

  it('refuses a storyboard without the title frame', async () => {
    const { dir, shots, plan } = await film('direction no title');
    const { stages } = run(dir, [
      reply(DIRECTION, plan),
      storyboardRule(storyboard(shots, plan, false)),
    ]);
    const result = await stages.run({ stage: 'storyboard' });
    expect(result.ok).toBe(false);
    expect(JSON.stringify(result)).toContain('direction-title-frame');
  });

  it('never runs for another style', async () => {
    const { dir, plan } = await film('direction voxel', 'soft-480');
    const { stages } = run(dir, []);
    const action = await stages.run({ stage: 'storyboard', action: 'direction' });
    expect(action.ok).toBe(false);
    expect(JSON.stringify(action)).toContain('not Grim Ink');
    expect(plan.cast[0]?.id).toBe('lead');
  });
});
