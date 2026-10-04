/** Tension map (PLAN.md#12.22): schema, curve math, segments, cut tempo, per-shot ambient. */
import { describe, expect, it } from 'vitest';
import { ambientShotInputs } from './ambient-variation.js';
import { projectFileSchema } from './project.js';
import {
  lockedShotPins,
  meanTension,
  NEUTRAL_TENSION,
  normalizeTensionPoints,
  projectTensionMap,
  resampleTension,
  TENSION_PRESETS,
  tensionAt,
  tensionFileSchema,
  tensionForShot,
  tensionPreset,
  type TensionFile,
} from './tension.js';
import {
  cutTempoReport,
  targetShotLength,
  tensionAmbientScale,
  tensionSpans,
  withShotTension,
} from './tension-tempo.js';

const CURVE: TensionFile = {
  version: 1,
  source: 'claude',
  points: [
    { t: 0, v: 0.2 },
    { t: 30, v: 0.2 },
    { t: 60, v: 1 },
    { t: 90, v: 0.4 },
  ],
};

/** 90 s, one shot per 6 s. */
const SHOTS = Array.from({ length: 15 }, (_, index) => ({
  id: `s${String(index + 1).padStart(2, '0')}`,
  t0: index * 6,
  t1: (index + 1) * 6,
}));

describe('tension.json schema', () => {
  it('accepts a curve and refuses unordered points, overlapping segments, double pins', () => {
    expect(tensionFileSchema.safeParse(CURVE).success).toBe(true);
    const unordered = { ...CURVE, points: [CURVE.points[1], CURVE.points[0]] };
    expect(tensionFileSchema.safeParse(unordered).success).toBe(false);
    const overlap = {
      ...CURVE,
      segments: [
        { from: 0, to: 40, kind: 'calm' },
        { from: 30, to: 60, kind: 'peak' },
      ],
    };
    expect(tensionFileSchema.safeParse(overlap).success).toBe(false);
    const pins = {
      ...CURVE,
      pins: [
        { shotId: 's01', v: 0.5 },
        { shotId: 's01', v: 0.6 },
      ],
    };
    expect(tensionFileSchema.safeParse(pins).success).toBe(false);
    expect(
      tensionFileSchema.safeParse({
        ...CURVE,
        points: [
          { t: 0, v: 1.2 },
          { t: 1, v: 0 },
        ],
      }).success,
    ).toBe(false);
  });

  it('reads a missing tensionMap as off; new projects may say auto', () => {
    const project = {
      version: 1,
      title: 'x',
      language: 'en',
      style: 'voxel-pixel-crisp640',
      fps: 30,
      seed: 1,
    } as const;
    expect(projectTensionMap(projectFileSchema.parse(project))).toBe('off');
    expect(projectTensionMap(projectFileSchema.parse({ ...project, tensionMap: 'auto' }))).toBe(
      'auto',
    );
    expect(projectFileSchema.safeParse({ ...project, tensionMap: 'on' }).success).toBe(false);
  });
});

describe('curve math', () => {
  it('interpolates linearly and holds the ends', () => {
    expect(tensionAt(CURVE.points, -5)).toBe(0.2);
    expect(tensionAt(CURVE.points, 45)).toBeCloseTo(0.6, 9);
    expect(tensionAt(CURVE.points, 200)).toBe(0.4);
  });

  it('integrates the mean exactly over a range', () => {
    expect(meanTension(CURVE.points, 30, 60)).toBeCloseTo(0.6, 9);
    expect(meanTension(CURVE.points, 0, 30)).toBeCloseTo(0.2, 9);
    expect(meanTension(CURVE.points, 50, 70)).toBeCloseTo(
      (0.2 + (0.8 * 20) / 30 + 1) / 4 + 0.45,
      9,
    );
    expect(meanTension(CURVE.points, 10, 10)).toBe(0.2);
  });

  it('gives a shot its mean, or its pin', () => {
    const shot = { id: 's06', t0: 30, t1: 36 };
    expect(tensionForShot(CURVE, shot)).toBe(0.28);
    expect(tensionForShot({ ...CURVE, pins: [{ shotId: 's06', v: 0.9 }] }, shot)).toBe(0.9);
  });

  it('normalizes points: clamps, sorts, merges, pads', () => {
    expect(
      normalizeTensionPoints(
        [
          { t: 10, v: 1.4 },
          { t: -2, v: 0.1 },
          { t: 10.0004, v: 0.5 },
        ],
        20,
      ),
    ).toEqual([
      { t: 0, v: 0.1 },
      { t: 10, v: 0.5 },
    ]);
    expect(normalizeTensionPoints([], 20)).toEqual([
      { t: 0, v: 0.5 },
      { t: 20, v: 0.5 },
    ]);
    expect(normalizeTensionPoints([{ t: 5, v: 0.3 }], 20)).toEqual([
      { t: 5, v: 0.3 },
      { t: 20, v: 0.3 },
    ]);
  });

  it('resamples evenly and builds every preset over the film', () => {
    const resampled = resampleTension(CURVE.points, 90, 4);
    expect(resampled.map((point) => point.t)).toEqual([0, 30, 60, 90]);
    expect(resampled.map((point) => point.v)).toEqual([0.2, 0.2, 1, 0.4]);
    for (const preset of TENSION_PRESETS) {
      const points = tensionPreset(preset, 120);
      expect(points[0]?.t, preset).toBe(0);
      expect(points.at(-1)?.t, preset).toBe(120);
      expect(tensionFileSchema.safeParse({ version: 1, source: 'user', points }).success).toBe(
        true,
      );
    }
  });

  it('pins locked shots to their tension under the previous curve (neutral without one)', () => {
    const locked = new Set(['s06', 's10']);
    expect(lockedShotPins(CURVE, SHOTS, locked)).toEqual([
      { shotId: 's06', v: 0.28 },
      { shotId: 's10', v: tensionForShot(CURVE, { id: 's10', t0: 54, t1: 60 }) },
    ]);
    expect(lockedShotPins(undefined, SHOTS, locked).map((pin) => pin.v)).toEqual([
      NEUTRAL_TENSION,
      NEUTRAL_TENSION,
    ]);
  });
});

