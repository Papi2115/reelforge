import type { ScenesReport, StoryboardShot, SyncReport } from '@reelforge/shared';
import { describe, expect, it } from 'vitest';
import type { StageRunView } from '../../shared/stages-contract.js';
import {
  buildProgress,
  buildProgressView,
  builtShotIds,
  findingLabel,
  findingText,
  fixPrompt,
  joinBanners,
  missingBadgeLabel,
  propsBanner,
  propsSummary,
  rolesBanner,
  scenesTotals,
  shotBadges,
  stepText,
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

  it('reads built scenes from the files when the scenes report is missing', () => {
    const shots = ['s01', 's02', 's03'].map((id): StoryboardShot => ({
      id,
      t0: 0,
      t1: 1,
      treatment: 'title-card',
      intent: 'x',
      scene: `scenes/${id}.js`,
    }));
    const built = builtShotIds(shots, ['scenes/s01.js', 'scenes/s02.js', 'storyboard.json']);
    expect([...built]).toEqual(['s01', 's02']);
    expect(missingBadgeLabel('s01', built)).toBe('Not checked');
    expect(missingBadgeLabel('s03', built)).toBe('Not built yet');
    expect(scenesTotals(null, built)).toEqual({
      kind: 'unchecked',
      text: '2 scenes built · not checked yet',
    });
    expect(scenesTotals(null, new Set(['s01']))).toMatchObject({
      text: '1 scene built · not checked yet',
    });
    expect(scenesTotals(null, new Set())).toEqual({ kind: 'none' });
    expect(scenesTotals({ ...REPORT, shots: [] }, new Set())).toEqual({ kind: 'none' });
  });

  it('counts checked shots and the built ones the report does not know yet', () => {
    expect(scenesTotals(REPORT, new Set(['s01', 's02', 's03']))).toEqual({
      kind: 'checked',
      ok: 1,
      warning: 1,
      failed: 0,
      checked: 2,
      unchecked: 1,
    });
    expect(scenesTotals(REPORT, new Set())).toMatchObject({ checked: 2, unchecked: 0 });
  });

  it('says anti-slop findings in plain words', () => {
    const slop = {
      source: 'slop',
      severity: 'warning',
      fatal: false,
      message: 'invented text: "ZORP" (scenes/s01.js:4: zorp)',
    } as const;
    expect(findingText(slop)).toBe('Looks generic: invented text: "ZORP" (scenes/s01.js:4: zorp)');
    expect(findingText({ ...slop, t: 2 })).toMatch(/^Looks generic @2.0 s: invented text/);
    expect(findingLabel('lint')).toBe('lint');
    const report: ScenesReport = {
      ...REPORT,
      shots: REPORT.shots.map((shot) => ({ ...shot, findings: [slop] })),
    };
    expect(shotBadges(report, null).get('s02')?.findings).toEqual([findingText(slop)]);
  });

  it('prefills the chat with the findings of a shot', () => {
    expect(fixPrompt('s02', shotBadges(REPORT, null).get('s02'))).toBe(
      'Fix shot s02. QA found:\n- cards @1.3 s: title clipped\n- clipped: title cut at the right edge',
    );
    expect(fixPrompt('s09', undefined)).toBe('Shot s09 needs a fix: ');
  });

  it('shows the build progress as shot n of m with the current step in plain words', () => {
    expect(buildProgress(run({ shots: { s01: 'ok', s02: 'running' } }), 8)).toBe(
      'Building · shot 2 of 8 · building the scene',
    );
    expect(buildProgress(run({ targets: ['s05'], action: 'sync-check', label: null }), 8)).toBe(
      'Reviewing · shot 1 of 1 · starting',
    );
    expect(buildProgress(null, 8)).toBeNull();
  });

  it('keeps the step out of the title, so the progress never says it twice', () => {
    const view = buildProgressView(
      run({ shots: { s01: 'ok', s02: 'ok', s03: 'running' }, label: 'Claude: critic s03' }),
      16,
    );
    expect(view).toEqual({
      title: 'Shot 3 of 16',
      step: 'Claude checks the frames',
      what: 'Building',
      percent: 12.5,
    });
    expect(view?.title).not.toContain(view?.step ?? '');
  });

  it('says runner steps in plain words', () => {
    expect(stepText('Claude: scene-build s01_hook')).toBe('Claude writes the scene');
    expect(stepText('s03: QA build round 2')).toBe('checking frames (round 2)');
    expect(stepText('Claude: review plan')).toBe('Claude: review plan');
    expect(stepText(null)).toBe('starting');
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

  it('says which project roles were built, with warnings, and which could not be built', () => {
    const role = {
      file: 'characters/roles/x.json',
      description: 'x',
      shots: ['s01'],
      attempts: 1,
      accessories: [],
      findings: [],
      notes: [],
      updatedAt: STAMP,
    };
    const report = {
      version: 1 as const,
      updatedAt: STAMP,
      roles: [
        { ...role, id: 'firefighter', status: 'built' as const },
        { ...role, id: 'pilot', status: 'failed' as const },
        { ...role, id: 'chef', status: 'warning' as const },
      ],
    };
    expect(rolesBanner(report)).toBe(
      'Built 2 new roles: chef, firefighter (⚠ chef) · Could not build: pilot — its shots use a cast member',
    );
    expect(rolesBanner(null)).toBeNull();
    expect(joinBanners('Built 1 new prop: fridge', null, rolesBanner(report))).toMatch(
      /^Built 1 new prop: fridge · Built 2 new roles/,
    );
    expect(joinBanners(null, null)).toBeNull();
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
