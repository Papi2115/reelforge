/**
 * Objective QA of the rendered beds, per mood (subjective quality needs ears: see
 * `pnpm --filter @reelforge/pipeline audio:demos`). Checks the "pleasant bed, no droning bass"
 * contract: little energy below 120 Hz (overall and in every 5 s window, no build-up), no low
 * resonances, the mid range carries the music, loudness -23 LUFS, sane crest factor, no clipping,
 * mono-safe stereo, a steady pulse at the score's tempo, a click-free loop seam, determinism.
 */
import { createHash } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  autocorrelation,
  bandShare,
  integratedLufs,
  mixToMono,
  onsetEnvelope,
  powerSpectrum,
  stereoCorrelation,
  type PowerSpectrum,
} from '../analysis.js';
import type { StereoClip } from '../clip.js';
import { MIX_SAMPLE_RATE, peakOf, rmsOf } from '../dsp.js';
import { MUSIC_MOODS, generateMusic, type GeneratedMusic, type MusicMood } from './music.js';
import { MUSIC_PEAK_DB, MUSIC_TARGET_LUFS } from './render.js';

const SR = MIX_SAMPLE_RATE;
const DURATION_S = 30;
const rendered = new Map<MusicMood, GeneratedMusic>();

beforeAll(() => {
  for (const mood of MUSIC_MOODS) {
    rendered.set(mood, generateMusic({ mood, seed: 7, durationS: DURATION_S }));
  }
}, 180_000);

function get(mood: MusicMood): GeneratedMusic {
  const music = rendered.get(mood);
  if (music === undefined) throw new Error(`not rendered: ${mood}`);
  return music;
}

const db = (value: number): number => 10 * Math.log10(Math.max(value, 1e-20));

function bandPower(spectrum: PowerSpectrum, from: number, to: number): number {
  let sum = 0;
  spectrum.power.forEach((value, bin) => {
    const hz = bin * spectrum.binHz;
    if (hz >= from && hz < to) sum += value;
  });
  return sum;
}

const hash = (clip: StereoClip): string =>
  createHash('sha256')
    .update(Buffer.from(clip.left.buffer))
    .update(Buffer.from(clip.right.buffer))
    .digest('hex');

