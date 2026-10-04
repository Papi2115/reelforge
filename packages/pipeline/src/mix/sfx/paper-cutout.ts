/**
 * Paper cut-out palette (PLAN.md#12.6, #12.24): the craft table heard up close — paper rustles
 * and slides, scissors snip, tape tears, cut pieces are pressed down with a soft pop, a wooden
 * frame-tick of the stop-motion rig and pages flip. Dry, light and high-passed (no bass), finished
 * with the shared pixel crush (`pixel.ts`).
 */
import type { StereoClip } from '../clip.js';
import { applyReverb, type ReverbOptions } from '../reverb.js';
import { attackDecay, expLerp, swell } from '../synth.js';
import {
  WOOD_MODES,
  addModal,
  addNoise,
  addTone,
  between,
  jitter,
  type Mode,
  type SfxContext,
  type SfxDefinition,
} from './layers.js';
import { Scatter, crushStereo, pixelFinish } from './pixel.js';

/** A craft table: close, a little wood, no boom. */
const DESK: ReverbOptions = { decayS: 0.2, wet: 0.06, damping: 0.55, size: 0.35, lowCutHz: 300 };

/** One paper grain: a 2-8 ms band-passed tick of noise. */
function grain(out: Float32Array, ctx: SfxContext, startS: number, hz: number, gain: number): void {
  const lengthS = between(ctx.rng, 0.002, 0.008);
  addNoise(out, ctx.rng, {
    startS,
    lengthS: lengthS * 4,
    filter: 'bp',
    freq: hz,
    q: 1.4,
    highpassHz: 600,
    envelope: (t) => attackDecay(t, 0.0004, lengthS / 3),
    gain,
  });
}

/** Rustle: `count` grains spread over `spreadS`, an optional swish bed under them. */
function rustle(count: number, spreadS: number, band: readonly [number, number], bed: number) {
  return (ctx: SfxContext): StereoClip => {
    const scatter = new Scatter(ctx.frames);
    for (let index = 0; index < count; index++) {
      const startS = spreadS * (index / count) + between(ctx.rng, 0, spreadS / count);
      const loud = swell(startS / spreadS, 0.35, 1.5, 1.5);
      scatter.add(between(ctx.rng, -0.35, 0.35), (out) => {
        grain(out, ctx, startS, between(ctx.rng, band[0], band[1]), 0.5 + 0.5 * loud);
      });
    }
    if (bed > 0) {
      scatter.add(0, (out) => {
        addNoise(out, ctx.rng, {
          lengthS: spreadS + 0.04,
          filter: 'bp',
          freq: (t) => 2600 + 900 * Math.sin(t * 17),
          q: 0.7,
          highpassHz: 500,
          envelope: (t) => bed * swell(t / (spreadS + 0.04), 0.4),
        });
      });
    }
    return applyReverb(crushStereo(scatter.clip, 0.15), DESK);
  };
}

export const paperRustle: SfxDefinition = {
  durationS: 0.55,
  category: 'texture',
  use: 'Paper cut-out: pieces of paper rustle as they are picked up, shifted or crumpled.',
  variants: [
    { name: 'soft', render: rustle(14, 0.4, [2200, 4200], 0.35) },
    { name: 'busy', render: rustle(34, 0.42, [1800, 5200], 0.2) },
    { name: 'crinkle', render: rustle(20, 0.3, [3500, 6500], 0) },
  ],
};

/** A sheet slid over paper: swept band noise with a fine friction grain. */
function slide(lengthS: number, fromHz: number, toHz: number, landing: boolean) {
  return (ctx: SfxContext): StereoClip => {
    const scatter = new Scatter(ctx.frames);
    let grainLevel = 1;
    let next = 0;
    scatter.add(between(ctx.rng, -0.2, 0.2), (out) => {
      addNoise(out, ctx.rng, {
        lengthS,
        filter: 'bp',
        freq: (t) => expLerp(fromHz, toHz, t / lengthS),
        q: 0.9,
        highpassHz: 400,
        envelope: (t) => {
          if (t >= next) {
            grainLevel = between(ctx.rng, 0.55, 1);
            next = t + 0.003;
          }
          return grainLevel * swell(t / lengthS, 0.55, 1.6, 1.4);
        },
      });
    });
    if (landing) {
      scatter.add(0, (out) => {
        grain(out, ctx, lengthS * 0.92, 2400, 0.6);
      });
    }
    return applyReverb(crushStereo(scatter.clip, 0.15), DESK);
  };
}

