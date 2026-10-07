/**
 * Textures: bubble, bubble-up, typewriter, glitch (scribble, paper, camera-shutter:
 * `texture-paper.ts`). Physical models kept simple: a bubble is a decaying sine whose pitch
 * rises as it surfaces (Minnaert), keys are short noise impacts with a few metallic modes.
 */
import type { StereoClip } from '../clip.js';
import type { Rng } from '../dsp.js';
import { applyReverb, type ReverbOptions } from '../reverb.js';
import { OnePole, Osc, addPanned, attackDecay, createStereo } from '../synth.js';
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

/** Collects mono events with their own pans into one stereo clip. */
class Scatter {
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

export const ROOM: ReverbOptions = { decayS: 0.3, wet: 0.08, damping: 0.5, size: 0.5 };

/** One bubble: decaying sine rising by `octaves` over ~1.5 decays, plus a faint "plip". */
function addBubble(
  out: Float32Array,
  rng: Rng,
  startS: number,
  hz: number,
  decayS: number,
  octaves: number,
  gain = 1,
): void {
  const rate = (octaves * Math.LN2) / (decayS * 1.5);
  addTone(out, {
    startS,
    freq: (t) => hz * Math.exp(rate * Math.min(t, decayS * 3)),
    attackS: 0.0015,
    decayS,
    gain,
  });
  addTone(out, {
    startS,
    freq: (t) => 2.7 * hz * Math.exp(rate * Math.min(t, decayS * 3)),
    attackS: 0.001,
    decayS: decayS * 0.3,
    gain: 0.12 * gain,
  });
  addNoise(out, rng, {
    startS,
    lengthS: 0.01,
    filter: 'bp',
    freq: hz * 3,
    q: 2,
    envelope: (t) => attackDecay(t, 0.0003, 0.0015),
    gain: 0.08 * gain,
  });
}

const WATER: ReverbOptions = { decayS: 0.35, wet: 0.1, damping: 0.3, size: 0.6 };

function bubbleVariant(bubbles: readonly (readonly [number, number, number, number])[]) {
  return (ctx: SfxContext): StereoClip => {
    const scatter = new Scatter(ctx.frames);
    for (const [startS, hz, decayS, octaves] of bubbles) {
      scatter.add(between(ctx.rng, -0.15, 0.15), (out) => {
        addBubble(out, ctx.rng, startS, jitter(ctx.rng, hz, 0.08), decayS, octaves);
      });
    }
    return applyReverb(scatter.clip, WATER);
  };
}

export const bubble: SfxDefinition = {
  durationS: 0.25,
  category: 'texture',
  use: 'Single bubble / blob appears, liquid UI, playful pop-in.',
  variants: [
    { name: 'single', render: bubbleVariant([[0, 600, 0.035, 1]]) },
    {
      name: 'double',
      render: bubbleVariant([
        [0, 550, 0.03, 1],
        [0.05, 750, 0.025, 1],
      ]),
    },
    { name: 'small', render: bubbleVariant([[0, 1100, 0.02, 1.2]]) },
    { name: 'big', render: bubbleVariant([[0, 340, 0.06, 0.8]]) },
    { name: 'gloop', render: bubbleVariant([[0, 240, 0.07, 2]]) },
  ],
};

function bubbleStream(count: number, fromHz: number, toHz: number, size: number) {
  return (ctx: SfxContext): StereoClip => {
    const scatter = new Scatter(ctx.frames);
    const lastS = ctx.durationS * 0.68;
    for (let index = 0; index < count; index++) {
      const position = index / Math.max(1, count - 1);
      // Spacing shrinks as the stream speeds up.
      const startS = lastS * (1 - (1 - position) ** 1.6) + between(ctx.rng, -0.008, 0.008);
      const hz = fromHz * (toHz / fromHz) ** position;
      scatter.add(between(ctx.rng, -0.4, 0.4), (out) => {
        addBubble(
          out,
          ctx.rng,
          Math.max(0, startS),
          jitter(ctx.rng, hz, 0.1),
          size * between(ctx.rng, 0.8, 1.2),
          1,
          0.6 + 0.4 * ctx.rng(),
        );
      });
    }
    return applyReverb(scatter.clip, WATER);
  };
}

export const bubbleUp: SfxDefinition = {
  durationS: 0.8,
  category: 'texture',
  use: 'Rising stream of bubbles: something fills up, boils, comes alive.',
  variants: [
    { name: 'stream', render: bubbleStream(9, 420, 1300, 0.03) },
    { name: 'few', render: bubbleStream(5, 380, 900, 0.04) },
    { name: 'fizzy', render: bubbleStream(14, 700, 2200, 0.018) },
  ],
};

interface KeyShape {
  readonly click: readonly [number, number];
  readonly modes: readonly Mode[];
  readonly ringHz: number;
  readonly thump: readonly [number, number];
  readonly bottomOutS?: number;
  readonly spacing: readonly [number, number];
}

function addKeystroke(out: Float32Array, rng: Rng, startS: number, shape: KeyShape): void {
  const level = between(rng, 0.7, 1);
  const [clickHz, clickDecay] = shape.click;
  addNoise(out, rng, {
    startS,
    lengthS: clickDecay * 12,
    filter: 'bp',
    freq: jitter(rng, clickHz, 0.1),
    q: 1.5,
    envelope: (t) => attackDecay(t, 0.0003, clickDecay),
    gain: level,
  });
  addModal(out, {
    startS,
    freq: jitter(rng, shape.ringHz, 0.05),
    modes: shape.modes,
    gain: 0.3 * level,
  });
  const [thumpHz, thumpDecay] = shape.thump;
  addNoise(out, rng, {
    startS: startS + (shape.bottomOutS ?? 0),
    lengthS: thumpDecay * 12,
    filter: 'lp',
    freq: thumpHz,
    envelope: (t) => attackDecay(t, 0.0008, thumpDecay),
    gain: 0.5 * level,
  });
}

function typing(shape: KeyShape) {
  return (ctx: SfxContext): StereoClip => {
    const scatter = new Scatter(ctx.frames);
    const lastS = ctx.durationS - 0.06;
    let t = 0;
    while (t < lastS) {
      const startS = t;
      scatter.add(between(ctx.rng, -0.2, 0.2), (out) => {
        addKeystroke(out, ctx.rng, startS, shape);
      });
      const [from, to] = shape.spacing;
      t += ctx.rng() < 0.12 ? between(ctx.rng, 0.15, 0.21) : between(ctx.rng, from, to);
    }
    return applyReverb(scatter.clip, ROOM);
  };
}

export const typewriter: SfxDefinition = {
  durationS: 1.2,
  category: 'texture',
  use: 'Text typing on screen (match the duration to the typing).',
  variants: [
    {
      name: 'typewriter',
      render: typing({
        click: [2600, 0.004],
        modes: [
          [1, 1, 0.015],
          [1.62, 0.6, 0.01],
          [2.48, 0.3, 0.006],
        ],
        ringHz: 2100,
        thump: [400, 0.02],
        spacing: [0.07, 0.13],
      }),
    },
    {
      name: 'mechanical',
      render: typing({
        click: [3500, 0.003],
        modes: [[1, 1, 0.008]],
        ringHz: 1800,
        thump: [900, 0.01],
        bottomOutS: 0.008,
        spacing: [0.06, 0.11],
      }),
    },
    {
      name: 'laptop',
      render: typing({
        click: [1800, 0.006],
        modes: [[1, 0.4, 0.008]],
        ringHz: 900,
        thump: [600, 0.008],
        spacing: [0.07, 0.12],
      }),
    },
  ],
};

type GlitchKind = 'blip' | 'crush' | 'hold' | 'stutter' | 'warble' | 'gap';

/** Writes one glitch segment into `out[start, end)`. */
function glitchSegment(
  out: Float32Array,
  start: number,
  end: number,
  rng: Rng,
  kind: GlitchKind,
): void {
  const level = between(rng, 0.4, 1);
  const hz = between(rng, 300, 2400);
  const hold = 2 + Math.floor(rng() * 14);
  const osc = new Osc(rng());
  const soften = new OnePole(6500);
  const grain = Math.max(24, Math.floor(between(rng, 0.003, 0.012) * SR));
  const grainSource = Float32Array.from({ length: grain }, () => 2 * rng() - 1);
  let held = 0;
  for (let index = start; index < end; index++) {
    const offset = index - start;
    let value = 0;
    if (kind === 'blip') value = osc.square(hz, 0.25);
    else if (kind === 'crush') value = Math.round(osc.sine(hz) * 4) / 4;
    else if (kind === 'hold') {
      if (offset % hold === 0) held = 2 * rng() - 1;
      value = held;
    } else if (kind === 'stutter') value = (grainSource[offset % grain] ?? 0) * osc.sine(hz * 0.25);
    else if (kind === 'warble') value = osc.sine(hz * (1 + 0.3 * Math.sin(offset / 40)));
    // A 0.5 ms fade on each side keeps the segment edges crisp instead of clicky.
    const edge = Math.min(1, offset / 24, (end - 1 - index) / 24);
    out[index] = soften.low(value) * level * edge;
  }
}

function glitchVariant(kinds: readonly GlitchKind[]) {
  return (ctx: SfxContext): StereoClip => {
    const scatter = new Scatter(ctx.frames);
    let start = 0;
    // The last 20 ms stay silent so the clip never ends mid-segment.
    const limit = ctx.frames - Math.round(0.02 * SR);
    while (start < limit) {
      const end = Math.min(limit, start + Math.round(between(ctx.rng, 0.012, 0.045) * SR));
      const kind = kinds[Math.floor(ctx.rng() * kinds.length)] ?? 'gap';
      const segmentStart = start;
      scatter.add(between(ctx.rng, -0.5, 0.5), (out) => {
        glitchSegment(out, segmentStart, end, ctx.rng, kind);
      });
      start = end;
    }
    return scatter.clip;
  };
}

export const glitch: SfxDefinition = {
  durationS: 0.35,
  category: 'texture',
  use: 'Digital error, data corruption, hacker / tech moments.',
  variants: [
    { name: 'digital', render: glitchVariant(['blip', 'crush', 'blip', 'gap']) },
    { name: 'stutter', render: glitchVariant(['stutter', 'stutter', 'crush', 'gap']) },
    { name: 'corrupt', render: glitchVariant(['hold', 'hold', 'gap', 'crush']) },
    { name: 'warble', render: glitchVariant(['warble', 'warble', 'blip', 'gap']) },
  ],
};
