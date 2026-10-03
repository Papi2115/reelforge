/**
 * Deterministic DSP primitives for the offline SFX / ambience synth (pure Node, no Web Audio).
 * Everything is a pure function of its inputs and a seeded PRNG: the same seed gives the same
 * samples bit for bit (math in float64, results stored as float32).
 */

/** Sample rate of every synthesized clip, bus and mix output. */
export const MIX_SAMPLE_RATE = 48_000;

export type Rng = () => number;

/** mulberry32: small, fast, seedable PRNG returning floats in [0, 1). */
export function mulberry32(seed: number): Rng {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let mixed = state;
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4_294_967_296;
  };
}

/** FNV-1a 32-bit hash of a string; used to derive stable default seeds from cue content. */
export function hashSeed(text: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index++) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

/** Uniform white noise sample in [-1, 1). */
export function whiteNoise(rng: Rng): number {
  return rng() * 2 - 1;
}

export function secondsToFrames(seconds: number, sampleRate: number = MIX_SAMPLE_RATE): number {
  return Math.round(seconds * sampleRate);
}

export function dbToGain(db: number): number {
  return 10 ** (db / 20);
}

/** RBJ-cookbook biquad (transposed direct form II); coefficients may change per sample. */
export class Biquad {
  private b0 = 1;
  private b1 = 0;
  private b2 = 0;
  private a1 = 0;
  private a2 = 0;
  private z1 = 0;
  private z2 = 0;

  constructor(private readonly sampleRate: number = MIX_SAMPLE_RATE) {}

  private omega(frequency: number, q: number): { cos: number; alpha: number } {
    const clamped = Math.min(Math.max(frequency, 10), this.sampleRate * 0.45);
    const w0 = (2 * Math.PI * clamped) / this.sampleRate;
    return { cos: Math.cos(w0), alpha: Math.sin(w0) / (2 * Math.max(q, 0.05)) };
  }

  private set(b0: number, b1: number, b2: number, a0: number, a1: number, a2: number): this {
    this.b0 = b0 / a0;
    this.b1 = b1 / a0;
    this.b2 = b2 / a0;
    this.a1 = a1 / a0;
    this.a2 = a2 / a0;
    return this;
  }

  lowpass(frequency: number, q = Math.SQRT1_2): this {
    const { cos, alpha } = this.omega(frequency, q);
    return this.set((1 - cos) / 2, 1 - cos, (1 - cos) / 2, 1 + alpha, -2 * cos, 1 - alpha);
  }

  highpass(frequency: number, q = Math.SQRT1_2): this {
    const { cos, alpha } = this.omega(frequency, q);
    return this.set((1 + cos) / 2, -(1 + cos), (1 + cos) / 2, 1 + alpha, -2 * cos, 1 - alpha);
  }

  /** Band-pass with 0 dB peak gain. */
  bandpass(frequency: number, q = 1): this {
    const { cos, alpha } = this.omega(frequency, q);
    return this.set(alpha, 0, -alpha, 1 + alpha, -2 * cos, 1 - alpha);
  }

  /** Peaking EQ (bell) with `gainDb` at `frequency`. */
  peaking(frequency: number, q: number, gainDb: number): this {
    const { cos, alpha } = this.omega(frequency, q);
    const a = 10 ** (gainDb / 40);
    return this.set(1 + alpha * a, -2 * cos, 1 - alpha * a, 1 + alpha / a, -2 * cos, 1 - alpha / a);
  }

  /** Shelving EQ (slope 1): `low` boosts/cuts below `frequency`, otherwise above it. */
  shelf(kind: 'low' | 'high', frequency: number, gainDb: number): this {
    const { cos, alpha } = this.omega(frequency, Math.SQRT1_2);
    const a = 10 ** (gainDb / 40);
    const root = 2 * Math.sqrt(a) * alpha;
    const sign = kind === 'low' ? 1 : -1;
    const plus = a + 1;
    const minus = a - 1;
    return this.set(
      a * (plus - sign * minus * cos + root),
      sign * 2 * a * (minus - sign * plus * cos),
      a * (plus - sign * minus * cos - root),
      plus + sign * minus * cos + root,
      -sign * 2 * (minus + sign * plus * cos),
      plus + sign * minus * cos - root,
    );
  }

  process(input: number): number {
    const output = this.b0 * input + this.z1;
    this.z1 = this.b1 * input - this.a1 * output + this.z2;
    this.z2 = this.b2 * input - this.a2 * output;
    return output;
  }
}

/** Pink-ish noise (Paul Kellet's economy filter over white noise). */
export class PinkNoise {
  private b0 = 0;
  private b1 = 0;
  private b2 = 0;

  constructor(private readonly rng: Rng) {}

  next(): number {
    const white = whiteNoise(this.rng);
    this.b0 = 0.99765 * this.b0 + white * 0.099046;
    this.b1 = 0.963 * this.b1 + white * 0.2965164;
    this.b2 = 0.57 * this.b2 + white * 1.0526913;
    return (this.b0 + this.b1 + this.b2 + white * 0.1848) * 0.2;
  }
}

/** Brown noise: leaky integral of white noise. */
export class BrownNoise {
  private value = 0;

  constructor(private readonly rng: Rng) {}

  next(): number {
    this.value = (this.value + whiteNoise(this.rng) * 0.02) * 0.998;
    return this.value * 3;
  }
}

/** Phase-accumulating sine oscillator (frequency may change per sample without clicks). */
export class Oscillator {
  private phase: number;

  constructor(
    initialPhase = 0,
    private readonly sampleRate: number = MIX_SAMPLE_RATE,
  ) {
    this.phase = initialPhase;
  }

  /** Returns sin(phase) for the current sample, then advances by `frequency`. */
  sine(frequency: number): number {
    const value = Math.sin(this.phase);
    this.phase = (this.phase + (2 * Math.PI * frequency) / this.sampleRate) % (2 * Math.PI);
    return value;
  }
}

/** Smooth 0..1 S-curve for fades. */
export function fadeCurve(position: number): number {
  const clamped = Math.min(1, Math.max(0, position));
  return (1 - Math.cos(Math.PI * clamped)) / 2;
}

export function peakOf(samples: Float32Array): number {
  let peak = 0;
  for (const value of samples) peak = Math.max(peak, Math.abs(value));
  return peak;
}

export function rmsOf(samples: Float32Array): number {
  if (samples.length === 0) return 0;
  let sum = 0;
  for (const value of samples) sum += value * value;
  return Math.sqrt(sum / samples.length);
}

/** Scales in place so the absolute peak equals `peak` (silent input stays silent). */
export function normalizePeak(samples: Float32Array, peak: number): Float32Array {
  const current = peakOf(samples);
  if (current === 0) return samples;
  const scale = peak / current;
  for (let index = 0; index < samples.length; index++) {
    samples[index] = (samples[index] ?? 0) * scale;
  }
  return samples;
}

/** Applies S-curve fades at both ends in place. */
export function fadeEdges(
  samples: Float32Array,
  fadeInFrames: number,
  fadeOutFrames: number,
): void {
  const length = samples.length;
  const fadeIn = Math.min(fadeInFrames, length);
  for (let index = 0; index < fadeIn; index++) {
    samples[index] = (samples[index] ?? 0) * fadeCurve(index / fadeIn);
  }
  const fadeOut = Math.min(fadeOutFrames, length);
  for (let index = 0; index < fadeOut; index++) {
    const at = length - 1 - index;
    samples[at] = (samples[at] ?? 0) * fadeCurve(index / fadeOut);
  }
}
