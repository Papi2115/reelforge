/**
 * Synthesis building blocks shared by the SFX recipes and the music engine: band-limited
 * oscillators, a modulation-safe state-variable filter, one-pole filters, envelopes, saturation,
 * bit-crushing and stereo placement. All pure and deterministic (no clocks, no Math.random).
 */
import type { StereoClip } from './clip.js';
import { MIX_SAMPLE_RATE } from './dsp.js';

const SR = MIX_SAMPLE_RATE;
const TAU = 2 * Math.PI;

/** PolyBLEP residual that removes most aliasing from a saw/square discontinuity. */
function polyBlep(phase: number, step: number): number {
  if (phase < step) {
    const x = phase / step;
    return x + x - x * x - 1;
  }
  if (phase > 1 - step) {
    const x = (phase - 1) / step;
    return x * x + x + x + 1;
  }
  return 0;
}

/** Phase accumulator (0..1) with band-limited waveforms; frequency may change per sample. */
export class Osc {
  private phase: number;
  /** Phase increment of the last advance (for the BLEP residuals). */
  private step = 0;

  constructor(
    initialPhase = 0,
    private readonly sampleRate: number = SR,
  ) {
    this.phase = initialPhase - Math.floor(initialPhase);
  }

  /** Returns the current phase and advances it (no allocation: this runs per sample). */
  private advance(frequency: number): number {
    const phase = this.phase;
    this.step = Math.min(0.5, Math.abs(frequency) / this.sampleRate);
    this.phase += this.step;
    if (this.phase >= 1) this.phase -= 1;
    return phase;
  }

  sine(frequency: number): number {
    return Math.sin(TAU * this.advance(frequency));
  }

  /** Sine with phase modulation (radians), for FM voices. */
  pm(frequency: number, modulation: number): number {
    return Math.sin(TAU * this.advance(frequency) + modulation);
  }

  saw(frequency: number): number {
    const phase = this.advance(frequency);
    return 2 * phase - 1 - polyBlep(phase, this.step);
  }

  square(frequency: number, width = 0.5): number {
    const phase = this.advance(frequency);
    let value = phase < width ? 1 : -1;
    value += polyBlep(phase, this.step);
    const shifted = phase - width + (phase < width ? 1 : 0);
    value -= polyBlep(shifted, this.step);
    return value;
  }

  /** Triangle (harmonics fall at 12 dB/oct, so aliasing stays negligible without BLEP). */
  triangle(frequency: number): number {
    const phase = this.advance(frequency);
    const shifted = phase + 0.25 - (phase >= 0.75 ? 1 : 0);
    // Starts at 0 and rises, like sine(), so note onsets do not jump.
    return 1 - 4 * Math.abs(shifted - 0.5);
  }
}

/** Topology-preserving state-variable filter (Simper); stable under fast cutoff modulation. */
export class Svf {
  private ic1 = 0;
  private ic2 = 0;
  private g = 0;
  private k = 1;
  private a1 = 1;
  private a2 = 0;
  private a3 = 0;
  low = 0;
  band = 0;
  high = 0;

  constructor(private readonly sampleRate: number = SR) {}

  set(cutoff: number, q: number): this {
    const clamped = Math.min(Math.max(cutoff, 15), this.sampleRate * 0.45);
    this.g = Math.tan((Math.PI * clamped) / this.sampleRate);
    this.k = 1 / Math.max(q, 0.1);
    this.a1 = 1 / (1 + this.g * (this.g + this.k));
    this.a2 = this.g * this.a1;
    this.a3 = this.g * this.a2;
    return this;
  }

  /** Processes one sample; returns the low-pass output (band/high are kept on the instance). */
  process(input: number): number {
    const v3 = input - this.ic2;
    const v1 = this.a1 * this.ic1 + this.a2 * v3;
    const v2 = this.ic2 + this.a2 * this.ic1 + this.a3 * v3;
    this.ic1 = 2 * v1 - this.ic1;
    this.ic2 = 2 * v2 - this.ic2;
    this.low = v2;
    this.band = v1;
    this.high = input - this.k * v1 - v2;
    return v2;
  }
}

/** One-pole low-pass (6 dB/oct); `high()` gives the complementary high-pass. */
export class OnePole {
  private coefficient = 0;
  private state = 0;

  constructor(
    cutoff: number,
    private readonly sampleRate: number = SR,
  ) {
    this.set(cutoff);
  }

  set(cutoff: number): this {
    this.coefficient = Math.exp((-TAU * Math.max(cutoff, 1)) / this.sampleRate);
    return this;
  }

  low(input: number): number {
    this.state = (1 - this.coefficient) * input + this.coefficient * this.state;
    return this.state;
  }

  high(input: number): number {
    return input - this.low(input);
  }
}

/** Smooth attack (raised cosine) then exponential decay; t in seconds since the onset. */
export function attackDecay(t: number, attackS: number, decayS: number): number {
  if (t < 0) return 0;
  if (t < attackS) return 0.5 - 0.5 * Math.cos((Math.PI * t) / attackS);
  return Math.exp(-(t - attackS) / Math.max(decayS, 1e-4));
}

