/**
 * Objective QA of every built-in SFX recipe x variant (what can be checked without ears): no
 * clipping, no DC, clean edges (no clicks), loudness per category, sensible spectral centroid,
 * audible on small speakers, mono-safe stereo, deterministic, variants really differ, and no
 * excessive silence padding. Subjective quality is judged by listening to the audition files
 * (`pnpm --filter @reelforge/pipeline audio:demos`).
 */
import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  bandShare,
  kWeighted,
  maxWindowRms,
  mixToMono,
  powerSpectrum,
  spectralCentroid,
  stereoCorrelation,
  type PowerSpectrum,
} from './analysis.js';
import type { StereoClip } from './clip.js';
import { dbToGain, peakOf, secondsToFrames } from './dsp.js';
import {
  SFX_CATEGORY,
  SFX_DEFAULT_DURATION_S,
  SFX_LEVEL_DB,
  SFX_RECIPES,
  SFX_VARIANTS,
  synthesizeSfx,
  type SfxRecipe,
} from './sfx.js';

/** Expected spectral centroid (Hz, power-weighted, mono) per recipe. */
const CENTROID_HZ: Readonly<Record<SfxRecipe, readonly [number, number]>> = {
  whoosh: [1000, 7000],
  'swoosh-in': [1500, 6500],
  'swoosh-out': [1500, 6500],
  riser: [600, 5000],
  downer: [250, 4000],
  hit: [40, 600],
  'hit-soft': [40, 600],
  boom: [25, 300],
  stamp: [80, 600],
  'whoosh-impact': [150, 2000],
  snap: [2000, 6000],
  pop: [200, 1500],
  bubble: [300, 2500],
  'bubble-up': [500, 2500],
  typewriter: [1500, 4000],
  glitch: [800, 4000],
  scribble: [2500, 6500],
  paper: [2000, 6000],
  'camera-shutter': [2500, 6000],
  click: [700, 5000],
  tick: [3000, 7000],
  tock: [400, 1500],
  blip: [500, 2000],
  'blip-up': [500, 2000],
  'blip-down': [500, 2000],
  notification: [600, 2000],
  success: [600, 2000],
  'error-buzz': [100, 600],
  ding: [900, 2500],
  chime: [1000, 2500],
  coin: [1200, 3000],
  sparkle: [3000, 7000],
};

/** Minimum power share above 150 Hz (phone speakers); impacts are allowed a heavier sub. */
const MIN_AUDIBLE_SHARE: Partial<Record<SfxRecipe, number>> = {
  hit: 0.03,
  'hit-soft': 0.03,
  stamp: 0.03,
  boom: 0.015,
};

interface Measured {
  readonly recipe: SfxRecipe;
  readonly variant: string;
  readonly clip: StereoClip;
  readonly mono: Float32Array;
  readonly spectrum: PowerSpectrum;
}

const LABELS = SFX_RECIPES.flatMap((recipe) =>
  SFX_VARIANTS[recipe].map((variant, seed) => ({ recipe, variant, seed })),
);
const measured = new Map<string, Measured>();
const key = (recipe: SfxRecipe, variant: string): string => `${recipe}/${variant}`;

function get(recipe: SfxRecipe, variant: string): Measured {
  const value = measured.get(key(recipe, variant));
  if (value === undefined) throw new Error(`not measured: ${key(recipe, variant)}`);
  return value;
}

const db = (value: number): number => 20 * Math.log10(Math.max(value, 1e-12));

/** Half-octave band levels (dB re total) from 40 Hz to 16 kHz. */
function bandProfile(spectrum: PowerSpectrum): number[] {
  const bands: number[] = [];
  for (let low = 40; low < 16_000; low *= Math.SQRT2) {
    bands.push(10 * Math.log10(Math.max(bandShare(spectrum, low, low * Math.SQRT2), 1e-6)));
  }
  return bands;
}

/** Band profiles of the first and the second half (so melodic direction counts too). */
function timeBandProfile(mono: Float32Array): number[] {
  const half = Math.floor(mono.length / 2);
  return [
    ...bandProfile(powerSpectrum(mono.subarray(0, half), 1024)),
    ...bandProfile(powerSpectrum(mono.subarray(half), 1024)),
  ];
}

beforeAll(() => {
  for (const { recipe, variant, seed } of LABELS) {
    const clip = synthesizeSfx(recipe, { seed });
    const mono = mixToMono(clip);
    measured.set(key(recipe, variant), {
      recipe,
      variant,
      clip,
      mono,
      spectrum: powerSpectrum(mono, 2048),
    });
  }
}, 120_000);

