import { describe, expect, it } from 'vitest';
import {
  autocorrelation,
  bandShare,
  fft,
  integratedLufs,
  maxWindowRms,
  onsetEnvelope,
  powerSpectrum,
  spectralCentroid,
  stereoCorrelation,
} from './analysis.js';
import { MIX_SAMPLE_RATE } from './dsp.js';

const SR = MIX_SAMPLE_RATE;
const sine = (hz: number, amplitude: number, seconds: number): Float32Array =>
  Float32Array.from(
    { length: Math.round(seconds * SR) },
    (_, index) => amplitude * Math.sin((2 * Math.PI * hz * index) / SR),
  );

describe('fft / spectra', () => {
  it('finds a single bin for a bin-centred sine', () => {
    const size = 64;
    const real = Float64Array.from({ length: size }, (_, index) =>
      Math.cos((2 * Math.PI * 4 * index) / size),
    );
    const imag = new Float64Array(size);
    fft(real, imag);
    expect(real[4]).toBeCloseTo(size / 2);
    expect(real[60]).toBeCloseTo(size / 2);
    expect(Math.abs(real[5] ?? 1)).toBeLessThan(1e-9);
  });

  it('measures centroid and band shares', () => {
    const spectrum = powerSpectrum(sine(1000, 0.5, 1));
    expect(spectralCentroid(spectrum)).toBeCloseTo(1000, -2);
    expect(bandShare(spectrum, 900, 1100)).toBeGreaterThan(0.99);
  });
});

describe('integratedLufs (BS.1770)', () => {
  it('reads a stereo 1 kHz sine at -20 dBFS peak as -20 LUFS', () => {
    const tone = sine(1000, 0.1, 3);
    expect(integratedLufs({ left: tone, right: tone })).toBeCloseTo(-20, 1);
  });

  it('gates out silence and returns -70 for silent input', () => {
    const tone = sine(1000, 0.1, 3);
    const padded = new Float32Array(tone.length * 3);
    padded.set(tone, tone.length);
    expect(integratedLufs({ left: padded, right: padded })).toBeCloseTo(-20, 0);
    const silent = new Float32Array(SR);
    expect(integratedLufs({ left: silent, right: silent })).toBe(-70);
  });
});

describe('misc measures', () => {
  it('maxWindowRms, stereoCorrelation', () => {
    const tone = sine(500, 1, 0.5);
    expect(maxWindowRms(tone, 2400)).toBeCloseTo(Math.SQRT1_2, 2);
    expect(stereoCorrelation({ left: tone, right: tone })).toBeCloseTo(1);
    expect(stereoCorrelation({ left: tone, right: tone.map((value) => -value) })).toBeCloseTo(-1);
  });

  it('onset envelope autocorrelation peaks at the pulse period', () => {
    const clicks = new Float32Array(SR * 4);
    for (let beat = 0; beat < 8; beat++) {
      for (let index = 0; index < 480; index++) {
        clicks[beat * SR * 0.5 + index] = Math.exp(-index / 100);
      }
    }
    const hop = 480;
    const onsets = onsetEnvelope(clicks, hop);
    const beatLag = (SR * 0.5) / hop;
    expect(autocorrelation(onsets, beatLag)).toBeGreaterThan(autocorrelation(onsets, beatLag - 7));
  });
});
