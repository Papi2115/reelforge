/**
 * Layer generators for the SFX recipes: enveloped tones (with pitch glides), filtered noise with
 * swept filters, modal "bell" partial sets, 2-operator FM, and stereo helpers. Every generator
 * adds into a mono buffer at an onset, so recipes are compositions of a few calls.
 */
import type { StereoClip } from '../clip.js';
import { Biquad, BrownNoise, MIX_SAMPLE_RATE, PinkNoise, whiteNoise, type Rng } from '../dsp.js';
import { Osc, Svf, attackDecay, createStereo, panGains } from '../synth.js';

export const SR = MIX_SAMPLE_RATE;

export type SfxCategory = 'motion' | 'impact' | 'texture' | 'ui' | 'tonal';

export interface SfxContext {
  readonly frames: number;
  readonly durationS: number;
  readonly rng: Rng;
}

export interface SfxVariant {
  readonly name: string;
  readonly render: (ctx: SfxContext) => StereoClip;
}

export interface SfxDefinition {
  readonly durationS: number;
  readonly category: SfxCategory;
  /** One line for docs/sfx.md and the Sound panel. */
  readonly use: string;
  readonly variants: readonly SfxVariant[];
}

/** Uniform value in [from, to) from the recipe's seeded stream. */
export function between(rng: Rng, from: number, to: number): number {
  return from + (to - from) * rng();
}

/** Multiplies `value` by up to ±`spread` (relative), seeded: per-use micro-variation. */
export function jitter(rng: Rng, value: number, spread: number): number {
  return value * (1 + spread * (2 * rng() - 1));
}

type Curve = number | ((t: number) => number);
const at = (curve: Curve, t: number): number => (typeof curve === 'number' ? curve : curve(t));

/** Frames an exponential envelope needs to fall below -100 dB. */
const tailFrames = (attackS: number, decayS: number): number =>
  Math.ceil((attackS + decayS * 11.5) * SR);

export interface ToneOptions {
  readonly startS?: number;
  /** Hz, or Hz as a function of seconds since the onset (pitch glides). */
  readonly freq: Curve;
  readonly wave?: 'sine' | 'triangle' | 'square' | 'saw';
  readonly width?: number;
  readonly attackS: number;
  readonly decayS: number;
  readonly gain?: number;
  readonly phase?: number;
  /** Gate length: the note is released (12 ms raised cosine) and ends here. */
  readonly lengthS?: number;
}

const GATE_RELEASE_S = 0.012;

function gate(t: number, lengthS: number | undefined): number {
  if (lengthS === undefined) return 1;
  const left = lengthS - t;
  if (left <= 0) return 0;
  return left < GATE_RELEASE_S ? 0.5 - 0.5 * Math.cos((Math.PI * left) / GATE_RELEASE_S) : 1;
}

export function addTone(out: Float32Array, options: ToneOptions): void {
  const start = Math.round((options.startS ?? 0) * SR);
  const osc = new Osc(options.phase ?? 0);
  const ring = tailFrames(options.attackS, options.decayS);
  const length = options.lengthS === undefined ? ring : Math.round(options.lengthS * SR);
  const end = Math.min(out.length, start + Math.min(ring, length));
  const gain = options.gain ?? 1;
  const wave = options.wave ?? 'sine';
  for (let index = Math.max(0, start); index < end; index++) {
    const t = (index - start) / SR;
    const hz = at(options.freq, t);
    const value =
      wave === 'sine'
        ? osc.sine(hz)
        : wave === 'triangle'
          ? osc.triangle(hz)
          : wave === 'saw'
            ? osc.saw(hz)
            : osc.square(hz, options.width ?? 0.5);
    const envelope = attackDecay(t, options.attackS, options.decayS) * gate(t, options.lengthS);
    out[index] = (out[index] ?? 0) + gain * value * envelope;
  }
}

