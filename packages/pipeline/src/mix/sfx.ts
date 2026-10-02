/**
 * Built-in SFX recipes, synthesized offline in pure Node (deterministic; no OfflineAudioContext /
 * Chromium). Each recipe returns a mono 48 kHz clip normalized to a -6 dBFS peak, so a cue's
 * `gainDb` is relative to a consistent reference.
 */
import {
  Biquad,
  MIX_SAMPLE_RATE,
  Oscillator,
  fadeEdges,
  mulberry32,
  normalizePeak,
  secondsToFrames,
  whiteNoise,
  type Rng,
} from './dsp.js';
import type { FfmpegError } from '../ffmpeg/errors.js';
import type { Result } from '../result.js';
import { writeWavAtomic } from './wav.js';

export const SFX_RECIPES = [
  'whoosh',
  'click',
  'hit',
  'typewriter',
  'riser',
  'glitch',
  'tick',
  'pop',
] as const;
export type SfxRecipe = (typeof SFX_RECIPES)[number];

/** Default length per recipe (seconds); `durationS` on a cue overrides it. */
export const SFX_DEFAULT_DURATION_S: Readonly<Record<SfxRecipe, number>> = {
  whoosh: 0.6,
  click: 0.03,
  hit: 0.6,
  typewriter: 1.2,
  riser: 2,
  glitch: 0.35,
  tick: 0.02,
  pop: 0.08,
};

export const SFX_MIN_DURATION_S = 0.01;
export const SFX_MAX_DURATION_S = 10;
/** Peak level of every synthesized SFX (linear, -6 dBFS). */
export const SFX_PEAK = 0.5;

export interface SfxSynthOptions {
  readonly seed: number;
  readonly durationS?: number | undefined;
}

type Recipe = (frames: number, rng: Rng) => Float32Array;

const SR = MIX_SAMPLE_RATE;
/** Coefficient refresh interval for swept filters (samples). */
const SWEEP_STEP = 16;

function whoosh(frames: number, rng: Rng): Float32Array {
  const out = new Float32Array(frames);
  const filter = new Biquad();
  const shimmer = new Biquad().highpass(2500);
  for (let index = 0; index < frames; index++) {
    const position = index / frames;
    if (index % SWEEP_STEP === 0) filter.bandpass(300 * 10 ** Math.sin(Math.PI * position), 1.6);
    const envelope = Math.sin(Math.PI * position) ** 2;
    const noise = whiteNoise(rng);
    out[index] = (filter.process(noise) + 0.08 * shimmer.process(noise)) * envelope;
  }
  return out;
}

function click(frames: number, rng: Rng): Float32Array {
  const out = new Float32Array(frames);
  const tone = new Oscillator();
  for (let index = 0; index < frames; index++) {
    const t = index / SR;
    out[index] =
      0.6 * whiteNoise(rng) * Math.exp(-t / 0.002) + tone.sine(2500) * Math.exp(-t / 0.004);
  }
  return out;
}

function tick(frames: number): Float32Array {
  const out = new Float32Array(frames);
  const high = new Oscillator();
  const higher = new Oscillator();
  for (let index = 0; index < frames; index++) {
    const t = index / SR;
    out[index] =
      high.sine(4200) * Math.exp(-t / 0.0015) + 0.4 * higher.sine(6300) * Math.exp(-t / 0.001);
  }
  return out;
}

function hit(frames: number, rng: Rng): Float32Array {
  const out = new Float32Array(frames);
  const body = new Oscillator();
  const transient = new Biquad().lowpass(3000);
  const decay = (frames / SR) * 0.3;
  for (let index = 0; index < frames; index++) {
    const t = index / SR;
    const pitch = 45 + 100 * Math.exp(-t / 0.04);
    const attack = Math.min(1, t / 0.001);
    out[index] =
      attack * body.sine(pitch) * Math.exp(-t / decay) +
      0.5 * transient.process(whiteNoise(rng)) * Math.exp(-t / 0.01);
  }
  return out;
}

function pop(frames: number): Float32Array {
  const out = new Float32Array(frames);
  const body = new Oscillator();
  for (let index = 0; index < frames; index++) {
    const t = index / SR;
    const attack = Math.min(1, t / 0.001);
    out[index] = attack * body.sine(220 + 500 * Math.exp(-t / 0.015)) * Math.exp(-t / 0.025);
  }
  return out;
}

