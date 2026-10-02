/**
 * Impacts: hit, hit-soft, boom, stamp, snap, pop. Built from a pitch-dropping sub, a short body
 * tone, a band-passed "crack", a low-passed noise thump and gentle saturation, then a small room.
 */
import type { Rng } from '../dsp.js';
import { normalizePeak } from '../dsp.js';
import { applyReverb, type ReverbOptions } from '../reverb.js';
import { OnePole, attackDecay, saturate } from '../synth.js';
import {
  BELL_MODES,
  addModal,
  addNoise,
  addTone,
  between,
  jitter,
  placeMono,
  type SfxContext,
  type SfxDefinition,
} from './layers.js';

/** Exponential approach from `from` to `to` with time constant `tau` (pitch drops). */
export const approach =
  (from: number, to: number, tau: number) =>
  (t: number): number =>
    to + (from - to) * Math.exp(-t / tau);

export interface HitShape {
  readonly sub: readonly [number, number, number, number];
  readonly body: readonly [number, number, number, number];
  readonly crack: readonly [number, number, number];
  readonly thump: readonly [number, number, number];
  readonly ring?: number;
  readonly drive: number;
}

/**
 * Adds one impact at `startS`: sub [fromHz, toHz, decayS, gain], body [fromHz, toHz, decayS, gain],
 * crack [centreHz, decayS, gain], thump [lowpassHz, decayS, gain], optional metallic ring gain.
 */
export function addHit(out: Float32Array, rng: Rng, startS: number, shape: HitShape): void {
  const layer = new Float32Array(out.length);
  const [subFrom, subTo, subDecay, subGain] = shape.sub;
  addTone(layer, {
    startS,
    freq: approach(jitter(rng, subFrom, 0.05), subTo, 0.035),
    attackS: 0.001,
    decayS: subDecay,
    gain: subGain,
  });
  const [bodyFrom, bodyTo, bodyDecay, bodyGain] = shape.body;
  addTone(layer, {
    startS,
    freq: approach(jitter(rng, bodyFrom, 0.06), bodyTo, 0.02),
    attackS: 0.0008,
    decayS: bodyDecay,
    gain: bodyGain,
    phase: 0.25,
  });
  const [crackHz, crackDecay, crackGain] = shape.crack;
  addNoise(layer, rng, {
    startS,
    lengthS: crackDecay * 12,
    filter: 'bp',
    freq: jitter(rng, crackHz, 0.1),
    q: 1.1,
    envelope: (t) => attackDecay(t, 0.0004, crackDecay),
    gain: crackGain,
  });
  const [thumpHz, thumpDecay, thumpGain] = shape.thump;
  addNoise(layer, rng, {
    startS,
    lengthS: thumpDecay * 12,
    filter: 'lp',
    freq: thumpHz,
    q: 0.9,
    envelope: (t) => attackDecay(t, 0.001, thumpDecay),
    gain: thumpGain,
  });
  if (shape.ring !== undefined) {
    addModal(layer, { startS, freq: between(rng, 330, 420), modes: BELL_MODES, gain: shape.ring });
  }
  normalizePeak(layer, 1);
  for (let index = 0; index < out.length; index++) {
    out[index] = (out[index] ?? 0) + saturate(layer[index] ?? 0, shape.drive);
  }
}

function impact(shape: HitShape, room: ReverbOptions, haasMs = 0.4) {
  return (ctx: SfxContext) => {
    const mono = new Float32Array(ctx.frames);
    addHit(mono, ctx.rng, 0, shape);
    return applyReverb(placeMono(mono, 0, haasMs), room);
  };
}

const SMALL_ROOM: ReverbOptions = { decayS: 0.45, wet: 0.12, damping: 0.5, size: 0.7 };

export const hit: SfxDefinition = {
  durationS: 0.8,
  category: 'impact',
  use: 'Number lands, object slams, emphasis on a key word.',
  variants: [
    {
      name: 'punchy',
      render: impact(
        {
          sub: [150, 55, 0.15, 0.6],
          body: [240, 120, 0.06, 1],
          crack: [3000, 0.006, 0.5],
          thump: [1000, 0.025, 0.8],
          drive: 1.8,
        },
        SMALL_ROOM,
      ),
    },
    {
      name: 'deep',
      render: impact(
        {
          sub: [110, 45, 0.28, 0.55],
          body: [210, 120, 0.08, 1],
          crack: [2000, 0.005, 0.35],
          thump: [900, 0.035, 0.9],
          drive: 1.4,
        },
        { ...SMALL_ROOM, wet: 0.15 },
      ),
    },
    {
      name: 'tight',
      render: impact(
        {
          sub: [180, 70, 0.09, 0.5],
          body: [320, 160, 0.035, 1],
          crack: [4000, 0.004, 0.6],
          thump: [1400, 0.015, 0.7],
          drive: 2.2,
        },
        { decayS: 0.3, wet: 0.08, damping: 0.4, size: 0.5 },
      ),
    },
    {
      name: 'cinematic',
      render: impact(
        {
          sub: [95, 40, 0.35, 0.6],
          body: [160, 80, 0.09, 0.8],
          crack: [2500, 0.007, 0.45],
          thump: [600, 0.06, 0.8],
          ring: 0.15,
          drive: 1.6,
        },
        { decayS: 0.6, wet: 0.2, damping: 0.55, size: 0.9 },
      ),
    },
  ],
};

