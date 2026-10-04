/**
 * Blueprint / data palette (PLAN.md#12.24): drafting pencil, plotter pen, ruler ticks, measuring
 * blips, relay clicks and data pings — precise, dry, technical, finished with the shared pixel
 * crush (`pixel.ts`).
 */
import type { StereoClip } from '../clip.js';
import { Osc, OnePole, attackDecay, expLerp, gateEnvelope, swell } from '../synth.js';
import {
  SR,
  addModal,
  addNoise,
  addTone,
  between,
  jitter,
  type Mode,
  type SfxContext,
  type SfxDefinition,
} from './layers.js';
import { PIXEL_ROOM, Scatter, crushStereo, pixelFinish } from './pixel.js';
import { applyReverb } from '../reverb.js';

/** Graphite on paper: band-passed noise with a fast grain (amplitude re-drawn every 2 ms). */
function addStroke(
  out: Float32Array,
  ctx: SfxContext,
  startS: number,
  lengthS: number,
  hz: number,
) {
  let grain = 1;
  let next = 0;
  const wobble = between(ctx.rng, 0, Math.PI);
  addNoise(out, ctx.rng, {
    startS,
    lengthS,
    filter: 'bp',
    freq: (t) => hz * (1 + 0.15 * Math.sin(t * 25 + wobble)),
    q: 1.2,
    envelope: (t) => {
      if (t >= next) {
        grain = between(ctx.rng, 0.4, 1);
        next = t + 0.002;
      }
      return grain * swell(t / lengthS, 0.15, 2, 1.5);
    },
  });
}

/** Pencil strokes: [startS, lengthS] at a base pitch. */
function pencil(strokes: readonly (readonly [number, number])[], hz: number) {
  return (ctx: SfxContext): StereoClip => {
    const scatter = new Scatter(ctx.frames);
    for (const [startS, lengthS] of strokes) {
      scatter.add(between(ctx.rng, -0.25, 0.25), (out) => {
        addStroke(out, ctx, startS, lengthS, jitter(ctx.rng, hz, 0.08));
      });
    }
    return applyReverb(crushStereo(scatter.clip, 0.2), PIXEL_ROOM);
  };
}

export const pencilScratch: SfxDefinition = {
  durationS: 0.7,
  category: 'texture',
  use: 'Blueprint: a drafting pencil draws a line, hatches or circles something.',
  variants: [
    { name: 'line', render: pencil([[0, 0.6]], 3600) },
    {
      name: 'hatch',
      render: pencil(
        [
          [0, 0.08],
          [0.12, 0.08],
          [0.24, 0.08],
          [0.36, 0.08],
          [0.48, 0.1],
        ],
        4200,
      ),
    },
    {
      name: 'circle',
      render: pencil(
        [
          [0, 0.18],
          [0.21, 0.18],
          [0.42, 0.18],
        ],
        2900,
      ),
    },
  ],
};

/** Stepper buzz at `rate(t)` Hz (pulse train through a resonant band) with a pen-down tick. */
function plotter(rate: (t: number) => number, lengthFraction: number, solenoid: boolean) {
  return (ctx: SfxContext): StereoClip => {
    const mono = new Float32Array(ctx.frames);
    const lengthS = (ctx.durationS - 0.1) * lengthFraction;
    const startS = 0.03;
    const frames = Math.min(ctx.frames, Math.round((startS + lengthS) * SR));
    const osc = new Osc(ctx.rng());
    const band = new OnePole(1800);
    const floor = new OnePole(250);
    for (let index = Math.round(startS * SR); index < frames; index++) {
      const t = index / SR - startS;
      const raw = floor.high(band.low(osc.square(rate(t), 0.15)));
      mono[index] = 0.35 * raw * gateEnvelope(t, 0.01, 0.02, lengthS);
    }
    const tick = (atS: number, gain: number): void => {
      addNoise(mono, ctx.rng, {
        startS: atS,
        lengthS: 0.02,
        filter: 'bp',
        freq: 2600,
        q: 2,
        envelope: (t) => attackDecay(t, 0.0003, 0.0015),
        gain,
      });
    };
    tick(0, 1);
    if (solenoid) tick(Math.min(ctx.durationS - 0.05, startS + lengthS + 0.03), 0.9);
    return pixelFinish(mono, { crush: 0.3 });
  };
}

export const plotterPen: SfxDefinition = {
  durationS: 1,
  category: 'texture',
  use: 'Blueprint: a pen plotter draws (diagram lines, charts being plotted).',
  variants: [
    { name: 'line', render: plotter(() => 520, 1, false) },
    { name: 'curve', render: plotter((t) => 550 + 150 * Math.sin(t * 9), 1, false) },
    { name: 'pen-up', render: plotter((t) => expLerp(380, 700, t * 4), 0.35, true) },
  ],
};

/** Ruler / scale tick: [startS, gain] strikes of a small resonant body. */
function rulerTick(
  modes: readonly Mode[],
  hz: number,
  strikes: readonly (readonly [number, number])[],
) {
  return (ctx: SfxContext): StereoClip => {
    const mono = new Float32Array(ctx.frames);
    for (const [startS, gain] of strikes) {
      addModal(mono, { startS, freq: jitter(ctx.rng, hz, 0.02), modes, attackS: 0.0003, gain });
      addNoise(mono, ctx.rng, {
        startS,
        lengthS: 0.006,
        filter: 'hp',
        freq: 3500,
        envelope: (t) => attackDecay(t, 0.0002, 0.0006),
        gain: 0.3 * gain,
      });
    }
    return pixelFinish(mono, { crush: 0.25, haasMs: 0.15 });
  };
}

