import { describe, expect, it } from 'vitest';
import { loadOriginal } from './original.js';
import {
  POSE,
  POSE_NAMES,
  bodyDimsSchema,
  footAt,
  handAt,
  pose,
  type BodyDims,
  type Pose,
  type Vec3,
} from './poses.js';

const original = loadOriginal(['poses.js']);
type Loose = (...args: unknown[]) => unknown;
const originalPoses = original['POSE'] as unknown as Record<string, Loose>;
const orig = (name: string): Loose => original[name] as unknown as Loose;

/** The commander's dimensions (films/03-apollo-11/js/cast/commander.js:10), pose fields only. */
const COMMANDER: BodyDims = {
  sw: 70,
  sy: -552,
  sz: 8,
  l1a: 114,
  l2a: 108,
  hw: 36,
  l1l: 164,
  l2l: 150,
  waist: [84, -404],
};
/** A crowd extra (cast/crowd.js:8): small, no shoulder depth. */
const CROWD: BodyDims = {
  sw: 30,
  sy: -250,
  l1a: 64,
  l2a: 60,
  hw: 16,
  l1l: 64,
  l2l: 58,
  waist: [34, -160],
};

const PHASES = [0, 0.125, 0.25, 0.4, 0.5, 0.75, 0.9];

describe('equivalence with the original poses.js', () => {
  it('every pose matches for several bodies and phases', () => {
    expect(Object.keys(POSE)).toEqual(Object.keys(originalPoses));
    expect([...POSE_NAMES]).toEqual(Object.keys(originalPoses));
    for (const D of [COMMANDER, CROWD]) {
      for (const name of POSE_NAMES) {
        const legacy = originalPoses[name];
        expect(legacy, name).toBeDefined();
        for (const ph of name === 'point' ? [1, -1] : PHASES) {
          expect(POSE[name](D, ph), `${name} @ ${String(ph)}`).toEqual(legacy?.(D, ph));
        }
      }
    }
  });

  it('pose() applies overrides and handAt/footAt match', () => {
    const over = { hR: handAt(COMMANDER, -1, 0.35, -0.55, 0.25), kR: 'grip' } as const;
    expect(pose('stand', COMMANDER, 0, over)).toEqual(orig('pose')('stand', COMMANDER, null, over));
    expect(pose('jig', CROWD, 0.3)).toEqual(orig('pose')('jig', CROWD, 0.3, undefined));
    expect(pose('point', CROWD)).toEqual(orig('pose')('point', CROWD, null, undefined));
    expect(handAt(CROWD, 1, 0.2, 0.4, 0.1)).toEqual(orig('handAt')(CROWD, 1, 0.2, 0.4, 0.1));
    expect(footAt(COMMANDER, -1, 0.1, 0.3, -0.2)).toEqual(
      orig('footAt')(COMMANDER, -1, 0.1, 0.3, -0.2),
    );
  });
});

describe('scaling by D', () => {
  const scaleDims = (D: BodyDims, k: number): BodyDims => ({
    sw: D.sw * k,
    sy: D.sy * k,
    sz: (D.sz ?? 0) * k,
    hw: D.hw * k,
    l1a: D.l1a * k,
    l2a: D.l2a * k,
    l1l: D.l1l * k,
    l2l: D.l2l * k,
    waist: [D.waist[0] * k, D.waist[1] * k],
  });
  const close = (actual: Vec3 | undefined, expected: Vec3 | undefined): void => {
    expect(actual).toBeDefined();
    for (let i = 0; i < 3; i += 1) expect(actual?.[i]).toBeCloseTo(expected?.[i] ?? NaN, 9);
  };

  it('hand and foot targets scale with the body; poles, bob and lean do not', () => {
    const big = scaleDims(COMMANDER, 1.5);
    for (const name of POSE_NAMES) {
      const a: Pose = pose(name, COMMANDER, 0.3);
      const b: Pose = pose(name, big, 0.3);
      const scaled = (v: Vec3): Vec3 => [v[0] * 1.5, v[1] * 1.5, v[2] * 1.5];
      close(b.hL, scaled(a.hL));
      close(b.hR, scaled(a.hR));
      close(b.fL, scaled(a.fL));
      close(b.fR, scaled(a.fR));
      expect([b.poleL, b.poleR, b.kL, b.kR, b.bob, b.lean]).toEqual([
        a.poleL,
        a.poleR,
        a.kL,
        a.kR,
        a.bob,
        a.lean,
      ]);
    }
  });

  it('longer arms reach further: handAt moves by arm-length units', () => {
    const longArms: BodyDims = { ...CROWD, l1a: CROWD.l1a * 2, l2a: CROWD.l2a * 2 };
    const [x1, y1] = handAt(CROWD, 1, 0.5, 0.5, 0);
    const [x2, y2] = handAt(longArms, 1, 0.5, 0.5, 0);
    expect(x2 - CROWD.sw).toBeCloseTo(2 * (x1 - CROWD.sw), 9);
    expect(y2 - CROWD.sy).toBeCloseTo(2 * (y1 - CROWD.sy), 9);
  });
});

describe('bodyDimsSchema', () => {
  it('accepts real character records (extra rig fields are stripped)', () => {
    const fromFile: unknown = {
      ...COMMANDER,
      hy: -340,
      elbowOut: 0.75,
      head: { x: [0, 18, 36, 0], top: -800, bottom: -598, hw: 78 },
    };
    expect(bodyDimsSchema.parse(fromFile)).toEqual(COMMANDER);
    expect(bodyDimsSchema.safeParse(CROWD).success).toBe(true);
  });

  it('rejects missing, malformed and non-finite fields', () => {
    expect(bodyDimsSchema.safeParse({ ...COMMANDER, waist: undefined }).success).toBe(false);
    expect(bodyDimsSchema.safeParse({ ...COMMANDER, waist: [1] }).success).toBe(false);
    expect(bodyDimsSchema.safeParse({ ...COMMANDER, l1a: -3 }).success).toBe(false);
    expect(bodyDimsSchema.safeParse({ ...COMMANDER, sw: Number.NaN }).success).toBe(false);
    expect(bodyDimsSchema.safeParse({ ...COMMANDER, sy: Infinity }).success).toBe(false);
    expect(bodyDimsSchema.safeParse({ ...COMMANDER, hw: '36' }).success).toBe(false);
  });
});

describe('determinism', () => {
  it('a pose is a pure function of (D, ph)', () => {
    for (const name of POSE_NAMES) {
      expect(pose(name, COMMANDER, 0.4)).toEqual(pose(name, COMMANDER, 0.4));
    }
  });
});
