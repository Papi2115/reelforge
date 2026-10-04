/** View model of the Dramaturgy section (PLAN.md#12.25–12.27). */
import type { DramaturgyReport, Moment } from '@reelforge/shared';
import { describe, expect, it } from 'vitest';
import type { DramaturgyState } from '../../shared/dramaturgy-contract.js';
import {
  dramaturgyKey,
  dramaturgyVisible,
  interruptLine,
  interruptRows,
  loopLines,
  momentRows,
} from './dramaturgy-view.js';

const REPORT: DramaturgyReport = {
  version: 1,
  createdAt: '2026-10-04T10:00:00.000Z',
  source: 'final-review',
  interrupts: {
    version: 1,
    durationS: 100,
    planned: 2,
    realised: 1,
    range: { min: 1, max: 4 },
    perMinute: [
      { minute: 0, planned: 1, realised: 1 },
      { minute: 1, planned: 1, realised: 0 },
    ],
    shots: [
      {
        shotId: 's02',
        t: 20,
        kind: 'enter-screen',
        note: 'into the CRT',
        realisedBy: 'transition crt-zoom',
      },
      { shotId: 's05', t: 70, kind: 'scale-shift', note: 'the room shrinks', realisedBy: null },
    ],
  },
  loops: { count: 2, open: 1, warnings: ['⚠ loop x "why?" is never closed (planned at 50.0 s)'] },
};

const MOMENT: Moment = {
  id: 'slow-motion-s04-51600',
  kind: 'slow-motion',
  shotId: 's04',
  at: 51.6,
  word: 'forever.',
  tension: 0.92,
  from: 51.6,
  to: 53.1,
  rate: 0.4,
  cameraHint: 'a slow orbit',
  status: 'proposed',
};

const OFF = { patternInterrupts: 'off', openLoops: 'off', revealMoments: 'off' } as const;

describe('dramaturgy view', () => {
  it('shows only with a switch on', () => {
    const base: DramaturgyState = {
      status: 'ok',
      switches: OFF,
      report: null,
      moments: [],
      momentsNote: null,
    };
    expect(dramaturgyVisible(base)).toBe(false);
    expect(dramaturgyVisible({ ...base, switches: { ...OFF, openLoops: 'auto' } })).toBe(true);
    expect(dramaturgyVisible({ status: 'error', message: 'x' })).toBe(false);
    expect(dramaturgyVisible(undefined)).toBe(false);
  });

  it('summarises interrupts per minute and marks the unrealised one', () => {
    expect(interruptLine(REPORT)).toBe('2 planned, 1 in the frames (0:00 1/1 · 1:00 0/1)');
    expect(interruptRows(REPORT).map((row) => row.symbol)).toEqual(['✓', '⚠']);
    expect(interruptRows(REPORT)[0]?.text).toBe(
      '0:20 enter-screen: into the CRT (transition crt-zoom)',
    );
    expect(interruptLine({ ...REPORT, source: 'storyboard' })).toContain('not built yet');
    expect(interruptLine(null)).toContain('No interrupt report yet');
  });

  it('lists loop warnings or a reassuring line', () => {
    expect(loopLines(REPORT)).toEqual(REPORT.loops?.warnings);
    expect(loopLines({ ...REPORT, loops: { count: 2, open: 0, warnings: [] } })).toEqual([
      '2 open loops, all closed with a foreshadow.',
    ]);
  });

  it('builds moment rows: accept disabled on a locked shot, preview a second before', () => {
    const [row] = momentRows([{ moment: MOMENT, locked: false }]);
    expect(row).toMatchObject({
      title: 'Slow motion on “forever.” · 0:52 · s04',
      statusLabel: 'proposed',
      canAccept: true,
      canReject: true,
      acceptNote: null,
    });
    expect(row?.seekT).toBeCloseTo(50.6, 9);
    expect(row?.detail).toContain('shows in the preview and the export');
    const [locked] = momentRows([{ moment: { ...MOMENT, kind: 'silence-hit' }, locked: true }]);
    expect(locked).toMatchObject({
      canAccept: false,
      acceptNote: 's04 is locked: unlock it to accept',
    });
    expect(locked?.detail).toContain('next Sound design mix');
    const [accepted] = momentRows([{ moment: { ...MOMENT, status: 'accepted' }, locked: false }]);
    expect(accepted?.canAccept).toBe(false);
  });

  it('keys the refresh by its parts', () => {
    expect(dramaturgyKey(['a', undefined, 3])).toBe('a||3');
  });
});
