/**
 * Movement: whoosh, swoosh-in/out, whoosh-impact (riser, downer: `risers.ts`). Whooshes are
 * three decorrelated noise layers (resonant band "voice", low body, high air) under a Doppler-like
 * centre-frequency curve and an asymmetric swell, swept across the stereo field, with a short room.
 */
import type { StereoClip } from '../clip.js';
import { normalizePeak, peakOf } from '../dsp.js';
import { applyReverb } from '../reverb.js';
import { expLerp, swell } from '../synth.js';
import { addHit } from './impact.js';
import {
  addNoise,
  addTone,
  jitter,
  panSweep,
  placeMono,
  stereoNoise,
  sumStereo,
  type SfxContext,
  type SfxDefinition,
} from './layers.js';

interface WhooshShape {
  /** Share of the clip the movement occupies (the rest is reverb tail). */
  readonly span: number;
  readonly peakAt: number;
  readonly rise: number;
  readonly fall: number;
  /** Centre frequency at the start, at the peak and at the end (Hz). */
  readonly hz: readonly [number, number, number];
  readonly q: number;
  readonly body: number;
  readonly air: number;
  readonly pan: readonly [number, number];
  readonly width: number;
  readonly wet: number;
  /** Seconds before the movement starts. */
  readonly offsetS?: number;
}

const smoothStep = (x: number): number => {
  const clamped = Math.min(1, Math.max(0, x));
  return clamped * clamped * (3 - 2 * clamped);
};

function whooshLayers(ctx: SfxContext, shape: WhooshShape): StereoClip {
  const { frames, rng } = ctx;
  const lengthS = Math.max(0.05, ctx.durationS * shape.span);
  const startS = shape.offsetS ?? 0;
  const from = jitter(rng, shape.hz[0], 0.08);
  const peak = jitter(rng, shape.hz[1], 0.08);
  const to = jitter(rng, shape.hz[2], 0.08);
  const envelope = (t: number): number => swell(t / lengthS, shape.peakAt, shape.rise, shape.fall);
  const centre = (t: number): number => {
    const position = t / lengthS;
    return position < shape.peakAt
      ? expLerp(from, peak, position / shape.peakAt)
      : expLerp(peak, to, (position - shape.peakAt) / (1 - shape.peakAt));
  };
  const voice = stereoNoise(frames, rng, shape.width, (out, stream) => {
    addNoise(out, stream, {
      startS,
      lengthS,
      color: 'pink',
      filter: 'bp',
      freq: centre,
      q: shape.q,
      highpassHz: 60,
      envelope,
    });
  });
  const body = stereoNoise(frames, rng, shape.width * 0.5, (out, stream) => {
    addNoise(out, stream, {
      startS,
      lengthS,
      color: 'brown',
      filter: 'bp',
      freq: (t) => Math.max(140, centre(t) * 0.35),
      q: 0.7,
      highpassHz: 90,
      envelope,
    });
  });
  const air = stereoNoise(frames, rng, Math.min(1, shape.width + 0.2), (out, stream) => {
    addNoise(out, stream, {
      startS,
      lengthS,
      filter: 'hp',
      freq: (t) => centre(t) * 2.2,
      q: 0.7,
      envelope: (t) => envelope(t) ** 1.5,
    });
  });
  const mixed = sumStereo(frames, [
    [voice, 1],
    [body, shape.body],
    [air, shape.air],
  ]);
  const [panFrom, panTo] = shape.pan;
  const spanShare = (startS + lengthS) / ctx.durationS;
  panSweep(mixed, (position) => panFrom + (panTo - panFrom) * smoothStep(position / spanShare));
  // Seeded room size: a fixed size would ring the same comb mode on every whoosh.
  return applyReverb(mixed, {
    decayS: 0.45,
    wet: shape.wet * 0.6,
    damping: 0.55,
    size: jitter(rng, 0.8, 0.15),
  });
}

const whooshVariant = (shape: WhooshShape) => (ctx: SfxContext) => whooshLayers(ctx, shape);

export const whoosh: SfxDefinition = {
  durationS: 0.7,
  category: 'motion',
  use: 'Transitions, camera moves, objects flying past.',
  variants: [
    {
      name: 'fast',
      render: whooshVariant({
        ...{ span: 0.55, peakAt: 0.5, rise: 2, fall: 2.4, hz: [600, 3200, 1400], q: 1.6 },
        ...{ body: 0.35, air: 0.25, pan: [-0.5, 0.5], width: 0.5, wet: 0.12 },
      }),
    },
    {
      name: 'slow',
      render: whooshVariant({
        ...{ span: 0.9, peakAt: 0.55, rise: 2, fall: 2, hz: [250, 1500, 450], q: 1.1 },
        ...{ body: 0.6, air: 0.15, pan: [-0.3, 0.3], width: 0.5, wet: 0.14 },
      }),
    },
    {
      name: 'up',
      render: whooshVariant({
        ...{ span: 0.85, peakAt: 0.82, rise: 2.6, fall: 1.2, hz: [300, 4500, 4000], q: 1.4 },
        ...{ body: 0.3, air: 0.35, pan: [-0.2, 0.2], width: 0.45, wet: 0.12 },
      }),
    },
    {
      name: 'down',
      render: whooshVariant({
        ...{ span: 0.8, peakAt: 0.18, rise: 1.2, fall: 2.6, hz: [4200, 4000, 280], q: 1.4 },
        ...{ body: 0.4, air: 0.3, pan: [0.2, -0.2], width: 0.45, wet: 0.12 },
      }),
    },
    {
      name: 'air',
      render: whooshVariant({
        ...{ span: 0.85, peakAt: 0.5, rise: 2, fall: 2, hz: [1200, 3800, 2000], q: 0.9 },
        ...{ body: 0.15, air: 0.45, pan: [0.4, -0.4], width: 0.8, wet: 0.15 },
      }),
    },
  ],
};