export const paperSlide: SfxDefinition = {
  durationS: 0.5,
  category: 'motion',
  use: 'Paper cut-out: a sheet or a cut-out slides across the set (moves, entrances, cuts).',
  variants: [
    { name: 'short', render: slide(0.2, 2400, 3200, true) },
    { name: 'long', render: slide(0.42, 1800, 3000, false) },
    { name: 'in', render: slide(0.34, 1500, 4200, true) },
    { name: 'out', render: slide(0.34, 4000, 1600, false) },
  ],
};

/** Scissor blades: a high metal ring and the shear of paper. */
const BLADE: readonly Mode[] = [
  [1, 1, 0.012],
  [1.62, 0.5, 0.008],
  [2.71, 0.25, 0.005],
];

function snips(times: readonly number[], shear: number) {
  return (ctx: SfxContext): StereoClip => {
    const scatter = new Scatter(ctx.frames);
    for (const startS of times) {
      const at = jitter(ctx.rng, startS + 0.005, 0.03);
      scatter.add(between(ctx.rng, -0.15, 0.15), (out) => {
        addNoise(out, ctx.rng, {
          startS: at,
          lengthS: 0.05,
          filter: 'bp',
          freq: (t) => expLerp(2600, 4800, t / 0.03),
          q: 1.1,
          highpassHz: 900,
          envelope: (t) => shear * swell(t / 0.03, 0.7, 1.5, 3) * (t < 0.03 ? 1 : 0),
        });
        addModal(out, {
          startS: at + 0.028,
          freq: jitter(ctx.rng, 3100, 0.03),
          modes: BLADE,
          attackS: 0.0003,
          gain: 0.5,
        });
      });
    }
    return applyReverb(crushStereo(scatter.clip, 0.2), DESK);
  };
}

export const scissorSnip: SfxDefinition = {
  durationS: 0.32,
  category: 'texture',
  use: 'Paper cut-out: scissors snip a piece out (a reveal, a new shape, a quick series = cutting).',
  variants: [
    { name: 'single', render: snips([0], 1) },
    { name: 'double', render: snips([0, 0.11], 0.9) },
    { name: 'cut', render: snips([0, 0.08, 0.16], 0.7) },
  ],
};

/** Tape: a crackly peel (pulse train speeding up through a band) and a pat to stick it down. */
function tape(lengthS: number, fromHz: number, toHz: number, pats: number) {
  return (ctx: SfxContext): StereoClip => {
    const scatter = new Scatter(ctx.frames);
    if (lengthS > 0) {
      scatter.add(between(ctx.rng, -0.2, 0.2), (out) => {
        let t = 0;
        while (t < lengthS) {
          const rate = expLerp(fromHz, toHz, t / lengthS);
          grain(out, ctx, t, between(ctx.rng, 2000, 3600), 0.45 + 0.55 * swell(t / lengthS, 0.6));
          t += jitter(ctx.rng, 1 / rate, 0.35);
        }
      });
    }
    for (let index = 0; index < pats; index++) {
      scatter.add(0, (out) => {
        addNoise(out, ctx.rng, {
          startS: lengthS + 0.02 + index * 0.07,
          lengthS: 0.05,
          filter: 'bp',
          freq: 1400,
          q: 0.8,
          highpassHz: 350,
          envelope: (t) => attackDecay(t, 0.001, 0.008),
          gain: 1.1,
        });
      });
    }
    return applyReverb(crushStereo(scatter.clip, 0.2), DESK);
  };
}

export const tapeTear: SfxDefinition = {
  durationS: 0.5,
  category: 'texture',
  use: 'Paper cut-out: sticky tape is pulled and torn off the roll, or a piece is taped down.',
  variants: [
    { name: 'tear', render: tape(0.3, 60, 260, 0) },
    { name: 'peel', render: tape(0.36, 40, 90, 0) },
    { name: 'stick', render: tape(0.12, 120, 200, 2) },
  ],
};

