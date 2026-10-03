/**
 * Isometric diorama palette (PLAN.md#12.24): small-world foley heard from a little distance —
 * soft keyboards, chairs, paper, server fans and LEDs (traffic, horns, birds and servos:
 * `diorama-world.ts`). Kept light (high-passed lows), finished with the shared pixel crush.
 */
import type { StereoClip } from '../clip.js';
import { applyReverb, type ReverbOptions } from '../reverb.js';
import { Osc, OnePole, attackDecay, expLerp, gateEnvelope, swell } from '../synth.js';
import {
  SR,
  addNoise,
  addTone,
  between,
  jitter,
  type SfxContext,
  type SfxDefinition,
} from './layers.js';
import {
  PIXEL_ROOM,
  Scatter,
  crushStereo,
  pixelFinish,
  typingBurst,
  type KeyShape,
} from './pixel.js';

/** A room a few metres away (the diorama is seen from above). */
export const DISTANT: ReverbOptions = { decayS: 0.35, wet: 0.12, damping: 0.6, size: 0.6 };

const OFFICE_KEYS: KeyShape = {
  clickHz: 1500,
  clickDecayS: 0.005,
  ringHz: 700,
  ringDecayS: 0.006,
  ringGain: 0.25,
  thumpHz: 500,
  thumpDecayS: 0.01,
};

function softTyping(shape: KeyShape, spacing: readonly [number, number]) {
  return (ctx: SfxContext): StereoClip => {
    const clip = typingBurst(ctx, shape, spacing);
    const soften = [new OnePole(4500), new OnePole(4500)] as const;
    clip.left.forEach((value, index) => (clip.left[index] = soften[0].low(value)));
    clip.right.forEach((value, index) => (clip.right[index] = soften[1].low(value)));
    return applyReverb(crushStereo(clip, 0.2), DISTANT);
  };
}

export const softKeys: SfxDefinition = {
  durationS: 1.2,
  category: 'texture',
  use: 'Diorama: soft office typing a few desks away (match the duration to the typing).',
  variants: [
    { name: 'office', render: softTyping(OFFICE_KEYS, [0.08, 0.16]) },
    {
      name: 'laptop',
      render: softTyping({ ...OFFICE_KEYS, clickHz: 2200, ringGain: 0.1 }, [0.07, 0.13]),
    },
    { name: 'burst', render: softTyping({ ...OFFICE_KEYS, clickHz: 1800 }, [0.05, 0.08]) },
  ],
};

/** Friction creak: a pulse train (rate `from` -> `to` Hz) exciting two wood resonances. */
function creak(fromHz: number, toHz: number, bodyHz: number, roll: boolean) {
  return (ctx: SfxContext): StereoClip => {
    const mono = new Float32Array(ctx.frames);
    const lengthS = ctx.durationS * 0.85;
    const frames = Math.min(ctx.frames, Math.round(lengthS * SR));
    let phase = 0;
    const pulses = new Float32Array(frames);
    for (let index = 0; index < frames; index++) {
      const position = index / frames;
      phase += (expLerp(fromHz, toHz, position) * jitter(ctx.rng, 1, 0.15)) / SR;
      if (phase >= 1) {
        phase -= 1;
        pulses[index] = swell(position, 0.4, 2, 1.5) * between(ctx.rng, 0.5, 1);
      }
    }
    for (const [hz, gain] of [
      [bodyHz, 1],
      [bodyHz * 1.87, 0.6],
    ] as const) {
      const ring = new Float32Array(frames);
      const filter = new OnePole(hz * 2);
      let state = 0;
      let velocity = 0;
      const omega = (2 * Math.PI * hz) / SR;
      for (let index = 0; index < frames; index++) {
        // Damped resonator (two-pole) driven by the pulses.
        velocity = velocity * 0.995 - omega * state + (pulses[index] ?? 0);
        state += omega * velocity;
        ring[index] = filter.low(state * omega);
      }
      ring.forEach((value, index) => (mono[index] = (mono[index] ?? 0) + gain * value));
    }
    if (roll) {
      addNoise(mono, ctx.rng, {
        lengthS,
        color: 'pink',
        filter: 'lp',
        freq: 1400,
        highpassHz: 160,
        envelope: (t) => 0.25 * swell(t / lengthS, 0.5),
      });
    }
    return applyReverb(pixelFinish(mono, { crush: 0.15, haasMs: 0.3 }), DISTANT);
  };
}

export const chair: SfxDefinition = {
  durationS: 0.6,
  category: 'texture',
  use: 'Diorama: office chair creak, roll or swivel (someone sits, turns, leans back).',
  variants: [
    { name: 'creak', render: creak(40, 90, 900, false) },
    { name: 'roll', render: creak(25, 35, 700, true) },
    { name: 'swivel', render: creak(120, 60, 1200, false) },
  ],
};