function swoosh(direction: 'in' | 'out', bright: number, span: number, tick: boolean) {
  return (ctx: SfxContext): StereoClip => {
    const incoming = direction === 'in';
    const clip = whooshLayers(ctx, {
      span,
      peakAt: incoming ? 0.88 : 0.12,
      rise: incoming ? 2.4 : 1,
      fall: incoming ? 1 : 2.4,
      hz: incoming
        ? [500 * bright, 2800 * bright, 2200 * bright]
        : [2200 * bright, 2800 * bright, 450 * bright],
      q: bright < 1 ? 1 : 1.6,
      body: bright < 1 ? 0.45 : 0.2,
      air: 0.3,
      pan: incoming ? [-0.6, 0] : [0, 0.6],
      width: 0.4,
      wet: 0.1,
    });
    if (!tick) return clip;
    const landing = new Float32Array(ctx.frames);
    const at = incoming ? ctx.durationS * span * 0.9 : 0.004;
    addTone(landing, { startS: at, freq: 1800 * bright, attackS: 0.0006, decayS: 0.006 });
    addTone(landing, {
      startS: at,
      freq: 3300 * bright,
      attackS: 0.0004,
      decayS: 0.003,
      gain: 0.4,
    });
    normalizePeak(landing, 0.25 * peakOf(clip.left));
    return sumStereo(ctx.frames, [
      [clip, 1],
      [placeMono(landing, incoming ? 0 : 0.1), 1],
    ]);
  };
}

export const swooshIn: SfxDefinition = {
  durationS: 0.5,
  category: 'motion',
  use: 'UI panel / card slides in and settles.',
  variants: [
    { name: 'soft', render: swoosh('in', 0.65, 0.75, false) },
    { name: 'bright', render: swoosh('in', 1.45, 0.6, false) },
    { name: 'tick', render: swoosh('in', 1, 0.72, true) },
  ],
};

export const swooshOut: SfxDefinition = {
  durationS: 0.5,
  category: 'motion',
  use: 'UI panel / card slides away.',
  variants: [
    { name: 'soft', render: swoosh('out', 0.65, 0.75, false) },
    { name: 'bright', render: swoosh('out', 1.45, 0.6, false) },
    { name: 'tick', render: swoosh('out', 1, 0.72, true) },
  ],
};

function whooshIntoHit(hz: readonly [number, number, number], sub: number, ringing: boolean) {
  return (ctx: SfxContext): StereoClip => {
    const hitAtS = 0.42;
    const movement = whooshLayers(ctx, {
      span: (hitAtS + 0.03) / ctx.durationS,
      peakAt: 0.9,
      rise: 2.4,
      fall: 1,
      hz,
      q: 1.4,
      body: 0.4,
      air: 0.3,
      pan: [-0.4, 0],
      width: 0.5,
      wet: 0.08,
    });
    const mono = new Float32Array(ctx.frames);
    addHit(mono, ctx.rng, hitAtS, {
      sub: [sub, sub * 0.36, 0.3, 0.7],
      body: [sub * 1.6, sub * 0.8, 0.06, 0.9],
      crack: [2600, 0.006, 0.4],
      thump: [700, 0.04, 0.7],
      ...(ringing ? { ring: 0.1 } : {}),
      drive: 1.6,
    });
    const impact = applyReverb(placeMono(mono, 0, 0.4), {
      decayS: 0.6,
      wet: 0.18,
      damping: 0.5,
      size: 0.9,
    });
    return sumStereo(ctx.frames, [
      [movement, 0.8],
      [impact, 1],
    ]);
  };
}

export const whooshImpact: SfxDefinition = {
  durationS: 1.3,
  category: 'impact',
  use: 'Something flies in and lands: title cards, big numbers.',
  variants: [
    { name: 'classic', render: whooshIntoHit([400, 3500, 3000], 130, false) },
    { name: 'heavy', render: whooshIntoHit([250, 2200, 2000], 100, true) },
    { name: 'snappy', render: whooshIntoHit([700, 5000, 4500], 160, false) },
  ],
};