describe('what the curve steers', () => {
  it('maps tension to shot length 7.5 s .. 3 s and ambient scale 0.6 .. 1.4 (1 at neutral)', () => {
    expect([0, 0.5, 1].map(targetShotLength)).toEqual([7.5, 5.25, 3]);
    expect([0, NEUTRAL_TENSION, 1].map(tensionAmbientScale)).toEqual([0.6, 1, 1.4]);
  });

  it('splits an unlabelled curve into ~15 s windows and keeps labelled segments', () => {
    const auto = tensionSpans(CURVE, 90);
    expect(auto).toHaveLength(6);
    expect(auto[0]).toMatchObject({ from: 0, to: 15, kind: 'calm', mean: 0.2, targetS: 6.6 });
    expect(auto[3]?.kind).toBe('peak');
    const labelled = tensionSpans(
      { ...CURVE, segments: [{ from: 45, to: 70, kind: 'peak', label: 'the reveal' }] },
      90,
    );
    expect(labelled.map((span) => [span.from, span.to, span.kind])).toEqual([
      [0, 15, 'calm'],
      [15, 30, 'calm'],
      [30, 45, 'rising'],
      [45, 70, 'peak'],
      [70, 90, 'release'],
    ]);
    expect(labelled[3]?.label).toBe('the reveal');
  });

  it('two curves on the same storyboard give measurably different tempo targets and ambient', () => {
    const calm: TensionFile = {
      ...CURVE,
      points: [
        { t: 0, v: 0.1 },
        { t: 90, v: 0.2 },
      ],
    };
    const tense: TensionFile = {
      ...CURVE,
      points: [
        { t: 0, v: 0.8 },
        { t: 90, v: 0.95 },
      ],
    };
    const calmReport = cutTempoReport(SHOTS, calm);
    const tenseReport = cutTempoReport(SHOTS, tense);
    // Same cuts (10 shots per minute) measured against very different targets.
    expect(calmReport.shotsPerMinute).toBe(10);
    expect(tenseReport.shotsPerMinute).toBe(10);
    const calmTargets = calmReport.segments.map((segment) => segment.targetS);
    const tenseTargets = tenseReport.segments.map((segment) => segment.targetS);
    expect(Math.min(...calmTargets)).toBeGreaterThan(6.5);
    expect(Math.max(...tenseTargets)).toBeLessThan(4);
    expect(calmReport.segments.every((segment) => segment.ratio < 1)).toBe(true);
    expect(tenseReport.segments.every((segment) => segment.ratio > 1.5)).toBe(true);
    const inputs = ambientShotInputs(SHOTS.map(() => ({})));
    const calmScale = withShotTension(inputs, SHOTS, calm).map((shot) => shot.scale ?? 1);
    const tenseScale = withShotTension(inputs, SHOTS, tense).map((shot) => shot.scale ?? 1);
    expect(Math.max(...calmScale)).toBeLessThan(0.8);
    expect(Math.min(...tenseScale)).toBeGreaterThan(1.2);
    expect(withShotTension(inputs, SHOTS, tense)[0]).toMatchObject({
      index: 0,
      act: 0,
      tension: 0.805,
    });
  });
});
