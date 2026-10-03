import { describe, expect, it } from 'vitest';
import {
  applyAppSettingsPatch,
  defaultAppSettings,
  emptyShotLocks,
  finalReviewSchema,
  lockedShotIds,
  shotLocksFileSchema,
  withShotsLocked,
} from './index.js';

const STAMP = '2026-10-03T10:00:00.000Z';

describe('shot locks (locks.json)', () => {
  it('locks and unlocks shots, sorted, keeping the first lock time', () => {
    const first = withShotsLocked(emptyShotLocks(), ['s03', 's01'], true, new Date(STAMP));
    expect(first.shots.map((entry) => entry.shotId)).toEqual(['s01', 's03']);
    const later = withShotsLocked(first, ['s01', 's02'], true, new Date('2026-10-04T00:00:00Z'));
    expect(later.shots).toEqual([
      { shotId: 's01', lockedAt: STAMP },
      { shotId: 's02', lockedAt: '2026-10-04T00:00:00.000Z' },
      { shotId: 's03', lockedAt: STAMP },
    ]);
    const unlocked = withShotsLocked(later, ['s02', 's09'], false, new Date(STAMP));
    expect([...lockedShotIds(unlocked)]).toEqual(['s01', 's03']);
    expect(shotLocksFileSchema.safeParse(unlocked).success).toBe(true);
  });

  it('rejects other versions and invalid shot ids', () => {
    expect(shotLocksFileSchema.safeParse({ version: 2, shots: [] }).success).toBe(false);
    expect(
      shotLocksFileSchema.safeParse({ version: 1, shots: [{ shotId: 'S 1', lockedAt: STAMP }] })
        .success,
    ).toBe(false);
    expect(lockedShotIds(undefined).size).toBe(0);
  });
});

describe('final review (final-review.json)', () => {
  it('accepts a review with a fixed, a warned and a locked shot', () => {
    const parsed = finalReviewSchema.safeParse({
      version: 1,
      trigger: 'auto',
      startedAt: STAMP,
      finishedAt: STAMP,
      shots: [
        {
          shotId: 's01',
          status: 'ok',
          findings: [],
          autoFixed: true,
          locked: false,
          outOfSync: false,
        },
        {
          shotId: 's02',
          status: 'warning',
          findings: [{ source: 'legibility', severity: 'warning', fatal: false, message: 'small' }],
          autoFixed: false,
          locked: false,
          outOfSync: false,
        },
        {
          shotId: 's03',
          status: 'ok',
          findings: [],
          autoFixed: false,
          locked: true,
          outOfSync: true,
        },
      ],
      counts: { ok: 2, warning: 1, failed: 0, locked: 1, fixed: 1 },
      notes: [],
    });
    expect(parsed.success).toBe(true);
  });

  it('rejects unknown triggers and negative counts', () => {
    const base = {
      version: 1,
      trigger: 'auto',
      startedAt: STAMP,
      finishedAt: STAMP,
      shots: [],
      counts: { ok: 0, warning: 0, failed: 0, locked: 0, fixed: 0 },
      notes: [],
    };
    expect(finalReviewSchema.safeParse({ ...base, trigger: 'nightly' }).success).toBe(false);
    expect(
      finalReviewSchema.safeParse({ ...base, counts: { ...base.counts, ok: -1 } }).success,
    ).toBe(false);
  });
});

describe('final review setting', () => {
  it('defaults to on and can be switched off by a patch', () => {
    const settings = defaultAppSettings();
    expect(settings.scenes.finalReview).toBe(true);
    expect(applyAppSettingsPatch(settings, { scenes: { finalReview: false } }).scenes).toEqual({
      finalReview: false,
    });
  });
});