export interface NoiseOptions {
  readonly startS?: number;
  readonly lengthS: number;
  readonly color?: 'white' | 'pink' | 'brown';
  readonly filter?: 'lp' | 'bp' | 'hp';
  /** Cutoff/centre Hz, or a function of seconds since the onset. */
  readonly freq?: Curve;
  readonly q?: number;
  /** Extra 12 dB/oct high-pass (keeps rumble out of brown/pink layers). */
  readonly highpassHz?: number;
  /** Gain as a function of seconds since the onset. */
  readonly envelope: (t: number) => number;
  readonly gain?: number;
}

/** Filtered noise with a swept filter (coefficients refreshed every 16 samples). */
export function addNoise(out: Float32Array, rng: Rng, options: NoiseOptions): void {
  const start = Math.round((options.startS ?? 0) * SR);
  const end = Math.min(out.length, start + Math.round(options.lengthS * SR));
  const pink = new PinkNoise(rng);
  const brown = new BrownNoise(rng);
  const filter = new Svf();
  const highpass =
    options.highpassHz === undefined ? null : new Biquad().highpass(options.highpassHz);
  const gain = options.gain ?? 1;
  const q = options.q ?? 0.8;
  const freq = options.freq ?? 1000;
  if (typeof freq === 'number') filter.set(freq, q);
  for (let index = Math.max(0, start); index < end; index++) {
    const t = (index - start) / SR;
    const source =
      options.color === 'pink'
        ? pink.next() * 2.5
        : options.color === 'brown'
          ? brown.next()
          : whiteNoise(rng);
    let value = source;
    if (options.filter !== undefined) {
      // Swept filters update every 2 samples: coarser steps leave an audible zipper tone.
      if (typeof freq !== 'number' && (index - start) % 2 === 0) filter.set(freq(t), q);
      filter.process(source);
      // The SVF band output peaks at Q; dividing by Q gives a unity-gain band-pass.
      value =
        options.filter === 'lp'
          ? filter.low
          : options.filter === 'hp'
            ? filter.high
            : filter.band / q;
    }
    if (highpass !== null) value = highpass.process(value);
    out[index] = (out[index] ?? 0) + gain * value * options.envelope(t);
  }
}

/** [frequency ratio, relative gain, decay seconds] of one mode. */
export type Mode = readonly [number, number, number];

/** Struck glass/metal partials (slightly inharmonic, upper modes die fast). */
export const BELL_MODES: readonly Mode[] = [
  [1, 1, 0.55],
  [2.01, 0.45, 0.3],
  [2.76, 0.3, 0.18],
  [4.07, 0.15, 0.1],
  [5.4, 0.08, 0.06],
];
/** Wooden bar (marimba-ish): fundamental + 4th and 10th harmonics. */
export const WOOD_MODES: readonly Mode[] = [
  [1, 1, 0.22],
  [3.93, 0.25, 0.05],
  [9.8, 0.06, 0.015],
];
/** Small metal ping (glockenspiel). */
export const GLOCK_MODES: readonly Mode[] = [
  [1, 1, 0.7],
  [2.76, 0.25, 0.25],
  [5.4, 0.12, 0.08],
  [8.93, 0.05, 0.03],
];

export interface ModalOptions {
  readonly startS?: number;
  readonly freq: number;
  readonly modes: readonly Mode[];
  readonly attackS?: number;
  /** Scales every decay (longer/shorter ring). */
  readonly decayScale?: number;
  readonly gain?: number;
}

export function addModal(out: Float32Array, options: ModalOptions): void {
  for (const [ratio, level, decayS] of options.modes) {
    const hz = options.freq * ratio;
    if (hz > SR * 0.45) continue;
    addTone(out, {
      startS: options.startS ?? 0,
      freq: hz,
      attackS: options.attackS ?? 0.0015,
      decayS: decayS * (options.decayScale ?? 1),
      gain: (options.gain ?? 1) * level,
    });
  }
}