/** Attack, hold at 1, then a raised-cosine release ending at `lengthS`. */
export function gateEnvelope(
  t: number,
  attackS: number,
  releaseS: number,
  lengthS: number,
): number {
  if (t < 0 || t >= lengthS) return 0;
  const rise = t < attackS ? 0.5 - 0.5 * Math.cos((Math.PI * t) / attackS) : 1;
  const left = lengthS - t;
  const fall = left < releaseS ? 0.5 - 0.5 * Math.cos((Math.PI * left) / releaseS) : 1;
  return rise * fall;
}

/** Asymmetric swell 0 -> 1 (at `peakAt`) -> 0 over position 0..1, with curve powers. */
export function swell(position: number, peakAt: number, risePower = 2, fallPower = 2): number {
  if (position <= 0 || position >= 1) return 0;
  if (position < peakAt) {
    return (0.5 - 0.5 * Math.cos((Math.PI * position) / peakAt)) ** (risePower / 2);
  }
  const fall = (position - peakAt) / (1 - peakAt);
  return (0.5 + 0.5 * Math.cos(Math.PI * fall)) ** (fallPower / 2);
}

/** Exponential interpolation between two positive values. */
export function expLerp(from: number, to: number, position: number): number {
  return from * (to / from) ** Math.min(1, Math.max(0, position));
}

/** Normalized tanh saturation: unity slope at 0 for drive -> 0, bounded by 1/tanh(drive). */
export function saturate(value: number, drive: number): number {
  return Math.tanh(drive * value) / Math.tanh(drive);
}

export interface CrushOptions {
  /** Quantizer resolution (e.g. 6 = 64 levels). */
  readonly bits: number;
  /** Sample-and-hold length (samples), i.e. rate reduction by this factor. */
  readonly hold: number;
  /** Crushed share in the output (0..1). */
  readonly mix: number;
}

/**
 * "Pixel" flavour: rate reduction + quantization, mixed in place. The crushed path is low-passed
 * (tames aliasing fizz) and high-passed (quantizing a decaying tone leaves low-frequency steps).
 */
export function bitcrush(samples: Float32Array, options: CrushOptions): Float32Array {
  const levels = 2 ** (options.bits - 1);
  const smooth = new OnePole(9000);
  const steps = new OnePole(120);
  const hold = Math.max(1, Math.round(options.hold));
  let held = 0;
  for (let index = 0; index < samples.length; index++) {
    const dry = samples[index] ?? 0;
    if (index % hold === 0) held = Math.round(dry * levels) / levels;
    const crushed = steps.high(smooth.low(held));
    samples[index] = dry * (1 - options.mix) + crushed * options.mix;
  }
  return samples;
}

export function createStereo(frames: number): StereoClip {
  return { left: new Float32Array(frames), right: new Float32Array(frames) };
}

/** Equal-power pan gains normalized to unity at the centre (-1 = left, 1 = right). */
export function panGains(pan: number): { readonly left: number; readonly right: number } {
  const angle = ((Math.max(-1, Math.min(1, pan)) + 1) * Math.PI) / 4;
  return { left: Math.cos(angle) * Math.SQRT2, right: Math.sin(angle) * Math.SQRT2 };
}

/** Adds `mono` into `target` at `start` with a gain and either a fixed pan or a pan per sample. */
export function addPanned(
  target: StereoClip,
  mono: Float32Array,
  start: number,
  gain: number,
  pan: number | ((position: number) => number),
): void {
  const end = Math.min(target.left.length, start + mono.length);
  let fixed = typeof pan === 'number' ? panGains(pan) : null;
  for (let at = Math.max(0, start); at < end; at++) {
    const offset = at - start;
    if (typeof pan === 'function') {
      fixed = panGains(pan(offset / Math.max(1, mono.length - 1)));
    }
    const value = (mono[offset] ?? 0) * gain;
    target.left[at] = (target.left[at] ?? 0) + value * (fixed?.left ?? 1);
    target.right[at] = (target.right[at] ?? 0) + value * (fixed?.right ?? 1);
  }
}

/** Adds `source` (stereo) into `target` at `start` with a gain. */
export function addStereo(target: StereoClip, source: StereoClip, start: number, gain = 1): void {
  const end = Math.min(target.left.length, start + source.left.length);
  for (let at = Math.max(0, start); at < end; at++) {
    target.left[at] = (target.left[at] ?? 0) + (source.left[at - start] ?? 0) * gain;
    target.right[at] = (target.right[at] ?? 0) + (source.right[at - start] ?? 0) * gain;
  }
}

/** Fills a buffer of `frames` samples from a per-sample generator (index, seconds). */
export function render(frames: number, sample: (index: number, t: number) => number): Float32Array {
  const out = new Float32Array(frames);
  for (let index = 0; index < frames; index++) out[index] = sample(index, index / SR);
  return out;
}

export function midiToHz(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12);
}
