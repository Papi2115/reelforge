import { describe, expect, it } from 'vitest';
import {
  Biquad,
  MIX_SAMPLE_RATE,
  Oscillator,
  fadeEdges,
  hashSeed,
  mulberry32,
  normalizePeak,
  peakOf,
  rmsOf,
  secondsToFrames,
  whiteNoise,
} from './dsp.js';

function sine(frequency: number, frames: number): Float32Array {
  const oscillator = new Oscillator();
  return Float32Array.from({ length: frames }, () => oscillator.sine(frequency));
}

function filtered(filter: Biquad, input: Float32Array): Float32Array {
  return input.map((value) => filter.process(value));
}

describe('mulberry32 / hashSeed', () => {
  it('is deterministic per seed, in [0, 1), and differs between seeds', () => {
    const first = mulberry32(42);
    const second = mulberry32(42);
    const other = mulberry32(43);
    const a = Array.from({ length: 1000 }, () => first());
    const b = Array.from({ length: 1000 }, () => second());
    const c = Array.from({ length: 1000 }, () => other());
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
    expect(Math.min(...a)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...a)).toBeLessThan(1);
    const mean = a.reduce((sum, value) => sum + value, 0) / a.length;
    expect(mean).toBeGreaterThan(0.45);
    expect(mean).toBeLessThan(0.55);
  });

  it('hashes strings to stable unsigned 32-bit seeds', () => {
    expect(hashSeed('')).toBe(0x811c9dc5);
    expect(hashSeed('a')).toBe(0xe40c292c);
    expect(hashSeed('hit@1.000')).toBe(hashSeed('hit@1.000'));
    expect(hashSeed('hit@1.000')).not.toBe(hashSeed('hit@1.001'));
  });

  it('white noise stays in [-1, 1)', () => {
    const rng = mulberry32(1);
    for (let index = 0; index < 1000; index++) {
      const value = whiteNoise(rng);
      expect(value).toBeGreaterThanOrEqual(-1);
      expect(value).toBeLessThan(1);
    }
  });
});

describe('Biquad', () => {
  const frames = MIX_SAMPLE_RATE / 2;
  const settle = (samples: Float32Array): Float32Array => samples.slice(frames / 2);

  it('lowpass passes lows and attenuates highs', () => {
    const low = rmsOf(settle(filtered(new Biquad().lowpass(1000), sine(100, frames))));
    const high = rmsOf(settle(filtered(new Biquad().lowpass(1000), sine(8000, frames))));
    expect(low).toBeGreaterThan(0.69);
    expect(high).toBeLessThan(0.02);
  });

  it('highpass and bandpass shape the spectrum as expected', () => {
    expect(rmsOf(settle(filtered(new Biquad().highpass(1000), sine(100, frames))))).toBeLessThan(
      0.01,
    );
    const centre = rmsOf(settle(filtered(new Biquad().bandpass(1000, 2), sine(1000, frames))));
    const off = rmsOf(settle(filtered(new Biquad().bandpass(1000, 2), sine(100, frames))));
    expect(centre).toBeCloseTo(Math.SQRT1_2, 2);
    expect(off).toBeLessThan(0.1);
  });
});

describe('helpers', () => {
  it('converts seconds to frames at 48 kHz', () => {
    expect(secondsToFrames(1)).toBe(48_000);
    expect(secondsToFrames(0.0105)).toBe(504);
  });

  it('normalizes the peak and leaves silence alone', () => {
    const samples = Float32Array.from([0.1, -0.4, 0.2]);
    normalizePeak(samples, 0.5);
    expect(peakOf(samples)).toBeCloseTo(0.5, 6);
    expect(samples[0]).toBeCloseTo(0.125, 6);
    const silent = new Float32Array(4);
    expect(normalizePeak(silent, 0.5)).toEqual(new Float32Array(4));
  });

  it('fades both edges to zero', () => {
    const samples = new Float32Array(100).fill(1);
    fadeEdges(samples, 10, 20);
    expect(samples[0]).toBe(0);
    expect(samples[99]).toBe(0);
    expect(samples[50]).toBe(1);
    expect(samples[5]).toBeCloseTo(0.5, 6);
  });
});
