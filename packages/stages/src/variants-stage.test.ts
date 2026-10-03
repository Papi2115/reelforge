/**
 * Shot variants (PLAN.md#11.3) on fake-claude with the scripted frame renderer: 3 variants of one
 * shot built in parallel through the QA loop (one failing and dropped), all failing (current
 * scene kept), a locked shot refused, pick (scene + report + commit + lock + taste log),
 * keep-current, regenerate one variant, a variant turn touching the current scene, stale sets
 * and cancellation. Usage limits and restarts: variants-resilience.test.ts.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { PipelineStateStore } from '@reelforge/claude-bridge';
import { scenesReportSchema, shotLocksFileSchema, tasteLogSchema } from '@reelforge/shared';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { setShotsLocked } from './locks.js';
import { FakeClaudeHarness, writes } from './testing/fake-claude.js';
import { sceneSource, type FilmShot } from './testing/film.js';
import { TestProjects, readProject } from './testing/project.js';
import {
  generateRequest as generate,
  readVariantSetFile as variantSet,
  setupVariants,
  twoGoodOneBad,
  variantFixRule,
  variantRule,
  variantScript as script,
  variantSource,
  work,
  type Rules,
} from './testing/variants.js';
import { readVariantSets } from './variants/current.js';

const projects = new TestProjects();
const harnesses: FakeClaudeHarness[] = [];
afterEach(async () => {
  await Promise.all(harnesses.splice(0).map((harness) => harness.dispose()));
});
afterAll(() => {
  projects.dispose();
});

const setup = (name: string, rules: (shot: FilmShot) => Rules) =>
  setupVariants(projects, harnesses, name, rules);

describe('shot variants', { timeout: 120_000 }, () => {
  it('builds 3 variants in parallel with QA, drops the failing one, touches nothing tracked', async () => {
    const { dir, shot, harness, runner } = await setup('three variants', twoGoodOneBad);
    const commitsBefore = (await projects.history(dir)).length;
    const result = await runner.run(generate(shot.id, 3, 'make it calmer'));
    expect(result.ok && result.value).toMatchObject({
      message: 's02: 2 variants ready, 1 dropped',
      metrics: { variants: 3, ready: 2, dropped: 1 },
      changed: false,
    });
    const set = variantSet(dir, shot.id);
    expect(set.variants.map((variant) => [variant.direction.id, variant.status])).toEqual([
      ['hero-push', 'ready'],
      ['orbit-depth', 'ready'],
      ['kinetic-text', 'dropped'],
    ]);
    expect(set.variants[2]?.reason).toContain('failed QA');
    expect(set.note).toBe('make it calmer');
    expect(readProject(dir, '.reelforge/variants/s02/v2.js')).toBe(variantSource(shot, 2));
    expect(set.variants[1]?.record).toMatchObject({
      status: 'ok',
      scene: '.reelforge/variants/s02/v2.js',
    });
    expect(existsSync(path.join(dir, '.variants', 's02'))).toBe(false);
    expect(readProject(dir, shot.scene)).toBe(sceneSource(shot));
    expect((await projects.history(dir)).length).toBe(commitsBefore);
    expect(readFileSync(path.join(dir, '.git', 'info', 'exclude'), 'utf8')).toContain(
      '/.variants/',
    );
    // Each build prompt carries its direction and the note; the builds ran in parallel.
    const builds = harness.specs.filter((spec) => spec.stage === 'scene-build');
    expect(builds.map((spec) => spec.prompt.includes('make it calmer'))).toEqual([
      true,
      true,
      true,
    ]);
    expect(builds.some((spec) => spec.prompt.includes('Orbit, layered depth'))).toBe(true);
    let running = 0;
    let peak = 0;
    for (const event of harness.lifecycle) {
      if (event.stage !== 'scene-build') continue;
      running += event.type === 'started' ? 1 : event.type === 'finished' ? -1 : 0;
      peak = Math.max(peak, running);
    }
    expect(peak).toBe(3);
    // At most one QA fix per variant.
    const fixes = harness.specs.filter((spec) => spec.stage === 'scene-fix');
    expect(fixes.map((spec) => spec.prompt.includes('QA fix 1/1 for shot s02'))).toEqual([true]);
    // Variants leave the stage status as it was.
    const state = await new PipelineStateStore().read(dir);
    expect(state.ok && state.value.stages['scenes']?.status).not.toBe('done');
  });

  it('keeps the current scene and removes the set when every variant fails', async () => {
    const { dir, shot, runner } = await setup('all fail', (target) => {
      const lint = sceneSource(target, 'lint');
      return [1, 2].flatMap((index) => [
        variantRule(target, index, lint),
        variantFixRule(target, index, lint),
      ]);
    });
    const result = await runner.run(generate(shot.id, 2));
    expect(!result.ok && result.error).toMatchObject({
      kind: 'quality',
      message: 'No variant of s02 passed QA; the current scene is kept',
    });
    expect(existsSync(path.join(dir, '.reelforge', 'variants', 's02'))).toBe(false);
    expect(readProject(dir, shot.scene)).toBe(sceneSource(shot));
  });

  it('refuses a locked shot', async () => {
    const { dir, shot, harness, runner } = await setup('locked', twoGoodOneBad);
    expect((await setShotsLocked(dir, [shot.id], true, new Date())).ok).toBe(true);
    const result = await runner.run(generate(shot.id));
    expect(!result.ok && result.error).toMatchObject({
      kind: 'invalid-input',
      message: 'Shot s02 is locked — unlock first',
    });
    expect(harness.specs).toHaveLength(0);
  });

  it('picks a variant: scene, report, commit, lock, taste log; the rest is deleted', async () => {
    const { dir, shot, runner } = await setup('pick', twoGoodOneBad);
    expect((await runner.run(generate(shot.id))).ok).toBe(true);
    const picked = await runner.run({
      stage: 'scenes',
      action: 'variants',
      shots: [shot.id],
      variants: { kind: 'pick', index: 2, lock: true },
    });
    expect(picked.ok && picked.value.message).toBe(
      's02: picked variant 2 (Orbit, layered depth), locked',
    );
    expect(readProject(dir, shot.scene)).toBe(variantSource(shot, 2));
    const [head] = await projects.history(dir);
    expect(head?.subject).toBe('Shot s02: picked variant 2 (Orbit, layered depth)');
    expect(head?.files.map((file) => file.path).sort()).toEqual(['locks.json', 'scenes/s02.js']);
    const locks = shotLocksFileSchema.parse(JSON.parse(readProject(dir, 'locks.json')));
    expect(locks.shots.map((entry) => entry.shotId)).toEqual(['s02']);
    const report = scenesReportSchema.parse(
      JSON.parse(readProject(dir, '.reelforge/scenes-report.json')),
    );
    expect(report.shots.find((entry) => entry.shotId === 's02')).toMatchObject({
      status: 'ok',
      scene: 'scenes/s02.js',
    });
    expect(existsSync(path.join(dir, '.reelforge', 'variants', 's02'))).toBe(false);
    const taste = tasteLogSchema.parse(JSON.parse(readProject(dir, '.reelforge/taste.json')));
    expect(taste.entries).toEqual([
      expect.objectContaining({
        shotId: 's02',
        treatment: shot.treatment,
        decision: 'pick',
        offered: ['hero-push', 'orbit-depth', 'kinetic-text'],
        chosen: 'orbit-depth',
        scores: [
          { direction: 'hero-push', status: 'ok', findings: 0 },
          { direction: 'orbit-depth', status: 'ok', findings: 0 },
          { direction: 'kinetic-text', status: 'dropped', findings: 0 },
        ],
      }),
    ]);
  });

  it('keep-current logs the decision, and the next set rotates the directions', async () => {
    const { dir, shot, runner } = await setup('keep current', twoGoodOneBad);
    expect((await runner.run(generate(shot.id, 2))).ok).toBe(true);
    const kept = await runner.run({
      stage: 'scenes',
      action: 'variants',
      shots: [shot.id],
      variants: { kind: 'keep-current' },
    });
    expect(kept.ok && kept.value.message).toBe('s02: kept the current scene');
    expect(readProject(dir, shot.scene)).toBe(sceneSource(shot));
    const taste = tasteLogSchema.parse(JSON.parse(readProject(dir, '.reelforge/taste.json')));
    expect(taste.entries.map((entry) => [entry.decision, entry.chosen])).toEqual([
      ['keep-current', 'none'],
    ]);
    expect((await runner.run(generate(shot.id, 2))).ok).toBe(true);
    expect(variantSet(dir, shot.id).variants.map((variant) => variant.direction.id)).toEqual([
      'kinetic-text',
      'diorama-wide',
    ]);
  });

  it('rebuilds one variant with its direction, keeping the others', async () => {
    const { dir, shot, harness, runner } = await setup('regenerate', twoGoodOneBad);
    expect((await runner.run(generate(shot.id))).ok).toBe(true);
    harness.setScript(script([variantRule(shot, 3, variantSource(shot, 3))]));
    const again = await runner.run({
      stage: 'scenes',
      action: 'variants',
      shots: [shot.id],
      variants: { kind: 'generate', count: 3, only: 3 },
    });
    expect(again.ok && again.value.message).toBe('s02: 3 variants ready');
    const set = variantSet(dir, shot.id);
    expect(set.variants.map((variant) => variant.status)).toEqual(['ready', 'ready', 'ready']);
    expect(set.variants[2]?.direction.id).toBe('kinetic-text');
    expect(set.note).toBeUndefined();
  });

  it('puts the current scene back when a variant turn edits it anyway', async () => {
    const { dir, shot, runner, events } = await setup('protect', (target) => [
      {
        ...writes({ [work(target, 1)]: variantSource(target, 1), [target.scene]: 'broken' }),
        promptIncludes: `Write \`${work(target, 1)}\``,
      },
      variantRule(target, 2, variantSource(target, 2)),
    ]);
    expect((await runner.run(generate(shot.id, 2))).ok).toBe(true);
    expect(readProject(dir, shot.scene)).toBe(sceneSource(shot));
    expect(
      events.some((event) => event.type === 'warning' && event.message.includes('restored')),
    ).toBe(true);
  });

  it('removes a stale set once the shot scene changes', async () => {
    const { dir, shot, runner } = await setup('stale', twoGoodOneBad);
    expect((await runner.run(generate(shot.id))).ok).toBe(true);
    expect((await readVariantSets(dir)).ok).toBe(true);
    writeFileSync(path.join(dir, ...shot.scene.split('/')), `${sceneSource(shot)}// edited\n`);
    const sets = await readVariantSets(dir);
    expect(sets.ok && sets.value).toEqual({ sets: [], removed: ['s02'] });
    expect(existsSync(path.join(dir, '.reelforge', 'variants', 's02'))).toBe(false);
  });

  it('Stop cancels every variant turn and keeps the current scene', async () => {
    const { dir, shot, runner } = await setup('cancel', (target) =>
      [1, 2, 3].map((index) =>
        variantRule(target, index, variantSource(target, index), { delayMs: 20_000 }),
      ),
    );
    const started = new Promise<void>((resolve) => {
      runner.on('event', (event) => {
        if (event.type === 'claude') resolve();
      });
    });
    const run = runner.run(generate(shot.id));
    await started;
    runner.cancel();
    const result = await run;
    expect(!result.ok && result.error.kind).toBe('cancelled');
    expect(existsSync(path.join(dir, '.reelforge', 'variants', 's02'))).toBe(false);
    expect(existsSync(path.join(dir, '.variants', 's02', 'v1.js'))).toBe(false);
    expect(readProject(dir, shot.scene)).toBe(sceneSource(shot));
  });
});
