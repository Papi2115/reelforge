import { describe, expect, it } from 'vitest';
import { bandShare, powerSpectrum, spectralCentroid } from './analysis.js';
import { Biquad, MIX_SAMPLE_RATE, mulberry32, rmsOf, whiteNoise } from './dsp.js';
import { applyReverb } from './reverb.js';
import {
  Osc,
  Svf,
  addPanned,
  attackDecay,
  bitcrush,
  createStereo,
  expLerp,
  gateEnvelope,
  midiToHz,
  panGains,
  saturate,
  swell,
} from './synth.js';

const SR = MIX_SAMPLE_RATE;

function tone(frames: number, make: (osc: Osc) => number): Float32Array {
  const osc = new Osc();
  return Float32Array.from({ length: frames }, () => make(osc));
}

const levelDb = (samples: Float32Array): number => 20 * Math.log10(rmsOf(samples));

describe('Osc', () => {
  it('produces bounded waveforms at the requested pitch', () => {
    for (const make of [
      (osc: Osc) => osc.sine(1000),
      (osc: Osc) => osc.triangle(1000),
      (osc: Osc) => osc.saw(1000),
      (osc: Osc) => osc.square(1000),
    ]) {
      const samples = tone(SR, make);
      expect(Math.max(...samples.map(Math.abs))).toBeLessThanOrEqual(1.3);
      const spectrum = powerSpectrum(samples, 8192);
      expect(bandShare(spectrum, 950, 1050)).toBeGreaterThan(0.6);
    }
  });

  it('keeps saw aliasing low (polyBLEP)', () => {
    // A 5 kHz saw has harmonics at 5, 10, 15, 20 kHz; aliases would land between them.
    const spectrum = powerSpectrum(
      tone(SR, (osc) => osc.saw(5000)),
      8192,
    );
    const harmonics = [5000, 10_000, 15_000, 20_000].reduce(
      (sum, hz) => sum + bandShare(spectrum, hz - 60, hz + 60),
      0,
    );
    expect(harmonics).toBeGreaterThan(0.97);
  });

  it('starts every waveform at 0 (no onset jump)', () => {
    expect(new Osc().sine(440)).toBe(0);
    expect(new Osc().triangle(440)).toBe(0);
  });
});

describe('filters', () => {
  const noise = (): Float32Array => {
    const rng = mulberry32(1);
    return Float32Array.from({ length: SR }, () => whiteNoise(rng));
  };

  it('Svf low-pass / band-pass shape the spectrum', () => {
    const input = noise();
    const lowpass = new Svf().set(500, 0.7);
    const low = input.map((value) => lowpass.process(value));
    expect(spectralCentroid(powerSpectrum(low))).toBeLessThan(900);
    const bandpass = new Svf().set(3000, 4);
    const band = input.map((value) => {
      bandpass.process(value);
      return bandpass.band;
    });
    expect(bandShare(powerSpectrum(band), 2400, 3700)).toBeGreaterThan(0.5);
  });

  it('Biquad peaking and shelves apply their gain', () => {
    const sine = tone(SR, (osc) => osc.sine(1000));
    const peak = new Biquad().peaking(1000, 1, -6);
    expect(levelDb(sine.map((value) => peak.process(value))) - levelDb(sine)).toBeCloseTo(-6, 0);
    const low = new Biquad().shelf('low', 5000, 6);
    expect(levelDb(sine.map((value) => low.process(value))) - levelDb(sine)).toBeCloseTo(6, 0);
    const high = new Biquad().shelf('high', 200, -4);
    expect(levelDb(sine.map((value) => high.process(value))) - levelDb(sine)).toBeCloseTo(-4, 0);
  });
});

describe('envelopes and helpers', () => {
  it('shape attack/decay, gates and swells', () => {
    expect(attackDecay(-1, 0.01, 0.1)).toBe(0);
    expect(attackDecay(0.01, 0.01, 0.1)).toBeCloseTo(1);
    expect(attackDecay(0.11, 0.01, 0.1)).toBeCloseTo(Math.exp(-1));
    expect(gateEnvelope(0.5, 0.1, 0.1, 1)).toBe(1);
    expect(gateEnvelope(1, 0.1, 0.1, 1)).toBe(0);
    expect(swell(0.3, 0.3)).toBeCloseTo(1);
    expect(swell(0, 0.3)).toBe(0);
    expect(expLerp(100, 400, 0.5)).toBeCloseTo(200);
    expect(midiToHz(69)).toBe(440);
    expect(saturate(1, 2)).toBeCloseTo(1);
    const centre = panGains(0);
    expect(centre.left).toBeCloseTo(1);
    expect(panGains(-1).right).toBeCloseTo(0);
  });

  it('bitcrush quantizes the crushed share only', () => {
    const samples = tone(4800, (osc) => osc.sine(440));
    const dry = samples.slice();
    bitcrush(samples, { bits: 4, hold: 4, mix: 0 });
    expect(samples).toEqual(dry);
    bitcrush(samples, { bits: 4, hold: 4, mix: 0.5 });
    expect(samples).not.toEqual(dry);
  });

  it('addPanned places a mono buffer with a pan sweep', () => {
    const out = createStereo(1000);
    addPanned(out, new Float32Array(1000).fill(1), 0, 1, (position) => -1 + 2 * position);
    expect(out.left[0] ?? 0).toBeGreaterThan(1.3);
    expect(out.right[0] ?? 1).toBeCloseTo(0);
    expect(out.right[999] ?? 0).toBeGreaterThan(1.3);
  });
});

describe('applyReverb', () => {
  it('decays at roughly the requested RT60 and keeps the dry signal', () => {
    const frames = SR * 2;
    const impulse = new Float32Array(frames);
    impulse[0] = 1;
    const wet = applyReverb(
      { left: impulse, right: impulse },
      { decayS: 0.5, wet: 1, dry: 0, preDelayMs: 0 },
    );
    const early = rmsOf(wet.left.subarray(SR * 0.05, SR * 0.15));
    const late = rmsOf(wet.left.subarray(SR * 0.55, SR * 0.65));
    const dropDb = 20 * Math.log10(early / late);
    // 0.5 s apart -> ~60 dB for RT60 = 0.5 s (damping adds a bit).
    expect(dropDb).toBeGreaterThan(45);
    expect(dropDb).toBeLessThan(85);
    const dryOnly = applyReverb({ left: impulse, right: impulse }, { decayS: 0.5, wet: 0 });
    expect(dryOnly.left).toEqual(impulse);
  });
});
