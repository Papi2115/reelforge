import type { BeatSyncReport, RepetitionItem, RepetitionsFile } from '@reelforge/shared';
import { DEFAULT_REPETITION_THRESHOLDS } from '@reelforge/shared';
import { describe, expect, it } from 'vitest';
import type { EditingState } from '../../shared/editing-contract.js';
import { beatSyncLine, editingVisible, repetitionRows, repetitionSummary } from './editing-view.js';

const REPORT: BeatSyncReport = {
  version: 1,
  frameS: 0.0333,
  cuts: { total: 20, onGrid: 19, fraction: 0.95 },
  nudges: { moved: 7, locked: 2, kept: 1, meanMs: 41.2, maxMs: 96.4, reverted: false },
  whooshes: { total: 8, inWindow: 8, fraction: 1, windowS: 0.12 },
  cues: { snapped: 3 },
  ok: true,
};

function item(overrides: Partial<RepetitionItem>): RepetitionItem {
  return {
    id: 'sfx:whoosh@20.00',
    kind: 'sfx',
    severity: 'warning',
    subject: 'whoosh',
    text: 'whoosh 4× in 20.0 s–41.0 s',
    occurrences: [
      { t: 20, shotId: 's06', cueId: 'sfx-01' },
      { t: 27, shotId: 's07', cueId: 'sfx-03' },
    ],
    action: 'sfx',
    changes: [{ target: 'sfx-03', from: 'whoosh', to: 'swoosh-in' }],
    locked: false,
    status: 'open',
    ...overrides,
  };
}

function file(items: RepetitionItem[]): RepetitionsFile {
  return {
    version: 1,
    thresholds: DEFAULT_REPETITION_THRESHOLDS,
    items,
    counts: { visual: 0, template: 0, transition: 0, sfx: 0, phrase: 0, open: 0 },
  };
}

describe('editing view', () => {
  it('is visible only when a switch is on', () => {
    const off: EditingState = {
      status: 'ok',
      switches: { beatSync: 'off', repetitionControl: 'off' },
      beatSync: null,
      repetitions: null,
    };
    expect(editingVisible(off)).toBe(false);
    expect(
      editingVisible({ ...off, switches: { beatSync: 'auto', repetitionControl: 'off' } }),
    ).toBe(true);
    expect(editingVisible({ status: 'error', message: 'x' })).toBe(false);
    expect(editingVisible(undefined)).toBe(false);
  });

  it('summarises beat sync with ✓ / ⚠', () => {
    expect(beatSyncLine(REPORT)).toBe(
      'Beat sync ✓ 95 % of cuts on the beat (±1 frame) · whooshes 100 % · 7 cuts moved (≤ 96 ms) · 2 by locked shots',
    );
    expect(
      beatSyncLine({ ...REPORT, ok: false, cuts: { total: 10, onGrid: 6, fraction: 0.6 } }),
    ).toMatch(/^Beat sync ⚠ 60 %/);
    expect(beatSyncLine(null)).toContain('not measured yet');
  });

  it('lists repetitions with what Apply does', () => {
    const items = [
      item({}),
      item({
        id: 'phrase:the old engine@1.00',
        kind: 'phrase',
        severity: 'info',
        action: 'none',
        changes: [],
        text: '"the old engine" 3×',
      }),
      item({ id: 'visual:x@8.00', kind: 'visual', action: 'variant', changes: [], locked: true }),
      item({
        id: 'transition:pixel-wipe@24.00',
        kind: 'transition',
        action: 'transition',
        status: 'ignored',
      }),
    ];
    const rows = repetitionRows(file(items));
    expect(
      rows.map((row) => [row.kind, row.symbol, row.applyLabel, row.canApply, row.detail]),
    ).toEqual([
      ['Sound', '⚠', 'Swap sound', true, 'whoosh → swoosh-in (1)'],
      ['Phrase', 'ℹ', null, false, 'report only'],
      ['Visual', '⚠', 'Build variants', false, 'locked shots: nothing to change'],
      ['Transition', '✓', 'Re-pick transition', false, 'ignored'],
    ]);
    expect(rows[0]).toMatchObject({ shotId: 's06', t: 20, ignored: false });
    expect(rows[3]?.ignored).toBe(true);
    expect(repetitionSummary(file(items))).toBe('Repetition ⚠ 3 open: 1 visual, 1 sound, 1 phrase');
    expect(repetitionSummary(file([]))).toBe('Repetition ✓ nothing repeats too often');
    expect(repetitionSummary(null)).toContain('not analysed yet');
  });
});
