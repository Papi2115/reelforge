import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { UsageFile, UsageTotals } from '@reelforge/shared';
import { emptyUsageTotals } from '@reelforge/shared';
import { afterAll, describe, expect, it } from 'vitest';
import { VARIANT_DIRECTIONS, directionById, pickDirections } from './directions.js';
import { DEFAULT_BUILD_TURN_S, averageTurnSeconds, estimateVariants } from './estimate.js';
import { excludeVariantWork, sameBase, variantBase, variantWorkFile } from './store.js';

const root = mkdtempSync(path.join(os.tmpdir(), 'rf variants '));
afterAll(() => {
  rmSync(root, { recursive: true, force: true });
});

describe('variant directions', () => {
  it('is a library of distinct, documented directions', () => {
    expect(VARIANT_DIRECTIONS.length).toBeGreaterThanOrEqual(6);
    expect(VARIANT_DIRECTIONS.length).toBeLessThanOrEqual(8);
    expect(new Set(VARIANT_DIRECTIONS.map((direction) => direction.id)).size).toBe(
      VARIANT_DIRECTIONS.length,
    );
    for (const direction of VARIANT_DIRECTIONS) {
      expect(direction.brief.length).toBeGreaterThan(60);
      expect(directionById(direction.id)).toBe(direction);
    }
  });

  it('picks consecutive directions per round, deterministically, wrapping around', () => {
    const ids = (count: number, round: number): string[] =>
      pickDirections(count, round).map((direction) => direction.id);
    expect(ids(3, 0)).toEqual(['hero-push', 'orbit-depth', 'kinetic-text']);
    expect(ids(3, 0)).toEqual(ids(3, 0));
    expect(ids(3, 1)).toEqual(['diorama-wide', 'macro-reveal', 'build-up']);
    expect(ids(3, 2)).toEqual(['contrast', 'low-dramatic', 'hero-push']);
    expect(ids(2, 1)).toEqual(['kinetic-text', 'diorama-wide']);
    expect(new Set(ids(3, 5)).size).toBe(3);
    expect(pickDirections(3, 0, [])).toEqual([]);
  });
});

describe('variant work files', () => {
  it('builds in a work folder outside .reelforge (the runtime Claude cannot write there)', () => {
    expect(variantWorkFile('s03', 2)).toBe('.variants/s03/v2.js');
  });

  it('excludes the work folder from git once (local exclude file)', async () => {
    const dir = path.join(root, 'exclude');
    mkdirSync(path.join(dir, '.git', 'info'), { recursive: true });
    writeFileSync(path.join(dir, '.git', 'info', 'exclude'), '# local\n*.log');
    expect((await excludeVariantWork(dir)).ok).toBe(true);
    expect((await excludeVariantWork(dir)).ok).toBe(true);
    expect(readFileSync(path.join(dir, '.git', 'info', 'exclude'), 'utf8')).toBe(
      '# local\n*.log\n/.variants/\n',
    );
  });

  it('fingerprints the shot: a scene or storyboard change makes a set stale', async () => {
    const dir = path.join(root, 'base');
    mkdirSync(path.join(dir, 'scenes'), { recursive: true });
    const shot = {
      id: 's01',
      t0: 0,
      t1: 2,
      treatment: 'title-card' as const,
      intent: 'Hello',
      scene: 'scenes/s01.js',
    };
    const missing = await variantBase(dir, shot);
    expect(missing.ok && missing.value.sceneHash).toBe('');
    writeFileSync(path.join(dir, 'scenes', 's01.js'), 'export const meta = {};');
    const first = await variantBase(dir, shot);
    const same = await variantBase(dir, shot);
    const moved = await variantBase(dir, { ...shot, t1: 3 });
    if (!first.ok || !same.ok || !moved.ok) throw new Error('variantBase failed');
    expect(sameBase(first.value, same.value)).toBe(true);
    expect(sameBase(first.value, moved.value)).toBe(false);
    writeFileSync(path.join(dir, 'scenes', 's01.js'), 'export const meta = { id: 1 };');
    const edited = await variantBase(dir, shot);
    expect(edited.ok && sameBase(first.value, edited.value)).toBe(false);
  });
});

function totals(turns: number, seconds: number, failed = 0): UsageTotals {
  return { ...emptyUsageTotals(), turns, failedTurns: failed, durationMs: seconds * 1000 * turns };
}

function usage(stages: UsageFile['stages']): UsageFile {
  return {
    version: 1,
    updatedAt: '2026-10-03T10:00:00.000Z',
    totals: emptyUsageTotals(),
    stages,
    budgetWarnings: [],
  };
}

describe('variant estimate', () => {
  it('uses defaults before any scene was built', () => {
    const estimate = estimateVariants({
      count: 3,
      concurrency: 3,
      model: 'opus',
      usage: undefined,
    });
    expect(estimate).toMatchObject({
      turns: 3,
      fromHistory: false,
      buildTurnS: DEFAULT_BUILD_TURN_S,
    });
    expect(estimate.text).toBe('≈ 3 Opus turns, about 3–6 min');
  });

  it('uses the ledger averages and the concurrency', () => {
    const ledger = usage({
      'scene-build': { opus: totals(4, 60), sonnet: totals(2, 30) },
      critic: { haiku: totals(4, 15) },
    });
    expect(averageTurnSeconds(ledger, 'scene-build', 'opus')).toBe(60);
    expect(averageTurnSeconds(ledger, 'scene-build', 'haiku')).toBe(50);
    expect(averageTurnSeconds(ledger, 'storyboard')).toBeUndefined();
    const parallel = estimateVariants({ count: 3, concurrency: 3, model: 'opus', usage: ledger });
    expect(parallel.text).toBe('≈ 3 Opus turns, about 1–3 min');
    const serial = estimateVariants({ count: 2, concurrency: 1, model: 'sonnet', usage: ledger });
    expect(serial.text).toBe('≈ 2 Sonnet turns, about 2–3 min');
    expect(serial.fromHistory).toBe(true);
  });
});