describe.each(LABELS)('$recipe / $variant', ({ recipe, variant, seed }) => {
  it('does not clip and has no DC offset', () => {
    const { clip } = get(recipe, variant);
    for (const channel of [clip.left, clip.right]) {
      expect(db(peakOf(channel))).toBeLessThanOrEqual(-1);
      const mean = channel.reduce((sum, value) => sum + value, 0) / channel.length;
      expect(Math.abs(mean)).toBeLessThan(3e-3);
    }
  });

  it('has click-free edges and a natural tail', () => {
    const { mono } = get(recipe, variant);
    const peak = peakOf(mono);
    const head = peakOf(mono.subarray(0, secondsToFrames(0.00025)));
    const tail = peakOf(mono.subarray(mono.length - secondsToFrames(0.005)));
    expect(head / peak).toBeLessThanOrEqual(0.25);
    expect(db(tail / peak)).toBeLessThanOrEqual(-20);
  });

  it('sits in its category loudness band', () => {
    const { clip } = get(recipe, variant);
    const window = secondsToFrames(0.05);
    const level = db(
      Math.max(
        maxWindowRms(kWeighted(clip.left), window),
        maxWindowRms(kWeighted(clip.right), window),
      ),
    );
    const target = SFX_LEVEL_DB[SFX_CATEGORY[recipe]];
    expect(level).toBeLessThanOrEqual(target + 0.5);
    expect(level).toBeGreaterThanOrEqual(target - 10);
  });

  it('has its expected spectral shape', () => {
    const { spectrum } = get(recipe, variant);
    const [low, high] = CENTROID_HZ[recipe];
    const centroid = spectralCentroid(spectrum);
    expect(centroid).toBeGreaterThanOrEqual(low);
    expect(centroid).toBeLessThanOrEqual(high);
    // Audible on phone speakers (not only sub), and never dominated by fizz above 10 kHz.
    expect(bandShare(spectrum, 150, 24_000)).toBeGreaterThanOrEqual(
      MIN_AUDIBLE_SHARE[recipe] ?? 0.1,
    );
    expect(bandShare(spectrum, 10_000, 24_000)).toBeLessThanOrEqual(0.3);
  });

  it('is mono-compatible stereo', () => {
    const { clip, mono } = get(recipe, variant);
    expect(stereoCorrelation(clip)).toBeGreaterThanOrEqual(0.3);
    const energy = (samples: Float32Array): number =>
      samples.reduce((sum, value) => sum + value * value, 0);
    const sides = (energy(clip.left) + energy(clip.right)) / 2;
    expect(energy(mono) / sides).toBeGreaterThanOrEqual(0.6);
  });

  it('is not padded with silence and stays within its duration range', () => {
    const { mono } = get(recipe, variant);
    const durationS = SFX_DEFAULT_DURATION_S[recipe];
    expect(durationS).toBeGreaterThanOrEqual(0.03);
    expect(durationS).toBeLessThanOrEqual(2.5);
    const window = secondsToFrames(0.005);
    const floor = peakOf(mono) * dbToGain(-40);
    let lastLoud = 0;
    for (let start = 0; start + window <= mono.length; start += window) {
      if (peakOf(mono.subarray(start, start + window)) > floor) lastLoud = start + window;
    }
    expect(lastLoud / mono.length).toBeGreaterThanOrEqual(0.4);
  });

  it('renders byte-identical output for the same seed', () => {
    const hash = (clip: StereoClip): string =>
      createHash('sha256')
        .update(Buffer.from(clip.left.buffer))
        .update(Buffer.from(clip.right.buffer))
        .digest('hex');
    expect(hash(synthesizeSfx(recipe, { seed }))).toBe(hash(get(recipe, variant).clip));
  });
});

describe.each(SFX_RECIPES)('%s variants', (recipe) => {
  it('differ from each other (half-octave spectral profile over time, or envelope)', () => {
    const variants = SFX_VARIANTS[recipe].map((variant) => get(recipe, variant));
    for (const [index, first] of variants.entries()) {
      for (const second of variants.slice(index + 1)) {
        const a = timeBandProfile(first.mono);
        const b = timeBandProfile(second.mono);
        const spectral = a.reduce((sum, value, band) => sum + Math.abs(value - (b[band] ?? 0)), 0);
        const envelope = (samples: Float32Array): number[] => {
          const hop = secondsToFrames(0.01);
          return Array.from({ length: Math.floor(samples.length / hop) }, (_, block) =>
            peakOf(samples.subarray(block * hop, (block + 1) * hop)),
          );
        };
        const ea = envelope(first.mono);
        const eb = envelope(second.mono);
        const temporal = ea.reduce(
          (sum, value, block) => sum + Math.abs(value - (eb[block] ?? 0)),
          0,
        );
        const label = `${first.variant} vs ${second.variant}`;
        expect(spectral / a.length > 1.5 || temporal / ea.length > 0.03, label).toBe(true);
      }
    }
  });
});

describe('determinism guard', () => {
  it('synth sources use no clocks, timers or unseeded randomness', async () => {
    const dir = import.meta.dirname;
    const files = [
      ...['sfx.ts', 'synth.ts', 'reverb.ts', 'analysis.ts', 'dsp.ts'].map((name) =>
        path.join(dir, name),
      ),
      ...(await readdir(path.join(dir, 'sfx'))).map((name) => path.join(dir, 'sfx', name)),
      ...(await readdir(path.join(dir, 'music')))
        .filter((name) => !name.endsWith('.test.ts'))
        .map((name) => path.join(dir, 'music', name)),
    ];
    for (const file of files) {
      const source = await readFile(file, 'utf8');
      const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
      expect(code, file).not.toMatch(/Math\.random|Date\.now|new Date|performance\.now|setTimeout/);
    }
  });
});
