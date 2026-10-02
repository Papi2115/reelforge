import { describe, expect, it } from 'vitest';
import {
  AMBIENCE_LOOP_S,
  AMBIENCE_RECIPES,
  AMBIENCE_RMS_DB,
  synthesizeAmbience,
} from './ambience.js';
import { makeSeamlessLoop, monoClip } from './clip.js';
import { Oscillator, secondsToFrames } from './dsp.js';

function maxStep(samples: Float32Array): number {
  let step = 0;
  for (let index = 1; index < samples.length; index++) {
    step = Math.max(step, Math.abs((samples[index] ?? 0) - (samples[index - 1] ?? 0)));
  }
  return step;
}

function seamStep(samples: Float32Array): number {
  return Math.abs((samples[0] ?? 0) - (samples[samples.length - 1] ?? 0));
}

function rmsDb(left: Float32Array, right: Float32Array): number {
  let sum = 0;
  for (const value of left) sum += value * value;
  for (const value of right) sum += value * value;
  return 20 * Math.log10(Math.sqrt(sum / (left.length + right.length)));
}

describe('synthesizeAmbience', () => {
  it.each(AMBIENCE_RECIPES)('%s: 8 s seamless stereo loop at -30 dBFS RMS', (recipe) => {
    const clip = synthesizeAmbience(recipe, { seed: 11 });
    expect(clip.left.length).toBe(secondsToFrames(AMBIENCE_LOOP_S));
    expect(clip.right.length).toBe(clip.left.length);
    expect(rmsDb(clip.left, clip.right)).toBeCloseTo(AMBIENCE_RMS_DB, 1);
    expect(clip.left.every((value) => Number.isFinite(value) && Math.abs(value) < 1)).toBe(true);
    // Wrapping from the last frame to frame 0 is no bigger a jump than any step inside the loop.
    for (const channel of [clip.left, clip.right]) {
      expect(seamStep(channel)).toBeLessThanOrEqual(maxStep(channel));
    }
  });

  it.each(AMBIENCE_RECIPES)('%s: deterministic per seed', (recipe) => {
    expect(synthesizeAmbience(recipe, { seed: 4 })).toEqual(
      synthesizeAmbience(recipe, { seed: 4 }),
    );
  });

  it('uses decorrelated channels and different seeds for noise beds', () => {
    const clip = synthesizeAmbience('wind', { seed: 4 });
    expect(clip.left).not.toEqual(clip.right);
    expect(synthesizeAmbience('room-tone', { seed: 1 }).left).not.toEqual(
      synthesizeAmbience('room-tone', { seed: 2 }).left,
    );
  });
});

describe('makeSeamlessLoop', () => {
  it('removes the click of a sine cut at an arbitrary phase', () => {
    const oscillator = new Oscillator();
    const raw = Float32Array.from({ length: 10_000 }, () => oscillator.sine(97.3));
    expect(seamStep(raw)).toBeGreaterThan(maxStep(raw) * 5);
    const loop = makeSeamlessLoop(monoClip(raw), 2_000, 'linear');
    expect(loop.left.length).toBe(8_000);
    expect(loop.right).toBe(loop.left);
    expect(seamStep(loop.left)).toBeLessThanOrEqual(maxStep(raw) * 1.01);
  });

  it('caps the crossfade at half the clip and returns short clips untouched', () => {
    const raw = monoClip(new Float32Array(10).fill(0.5));
    expect(makeSeamlessLoop(raw, 100).left.length).toBe(5);
    expect(makeSeamlessLoop(raw, 0)).toBe(raw);
  });
});