export const hitSoft: SfxDefinition = {
  durationS: 0.4,
  category: 'impact',
  use: 'Gentle landing of a card/icon, soft emphasis under narration.',
  variants: [
    {
      name: 'felt',
      render: impact(
        {
          sub: [95, 70, 0.07, 0.3],
          body: [180, 135, 0.045, 1],
          crack: [1200, 0.003, 0.05],
          thump: [500, 0.04, 1],
          drive: 1.1,
        },
        { ...SMALL_ROOM, wet: 0.1 },
      ),
    },
    {
      name: 'cardboard',
      render: impact(
        {
          sub: [120, 90, 0.04, 0.5],
          body: [200, 170, 0.04, 0.8],
          crack: [700, 0.025, 0.6],
          thump: [500, 0.03, 0.6],
          drive: 1.2,
        },
        { ...SMALL_ROOM, wet: 0.1, size: 0.6 },
      ),
    },
    {
      name: 'muted',
      render: impact(
        {
          sub: [80, 60, 0.1, 0.25],
          body: [160, 125, 0.045, 1],
          crack: [900, 0.003, 0.03],
          thump: [350, 0.03, 0.9],
          drive: 1.1,
        },
        { ...SMALL_ROOM, wet: 0.06 },
      ),
    },
  ],
};

function boomVariant(shape: HitShape, debris: number, lowpassHz: number, room: ReverbOptions) {
  return (ctx: SfxContext) => {
    const mono = new Float32Array(ctx.frames);
    addHit(mono, ctx.rng, 0, shape);
    addNoise(mono, ctx.rng, {
      lengthS: ctx.durationS,
      color: 'brown',
      filter: 'lp',
      freq: (t) => 120 + 900 * Math.exp(-t / 0.15),
      envelope: (t) => attackDecay(t, 0.01, 0.45),
      gain: 0.9,
    });
    if (debris > 0) {
      addNoise(mono, ctx.rng, {
        lengthS: ctx.durationS,
        filter: 'lp',
        freq: (t) => 200 + 3000 * Math.exp(-t / 0.25),
        envelope: (t) => attackDecay(t, 0.004, 0.35) * (0.6 + 0.4 * Math.sin(t * 90)),
        gain: debris,
      });
    }
    const lowpass = new OnePole(lowpassHz);
    const smooth = mono.map((value) => lowpass.low(value));
    return applyReverb(placeMono(smooth, 0, 0.6), room);
  };
}

export const boom: SfxDefinition = {
  durationS: 2,
  category: 'impact',
  use: 'Big reveal, title slam, act break (use sparingly).',
  variants: [
    {
      name: 'deep',
      render: boomVariant(
        {
          sub: [75, 32, 0.7, 1],
          body: [120, 55, 0.15, 1],
          crack: [1800, 0.008, 0.25],
          thump: [300, 0.12, 0.8],
          drive: 1.5,
        },
        0,
        6000,
        { decayS: 1.4, wet: 0.22, damping: 0.6, size: 1.2 },
      ),
    },
    {
      name: 'explosion',
      render: boomVariant(
        {
          sub: [85, 35, 0.55, 1],
          body: [140, 60, 0.12, 1],
          crack: [2200, 0.01, 0.4],
          thump: [500, 0.1, 0.8],
          drive: 1.8,
        },
        0.45,
        7000,
        { decayS: 1.2, wet: 0.2, damping: 0.55, size: 1.1 },
      ),
    },
    {
      name: 'distant',
      render: boomVariant(
        {
          sub: [65, 30, 0.9, 1],
          body: [100, 50, 0.15, 0.8],
          crack: [900, 0.01, 0.1],
          thump: [200, 0.15, 0.9],
          drive: 1.2,
        },
        0.15,
        900,
        { decayS: 1.6, wet: 0.35, damping: 0.7, size: 1.3 },
      ),
    },
  ],
};