const PLASTIC: readonly Mode[] = [
  [1, 1, 0.003],
  [2.3, 0.4, 0.002],
];
const METAL: readonly Mode[] = [
  [1, 1, 0.006],
  [1.45, 0.6, 0.005],
  [2.9, 0.2, 0.003],
];

export const rulerTickSfx: SfxDefinition = {
  durationS: 0.04,
  category: 'ui',
  use: 'Blueprint: a ruler / scale tick, a dimension snaps into place, a counter step.',
  variants: [
    { name: 'plastic', render: rulerTick(PLASTIC, 2400, [[0, 1]]) },
    { name: 'metal', render: rulerTick(METAL, 4200, [[0, 1]]) },
    {
      name: 'double',
      render: rulerTick(PLASTIC, 2700, [
        [0, 1],
        [0.015, 0.7],
      ]),
    },
  ],
};

/** A clean measuring blip with a small upward glide (pitched: low -> mid -> high for lists). */
function measureBlip(hz: number) {
  return (ctx: SfxContext): StereoClip => {
    const mono = new Float32Array(ctx.frames);
    const base = jitter(ctx.rng, hz, 0.01);
    const freq = (t: number): number => base * expLerp(0.94, 1, t / 0.015);
    addTone(mono, {
      freq,
      wave: 'triangle',
      attackS: 0.002,
      decayS: 0.05,
      lengthS: 0.09,
      gain: 0.6,
    });
    addTone(mono, { freq, attackS: 0.002, decayS: 0.05, lengthS: 0.09, gain: 0.4 });
    return pixelFinish(mono, { crush: 0.45, haasMs: 0.25 });
  };
}

export const measureBlipSfx: SfxDefinition = {
  durationS: 0.15,
  category: 'ui',
  use: 'Blueprint: a measurement / data point appears; list items (low -> mid -> high).',
  variants: [
    { name: 'low', render: measureBlip(880) },
    { name: 'mid', render: measureBlip(1175) },
    { name: 'high', render: measureBlip(1568) },
  ],
};

/** Relay: contact click (metal ring + hiss) and its bounce; [startS, gain, pan] per relay. */
function relay(strikes: readonly (readonly [number, number, number])[], thump: boolean) {
  return (ctx: SfxContext): StereoClip => {
    const scatter = new Scatter(ctx.frames);
    for (const [startS, gain, pan] of strikes) {
      scatter.add(pan, (out) => {
        for (const [offsetS, level] of [
          [0, 1],
          [0.004, 0.4],
        ] as const) {
          addModal(out, {
            startS: startS + offsetS,
            freq: jitter(ctx.rng, 3200, 0.04),
            modes: METAL,
            attackS: 0.0002,
            gain: gain * level,
          });
          addNoise(out, ctx.rng, {
            startS: startS + offsetS,
            lengthS: 0.008,
            filter: 'hp',
            freq: 3000,
            envelope: (t) => attackDecay(t, 0.0002, 0.0008),
            gain: 0.5 * gain * level,
          });
        }
        if (thump) {
          addNoise(out, ctx.rng, {
            startS,
            lengthS: 0.04,
            filter: 'lp',
            freq: 900,
            highpassHz: 160,
            envelope: (t) => attackDecay(t, 0.0005, 0.004),
            gain: 0.8 * gain,
          });
        }
      });
    }
    return applyReverb(crushStereo(scatter.clip, 0.25), PIXEL_ROOM);
  };
}

export const relayClick: SfxDefinition = {
  durationS: 0.1,
  category: 'ui',
  use: 'Blueprint: a relay / switch clicks (a node turns on, a circuit closes).',
  variants: [
    { name: 'small', render: relay([[0, 1, 0]], false) },
    {
      name: 'latch',
      render: relay(
        [
          [0, 1, 0],
          [0.025, 0.7, 0],
        ],
        true,
      ),
    },
    {
      name: 'bank',
      render: relay(
        [
          [0, 1, -0.3],
          [0.012, 0.8, 0.2],
          [0.026, 0.9, -0.1],
          [0.04, 0.7, 0.3],
        ],
        false,
      ),
    },
  ],
};

/** Sonar-ish data ping(s): [startS, Hz] sines with an octave partial, crushed, in a small room. */
function ping(
  notes: readonly (readonly [number, number])[],
  wave: 'sine' | 'triangle',
  decayS: number,
) {
  return (ctx: SfxContext): StereoClip => {
    const mono = new Float32Array(ctx.frames);
    for (const [startS, hz] of notes) {
      const freq = jitter(ctx.rng, hz, 0.005);
      addTone(mono, { startS, freq, wave, attackS: 0.002, decayS, gain: 0.8 });
      addTone(mono, { startS, freq: freq * 2, attackS: 0.002, decayS: decayS * 0.4, gain: 0.2 });
    }
    return pixelFinish(mono, {
      crush: 0.3,
      haasMs: 0.4,
      room: { decayS: 0.5, wet: 0.15, damping: 0.4, size: 0.7, width: 0.5 },
    });
  };
}

export const dataPing: SfxDefinition = {
  durationS: 0.7,
  category: 'tonal',
  use: 'Blueprint: a data ping (result found, value highlighted, closing card).',
  variants: [
    { name: 'ping', render: ping([[0, 1320]], 'sine', 0.12) },
    {
      name: 'double',
      render: ping(
        [
          [0, 1320],
          [0.09, 1760],
        ],
        'sine',
        0.1,
      ),
    },
    { name: 'soft', render: ping([[0, 990]], 'triangle', 0.15) },
  ],
};