/** Paper: [startS, lengthS, from Hz, to Hz, gain] swept noise strokes; `thud` adds a soft landing. */
function paperStrokes(
  strokes: readonly (readonly [number, number, number, number, number])[],
  thud: boolean,
) {
  return (ctx: SfxContext): StereoClip => {
    const scatter = new Scatter(ctx.frames);
    for (const [startS, lengthS, fromHz, toHz, gain] of strokes) {
      scatter.add(between(ctx.rng, -0.3, 0.3), (out) => {
        addNoise(out, ctx.rng, {
          startS: jitter(ctx.rng, startS, 0.05),
          lengthS,
          filter: 'bp',
          freq: (t) => expLerp(fromHz, toHz, t / lengthS),
          q: 0.9,
          envelope: (t) =>
            gain * swell(t / lengthS, 0.3) * (0.6 + 0.4 * Math.abs(Math.sin(t * 230))),
        });
      });
    }
    if (thud) {
      scatter.add(0, (out) => {
        addNoise(out, ctx.rng, {
          startS: 0.02,
          lengthS: 0.15,
          filter: 'lp',
          freq: 700,
          highpassHz: 160,
          envelope: (t) => attackDecay(t, 0.002, 0.03),
          gain: 1.2,
        });
      });
    }
    return applyReverb(crushStereo(scatter.clip, 0.15), PIXEL_ROOM);
  };
}

export const paperShuffle: SfxDefinition = {
  durationS: 0.5,
  category: 'texture',
  use: 'Diorama: papers shuffled, a stack set down, a sheet flipped over.',
  variants: [
    {
      name: 'shuffle',
      render: paperStrokes(
        [
          [0, 0.12, 2500, 3500, 1],
          [0.13, 0.1, 3000, 2200, 0.8],
          [0.25, 0.14, 2200, 3800, 0.9],
        ],
        false,
      ),
    },
    {
      name: 'stack',
      render: paperStrokes(
        [
          [0, 0.06, 2600, 2600, 0.6],
          [0.06, 0.18, 3000, 2000, 0.4],
        ],
        true,
      ),
    },
    { name: 'flip', render: paperStrokes([[0, 0.3, 1500, 4000, 1]], false) },
  ],
};

/** Fan: blade tone(s) (Hz glide) with a little AM, plus band-passed air. */
function fan(fromHz: number, toHz: number, second: number) {
  return (ctx: SfxContext): StereoClip => {
    const mono = new Float32Array(ctx.frames);
    const lengthS = ctx.durationS - 0.03;
    const envelope = (t: number): number => gateEnvelope(t, lengthS * 0.3, lengthS * 0.3, lengthS);
    const pitch = (t: number): number => expLerp(fromHz, toHz, t / (lengthS * 0.6));
    const tremolo = new Osc(ctx.rng());
    const frames = Math.min(ctx.frames, Math.round(lengthS * SR));
    const blade = new Osc(ctx.rng());
    const other = new Osc(ctx.rng());
    for (let index = 0; index < frames; index++) {
      const t = index / SR;
      const hz = pitch(t);
      const am = 0.8 + 0.2 * tremolo.sine(7);
      const tone = blade.triangle(hz) + (second > 0 ? 0.7 * other.triangle(hz * second) : 0);
      mono[index] = 0.25 * tone * am * envelope(t);
    }
    addNoise(mono, ctx.rng, {
      lengthS,
      color: 'pink',
      filter: 'bp',
      freq: (t) => 2.5 * pitch(t),
      q: 0.7,
      highpassHz: 150,
      envelope: (t) => 0.5 * envelope(t),
    });
    return pixelFinish(mono, { crush: 0.2, haasMs: 0.5 });
  };
}

export const serverWhir: SfxDefinition = {
  durationS: 1,
  category: 'texture',
  use: 'Diorama: server / computer fan whir (a machine works, the server room hums).',
  variants: [
    { name: 'fan', render: fan(420, 420, 0) },
    { name: 'rack', render: fan(410, 410, 1.066) },
    { name: 'spin-up', render: fan(160, 620, 0) },
  ],
};

/** A tiny pure LED blip (pitched: low -> mid -> high for lists). */
function ledBlip(hz: number, repeats: number) {
  return (ctx: SfxContext): StereoClip => {
    const mono = new Float32Array(ctx.frames);
    const freq = jitter(ctx.rng, hz, 0.01);
    for (let index = 0; index < repeats; index++) {
      const startS = index * 0.035;
      addTone(mono, { startS, freq, attackS: 0.001, decayS: 0.008, lengthS: 0.022, gain: 0.8 });
      addTone(mono, {
        startS,
        freq: freq * 2,
        attackS: 0.001,
        decayS: 0.004,
        lengthS: 0.02,
        gain: 0.15,
      });
    }
    return pixelFinish(mono, { crush: 0.35, haasMs: 0.15 });
  };
}

export const ledBlipSfx: SfxDefinition = {
  durationS: 0.08,
  category: 'ui',
  use: 'Diorama: a status LED blinks; list items (low -> mid -> high).',
  variants: [
    { name: 'low', render: ledBlip(1500, 1) },
    { name: 'mid', render: ledBlip(2000, 1) },
    { name: 'high', render: ledBlip(2660, 1) },
  ],
};