function stampVariant(scale: number, squish: boolean) {
  return (ctx: SfxContext) => {
    const mono = new Float32Array(ctx.frames);
    const { rng } = ctx;
    addNoise(mono, rng, {
      lengthS: 0.25,
      filter: 'lp',
      freq: 350 * scale,
      envelope: (t) => attackDecay(t, 0.0008, 0.02),
    });
    addNoise(mono, rng, {
      lengthS: 0.12,
      filter: 'bp',
      freq: jitter(rng, 1600 * scale, 0.08),
      q: 1.2,
      envelope: (t) => attackDecay(t, 0.0004, 0.01),
      gain: 0.6,
    });
    addNoise(mono, rng, {
      lengthS: 0.3,
      filter: 'bp',
      freq: jitter(rng, 420 * scale, 0.06),
      q: 8,
      envelope: (t) => attackDecay(t, 0.001, 0.045),
      gain: 0.9,
    });
    addTone(mono, { freq: 140 * scale, attackS: 0.001, decayS: 0.03, gain: 0.5, phase: 0.25 });
    if (squish) {
      addNoise(mono, rng, {
        startS: 0.028,
        lengthS: 0.15,
        filter: 'lp',
        freq: 700,
        envelope: (t) => attackDecay(t, 0.004, 0.025),
        gain: 0.35,
      });
    }
    return applyReverb(placeMono(mono, 0, 0.3), {
      decayS: 0.3,
      wet: 0.1,
      damping: 0.5,
      size: 0.5,
    });
  };
}

export const stamp: SfxDefinition = {
  durationS: 0.4,
  category: 'impact',
  use: 'Rubber stamp / "approved" badge / label slapped on.',
  variants: [
    { name: 'rubber', render: stampVariant(1, false) },
    { name: 'heavy', render: stampVariant(0.85, false) },
    { name: 'approve', render: stampVariant(1.1, true) },
  ],
};

function snapVariant(centreHz: number) {
  return (ctx: SfxContext) => {
    const mono = new Float32Array(ctx.frames);
    const { rng } = ctx;
    const centre = jitter(rng, centreHz, 0.06);
    addNoise(mono, rng, {
      lengthS: 0.08,
      filter: 'bp',
      freq: centre,
      q: 3,
      envelope: (t) => attackDecay(t, 0.0003, 0.007),
    });
    addTone(mono, { freq: centre * 0.8, attackS: 0.0005, decayS: 0.012, gain: 0.25 });
    addNoise(mono, rng, {
      lengthS: 0.02,
      filter: 'hp',
      freq: 4000,
      envelope: (t) => attackDecay(t, 0.0002, 0.0015),
      gain: 0.5,
    });
    return applyReverb(placeMono(mono, 0, 0.3), { decayS: 0.35, wet: 0.15, size: 0.6 });
  };
}

export const snap: SfxDefinition = {
  durationS: 0.15,
  category: 'impact',
  use: 'Finger snap: instant change, "just like that".',
  variants: [
    { name: 'mid', render: snapVariant(2300) },
    { name: 'low', render: snapVariant(1800) },
    { name: 'bright', render: snapVariant(2900) },
  ],
};

function popVariant(from: number, to: number, decayS: number, wave: 'sine' | 'triangle') {
  return (ctx: SfxContext) => {
    const mono = new Float32Array(ctx.frames);
    const { rng } = ctx;
    addTone(mono, {
      freq: approach(jitter(rng, from, 0.06), jitter(rng, to, 0.06), 0.012),
      wave,
      attackS: 0.0008,
      decayS,
    });
    addNoise(mono, rng, {
      lengthS: 0.01,
      filter: 'bp',
      freq: 2500,
      q: 1,
      envelope: (t) => attackDecay(t, 0.0002, 0.0012),
      gain: 0.2,
    });
    return applyReverb(placeMono(mono, 0, 0.25), { decayS: 0.25, wet: 0.08, size: 0.5 });
  };
}

export const pop: SfxDefinition = {
  durationS: 0.15,
  category: 'texture',
  use: 'Element pops into view (icons, bullets, bubbles of text).',
  variants: [
    { name: 'cork', render: popVariant(1000, 350, 0.03, 'sine') },
    { name: 'mouth', render: popVariant(550, 1300, 0.02, 'sine') },
    { name: 'low', render: popVariant(700, 220, 0.04, 'sine') },
    { name: 'pluck', render: popVariant(800, 400, 0.025, 'triangle') },
  ],
};
