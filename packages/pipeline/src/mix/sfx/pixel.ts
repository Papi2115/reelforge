/**
 * The shared "pixel" treatment of the look palettes (PLAN.md#12.24): every palette recipe ends in
 * the same light bit-crush (7-bit, 16 kHz sample-and-hold) and a small dry room, so retro-UI,
 * diorama and blueprint sounds share one texture with the voxel blips. Also the small building
 * blocks several palettes use: a stereo scatter of mono events and a keystroke.
 */
import type { StereoClip } from '../clip.js';
import type { Rng } from '../dsp.js';
import { applyReverb, type ReverbOptions } from '../reverb.js';
import { addPanned, attackDecay, bitcrush, createStereo } from '../synth.js';
import { addNoise, addTone, between, jitter, placeMono, type SfxContext } from './layers.js';

/** Bit depth and sample-and-hold of the shared crush (48 kHz / 3 = 16 kHz). */
export const PIXEL_BITS = 7;
export const PIXEL_HOLD = 3;
export const PIXEL_ROOM: ReverbOptions = { decayS: 0.15, wet: 0.04, damping: 0.5, size: 0.4 };

export interface PixelFinish {
  /** Crushed share (0..1). */
  readonly crush: number;
  readonly pan?: number;
  readonly haasMs?: number;
  readonly room?: ReverbOptions;
}

/** Crushes both channels of `clip` in place (the shared texture). */
export function crushStereo(clip: StereoClip, crush: number): StereoClip {
  bitcrush(clip.left, { bits: PIXEL_BITS, hold: PIXEL_HOLD, mix: crush });
  bitcrush(clip.right, { bits: PIXEL_BITS, hold: PIXEL_HOLD, mix: crush });
  return clip;
}

/** Mono layer -> crushed stereo clip in the shared small room. */
export function pixelFinish(mono: Float32Array, options: PixelFinish): StereoClip {
  bitcrush(mono, { bits: PIXEL_BITS, hold: PIXEL_HOLD, mix: options.crush });
  return applyReverb(
    placeMono(mono, options.pan ?? 0, options.haasMs ?? 0.2),
    options.room ?? PIXEL_ROOM,
  );
}

/** Collects mono events with their own pans into one stereo clip. */
export class Scatter {
  readonly clip: StereoClip;

  constructor(private readonly frames: number) {
    this.clip = createStereo(frames);
  }

  add(pan: number, draw: (out: Float32Array) => void): void {
    const mono = new Float32Array(this.frames);
    draw(mono);
    addPanned(this.clip, mono, 0, 1, pan);
  }
}

export interface KeyShape {
  /** Band-passed click: centre Hz and decay s. */
  readonly clickHz: number;
  readonly clickDecayS: number;
  /** Key body ring (Hz, decay s, gain). */
  readonly ringHz: number;
  readonly ringDecayS: number;
  readonly ringGain: number;
  /** Low-passed bottom-out thump (Hz, decay s), high-passed at 150 Hz. */
  readonly thumpHz: number;
  readonly thumpDecayS: number;
  /** A second (spring / release) click this long after the first; undefined = none. */
  readonly secondS?: number | undefined;
}

/** One keystroke at `startS` (level and pitch vary per stroke). */
export function addKey(out: Float32Array, rng: Rng, startS: number, shape: KeyShape): void {
  const level = between(rng, 0.75, 1);
  const strike = (atS: number, gain: number): void => {
    addNoise(out, rng, {
      startS: atS,
      lengthS: shape.clickDecayS * 12,
      filter: 'bp',
      freq: jitter(rng, shape.clickHz, 0.08),
      q: 1.5,
      envelope: (t) => attackDecay(t, 0.0003, shape.clickDecayS),
      gain,
    });
  };
  strike(startS, level);
  addTone(out, {
    startS,
    freq: jitter(rng, shape.ringHz, 0.04),
    attackS: 0.0004,
    decayS: shape.ringDecayS,
    gain: shape.ringGain * level,
  });
  addNoise(out, rng, {
    startS: startS + 0.002,
    lengthS: shape.thumpDecayS * 12,
    filter: 'lp',
    freq: shape.thumpHz,
    highpassHz: 150,
    envelope: (t) => attackDecay(t, 0.0008, shape.thumpDecayS),
    gain: 0.5 * level,
  });
  if (shape.secondS !== undefined) strike(startS + shape.secondS, 0.55 * level);
}

/** Keystrokes from 0 to the clip end (minus 60 ms), `spacing` s apart, with the odd pause. */
export function typingBurst(
  ctx: SfxContext,
  shape: KeyShape,
  spacing: readonly [number, number],
): StereoClip {
  const scatter = new Scatter(ctx.frames);
  const lastS = ctx.durationS - 0.06;
  let t = 0;
  while (t < lastS) {
    const startS = t;
    scatter.add(between(ctx.rng, -0.25, 0.25), (out) => {
      addKey(out, ctx.rng, startS, shape);
    });
    t += ctx.rng() < 0.1 ? between(ctx.rng, 0.14, 0.2) : between(ctx.rng, spacing[0], spacing[1]);
  }
  return scatter.clip;
}
