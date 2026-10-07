import type { ScenesReport, ShotBuildRecord, StoryboardShot } from '@reelforge/shared';
import { describe, expect, it } from 'vitest';
import { errorCause, needsFromReason, shotFailureCause } from './station-reasons.js';
import { sentence, stationFacts } from './stations-view.js';

const record = (shotId: string, patch: Partial<ShotBuildRecord> = {}): ShotBuildRecord => ({
  shotId,
  scene: `scenes/${shotId}.js`,
  status: 'ok',
  findings: [],
  fixIterations: 0,
  missingProps: [],
  critic: [],
  notes: [],
  updatedAt: '2026-10-06T10:00:00.000Z',
  ...patch,
});

describe('stationFacts', () => {
  const shot = (id: string): StoryboardShot => ({
    id,
    t0: 0,
    t1: 1,
    treatment: 'title-card',
    intent: 'x',
    scene: `scenes/${id}.js`,
  });

  it('counts planned, built, failed (with a plain cause) and missing scenes', () => {
    const report: ScenesReport = {
      version: 1,
      updatedAt: '2026-10-06T10:00:00.000Z',
      shots: [
        record('s01', {}),
        record('s02', { status: 'failed', critic: [{ verdict: 'blank', note: 'empty' }] }),
        record('s09', { status: 'failed' }),
      ],
    };
    const facts = stationFacts(report, ['s01', 's02', 's03'].map(shot), new Set(['s01', 's02']));
    expect(facts).toEqual({
      scenes: {
        planned: 3,
        built: 2,
        failed: [{ id: 's02', cause: 'blank frames' }],
        missing: ['s03'],
      },
    });
    expect(stationFacts(null, [], new Set())).toEqual({});
  });
});

describe('sentence', () => {
  it('joins parts as sentences and skips empty parts', () => {
    expect(sentence('6 of 7 scenes built', null, 'Retry s02')).toBe(
      '6 of 7 scenes built. Retry s02.',
    );
    expect(sentence('Starting…', undefined, '')).toBe('Starting…');
  });
});

describe('station reasons', () => {
  it('translates gating reasons into what the step needs, or nothing when unknown', () => {
    expect(needsFromReason('cues.json is missing: run Sound cues first.')).toBe(
      'Needs: the sound mix',
    );
    expect(needsFromReason('Words timed is out of date: run it again first.')).toBe(
      'Needs: timed words made again',
    );
    expect(needsFromReason('Something else.')).toBeUndefined();
  });

  it('names a plain cause for an error and keeps unknown kinds as their message', () => {
    expect(errorCause(null)).toBe('the last run stopped with an error');
    expect(errorCause({ kind: 'blocked', message: 'apiKeySource', issues: [] })).toBe(
      'Claude could not start (check the connection in Settings)',
    );
    expect(errorCause({ kind: 'invalid-input', message: 'Unsupported format', issues: [] })).toBe(
      'Unsupported format',
    );
  });

  it('says why a shot failed in plain words', () => {
    const fatal = { source: 'lint', severity: 'error', fatal: true, message: 'Date' } as const;
    expect(shotFailureCause(record('s01', { status: 'failed', findings: [fatal] }))).toBe(
      'the scene does not run',
    );
    expect(
      shotFailureCause(record('s02', { critic: [{ verdict: 'clipped', note: 'title' }] })),
    ).toBe('something is cut off');
    expect(shotFailureCause(record('s03', { missingProps: ['fridge'] }))).toBe('missing fridge');
    expect(shotFailureCause(record('s04'))).toBe('it did not pass the check');
  });
});
