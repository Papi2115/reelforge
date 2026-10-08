import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { shotLocksFileSchema } from '@reelforge/shared';
import { afterEach, describe, expect, it } from 'vitest';
import { followUpReview } from './stage-state.js';
import { lockCommitSubject, lockShots } from './shot-locks.js';

const temps: string[] = [];
afterEach(() => {
  for (const dir of temps.splice(0)) rmSync(dir, { recursive: true, force: true });
});

const NOW = new Date('2026-10-03T10:00:00.000Z');

describe('lockShots', () => {
  it('writes locks.json and commits "Lock shot …" / "Unlock shots …"', async () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), 'rf locks ż '));
    temps.push(dir);
    const commits: string[] = [];
    const committedPaths: (readonly string[])[] = [];
    const commit = (_dir: string, message: string, paths: readonly string[]): Promise<void> => {
      commits.push(message);
      committedPaths.push(paths);
      return Promise.resolve();
    };
    expect(
      await lockShots({ dir, shotIds: ['s03', 's01'], locked: true, now: NOW, commit }),
    ).toEqual({ status: 'ok', message: null });
    const read = (): unknown => JSON.parse(readFileSync(path.join(dir, 'locks.json'), 'utf8'));
    expect(shotLocksFileSchema.parse(read()).shots.map((entry) => entry.shotId)).toEqual([
      's01',
      's03',
    ]);
    await lockShots({ dir, shotIds: ['s03'], locked: false, now: NOW, commit });
    expect(shotLocksFileSchema.parse(read()).shots.map((entry) => entry.shotId)).toEqual(['s01']);
    expect(commits).toEqual(['Lock shots s03, s01', 'Unlock shot s03']);
    // A lock commits the locked scenes with locks.json (HEAD keeps them); an unlock only locks.json.
    expect(committedPaths).toEqual([
      ['locks.json', 'scenes/s01.js', 'scenes/s03.js'],
      ['locks.json'],
    ]);
    expect(lockCommitSubject(['s02'], true)).toBe('Lock shot s02');
  });

  it('needs an open project', async () => {
    const result = await lockShots({
      dir: undefined,
      shotIds: ['s01'],
      locked: true,
      now: NOW,
      commit: () => Promise.resolve(),
    });
    expect(result).toEqual({ status: 'error', message: 'No project is open.' });
  });
});

describe('followUpReview', () => {
  it('follows only a whole-film build, and only when the setting is on', () => {
    const review = { stage: 'scenes', action: 'final-review', trigger: 'auto' };
    expect(followUpReview({ stage: 'scenes' }, true)).toEqual(review);
    expect(followUpReview({ stage: 'scenes', action: 'build' }, true)).toEqual(review);
    expect(followUpReview({ stage: 'scenes' }, false)).toBeUndefined();
    expect(followUpReview({ stage: 'scenes', shots: ['s01'] }, true)).toBeUndefined();
    expect(followUpReview({ stage: 'scenes', action: 'sync-check' }, true)).toBeUndefined();
    expect(followUpReview({ stage: 'scenes', action: 'final-review' }, true)).toBeUndefined();
    expect(followUpReview({ stage: 'mix' }, true)).toBeUndefined();
  });
});
