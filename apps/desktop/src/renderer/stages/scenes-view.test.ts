import type { ScenesReport, SyncReport } from '@reelforge/shared';
import { describe, expect, it } from 'vitest';
import type { StageRunView } from '../../shared/stages-contract.js';
import {
  buildProgress,
  fixPrompt,
  propsBanner,
  propsSummary,
  shotBadges,
  syncProblemShots,
  syncRows,
} from './scenes-view.js';

const STAMP = '2026-10-02T10:00:00.000Z';

const REPORT: ScenesReport = {
  version: 1,
  updatedAt: STAMP,
  shots: [
    {
      shotId: 's01',
      scene: 'scenes/s01.js',
      status: 'ok',
      findings: [],
      fixIterations: 0,
      missingProps: [],
      critic: [{ verdict: 'ok', note: '' }],
      notes: [],
      updatedAt: STAMP,
    },
    {
      shotId: 's02',
      scene: 'scenes/s02.js',
      status: 'warning',
      findings: [
        { source: 'cards', severity: 'warning', fatal: false, message: 'title clipped', t: 1.25 },
      ],
      fixIterations: 2,
      missingProps: ['prism'],
      critic: [{ verdict: 'clipped', note: 'title cut at the right edge' }],
      notes: [],
      updatedAt: STAMP,
    },
  ],
};

function run(patch: Partial<StageRunView>): StageRunView {
  return {
    stage: 'scenes',
    label: 's03: building the scene',
    percent: null,
    startedAt: 0,
    steps: [],
    paused: null,
    action: null,
    targets: null,
    shots: {},
    ...patch,
  };
}

describe('scenes view', () => {
  it('badges every shot from the report and the live run', () => {
    const badges = shotBadges(
      REPORT,
      run({ shots: { s01: 'ok', s03: 'running', s04: 'requeued' } }),
    );
    expect(badges.get('s01')).toMatchObject({ tone: 'ok', symbol: '✓', critic: [] });
    expect(badges.get('s02')).toMatchObject({
      tone: 'warning',
      symbol: '⚠',
      findings: ['cards @1.3 s: title clipped'],
      critic: ['clipped: title cut at the right edge'],
      missingProps: ['prism'],
    });
    expect(badges.get('s03')?.tone).toBe('running');
    expect(badges.get('s04')?.tone).toBe('pending');
    expect(shotBadges(null, null).size).toBe(0);
  });

  it('prefills the chat with the findings of a shot', () => {
    expect(fixPrompt('s02', shotBadges(REPORT, null).get('s02'))).toBe(
      'Fix shot s02. QA found:\n- cards @1.3 s: title clipped\n- clipped: title cut at the right edge',
    );
    expect(fixPrompt('s09', undefined)).toBe('Shot s09 needs a fix: ');
  });

  it('shows the build progress as shot n/m with the current step', () => {
    expect(buildProgress(run({ shots: { s01: 'ok', s02: 'running' } }), 8)).toBe(
      'Building shot 2/8 · s03: building the scene',
    );
    expect(buildProgress(run({ targets: ['s05'], action: 'sync-check', label: null }), 8)).toBe(
      'Reviewing shot 1/1',
    );
    expect(buildProgress(null, 8)).toBeNull();
  });

  it('says which project props were built and which could not be built', () => {
    const record = {
      file: 'kit-ext/props/x.js',
      description: 'x',
      shots: ['s01'],
      attempts: 1,
      findings: [],
      notes: [],
      updatedAt: STAMP,
    };
    const summary = propsSummary(REPORT, {
      version: 1,
      updatedAt: STAMP,
      props: [
        { ...record, name: 'fridge', status: 'built' },
        { ...record, name: 'abacus', status: 'failed' },
        { ...record, name: 'printer', status: 'built' },
      ],
    });
    expect(summary).toEqual({ built: ['fridge', 'printer'], failed: ['abacus', 'prism'] });
    expect(propsBanner(summary)).toBe(
      'Built 2 new props: fridge, printer · Could not build: abacus, prism — their shots use a fallback',
    );
    expect(propsBanner({ built: ['fridge'], failed: [] })).toBe('Built 1 new prop: fridge');
    expect(propsBanner(propsSummary(null, null))).toBeNull();
    expect(shotBadges(REPORT, null).get('s01')?.builtProps).toEqual([]);
  });

  it('turns the sync report into rows with signed deltas and the ±150 ms verdict', () => {
    const report: SyncReport = {
      version: 1,
      createdAt: STAMP,
      toleranceMs: 150,
      shots: [
        {
          shotId: 's01',
          t0: 0,
          t1: 2,
          events: [
            {
              kind: 'anchor',
              label: 'one lands',
              t: 0.6,
              spokenT: 0.6,
              phrase: 'one lands',
              deltaMs: 0,
              verdict: 'ok',
            },
            {
              kind: 'sfx',
              label: 'hit',
              t: 1,
              spokenT: 0.6,
              phrase: 'one lands',
              deltaMs: 400,
              verdict: 'off',
            },
          ],
          problems: 1,
          maxDeltaMs: 400,
        },
        {
          shotId: 's02',
          t0: 2,
          t1: 4,
          events: [],
          problems: 0,
          maxDeltaMs: null,
          error: 'build() threw',
        },
      ],
      summary: { shots: 2, events: 2, ok: 1, problems: 1, failedShots: 1 },
    };
    const rows = syncRows(report);
    expect(rows.map((row) => [row.shotId, row.delta, row.tone, row.verdict])).toEqual([
      ['s01', '±0 ms', 'ok', 'within ±150 ms'],
      ['s01', '+400 ms', 'off', 'off (over ±150 ms)'],
      ['s02', '—', 'off', 'not loaded'],
    ]);
    expect(rows[1]).toMatchObject({ t: 1, what: 'sfx “hit” → “one lands”' });
    expect(syncProblemShots(report)).toEqual(['s01']);
    expect(syncRows(null)).toEqual([]);
  });
});
