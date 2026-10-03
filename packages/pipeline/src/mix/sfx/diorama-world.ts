/**
 * Isometric diorama palette, the world around (PLAN.md#12.24): passing cars and scooters, small
 * horns, birds and model servos, through the shared pixel crush (`pixel.ts`). Indoor foley lives
 * in `diorama.ts`.
 */
import type { StereoClip } from '../clip.js';
import { applyReverb } from '../reverb.js';
import { Osc, OnePole, expLerp, gateEnvelope, swell } from '../synth.js';
import { DISTANT } from './diorama.js';
import {
  SR,
  addFm,
  addNoise,
  addTone,
  jitter,
  panSweep,
  placeMono,
  type SfxContext,
  type SfxDefinition,
} from './layers.js';
import { crushStereo, pixelFinish } from './pixel.js';

/** Vehicle pass-by: engine tone with a Doppler drop, tyre noise, swell and a left-right sweep. */
function passBy(engineHz: number, wave: 'saw' | 'square', engineGain: number) {
  return (ctx: SfxContext): StereoClip => {
    const mono = new Float32Array(ctx.frames);
    const lengthS = ctx.durationS - 0.03;
    const frames = Math.min(ctx.frames, Math.round(lengthS * SR));
    const osc = new Osc(ctx.rng());
    const lowpass = new OnePole(1200);
    const highpass = new OnePole(140);
    const base = jitter(ctx.rng, engineHz, 0.05);
    for (let index = 0; index < frames; index++) {
      const position = index / frames;
      const doppler = 1 + 0.06 * Math.tanh((0.5 - position) * 8);
      const raw = wave === 'saw' ? osc.saw(base * doppler) : osc.square(base * doppler, 0.3);
      mono[index] = engineGain * highpass.high(lowpass.low(raw)) * swell(position, 0.5, 3, 3);
    }
    addNoise(mono, ctx.rng, {
      lengthS,
      color: 'pink',
      filter: 'bp',
      freq: (t) => expLerp(1400, 700, t / lengthS),
      q: 0.8,
      highpassHz: 150,
      envelope: (t) => swell(t / lengthS, 0.5, 3, 3),
    });
    const clip = applyReverb(placeMono(mono, 0, 0.3), DISTANT);
    return crushStereo(
      panSweep(clip, (position) => -0.6 + 1.2 * position),
      0.15,
    );
  };
}

export const trafficPass: SfxDefinition = {
  durationS: 1.6,
  category: 'motion',
  use: 'Diorama: a car or scooter drives past in the little city.',
  variants: [
    { name: 'car', render: passBy(170, 'saw', 0.5) },
    { name: 'scooter', render: passBy(330, 'square', 0.35) },
    { name: 'distant', render: passBy(150, 'saw', 0.15) },
  ],
};

/** Horn honks: [startS, lengthS] of two detuned squares through a horn-ish band-pass. */
function horn(baseHz: number, honks: readonly (readonly [number, number])[], vibrato: number) {
  return (ctx: SfxContext): StereoClip => {
    const mono = new Float32Array(ctx.frames);
    const base = jitter(ctx.rng, baseHz, 0.02);
    for (const [startS, lengthS] of honks) {
      const lfo = new Osc(ctx.rng());
      for (const ratio of [1, 1.26]) {
        addTone(mono, {
          startS,
          freq: () => base * ratio * (1 + vibrato * lfo.sine(14)),
          wave: 'square',
          width: 0.4,
          attackS: 0.008,
          decayS: 2,
          lengthS,
          gain: 0.25,
        });
      }
    }
    const soften = new OnePole(2600);
    return pixelFinish(
      mono.map((value) => soften.low(value)),
      { crush: 0.3 },
    );
  };
}

