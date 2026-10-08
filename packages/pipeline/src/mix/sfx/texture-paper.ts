/**
 * Paper-ish textures: scribble, paper, camera-shutter (bubbles, typing and glitches: `texture.ts`).
 * Paper is shaped crackle; shutters are short noise impacts with a few metallic modes.
 */
import type { StereoClip } from '../clip.js';
import type { Rng } from '../dsp.js';
import { applyReverb } from '../reverb.js';
import { attackDecay, bitcrush, gateEnvelope, swell } from '../synth.js';
import {
  addModal,
  addNoise,
  addTone,
  between,
  jitter,
  placeMono,
  type Mode,
  type SfxContext,
  type SfxDefinition,
} from './layers.js';
import { ROOM } from './texture.js';

/** Sparse crackle: short band-passed noise ticks with a density envelope (0..1 over the clip). */
function addCrackle(
  out: Float32Array,
  rng: Rng,
  lengthS: number,
  count: number,
  density: (position: number) => number,
  band: readonly [number, number],
): void {
  for (let index = 0; index < count; index++) {
    const position = rng();
    if (rng() > density(position)) continue;
    addNoise(out, rng, {
      startS: position * lengthS,
      lengthS: 0.02,
      filter: 'bp',
      freq: between(rng, band[0], band[1]),
      q: 1.5,
      envelope: (t) => attackDecay(t, 0.0002, between(rng, 0.0008, 0.003)),
      gain: between(rng, 0.2, 1),
    });
  }
}

function scribbleVariant(baseHz: number, grain: number, squeak: number) {
  return (ctx: SfxContext): StereoClip => {
    const mono = new Float32Array(ctx.frames);
    const { rng } = ctx;
    let t = 0.01;
    while (t < ctx.durationS - 0.12) {
      const strokeS = Math.min(between(rng, 0.06, 0.16), ctx.durationS - 0.1 - t);
      const startS = t;
      const rate = between(rng, 8, 16);
      addNoise(mono, rng, {
        startS,
        lengthS: strokeS,
        filter: 'bp',
        freq: (s) => baseHz * (0.8 + 0.4 * Math.sin((Math.PI * s) / strokeS)),
        q: 1.2,
        envelope: (s) =>
          Math.sin((Math.PI * s) / strokeS) ** 0.8 * (0.7 + 0.3 * Math.sin(2 * Math.PI * rate * s)),
      });
      if (squeak > 0) {
        addTone(mono, {
          startS,
          freq: (s) => 1200 * (1 + 0.02 * Math.sin(2 * Math.PI * 7 * s)),
          attackS: strokeS * 0.4,
          decayS: strokeS * 0.3,
          gain: squeak,
        });
      }
      t += strokeS + between(rng, 0.01, 0.04);
    }
    addCrackle(mono, rng, ctx.durationS - 0.1, Math.round(120 * grain), () => 1, [2500, 7000]);
    return applyReverb(placeMono(mono, between(rng, -0.1, 0.1), 0.3), ROOM);
  };
}

export const scribble: SfxDefinition = {
  durationS: 0.8,
  category: 'texture',
  use: 'Pen/pencil writing, drawing, annotations appearing.',
  variants: [
    { name: 'pencil', render: scribbleVariant(3500, 0.6, 0) },
    { name: 'marker', render: scribbleVariant(1600, 0.1, 0.08) },
    { name: 'chalk', render: scribbleVariant(2500, 1, 0) },
  ],
};

function pageTurn(ctx: SfxContext): StereoClip {
  const mono = new Float32Array(ctx.frames);
  const lengthS = ctx.durationS * 0.6;
  const envelope = (t: number): number => swell(t / lengthS, 0.55, 2, 2);
  addNoise(mono, ctx.rng, {
    lengthS,
    color: 'pink',
    filter: 'bp',
    freq: (t) => 800 + 1700 * envelope(t),
    q: 0.9,
    envelope,
  });
  addCrackle(mono, ctx.rng, lengthS, 90, (p) => swell(p, 0.55, 2, 2), [1800, 5000]);
  addNoise(mono, ctx.rng, {
    startS: lengthS * 0.95,
    lengthS: 0.1,
    filter: 'lp',
    freq: 500,
    envelope: (t) => attackDecay(t, 0.002, 0.012),
    gain: 0.6,
  });
  return applyReverb(placeMono(mono, 0, 0.4), ROOM);
}

