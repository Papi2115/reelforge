import { describe, expect, it } from 'vitest';
import { blendPose, CLIPS, EUREKA_LOOP, eurekaGlow, makePose, POSE_KEYS, POSES } from './clips.js';
import { bump, hash, mod, smooth, spring, stringHash } from './math.js';

describe('character pack math', () => {
  it('springs overshoot and settle at 1', () => {
    expect(spring(0, 1.6, 5)).toBe(0);
    expect(spring(-1, 1.6, 5)).toBe(0);
    const samples = Array.from({ length: 200 }, (_, index) => spring(index / 100, 1.6, 5));
    expect(Math.max(...samples)).toBeGreaterThan(1.05);
    expect(spring(3, 1.6, 5)).toBeCloseTo(1, 4);
    // Less damping (low energy waves are damped more): a bigger overshoot.
    const peak = (damping: number) =>
      Math.max(...Array.from({ length: 100 }, (_, i) => spring(i / 100, 1.6, damping)));
    expect(peak(5)).toBeGreaterThan(peak(8));
  });

  it('eases, bumps and hashes deterministically', () => {
    expect(smooth(0, 1, 0.5)).toBe(0.5);
    expect(smooth(0, 1, -2)).toBe(0);
    expect(bump(0, 1, 2, 3, 1.5)).toBe(1);
    expect(bump(0, 1, 2, 3, 3.5)).toBe(0);
    expect(hash(7)).toBe(hash(7));
    expect(hash(7)).toBeGreaterThanOrEqual(0);
    expect(hash(7)).toBeLessThan(1);
    expect(stringHash('bulb')).toBe(stringHash('bulb'));
    expect(stringHash('bulb')).not.toBe(stringHash('fox'));
    expect(mod(-1, 4)).toBe(3);
  });
});

describe('character pack clips', () => {
  it('every pose is finite at every time and energy', () => {
    for (const name of POSES) {
      for (const local of [0, 0.05, 0.3, 1, 2.5, 7.3]) {
        for (const energy of [0, 0.45, 1]) {
          const { pose } = CLIPS[name](local, local + 3.1, energy);
          for (const key of POSE_KEYS)
            expect(Number.isFinite(pose[key]), `${name} ${key}`).toBe(true);
        }
      }
    }
  });

  it('is a pure function of time', () => {
    for (const name of POSES) expect(CLIPS[name](1.7, 4.2, 1)).toEqual(CLIPS[name](1.7, 4.2, 1));
  });

  it('anticipates, overshoots and lands where the page does', () => {
    // Wave: a dip first (anticipation), then the right arm goes up past its target.
    expect(CLIPS.wave(0.12, 0, 1).pose.hipY).toBeLessThan(-0.5);
    const raised = Array.from({ length: 60 }, (_, i) => -CLIPS.wave(i / 60 + 0.1, 0, 1).pose.armRX);
    expect(Math.max(...raised)).toBeGreaterThan(0.45);
    expect(CLIPS.wave(2, 0, 1).pose.armRZ).toBeLessThan(-1.5);
    // Point: wind up (spine turns away) before the snap.
    expect(CLIPS.point(0.13, 0, 1).pose.spineY).toBeLessThan(-0.2);
    expect(CLIPS.point(1.5, 0, 1).pose.armRX).toBeCloseTo(-Math.PI / 2 + 0.08, 1);
    // Joy: crouch, then airborne with a stretched body.
    expect(CLIPS.joy(0.2, 0, 1).pose.hipY).toBeLessThan(-1);
    expect(CLIPS.joy(0.5, 0, 1).pose.hipY).toBeGreaterThan(4);
    // Calm energy damps personality: no hop on a low-energy joy.
    expect(CLIPS.joy(0.5, 0, 0).pose.hipY).toBeLessThan(CLIPS.joy(0.5, 0, 1).pose.hipY);
  });

  it('suggests the page expression of every pose', () => {
    expect(CLIPS.wave(1, 0, 1).expression).toBe('joy');
    expect(CLIPS.think(1, 0, 1).expression).toBe('thinking');
    expect(CLIPS.point(1, 0, 1).expression).toBe('curious');
    expect(CLIPS.shrug(1, 0, 1).expression).toBe('sceptical');
    expect(CLIPS.walk(1, 0, 1).expression).toBe('neutral');
    expect(CLIPS.eureka(1, 0, 1).expression).toBe('thinking');
    expect(CLIPS.eureka(1.8, 0, 1).expression).toBe('surprised');
    expect(CLIPS.eureka(3, 0, 1).expression).toBe('joy');
  });

  it('lights the eureka: flicker on ignition, steady, fade out, every loop', () => {
    expect(eurekaGlow(1)).toBe(0);
    const flicker = new Set(Array.from({ length: 12 }, (_, i) => eurekaGlow(1.56 + i * 0.05)));
    expect(flicker).toEqual(new Set([1, 0.15]));
    expect(eurekaGlow(3)).toBe(1);
    expect(eurekaGlow(4.5)).toBe(0);
    expect(CLIPS.eureka(3 + EUREKA_LOOP, 0, 1).pose.glow).toBe(CLIPS.eureka(3, 0, 1).pose.glow);
  });

  it('blends poses linearly', () => {
    const a = makePose({ armLZ: 1 });
    const b = makePose({ armLZ: 3, hipY: 2 });
    expect(blendPose(a, b, 0.5).armLZ).toBe(2);
    expect(blendPose(a, b, 0.5).hipY).toBe(1);
  });
});