export const hornBlip: SfxDefinition = {
  durationS: 0.35,
  category: 'ui',
  use: 'Diorama: a small car horn (traffic, a playful "hey!").',
  variants: [
    { name: 'car', render: horn(400, [[0, 0.18]], 0) },
    { name: 'toy', render: horn(880, [[0, 0.12]], 0.02) },
    {
      name: 'double',
      render: horn(
        440,
        [
          [0, 0.08],
          [0.12, 0.1],
        ],
        0,
      ),
    },
  ],
};

/** Bird chirps: [startS, lengthS, from Hz, to Hz] FM-tinted sine glides. */
function chirps(notes: readonly (readonly [number, number, number, number])[]) {
  return (ctx: SfxContext): StereoClip => {
    const mono = new Float32Array(ctx.frames);
    const scale = jitter(ctx.rng, 1, 0.04);
    for (const [startS, lengthS, fromHz, toHz] of notes) {
      addTone(mono, {
        startS,
        freq: (t) => scale * expLerp(fromHz, toHz, t / lengthS),
        attackS: 0.004,
        decayS: lengthS,
        lengthS,
        gain: 0.8,
      });
      addFm(mono, {
        startS,
        freq: scale * fromHz,
        ratio: 0.5,
        index: 0.6,
        indexDecayS: 0.01,
        attackS: 0.003,
        decayS: lengthS * 0.5,
        gain: 0.15,
      });
    }
    return pixelFinish(mono, { crush: 0.12, haasMs: 0.4, room: DISTANT });
  };
}

export const birdChirp: SfxDefinition = {
  durationS: 0.5,
  category: 'tonal',
  use: 'Diorama: little birds outside (city morning, a park, a cheerful landing).',
  variants: [
    {
      name: 'sparrow',
      render: chirps([
        [0, 0.03, 3000, 4500],
        [0.07, 0.03, 3200, 4600],
        [0.14, 0.04, 3100, 4800],
      ]),
    },
    {
      name: 'tweet',
      render: chirps([
        [0, 0.09, 5000, 3000],
        [0.16, 0.1, 4800, 2800],
      ]),
    },
    {
      name: 'trill',
      render: chirps(
        Array.from({ length: 8 }, (_, index) => [index * 0.04, 0.025, 3600, 3200] as const),
      ),
    },
  ],
};

/** Small model servo: a whining saw glide with gear ticks, [startS, lengthS] bursts. */
function servo(fromHz: number, toHz: number, bursts: readonly (readonly [number, number])[]) {
  return (ctx: SfxContext): StereoClip => {
    const mono = new Float32Array(ctx.frames);
    for (const [startS, lengthS] of bursts) {
      const start = Math.round(startS * SR);
      const end = Math.min(ctx.frames, start + Math.round(lengthS * SR));
      const osc = new Osc(ctx.rng());
      const band = new OnePole(2200);
      const floor = new OnePole(300);
      for (let index = start; index < end; index++) {
        const t = (index - start) / SR;
        const hz = expLerp(fromHz, toHz, t / lengthS);
        const raw = floor.high(band.low(osc.saw(hz)));
        mono[index] = (mono[index] ?? 0) + 0.4 * raw * gateEnvelope(t, 0.01, 0.02, lengthS);
      }
      addNoise(mono, ctx.rng, {
        startS,
        lengthS,
        filter: 'bp',
        freq: 2400,
        q: 2,
        envelope: (t) =>
          0.3 * gateEnvelope(t, 0.01, 0.02, lengthS) * (Math.sin(t * 380) > 0.6 ? 1 : 0.2),
      });
    }
    return pixelFinish(mono, { crush: 0.25 });
  };
}

export const servoSfx: SfxDefinition = {
  durationS: 0.5,
  category: 'motion',
  use: 'Diorama: a small motor / servo moves (model parts turn, doors slide, a camera pans).',
  variants: [
    { name: 'up', render: servo(300, 900, [[0, 0.42]]) },
    { name: 'down', render: servo(900, 300, [[0, 0.42]]) },
    {
      name: 'step',
      render: servo(600, 640, [
        [0, 0.12],
        [0.22, 0.15],
      ]),
    },
  ],
};
