/**
 * Shot variants (PLAN.md#11.3) when things go wrong: a usage limit while variants are built
 * (pause, resume, nothing lost), variants a closed app left `building` (settled as interrupted),
 * and sets whose shot left the storyboard.
 */
import { existsSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { PipelineStateStore } from '@reelforge/claude-bridge';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { FakeClaudeHarness } from './testing/fake-claude.js';
import { filmShots, filmStoryboard } from './testing/film.js';
import { ManualClock } from './testing/manual-clock.js';
import { TestProjects } from './testing/project.js';
import {
  generateRequest,
  readVariantSetFile,
  setupVariants,
  variantRule,
  variantScript,
  variantSource,
} from './testing/variants.js';
import type { StageEvent } from './types.js';
import { readVariantSets, settleInterruptedVariants } from './variants/current.js';
import { updateVariantSet } from './variants/store.js';

const projects = new TestProjects();
const harnesses: FakeClaudeHarness[] = [];
afterEach(async () => {
  await Promise.all(harnesses.splice(0).map((harness) => harness.dispose()));
});
afterAll(() => {
  projects.dispose();
});

/** fake-claude's `rate-limit` reset time (epoch s). */
const FAKE_RESETS_AT = 1_790_902_800;

describe('shot variants: resilience', { timeout: 120_000 }, () => {
  it('pauses on a usage limit and resumes the variant builds', async () => {
    const clock = new ManualClock((FAKE_RESETS_AT - 3600) * 1000);
    const { dir, shot, harness, runner } = await setupVariants(
      projects,
      harnesses,
      'limit',
      (target) => [
        variantRule(target, 1, variantSource(target, 1)),
        { scenario: 'rate-limit', promptIncludes: 'Write `.variants/s02/v2.js`' },
      ],
      clock,
    );
    const paused = new Promise<void>((resolve) => {
      const listener = (event: StageEvent): void => {
        if (event.type !== 'paused') return;
        runner.off('event', listener);
        resolve();
      };
      runner.on('event', listener);
    });
    const running = runner.run(generateRequest(shot.id, 2));
    await paused;
    const state = await new PipelineStateStore().read(dir);
    expect(state.ok && state.value.stages['scenes']?.status).toBe('paused');
    harness.setScript(
      variantScript([
        variantRule(shot, 1, variantSource(shot, 1)),
        variantRule(shot, 2, variantSource(shot, 2)),
      ]),
    );
    clock.advance(2 * 3600 * 1000);
    const result = await running;
    expect(result.ok && result.value.message).toBe('s02: 2 variants ready');
    expect(result.ok && result.value.usage?.limitHits).toBe(1);
    expect(readVariantSetFile(dir, shot.id).variants.map((variant) => variant.status)).toEqual([
      'ready',
      'ready',
    ]);
  });

  it('drops variants a closed app left building, removes sets without a ready one', async () => {
    const { dir, shot, runner } = await setupVariants(projects, harnesses, 'settle', (target) => [
      variantRule(target, 1, variantSource(target, 1)),
      variantRule(target, 2, variantSource(target, 2)),
    ]);
    expect((await runner.run(generateRequest(shot.id, 2))).ok).toBe(true);
    // As if the app closed while variant 2 was being rebuilt.
    const marked = await updateVariantSet(dir, shot.id, (current) => {
      if (current === undefined) throw new Error('no set');
      return {
        ...current,
        variants: current.variants.map((variant) =>
          variant.index === 2 ? { ...variant, status: 'building' as const } : variant,
        ),
      };
    });
    expect(marked.ok).toBe(true);
    const settled = await settleInterruptedVariants(dir, new Date());
    expect(settled.ok && settled.value).toEqual(['s02']);
    const set = readVariantSetFile(dir, shot.id);
    expect(set.variants.map((variant) => [variant.status, variant.reason ?? null])).toEqual([
      ['ready', null],
      ['dropped', 'interrupted (the app closed while it was building)'],
    ]);
    const all = await updateVariantSet(dir, shot.id, (current) => ({
      ...(current ?? set),
      variants: (current ?? set).variants.map((variant) => ({
        ...variant,
        status: 'building' as const,
      })),
    }));
    expect(all.ok).toBe(true);
    expect((await settleInterruptedVariants(dir, new Date())).ok).toBe(true);
    expect(existsSync(path.join(dir, '.reelforge', 'variants', 's02'))).toBe(false);
  });

  it('removes the variants of a shot that left the storyboard', async () => {
    const { dir, shot, runner } = await setupVariants(projects, harnesses, 'orphan', (target) => [
      variantRule(target, 1, variantSource(target, 1)),
      variantRule(target, 2, variantSource(target, 2)),
    ]);
    expect((await runner.run(generateRequest(shot.id, 2))).ok).toBe(true);
    const kept = filmShots(3).filter((entry) => entry.id !== shot.id);
    writeFileSync(path.join(dir, 'storyboard.json'), JSON.stringify(filmStoryboard(kept)));
    const sets = await readVariantSets(dir);
    expect(sets.ok && sets.value).toEqual({ sets: [], removed: ['s02'] });
    expect(existsSync(path.join(dir, '.reelforge', 'variants', 's02'))).toBe(false);
  });
});