/** One keystroke (mechanical clack + key resonance + low thump) added at `start`. */
function addKeystroke(out: Float32Array, start: number, rng: Rng): void {
  const length = Math.min(secondsToFrames(0.04), out.length - start);
  const clack = new Biquad().highpass(1500);
  const resonance = new Oscillator();
  const thump = new Oscillator();
  const pitch = 1800 + rng() * 700;
  const level = 0.7 + rng() * 0.3;
  for (let offset = 0; offset < length; offset++) {
    const t = offset / SR;
    const sample =
      clack.process(whiteNoise(rng)) * Math.exp(-t / 0.004) +
      0.3 * resonance.sine(pitch) * Math.exp(-t / 0.008) +
      0.4 * thump.sine(140) * Math.exp(-t / 0.012);
    const at = start + offset;
    out[at] = (out[at] ?? 0) + level * sample;
  }
}

function typewriter(frames: number, rng: Rng): Float32Array {
  const out = new Float32Array(frames);
  const lastStart = frames - secondsToFrames(0.03);
  let t = 0;
  while (secondsToFrames(t) < lastStart) {
    addKeystroke(out, secondsToFrames(t), rng);
    t += rng() < 0.12 ? 0.15 + rng() * 0.05 : 0.07 + rng() * 0.06;
  }
  return out;
}

function riser(frames: number, rng: Rng): Float32Array {
  const out = new Float32Array(frames);
  const tone = new Oscillator();
  const overtone = new Oscillator();
  const air = new Biquad();
  for (let index = 0; index < frames; index++) {
    const position = index / frames;
    const pitch = 200 * 10 ** position;
    if (index % SWEEP_STEP === 0) air.bandpass(500 * 8 ** position, 0.9);
    const voice = tone.sine(pitch) + 0.3 * overtone.sine(pitch * 2);
    out[index] = (0.6 * voice + 0.8 * air.process(whiteNoise(rng))) * position ** 2;
  }
  return out;
}

/** Writes one glitch segment of `kind` into `out[start, end)`. */
function glitchSegment(out: Float32Array, start: number, end: number, rng: Rng): void {
  const kind = Math.floor(rng() * 4);
  const level = 0.4 + rng() * 0.6;
  const frequency = 100 + rng() * 1100;
  const hold = 2 + Math.floor(rng() * 18);
  const steps = 2 + Math.floor(rng() * 6);
  const square = new Oscillator();
  const crushed = new Oscillator();
  let held = 0;
  for (let index = start; index < end; index++) {
    let sample = 0;
    if (kind === 0) {
      sample = square.sine(frequency) >= 0 ? 1 : -1;
    } else if (kind === 1) {
      if ((index - start) % hold === 0) held = whiteNoise(rng);
      sample = held;
    } else if (kind === 2) {
      sample = Math.round(crushed.sine(frequency) * steps) / steps;
    }
    out[index] = sample * level;
  }
}

function glitch(frames: number, rng: Rng): Float32Array {
  const out = new Float32Array(frames);
  let start = 0;
  while (start < frames) {
    const end = Math.min(frames, start + secondsToFrames(0.01 + rng() * 0.03));
    glitchSegment(out, start, end, rng);
    start = end;
  }
  return out;
}

const RECIPES: Readonly<Record<SfxRecipe, Recipe>> = {
  whoosh,
  click,
  hit,
  typewriter,
  riser,
  glitch,
  tick: (frames) => tick(frames),
  pop: (frames) => pop(frames),
};

/** Synthesizes `recipe` as a mono 48 kHz clip with a -6 dBFS peak (deterministic per seed). */
export function synthesizeSfx(recipe: SfxRecipe, options: SfxSynthOptions): Float32Array {
  const durationS = Math.min(
    SFX_MAX_DURATION_S,
    Math.max(SFX_MIN_DURATION_S, options.durationS ?? SFX_DEFAULT_DURATION_S[recipe]),
  );
  const frames = secondsToFrames(durationS);
  const samples = RECIPES[recipe](frames, mulberry32(options.seed));
  // A 2 ms tail fade avoids a click when a recipe is cut at its length.
  fadeEdges(samples, 0, secondsToFrames(0.002));
  return normalizePeak(samples, SFX_PEAK);
}

/** Writes a synthesized SFX as a mono 48 kHz 16-bit WAV (e.g. for the SFX library preview). */
export function writeSfxWav(
  filePath: string,
  recipe: SfxRecipe,
  options: SfxSynthOptions,
): Promise<Result<void, FfmpegError>> {
  return writeWavAtomic(filePath, [synthesizeSfx(recipe, options)], MIX_SAMPLE_RATE, 'pcm16');
}
