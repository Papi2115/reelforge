import type { FinalReview, QaFinding, ScenesReport, StoryboardShot } from '@reelforge/shared';
import { describe, expect, it } from 'vitest';
import type { StageRunView } from '../../shared/stages-contract.js';
import { exportPreflight, finalReviewProgress, finalReviewSummary } from './final-review-view.js';
import {
  isLockShortcut,
  lockableOkShots,
  lockedLengthChanges,
  lockedLengthQuestion,
  lockedShotSet,
  outOfSyncLocked,
} from './locks-view.js';
import type { ShotBadge } from './scenes-view.js';

const STAMP = '2026-10-03T10:00:00.000Z';
const LATER = '2026-10-03T11:00:00.000Z';

const shots: StoryboardShot[] = ['s01', 's02', 's03', 's04'].map((id, index) => ({
  id,
  t0: index * 2,
  t1: index * 2 + 2,
  treatment: 'title-card',
  intent: `shot ${id}`,
  scene: `scenes/${id}.js`,
}));

const finding = (source: QaFinding['source'], message: string, fatal = false): QaFinding => ({
  source,
  severity: 'warning',
  fatal,
  message,
});

const review: FinalReview = {
  version: 1,
  trigger: 'auto',
  startedAt: STAMP,
  finishedAt: STAMP,
  shots: [
    { shotId: 's01', status: 'ok', findings: [], autoFixed: true, locked: false, outOfSync: false },
    {
      shotId: 's02',
      status: 'warning',
      findings: [finding('legibility', 'text too small'), finding('cards', 'overlap')],
      autoFixed: false,
      locked: false,
      outOfSync: false,
    },
    { shotId: 's03', status: 'ok', findings: [], autoFixed: false, locked: true, outOfSync: true },
    {
      shotId: 's04',
      status: 'failed',
      findings: [finding('runtime', 'the scene fails: boom', true)],
      autoFixed: false,
      locked: false,
      outOfSync: false,
    },
  ],
  counts: { ok: 2, warning: 1, failed: 1, locked: 1, fixed: 1 },
  notes: [],
};

describe('final review view', () => {
  it('summarises the review and its progress', () => {
    expect(finalReviewSummary(review)).toBe('Review done: 2 ✓, 1 ⚠, 1 ✗ · fixed 1 · 1 locked');
    expect(finalReviewSummary(null)).toBeNull();
    const running = { stage: 'scenes', action: 'final-review', label: 'Reviewing… 7/16' };
    expect(finalReviewProgress(running as StageRunView)).toBe('Reviewing… 7/16');
    expect(finalReviewProgress({ ...running, action: null } as StageRunView)).toBeNull();
  });

  it('lists ⚠/✗ shots before the export; a scene that cannot render blocks it', () => {
    const preflight = exportPreflight(review, null, shots);
    expect(
      preflight.items.map((item) => [item.shotId, item.symbol, item.t, item.blocking]),
    ).toEqual([
      ['s02', '⚠', 2, false],
      ['s03', '⚠', 4, false],
      ['s04', '✗', 6, true],
    ]);
    expect(preflight.items[0]?.text).toBe('legibility: text too small (+1 more)');
    expect(preflight.items[1]).toMatchObject({
      locked: true,
      text: 'locked, may be out of sync with the voice-over',
    });
    expect(preflight.blocker).toBe('s04 cannot render: rebuild or fix it first.');
  });

  it('prefers a newer scenes-report result and works without a review', () => {
    const scenes: ScenesReport = {
      version: 1,
      updatedAt: LATER,
      shots: [
        {
          shotId: 's04',
          scene: 'scenes/s04.js',
          status: 'ok',
          findings: [],
          fixIterations: 0,
          missingProps: [],
          critic: [],
          notes: [],
          updatedAt: LATER,
        },
      ],
    };
    expect(exportPreflight(review, scenes, shots).blocker).toBeNull();
    const without = exportPreflight(null, scenes, shots);
    expect(without.items).toEqual([]);
    expect(without.summary).toBe('No final review yet (Scenes panel → Run final review).');
  });
});

describe('locks view', () => {
  const badge = (tone: ShotBadge['tone']): ShotBadge => ({
    tone,
    symbol: '',
    label: '',
    findings: [],
    critic: [],
    missingProps: [],
    builtProps: [],
    notes: [],
  });

  it('reads the locked set and offers the unlocked ✓ shots for "Lock all ✓"', () => {
    const locked = lockedShotSet({
      status: 'ok',
      data: { version: 1, shots: [{ shotId: 's01', lockedAt: STAMP }] },
    });
    expect([...locked]).toEqual(['s01']);
    expect(lockedShotSet({ status: 'missing' }).size).toBe(0);
    const badges = new Map([
      ['s01', badge('ok')],
      ['s02', badge('ok')],
      ['s03', badge('warning')],
    ]);
    expect(lockableOkShots(shots, badges, locked)).toEqual(['s02']);
  });

  it('flags locked shots whose words moved', () => {
    const locked = new Set(['s03', 's01']);
    expect([...outOfSyncLocked(locked, null, review)]).toEqual(['s03']);
  });

  it('Shift+L outside text fields is the lock shortcut', () => {
    const key = {
      key: 'L',
      shiftKey: true,
      ctrlKey: false,
      altKey: false,
      metaKey: false,
      repeat: false,
      target: { tagName: 'DIV', contentEditable: false },
    };
    expect(isLockShortcut(key)).toBe(true);
    expect(isLockShortcut({ ...key, shiftKey: false })).toBe(false);
    expect(
      isLockShortcut({ ...key, target: { tagName: 'TEXTAREA', contentEditable: false } }),
    ).toBe(false);
  });

  it('asks before a boundary move changes a locked shot’s length', () => {
    const locked = new Set(['s02']);
    const move = { kind: 'move-boundary', left: 's01', right: 's02', from: 2, to: 2.4 } as const;
    expect(lockedLengthChanges({ file: 'storyboard', edits: [move] }, locked)).toEqual(['s02']);
    expect(
      lockedLengthChanges({ file: 'storyboard', edits: [{ ...move, to: 2 }] }, locked),
    ).toEqual([]);
    expect(lockedLengthQuestion(['s02'])).toBe(
      'Shot s02 is locked: change its length anyway? Its scene stays as it is.',
    );
  });
});