function paperSlide(ctx: SfxContext): StereoClip {
  const mono = new Float32Array(ctx.frames);
  const lengthS = ctx.durationS * 0.7;
  addNoise(mono, ctx.rng, {
    lengthS,
    filter: 'bp',
    freq: (t) => 1200 + 1800 * Math.sin((Math.PI * t) / lengthS),
    q: 0.8,
    envelope: (t) => gateEnvelope(t, lengthS * 0.3, lengthS * 0.5, lengthS),
  });
  addCrackle(mono, ctx.rng, lengthS, 40, () => 0.6, [2500, 6000]);
  return applyReverb(placeMono(mono, 0, 0.4), ROOM);
}

function crumple(ctx: SfxContext): StereoClip {
  const mono = new Float32Array(ctx.frames);
  const lengthS = ctx.durationS * 0.85;
  addCrackle(mono, ctx.rng, lengthS, 260, (p) => swell(p, 0.3, 1.5, 2), [1000, 5000]);
  addNoise(mono, ctx.rng, {
    lengthS,
    filter: 'bp',
    freq: 1800,
    q: 0.7,
    envelope: (t) => 0.15 * swell(t / lengthS, 0.3, 1.5, 2),
  });
  return applyReverb(placeMono(mono, 0, 0.5), ROOM);
}

export const paper: SfxDefinition = {
  durationS: 0.5,
  category: 'texture',
  use: 'Page turn, document slides in, notes crumpled.',
  variants: [
    { name: 'page-turn', render: pageTurn },
    { name: 'slide', render: paperSlide },
    { name: 'crumple', render: crumple },
  ],
};

const SHUTTER_MODES: readonly Mode[] = [
  [1, 1, 0.006],
  [1.73, 0.5, 0.004],
];

function addShutterClick(
  out: Float32Array,
  rng: Rng,
  startS: number,
  scale: number,
  gain = 1,
): void {
  addNoise(out, rng, {
    startS,
    lengthS: 0.03,
    filter: 'bp',
    freq: 3000 * scale,
    q: 0.7,
    envelope: (t) => attackDecay(t, 0.0002, 0.002),
    gain,
  });
  addModal(out, {
    startS,
    freq: jitter(rng, 3800 * scale, 0.05),
    modes: SHUTTER_MODES,
    gain: 0.35 * gain,
  });
  addNoise(out, rng, {
    startS,
    lengthS: 0.08,
    filter: 'lp',
    freq: 300 * scale,
    envelope: (t) => attackDecay(t, 0.0006, 0.008),
    gain,
  });
}

function shutterVariant(kind: 'dslr' | 'vintage' | 'digital') {
  return (ctx: SfxContext): StereoClip => {
    const mono = new Float32Array(ctx.frames);
    const { rng } = ctx;
    addShutterClick(mono, rng, 0, kind === 'vintage' ? 0.85 : 1);
    addShutterClick(mono, rng, between(rng, 0.065, 0.085), kind === 'vintage' ? 0.8 : 0.92);
    if (kind === 'vintage') {
      for (let tick = 0; tick < 6; tick++) {
        addShutterClick(mono, rng, 0.13 + tick * 0.028, 1.1, 0.35);
      }
    }
    if (kind === 'digital') bitcrush(mono, { bits: 7, hold: 2, mix: 0.4 });
    return applyReverb(placeMono(mono, 0, 0.3), { ...ROOM, wet: 0.1 });
  };
}

export const cameraShutter: SfxDefinition = {
  durationS: 0.35,
  category: 'texture',
  use: 'Photo taken, screenshot, freeze-frame.',
  variants: [
    { name: 'dslr', render: shutterVariant('dslr') },
    { name: 'vintage', render: shutterVariant('vintage') },
    { name: 'digital', render: shutterVariant('digital') },
  ],
};
