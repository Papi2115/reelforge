import { describe, expect, it } from 'vitest';
import type { Character } from '../draw/character.js';
import { handAt, pose, type BodyDims, type Pose, type Vec3 } from '../draw/poses.js';
import { TEST_CHARACTER } from '../draw/test-character.js';
import { THRESHOLDS, validateCharacter, type SweepCase } from './index.js';
import { contactLimit } from './rules-contact.js';

const T = TEST_CHARACTER;
const withD = (d: Partial<Character['D']>): Character => ({ ...T, D: { ...T.D, ...d } });

describe('tangle', () => {
  it('hand-in-head: no face guard at all', () => {
    const r = validateCharacter(withD({ head: undefined }), { rules: ['hand-in-head'] });
    expect(r.ok).toBe(false);
    expect(r.findings.some((f) => f.pose === 'armsUp')).toBe(true);
    expect(r.findings[0]?.fix).toMatch(/^add D\.head/);
  });

  it('hand-in-head: a hand-set box that stops above the real chin (the fixture before 14.13)', () => {
    const r = validateCharacter(
      withD({ head: { x: [0, 22, 40, 0], top: -805, bottom: -588, hw: 70 } }),
      { rules: ['hand-in-head'] },
    );
    expect(r.ok).toBe(false);
    expect(r.findings.every((f) => f.pose?.startsWith('jig'))).toBe(true);
    expect(r.findings[0]?.fix).toMatch(/lower bottom/);
  });

  it('arm-across-face: a neck line above the head puts raised arms in front', () => {
    const high: Character = {
      ...T,
      neck: [
        [0, -900, 0, -596],
        [5, -900, 12, -594],
        [12, -900, 26, -590],
        [0, -900, 0, -596],
      ],
    };
    const r = validateCharacter(high, { rules: ['arm-across-face'] });
    expect(r.ok).toBe(false);
    expect(r.findings[0]?.fix).toMatch(/neck\[\d\] base y \(-900\)/);
  });

  it('out-of-reach: arms too short for akimbo', () => {
    const r = validateCharacter(withD({ l1a: 55, l2a: 55 }), {
      rules: ['out-of-reach', 'guard-out-of-reach'],
      sweeps: [],
    });
    const akimbo = r.findings.filter((f) => f.pose === 'akimbo');
    expect(akimbo.length).toBeGreaterThan(0);
    // reported once, by the raw rule, never again as a guard push
    expect(new Set(akimbo.map((f) => f.code))).toEqual(new Set(['out-of-reach']));
    expect(akimbo[0]?.severity).toBe('error');
  });

  it('out-of-reach: at the 8% boundary', () => {
    const D = T.D;
    const len = D.l1a + D.l2a;
    const reachDown = (share: number) => ({
      name: `down ${String(share)}`,
      pose: (d: BodyDims): Pose => ({
        ...pose('stand', d),
        hL: [D.sw, D.sy + len * share, D.sz ?? 0] as Vec3,
      }),
    });
    const run = (share: number): number =>
      validateCharacter(T, {
        rules: ['out-of-reach'],
        views: [0],
        sweeps: [],
        poses: [reachDown(share)],
      }).findings.length;
    expect(run(1 + THRESHOLDS.reachOvershoot - 1e-9)).toBe(0);
    expect(run(1 + THRESHOLDS.reachOvershoot + 1e-6)).toBe(1);
  });

  it('guard-out-of-reach: only warns (the C-CAM guard is not reach-aware)', () => {
    const r = validateCharacter(T, { rules: ['guard-out-of-reach'] });
    expect(r.ok).toBe(true);
    expect(r.findings.length).toBeGreaterThan(0);
    expect(
      r.findings.every((f) => f.severity === 'warn' && f.view !== null && Math.abs(f.view) === 2),
    ).toBe(true);
  });

  it('elbow-flip: an elbow pole that swaps sides while the hand stays put', () => {
    const sweep = (swap: boolean, jump: boolean): SweepCase => ({
      name: swap ? 'swap' : 'steady',
      pose: (D, ph) => {
        const late = ph >= 0.5;
        const hL = late && jump ? handAt(D, 1, 0.6, -0.4, 0) : handAt(D, 1, 0, 0.45, 0);
        return { ...pose('stand', D), hL, poleL: [late && swap ? -1 : 1, 0, 0] };
      },
    });
    const run = (s: SweepCase) =>
      validateCharacter(T, { rules: ['elbow-flip'], views: [0], sweeps: [s] }).findings;
    expect(run(sweep(false, false))).toEqual([]);
    const flips = run(sweep(true, false));
    expect(flips).toHaveLength(1);
    expect(flips[0]).toMatchObject({
      code: 'elbow-flip',
      severity: 'error',
      view: 0,
      pose: 'swap 12/24',
    });
    // the same flip during a big swing of the wrist (>= half an arm) is not a visible jump
    expect(run(sweep(true, true))).toEqual([]);
  });
});

describe('contact', () => {
  it('scales the c-plus 4 px limit with figures drawn larger than 1', () => {
    expect(contactLimit(0.6)).toBe(4);
    expect(contactLimit(1)).toBe(4);
    expect(contactLimit(1.4)).toBeCloseTo(5.6, 9);
  });

  it('contact-miss: a guard box over the chest pushes every palm off its goal', () => {
    const r = validateCharacter(
      withD({ head: { x: [0, 0, 0, 0], top: -900, bottom: -300, hw: 200 } }),
      { rules: ['contact-miss'] },
    );
    expect(r.ok).toBe(false);
    expect(r.findings.some((f) => f.pose?.startsWith('object'))).toBe(true);
    expect(r.findings.some((f) => f.pose?.startsWith('handshake'))).toBe(true);
    expect(r.findings.every((f) => f.measured > f.limit)).toBe(true);
  });

  it('contact-miss: a short-armed partner is reported out of reach, not failed', () => {
    const self = validateCharacter(T, { rules: ['contact-miss'] });
    const shortArms: Character = { ...withD({ l1a: 50, l2a: 45 }), id: 'short-arms' };
    const pair = validateCharacter(T, { rules: ['contact-miss'], partner: shortArms });
    const key = 'contact: handshake set-ups out of reach (reported)';
    expect(pair.ok).toBe(true);
    expect(pair.metrics[key] ?? 0).toBeGreaterThan(self.metrics[key] ?? 0);
  });
});
