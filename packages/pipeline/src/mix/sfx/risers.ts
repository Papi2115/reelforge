/**
 * Builds and falls: riser, downer (whooshes and swooshes: `motion.ts`). Risers end on the hit
 * with a short room tail; downers start fast and fade long.
 */
import type { StereoClip } from '../clip.js';
import { applyReverb } from '../reverb.js';
import { Osc, Svf, bitcrush, expLerp, panGains } from '../synth.js';
import {
  SR,
  addNoise,
  addTone,
  jitter,
  placeMono,
  stereoNoise,
  sumStereo,
  type SfxContext,
  type SfxDefinition,
} from './layers.js';

/** Riser bodies end here; the rest of the clip is the room tail (no chopped ending). */
const RISE_END = 0.9;

/** Envelope of a build: slow rise to a peak at RISE_END, then a 5% release. */
function build(position: number, power: number): number {
  const progress = position / RISE_END;
  return progress >= 1 ? 0 : progress ** power * Math.min(1, (1 - progress) / 0.05);
}

function noiseRiser(ctx: SfxContext): StereoClip {
  const { frames, durationS } = ctx;
  const noise = stereoNoise(frames, ctx.rng, 0.3, (out, stream) => {
    addNoise(out, stream, {
      lengthS: durationS,
      color: 'pink',
      filter: 'bp',
      freq: (t) => expLerp(300, 6500, (t / durationS) ** 1.2),
      q: 1.3,
      envelope: (t) => {
        const position = t / durationS;
        const tremolo =
          1 - 0.35 * position * (0.5 + 0.5 * Math.sin(2 * Math.PI * (4 + 14 * position) * t));
        return build(position, 2) * tremolo;
      },
    });
  });
  return applyReverb(noise, { decayS: 0.6, wet: 0.15, size: 0.9 });
}

/** Detuned saw stack gliding up two octaves through an opening low-pass, plus noise. */
function tonalRiser(ctx: SfxContext): StereoClip {
  const { frames } = ctx;
  const out = { left: new Float32Array(frames), right: new Float32Array(frames) };
  const root = jitter(ctx.rng, 110, 0.04);
  const voices = [-0.12, -0.05, 0, 0.05, 0.12].map((semitones, index) => ({
    osc: new Osc(ctx.rng()),
    fifth: new Osc(ctx.rng()),
    detune: 2 ** (semitones / 12),
    pan: panGains(-0.6 + 0.3 * index),
  }));
  const filters = { left: new Svf(), right: new Svf() };
  for (let index = 0; index < frames; index++) {
    const position = index / frames;
    const pitch = root * 4 ** (position ** 1.3);
    if (index % 2 === 0) {
      const cutoff = expLerp(400, 7000, position ** 1.5);
      filters.left.set(cutoff, 1.2);
      filters.right.set(cutoff, 1.2);
    }
    let left = 0;
    let right = 0;
    for (const voice of voices) {
      const value =
        voice.osc.saw(pitch * voice.detune) + 0.5 * voice.fifth.saw(pitch * 1.5 * voice.detune);
      left += value * voice.pan.left;
      right += value * voice.pan.right;
    }
    const level = build(position, 1.6) * 0.2;
    out.left[index] = filters.left.process(left) * level;
    out.right[index] = filters.right.process(right) * level;
  }
  const noise = noiseRiser(ctx);
  return applyReverb(
    sumStereo(frames, [
      [out, 1],
      [noise, 0.5],
    ]),
    {
      decayS: 0.5,
      wet: 0.1,
      size: 0.8,
    },
  );
}

/** Octave-spaced sine partials gliding up under a fixed bell-shaped spectral window. */
function shepardRiser(ctx: SfxContext): StereoClip {
  const { frames, durationS } = ctx;
  const mono = new Float32Array(frames);
  const partials = Array.from({ length: 6 }, () => new Osc(ctx.rng()));
  for (let index = 0; index < frames; index++) {
    const position = index / frames;
    let value = 0;
    partials.forEach((osc, octave) => {
      const logPosition = (octave + position * 1.5) % 6;
      const hz = 80 * 2 ** logPosition;
      const weight = Math.exp(-(((logPosition - 3) / 1.3) ** 2));
      value += weight * osc.sine(hz);
    });
    mono[index] = value * build(position, 1.2) * 0.4;
  }
  addNoise(mono, ctx.rng, {
    lengthS: durationS,
    filter: 'hp',
    freq: (t) => expLerp(2000, 8000, t / durationS),
    envelope: (t) => build(t / durationS, 3) * 0.25,
  });
  return applyReverb(placeMono(mono, 0, 0.5), { decayS: 0.6, wet: 0.2, size: 0.9 });
}

