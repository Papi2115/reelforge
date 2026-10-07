/**
 * Sketchbook world palette (PLAN.md#13.6; beta feedback "dedicated sketchbook sound recipes"): the
 * desk of one notebook heard up close, the three sounds the reused recipes could not make: a
 * retractable ballpoint clicked on and off (a small spring-loaded plastic click, brighter and
 * drier than a marker cap), a marker slammed onto the page (a dull felt-and-desk thump with a
 * paper slap, never a boom) and paper torn (the fibres ripping: dense crackle that speeds up, not
 * the tape's sticky peel). Dry and close, finished with the shared pixel crush (`pixel.ts`).
 */
import type { StereoClip } from '../clip.js';
import { applyReverb, type ReverbOptions } from '../reverb.js';
import { attackDecay, expLerp, swell } from '../synth.js';
import {
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

/** A notebook on a desk: close, a little wood, no boom. */
const DESK: ReverbOptions = { decayS: 0.18, wet: 0.06, damping: 0.55, size: 0.3, lowCutHz: 250 };

/** The pen's plastic barrel and the steel spring inside it (a short metallic ring on top). */
const BARREL: readonly Mode[] = [
  [1, 1, 0.003],
  [2.7, 0.55, 0.0018],
  [5.3, 0.3, 0.004],
];

/** Ballpoint clicks at [startS, gain, pitch factor]. */
function click(strikes: readonly (readonly [number, number, number])[], hz: number) {
  return (ctx: SfxContext): StereoClip => {
    const mono = new Float32Array(ctx.frames);
    for (const [startS, gain, pitch] of strikes) {
      addModal(mono, {
        startS,
        freq: jitter(ctx.rng, hz * pitch, 0.03),
        modes: BARREL,
        attackS: 0.0003,
        gain,
      });
      addNoise(mono, ctx.rng, {
        startS,
        lengthS: 0.008,
        filter: 'hp',
        freq: 3200,
        envelope: (t) => attackDecay(t, 0.0003, 0.0012),
        gain: 0.35 * gain,
      });
    }
    return pixelFinish(mono, { crush: 0.25, haasMs: 0.12 });
  };
}

export const penClick: SfxDefinition = {
  durationS: 0.12,
  category: 'ui',
  use: 'Sketchbook: a ballpoint clicked on (the hand starts writing) or off (done); double = a nervous click-click.',
  variants: [
    {
      name: 'on',
      render: click(
        [
          [0, 0.7, 1],
          [0.022, 1, 1.12],
        ],
        2400,
      ),
    },
    { name: 'off', render: click([[0, 1, 0.82]], 2400) },
    {
      name: 'double',
      render: click(
        [
          [0, 1, 1],
          [0.055, 0.85, 1.05],
        ],
        2600,
      ),
    },
  ],
};

/** A marker slammed down: a dull thump of hand and desk, a paper slap, a felt squeak in `squeak`. */
function thump(weight: number, slap: number, squeak: boolean) {
  return (ctx: SfxContext): StereoClip => {
    const mono = new Float32Array(ctx.frames);
    const body = jitter(ctx.rng, 150, 0.06);
    addTone(mono, {
      freq: (t) => body * expLerp(1.5, 1, Math.min(1, t / 0.03)),
      attackS: 0.0015,
      decayS: 0.035 * weight,
      gain: 0.8,
    });
    addNoise(mono, ctx.rng, {
      lengthS: 0.09 * weight,
      color: 'pink',
      filter: 'bp',
      freq: (t) => expLerp(700, 320, Math.min(1, t / 0.06)),
      q: 0.9,
      highpassHz: 120,
      envelope: (t) => attackDecay(t, 0.0012, 0.02 * weight),
      gain: 1.1,
    });
    addNoise(mono, ctx.rng, {
      startS: 0.002,
      lengthS: 0.04,
      filter: 'bp',
      freq: 1600,
      q: 0.9,
      highpassHz: 500,
      envelope: (t) => attackDecay(t, 0.0006, 0.007),
      gain: slap,
    });
    if (squeak) {
      addNoise(mono, ctx.rng, {
        startS: 0.05,
        lengthS: 0.09,
        filter: 'bp',
        freq: (t) => 1900 + 300 * Math.sin((t / 0.09) * Math.PI),
        q: 3,
        highpassHz: 600,
        envelope: (t) => swell(t / 0.09, 0.3, 2, 2) * 0.5,
        gain: 0.35,
      });
    }
    return pixelFinish(mono, { crush: 0.25, room: DESK });
  };
}

export const markerThump: SfxDefinition = {
  durationS: 0.2,
  category: 'impact',
  use: 'Sketchbook: a marker slammed onto the page for the one loud word or number (C page); tap = lighter, slam = harder with a felt squeak.',
  variants: [
    { name: 'thump', render: thump(1, 0.5, false) },
    { name: 'slam', render: thump(1.5, 0.8, true) },
    { name: 'tap', render: thump(0.6, 0.35, false) },
  ],
};

/** One paper fibre snapping: a 2-6 ms band-passed tick. */
function fibre(out: Float32Array, ctx: SfxContext, startS: number, hz: number, gain: number): void {
  const lengthS = between(ctx.rng, 0.002, 0.006);
  addNoise(out, ctx.rng, {
    startS,
    lengthS: lengthS * 4,
    filter: 'bp',
    freq: hz,
    q: 1.1,
    highpassHz: 700,
    envelope: (t) => attackDecay(t, 0.0003, lengthS / 3),
    gain,
  });
}

/**
 * Paper torn over `lengthS`: fibres snapping ever faster (`fromHz` -> `toHz` per second) over a
 * rough band of noise; `tugs` > 1 tears in short pulls (a page ripped out of the spiral).
 */
function tear(lengthS: number, fromHz: number, toHz: number, tugs: number) {
  return (ctx: SfxContext): StereoClip => {
    const scatter = new Scatter(ctx.frames);
    const each = lengthS / tugs;
    for (let tug = 0; tug < tugs; tug += 1) {
      const from = tug * each;
      const span = each * (tugs > 1 ? 0.75 : 1);
      scatter.add(between(ctx.rng, -0.25, 0.25), (out) => {
        let t = 0;
        while (t < span) {
          const rate = expLerp(fromHz, toHz, t / span);
          fibre(out, ctx, from + t, between(ctx.rng, 2200, 4800), 0.4 + 0.6 * swell(t / span, 0.7));
          t += jitter(ctx.rng, 1 / rate, 0.4);
        }
        addNoise(out, ctx.rng, {
          startS: from,
          lengthS: span,
          color: 'pink',
          filter: 'bp',
          freq: (t) => expLerp(1500, 2600, t / span),
          q: 0.7,
          highpassHz: 500,
          envelope: (t) => swell(t / span, 0.75, 1.5, 3) * (0.8 + 0.2 * Math.sin(t * 190)),
          gain: 0.45,
        });
      });
    }
    return applyReverb(crushStereo(scatter.clip, 0.2), DESK);
  };
}

export const paperTear: SfxDefinition = {
  durationS: 0.6,
  category: 'texture',
  use: 'Sketchbook: paper torn (the torn-strip page transition, a plan ripped up); rip = one fast tear, out = a page ripped out of the spiral in tugs.',
  variants: [
    { name: 'tear', render: tear(0.5, 90, 320, 1) },
    { name: 'rip', render: tear(0.26, 200, 600, 1) },
    { name: 'out', render: tear(0.54, 140, 400, 3) },
  ],
};