/** A cut-out pressed down: a soft pitched pop with a paper tap. */
function pop(hz: number) {
  return (ctx: SfxContext): StereoClip => {
    const mono = new Float32Array(ctx.frames);
    const base = jitter(ctx.rng, hz, 0.015);
    addTone(mono, {
      freq: (t) => base * expLerp(1.35, 1, Math.min(1, t / 0.02)),
      attackS: 0.002,
      decayS: 0.03,
      lengthS: 0.12,
      gain: 0.8,
    });
    addNoise(mono, ctx.rng, {
      lengthS: 0.02,
      filter: 'bp',
      freq: base * 3.5,
      q: 1.2,
      envelope: (t) => attackDecay(t, 0.0005, 0.004),
      gain: 0.35,
    });
    return pixelFinish(mono, { crush: 0.3 });
  };
}

export const paperPop: SfxDefinition = {
  durationS: 0.18,
  category: 'ui',
  use: 'Paper cut-out: a cut piece is pressed onto the set (appear); list items rise low -> mid -> high.',
  variants: [
    { name: 'low', render: pop(440) },
    { name: 'mid', render: pop(620) },
    { name: 'high', render: pop(880) },
  ],
};

/** The stop-motion rig: small wooden ticks ([startS, Hz, gain]). */
function wood(strikes: readonly (readonly [number, number, number])[]) {
  return (ctx: SfxContext): StereoClip => {
    const scatter = new Scatter(ctx.frames);
    for (const [startS, hz, gain] of strikes) {
      scatter.add(between(ctx.rng, -0.1, 0.1), (out) => {
        addModal(out, {
          startS,
          freq: jitter(ctx.rng, hz, 0.02),
          modes: WOOD_MODES,
          attackS: 0.0004,
          decayScale: 0.25,
          gain,
        });
        addNoise(out, ctx.rng, {
          startS,
          lengthS: 0.01,
          filter: 'hp',
          freq: 2500,
          envelope: (t) => attackDecay(t, 0.0002, 0.001),
          gain: 0.25 * gain,
        });
      });
    }
    return applyReverb(crushStereo(scatter.clip, 0.25), DESK);
  };
}

export const woodTick: SfxDefinition = {
  durationS: 0.3,
  category: 'ui',
  use: 'Paper cut-out: a wooden tick of the stop-motion rig (counter steps, small marks, numbers).',
  variants: [
    { name: 'tick', render: wood([[0, 1250, 1]]) },
    { name: 'tock', render: wood([[0, 820, 1]]) },
    {
      name: 'double',
      render: wood([
        [0, 1250, 1],
        [0.06, 980, 0.8],
      ]),
    },
  ],
};

/** A page: an air swish over `lengthS`, then the slap of the page landing. */
function flip(pages: number, lengthS: number, gapS: number, land: number) {
  return (ctx: SfxContext): StereoClip => {
    const scatter = new Scatter(ctx.frames);
    for (let index = 0; index < pages; index++) {
      const startS = index * gapS;
      scatter.add(between(ctx.rng, -0.3, 0.3), (out) => {
        addNoise(out, ctx.rng, {
          startS,
          lengthS,
          filter: 'bp',
          freq: (t) => expLerp(1200, 3400, t / lengthS),
          q: 0.7,
          highpassHz: 450,
          envelope: (t) =>
            swell(t / lengthS, 0.7, 2, 4) * (0.7 + 0.3 * Math.abs(Math.sin(t * 160))),
        });
        grain(out, ctx, startS + lengthS * 0.9, 2000, land);
      });
    }
    return applyReverb(crushStereo(scatter.clip, 0.15), DESK);
  };
}

export const pageFlip: SfxDefinition = {
  durationS: 0.6,
  category: 'texture',
  use: 'Paper cut-out: a page turns (chapter, new scene, end card); riffle = many pages.',
  variants: [
    { name: 'flip', render: flip(1, 0.22, 0, 0.8) },
    { name: 'riffle', render: flip(6, 0.07, 0.065, 0.4) },
    { name: 'turn', render: flip(1, 0.42, 0, 1) },
  ],
};