describe.each(MUSIC_MOODS)('%s bed', (mood) => {
  it('keeps the low end small, steady and free of resonances', () => {
    const mono = mixToMono(get(mood).clip);
    const spectrum = powerSpectrum(mono, 8192);
    expect(bandShare(spectrum, 0, 120)).toBeLessThanOrEqual(0.12);
    const window = 5 * SR;
    const shares: number[] = [];
    for (let start = 0; start + window <= mono.length; start += window) {
      shares.push(bandShare(powerSpectrum(mono.subarray(start, start + window), 8192), 0, 120));
    }
    for (const share of shares) expect(share).toBeLessThanOrEqual(0.15);
    // No build-up: the least-squares trend over the piece stays flat.
    const mean = (shares.length - 1) / 2;
    const average = shares.reduce((sum, value) => sum + value, 0) / shares.length;
    let numerator = 0;
    let denominator = 0;
    shares.forEach((share, index) => {
      numerator += (index - mean) * (share - average);
      denominator += (index - mean) ** 2;
    });
    expect((numerator / denominator) * (shares.length - 1)).toBeLessThanOrEqual(0.05);
    // Low resonance check: no 1/6-octave band in 40-120 Hz pokes above the mid-range median.
    const sixth = 2 ** (1 / 6);
    const low: number[] = [];
    const mid: number[] = [];
    for (let hz = 40; hz < 4000; hz *= sixth) {
      (hz < 120 ? low : mid).push(db(bandPower(spectrum, hz, hz * sixth)));
    }
    mid.sort((a, b) => a - b);
    const median = mid[Math.floor(mid.length / 2)] ?? 0;
    expect(Math.max(...low) - median).toBeLessThanOrEqual(6);
  });

  it('carries the music in the mid range and keeps the top soft', () => {
    const spectrum = powerSpectrum(mixToMono(get(mood).clip), 8192);
    expect(bandShare(spectrum, 250, 4000)).toBeGreaterThanOrEqual(0.6);
    expect(bandShare(spectrum, 8000, 24_000)).toBeLessThanOrEqual(0.02);
  });

  it('sits at -23 LUFS with a sane crest factor and no clipping', () => {
    const { clip } = get(mood);
    expect(Math.abs(integratedLufs(clip) - MUSIC_TARGET_LUFS)).toBeLessThanOrEqual(0.5);
    const peak = Math.max(peakOf(clip.left), peakOf(clip.right));
    expect(20 * Math.log10(peak)).toBeLessThanOrEqual(MUSIC_PEAK_DB + 0.01);
    const crest = 20 * Math.log10(peak / rmsOf(mixToMono(clip)));
    expect(crest).toBeGreaterThanOrEqual(8);
    expect(crest).toBeLessThanOrEqual(22);
  });

  it('is mono-safe stereo', () => {
    expect(stereoCorrelation(get(mood).clip)).toBeGreaterThanOrEqual(0.3);
  });

  it('pulses at the score tempo (onset autocorrelation on the beat grid)', () => {
    const music = get(mood);
    const hop = 240;
    const onsets = onsetEnvelope(mixToMono(music.clip), hop);
    const beatHops = (60 / music.score.bpm) * (SR / hop);
    const near = (lag: number): number =>
      Math.max(
        ...[-2, -1, 0, 1, 2].map((offset) => autocorrelation(onsets, Math.round(lag) + offset)),
      );
    const grid = Math.max(...[0.5, 1, 2, 4].map((beats) => near(beats * beatHops)));
    const offGrid = [1.375, 1.625, 2.375, 2.625, 3.375].map((beats) =>
      autocorrelation(onsets, Math.round(beats * beatHops)),
    );
    const offMean = offGrid.reduce((sum, value) => sum + value, 0) / offGrid.length;
    expect(grid).toBeGreaterThan(offMean + 0.03);
  });

  it('loops without a click or a level jump at the seam', () => {
    const { clip } = get(mood);
    const frames = clip.left.length;
    expect(frames).toBe(Math.round(DURATION_S * SR));
    for (const channel of [clip.left, clip.right]) {
      // Typical sample-to-sample step (99.9th percentile over a strided subset).
      const steps: number[] = [];
      for (let index = 0; index + 1 < frames; index += 7) {
        steps.push(Math.abs((channel[index + 1] ?? 0) - (channel[index] ?? 0)));
      }
      steps.sort((a, b) => a - b);
      const typical = steps[Math.floor(steps.length * 0.999)] ?? 0;
      expect(Math.abs((channel[0] ?? 0) - (channel[frames - 1] ?? 0))).toBeLessThanOrEqual(typical);
    }
    const mono = mixToMono(clip);
    const edge = SR;
    const head = mono.subarray(0, edge);
    const tail = mono.subarray(frames - edge);
    expect(Math.abs(20 * Math.log10(rmsOf(head) / rmsOf(tail)))).toBeLessThanOrEqual(6);
    const bands = (samples: Float32Array): number[] => {
      const spectrum = powerSpectrum(samples, 2048);
      const out: number[] = [];
      for (let hz = 100; hz < 8000; hz *= 2) out.push(db(bandPower(spectrum, hz, hz * 2)));
      return out;
    };
    const a = bands(head);
    const b = bands(tail);
    const distance = a.reduce((sum, value, index) => sum + Math.abs(value - (b[index] ?? 0)), 0);
    expect(distance / a.length).toBeLessThanOrEqual(8);
  });
});

describe('generateMusic', () => {
  it('renders byte-identical beds for the same request and different ones per seed', () => {
    const options = { mood: 'bright-explainer', seed: 2, durationS: 8 } as const;
    const first = generateMusic(options);
    expect(hash(generateMusic(options).clip)).toBe(hash(first.clip));
    expect(hash(generateMusic({ ...options, seed: 3 }).clip)).not.toBe(hash(first.clip));
  });

  it('renders a one-shot (non-loop) bed that fades to silence', () => {
    const { clip } = generateMusic({ mood: 'calm-tech', seed: 1, durationS: 8, loopable: false });
    expect(Math.abs(clip.left.at(-1) ?? 1)).toBeLessThan(1e-4);
  });
});