export interface FmOptions {
  readonly startS?: number;
  readonly freq: number;
  /** Modulator frequency / carrier frequency. */
  readonly ratio: number;
  /** Peak modulation index (radians), decaying towards `indexFloor`. */
  readonly index: number;
  readonly indexDecayS: number;
  readonly indexFloor?: number;
  readonly attackS: number;
  readonly decayS: number;
  readonly gain?: number;
}

/** 2-operator FM (phase modulation) with a decaying index: e-piano tines, bells, soft plucks. */
export function addFm(out: Float32Array, options: FmOptions): void {
  const start = Math.round((options.startS ?? 0) * SR);
  const carrier = new Osc();
  const modulator = new Osc();
  const end = Math.min(out.length, start + tailFrames(options.attackS, options.decayS));
  const floor = options.indexFloor ?? 0;
  for (let index = Math.max(0, start); index < end; index++) {
    const t = (index - start) / SR;
    const depth = floor + (options.index - floor) * Math.exp(-t / options.indexDecayS);
    const modulation = depth * modulator.sine(options.freq * options.ratio);
    const value = carrier.pm(options.freq, modulation);
    out[index] =
      (out[index] ?? 0) +
      (options.gain ?? 1) * value * attackDecay(t, options.attackS, options.decayS);
  }
}

/** Places a mono buffer in stereo: fixed pan plus an optional tiny inter-channel delay (Haas). */
export function placeMono(mono: Float32Array, pan = 0, haasMs = 0): StereoClip {
  const out = createStereo(mono.length);
  const gains = panGains(pan);
  const delay = Math.round((Math.abs(haasMs) / 1000) * SR);
  for (let index = 0; index < mono.length; index++) {
    const direct = mono[index] ?? 0;
    const delayed = index >= delay ? (mono[index - delay] ?? 0) : 0;
    // Haas: the far side gets a delayed copy blended in (keeps mono compatibility high).
    const left = haasMs > 0 ? 0.7 * direct + 0.3 * delayed : direct;
    const right = haasMs < 0 ? 0.7 * direct + 0.3 * delayed : direct;
    out.left[index] = left * gains.left;
    out.right[index] = right * gains.right;
  }
  return out;
}

/** Stereo noise: a shared component plus independent per-side noise (`width` 0..1). */
export function stereoNoise(
  frames: number,
  rng: Rng,
  width: number,
  layer: (out: Float32Array, rng: Rng) => void,
): StereoClip {
  const shared = new Float32Array(frames);
  const left = new Float32Array(frames);
  const right = new Float32Array(frames);
  layer(shared, rng);
  layer(left, rng);
  layer(right, rng);
  const sharedGain = Math.sqrt(1 - width * 0.8);
  const sideGain = Math.sqrt(width * 0.8);
  const out = createStereo(frames);
  for (let index = 0; index < frames; index++) {
    out.left[index] = sharedGain * (shared[index] ?? 0) + sideGain * (left[index] ?? 0);
    out.right[index] = sharedGain * (shared[index] ?? 0) + sideGain * (right[index] ?? 0);
  }
  return out;
}

/** Applies a balance sweep to a stereo clip in place (pan as a function of position 0..1). */
export function panSweep(clip: StereoClip, pan: (position: number) => number): StereoClip {
  const frames = clip.left.length;
  for (let index = 0; index < frames; index++) {
    const gains = panGains(pan(index / Math.max(1, frames - 1)));
    clip.left[index] = (clip.left[index] ?? 0) * gains.left;
    clip.right[index] = (clip.right[index] ?? 0) * gains.right;
  }
  return clip;
}

/** Sums stereo clips (same length) with gains. */
export function sumStereo(
  frames: number,
  parts: readonly (readonly [StereoClip, number])[],
): StereoClip {
  const out = createStereo(frames);
  for (const [clip, gain] of parts) {
    for (let index = 0; index < frames; index++) {
      out.left[index] = (out.left[index] ?? 0) + gain * (clip.left[index] ?? 0);
      out.right[index] = (out.right[index] ?? 0) + gain * (clip.right[index] ?? 0);
    }
  }
  return out;
}