/** Chiptune build: a square arpeggio climbing in semitones, gently crushed. */
function retroRiser(ctx: SfxContext): StereoClip {
  const { frames, durationS } = ctx;
  const mono = new Float32Array(frames);
  const osc = new Osc();
  const stepS = 0.05;
  for (let index = 0; index < frames; index++) {
    const t = index / SR;
    const step = Math.floor(t / stepS);
    const hz = 220 * 2 ** ((step % 4) * (4 / 12) + Math.floor(step / 4) / 12);
    const position = t / durationS;
    mono[index] = osc.square(hz, 0.25) * build(position, 0.6) * 0.3;
  }
  bitcrush(mono, { bits: 6, hold: 3, mix: 0.5 });
  return applyReverb(placeMono(mono, 0, 0.4), { decayS: 0.4, wet: 0.12, size: 0.6 });
}

export const riser: SfxDefinition = {
  durationS: 2,
  category: 'motion',
  use: 'Build-up into a reveal or act change (end it on the hit).',
  variants: [
    { name: 'noise', render: noiseRiser },
    { name: 'tonal', render: tonalRiser },
    { name: 'shepard', render: shepardRiser },
    { name: 'retro', render: retroRiser },
  ],
};

/** Gentle fall: fast start, long fade. */
const fall = (position: number): number =>
  position >= 1 ? 0 : Math.min(1, position / 0.01) * (1 - position) ** 2;

function tapeStop(ctx: SfxContext): StereoClip {
  const { frames } = ctx;
  const mono = new Float32Array(frames);
  const oscillators = [new Osc(ctx.rng()), new Osc(ctx.rng()), new Osc(ctx.rng())];
  const filter = new Svf();
  const root = jitter(ctx.rng, 220, 0.04);
  for (let index = 0; index < frames; index++) {
    const position = index / frames;
    const speed = Math.max(0.05, 1 - position ** 0.7);
    if (index % 2 === 0) filter.set(400 + 3500 * speed, 0.9);
    const value =
      (oscillators[0]?.saw(root * speed) ?? 0) +
      (oscillators[1]?.saw(root * 1.5 * speed) ?? 0) +
      (oscillators[2]?.saw(root * 2.01 * speed) ?? 0);
    mono[index] = filter.process(value) * fall(position) * 0.25;
  }
  return applyReverb(placeMono(mono, 0, 0.5), { decayS: 0.5, wet: 0.12, size: 0.8 });
}

function sweepDrop(ctx: SfxContext): StereoClip {
  const { frames, durationS } = ctx;
  const mono = new Float32Array(frames);
  const start = jitter(ctx.rng, 900, 0.05);
  addTone(mono, {
    freq: (t) => expLerp(start, 45, (t / durationS) ** 0.6),
    attackS: 0.005,
    decayS: durationS * 0.35,
  });
  addTone(mono, {
    freq: (t) => expLerp(start * 2, 90, (t / durationS) ** 0.6),
    wave: 'triangle',
    attackS: 0.005,
    decayS: durationS * 0.2,
    gain: 0.25,
  });
  addNoise(mono, ctx.rng, {
    lengthS: durationS,
    filter: 'bp',
    freq: (t) => expLerp(3000, 200, t / durationS),
    q: 1.2,
    envelope: (t) => fall(t / durationS) * 0.4,
  });
  return applyReverb(placeMono(mono, 0, 0.5), { decayS: 0.5, wet: 0.14, size: 0.8 });
}

function noiseFall(ctx: SfxContext): StereoClip {
  const { frames, durationS } = ctx;
  const noise = stereoNoise(frames, ctx.rng, 0.4, (out, stream) => {
    addNoise(out, stream, {
      lengthS: durationS,
      color: 'pink',
      filter: 'bp',
      freq: (t) => expLerp(5000, 200, (t / durationS) ** 0.8),
      q: 1.4,
      envelope: (t) => fall(t / durationS),
    });
  });
  return applyReverb(noise, { decayS: 0.5, wet: 0.14, size: 0.8 });
}

export const downer: SfxDefinition = {
  durationS: 1.2,
  category: 'motion',
  use: 'Power-down, failure, "it all fell apart", leaving a scene.',
  variants: [
    { name: 'tape-stop', render: tapeStop },
    { name: 'sweep-drop', render: sweepDrop },
    { name: 'noise-fall', render: noiseFall },
  ],
};
