/** Tension panel view model (PLAN.md#12.22): geometry, snapping, point edits, labels, notices. */
import { describe, expect, it } from 'vitest';
import {
  addPoint,
  curvePath,
  movePoint,
  nudgePoint,
  pointText,
  presetPoints,
  removePoint,
  saveNotice,
  snapTime,
  snapTimes,
  sourceText,
  spanLabels,
  timeToX,
  valueToY,
  xToTime,
  yToValue,
  type TensionGeometry,
} from './tension-view.js';

const GEOMETRY: TensionGeometry = { width: 420, height: 120, durationS: 40, pad: 10 };
const POINTS = [
  { t: 0, v: 0.2 },
  { t: 20, v: 0.8 },
  { t: 40, v: 0.4 },
];
const SNAP = snapTimes(
  [{ t: 1.5 }, { t: 9.8 }, { t: 21.2 }],
  [
    { t0: 0, t1: 10 },
    { t0: 10, t1: 25 },
    { t0: 25, t1: 40 },
  ],
);

describe('geometry', () => {
  it('maps time and tension to pixels and back', () => {
    expect(timeToX(GEOMETRY, 0)).toBe(10);
    expect(timeToX(GEOMETRY, 40)).toBe(410);
    expect(xToTime(GEOMETRY, 210)).toBe(20);
    expect(xToTime(GEOMETRY, -50)).toBe(0);
    expect(valueToY(GEOMETRY, 1)).toBe(10);
    expect(valueToY(GEOMETRY, 0)).toBe(110);
    expect(yToValue(GEOMETRY, 60)).toBe(0.5);
    expect(yToValue(GEOMETRY, 500)).toBe(0);
  });

  it('draws the curve flat to both edges', () => {
    expect(curvePath(POINTS, GEOMETRY)).toBe(
      'M10.0 90.0 L10.0 90.0 L210.0 30.0 L410.0 70.0 L410.0 70.0',
    );
    expect(curvePath([], GEOMETRY)).toBe('');
  });
});

describe('snapping and edits', () => {
  it('snaps to word starts and shot boundaries within the tolerance', () => {
    expect(SNAP).toEqual([0, 1.5, 9.8, 10, 21.2, 25, 40]);
    expect(snapTime(9.85, SNAP, 0.5)).toBe(9.8);
    expect(snapTime(10.05, SNAP, 0.5)).toBe(10);
    expect(snapTime(15, SNAP, 0.5)).toBe(15);
  });

  it('moves inner points between their neighbours; edge points keep their time', () => {
    const moved = movePoint(POINTS, 1, { t: 21, v: 0.95, snap: SNAP, snapToleranceS: 0.5 });
    expect(moved[1]).toEqual({ t: 21.2, v: 0.95 });
    const clamped = movePoint(POINTS, 1, { t: 60, v: 2, snap: [], snapToleranceS: 0 });
    expect(clamped[1]).toEqual({ t: 39.75, v: 1 });
    const edge = movePoint(POINTS, 0, { t: 12, v: 0.6, snap: [], snapToleranceS: 0 });
    expect(edge[0]).toEqual({ t: 0, v: 0.6 });
  });

  it('adds a point on the curve (not on top of another) and removes inner points only', () => {
    const added = addPoint(POINTS, 10);
    expect(added.index).toBe(1);
    expect(added.points[1]).toEqual({ t: 10, v: 0.5 });
    expect(addPoint(POINTS, 20.1).index).toBe(-1);
    expect(removePoint(added.points, 1)).toEqual(POINTS);
    expect(removePoint(POINTS, 0)).toEqual(POINTS);
    expect(removePoint(POINTS, 2)).toEqual(POINTS);
  });

  it('nudges with the keyboard: tension by steps, time to the next snap', () => {
    expect(nudgePoint(POINTS, 1, 'ArrowUp', false, SNAP)?.[1]).toEqual({ t: 20, v: 0.85 });
    expect(nudgePoint(POINTS, 1, 'ArrowDown', true, SNAP)?.[1]).toEqual({ t: 20, v: 0.79 });
    expect(nudgePoint(POINTS, 1, 'ArrowRight', false, SNAP)?.[1]).toEqual({ t: 21.2, v: 0.8 });
    expect(nudgePoint(POINTS, 1, 'ArrowLeft', false, SNAP)?.[1]).toEqual({ t: 10, v: 0.8 });
    expect(nudgePoint(POINTS, 1, 'ArrowLeft', true, SNAP)?.[1]).toEqual({ t: 19.9, v: 0.8 });
    expect(nudgePoint(POINTS, 1, 'a', false, SNAP)).toBeUndefined();
  });
});

describe('labels and copy', () => {
  it('builds presets over the film and a target label per segment', () => {
    const three = presetPoints('three-act', 40);
    expect(three[0]?.t).toBe(0);
    expect(three.at(-1)?.t).toBe(40);
    const labels = spanLabels({ points: POINTS }, 40);
    expect(labels.map((label) => label.text)).toEqual([
      'rising · ~5.7 s shots',
      'peak · ~4.3 s shots',
      'release · ~5.1 s shots',
    ]);
    expect(pointText({ t: 20, v: 0.8 })).toBe('Tension 80 % at 20.0 s, shots ~3.9 s');
  });

  it('describes the source and what a save did', () => {
    expect(sourceText({ version: 1, source: 'edited', locked: true, points: POINTS })).toBe(
      "Claude's proposal, edited · locked",
    );
    expect(
      saveNotice({
        status: 'ok',
        file: null,
        committed: true,
        changedShots: ['s01', 's02'],
        keptLocked: ['s03'],
      }),
    ).toBe(
      '2 shots out of date (tension): backgrounds follow in the preview now, cut tempo and looks at the next Storyboard run. Locked shots keep their tension: s03.',
    );
    expect(
      saveNotice({ status: 'ok', file: null, committed: false, changedShots: [], keptLocked: [] }),
    ).toBe('Nothing changed.');
    expect(saveNotice({ status: 'error', message: 'no project is open' })).toBe(
      'no project is open',
    );
  });
});
