/**
 * Small stereo algorithmic reverb (Schroeder / Freeverb topology: 8 damped parallel combs + 4
 * series allpasses per channel, right channel detuned for width). Unlike stock Freeverb the comb
 * feedback is derived from a target RT60, so tails are predictable (SFX keep them short).
 */
import type { StereoClip } from './clip.js';
import { MIX_SAMPLE_RATE } from './dsp.js';
import { OnePole, createStereo } from './synth.js';

/** Freeverb tunings (samples at 44.1 kHz), scaled to the mix rate. */
const COMB_TUNING = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617];
const ALLPASS_TUNING = [556, 441, 341, 225];
const STEREO_SPREAD = 23;
const TUNING_SCALE = MIX_SAMPLE_RATE / 44_100;

export interface ReverbOptions {
  /** Time for the tail to fall by 60 dB (seconds). */
  readonly decayS: number;
  /** 0 = bright, 1 = dark (high frequencies die faster). */
  readonly damping?: number;
  /** Wet level added to the dry signal. */
  readonly wet: number;
  /** Dry level (default 1). */
  readonly dry?: number;
  /** Room size scale for the delay lengths (0.5..1.5, default 1). */
  readonly size?: number;
  readonly preDelayMs?: number;
  /** Stereo width of the wet signal (0 = mono, 1 = full; default 0.7 keeps mono sums safe). */
  readonly width?: number;
  /** High-pass on the wet return, keeps the low end clean (default 200 Hz). */
  readonly lowCutHz?: number;
}

class Comb {
  private readonly buffer: Float64Array;
  private index = 0;
  private store = 0;

  constructor(
    length: number,
    private readonly feedback: number,
    private readonly damping: number,
  ) {
    this.buffer = new Float64Array(Math.max(1, length));
  }

  process(input: number): number {
    const output = this.buffer[this.index] ?? 0;
    this.store = output * (1 - this.damping) + this.store * this.damping;
    this.buffer[this.index] = input + this.store * this.feedback;
    this.index = (this.index + 1) % this.buffer.length;
    return output;
  }
}

class Allpass {
  private readonly buffer: Float64Array;
  private index = 0;

  constructor(length: number) {
    this.buffer = new Float64Array(Math.max(1, length));
  }

  process(input: number): number {
    const delayed = this.buffer[this.index] ?? 0;
    this.buffer[this.index] = input + delayed * 0.5;
    this.index = (this.index + 1) % this.buffer.length;
    return delayed - input;
  }
}

class ReverbChannel {
  private readonly combs: Comb[];
  private readonly allpasses: Allpass[];

  constructor(options: ReverbOptions, spread: number) {
    const size = options.size ?? 1;
    const damping = Math.min(0.95, Math.max(0, options.damping ?? 0.4));
    this.combs = COMB_TUNING.map((tuning) => {
      const length = Math.round((tuning + spread) * TUNING_SCALE * size);
      const feedback = 10 ** ((-3 * length) / (Math.max(0.05, options.decayS) * MIX_SAMPLE_RATE));
      return new Comb(length, feedback, damping);
    });
    this.allpasses = ALLPASS_TUNING.map(
      (tuning) => new Allpass(Math.round((tuning + spread) * TUNING_SCALE)),
    );
  }

  process(input: number): number {
    let sum = 0;
    for (const comb of this.combs) sum += comb.process(input);
    let output = sum / this.combs.length;
    for (const allpass of this.allpasses) output = allpass.process(output);
    return output;
  }
}

/** Returns `dry * clip + wet * reverb(clip)` (same length; the recipe leaves room for the tail). */
export function applyReverb(clip: StereoClip, options: ReverbOptions): StereoClip {
  const frames = clip.left.length;
  const out = createStereo(frames);
  const left = new ReverbChannel(options, 0);
  const right = new ReverbChannel(options, STEREO_SPREAD);
  const lowCutLeft = new OnePole(options.lowCutHz ?? 200);
  const lowCutRight = new OnePole(options.lowCutHz ?? 200);
  const preDelay = Math.round(((options.preDelayMs ?? 8) / 1000) * MIX_SAMPLE_RATE);
  const width = Math.min(1, Math.max(0, options.width ?? 0.7));
  const dry = options.dry ?? 1;
  // Wet gain: the comb bank averages 8 lines, scale back to a usable level.
  const wet = options.wet * 3;
  for (let index = 0; index < frames; index++) {
    const source = index - preDelay;
    const input = source >= 0 ? 0.5 * ((clip.left[source] ?? 0) + (clip.right[source] ?? 0)) : 0;
    const wetLeft = lowCutLeft.high(left.process(input));
    const wetRight = lowCutRight.high(right.process(input));
    const mid = 0.5 * (wetLeft + wetRight);
    const side = 0.5 * (wetLeft - wetRight) * width;
    out.left[index] = dry * (clip.left[index] ?? 0) + wet * (mid + side);
    out.right[index] = dry * (clip.right[index] ?? 0) + wet * (mid - side);
  }
  return out;
}
