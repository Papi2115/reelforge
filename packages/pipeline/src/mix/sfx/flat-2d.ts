/**
 * Flat 2D motion-graphics palette (PLAN.md#12.5): soft shape pops, airy swooshes and clean
 * whooshes for slides and cuts, crisp ticks for counters, snaps for words landing and rising
 * chimes for reveals. Clean and light (high-passed, no sub), finished with the shared pixel crush
 * (`pixel.ts`) like every look palette.
 */
import type { StereoClip } from '../clip.js';
import { expLerp, swell } from '../synth.js';
import {
  WOOD_MODES,
  addModal,
  addNoise,
  addTone,
  between,
  jitter,
  panSweep,
  stereoNoise,
  type SfxContext,
  type SfxDefinition,
} from './layers.js';
import { PIXEL_ROOM, crushStereo, pixelFinish } from './pixel.js';
import { applyReverb } from '../reverb.js';

/** A rounded pop: a sine (or triangle) dropping in pitch, with a soft click on top. */
function addPop(
  out: Float32Array,
  ctx: SfxContext,
  startS: number,
  hz: number,
  wave: 'sine' | 'triangle',
): void {
  const base = jitter(ctx.rng, hz, 0.04);
  addTone(out, {
    startS,
    freq: (t) => base * expLerp(1.8, 1, t / 0.03),
    wave,
    attackS: 0.002,
    decayS: 0.032,
    gain: 0.9,
  });
  addTone(out, { startS, freq: base * 2, attackS: 0.001, decayS: 0.012, gain: 0.2 });
  addNoise(out, ctx.rng, {
    startS,
    lengthS: 0.01,
    filter: 'bp',
    freq: base * 3,
    q: 1.5,
    envelope: (t) => Math.exp(-t / 0.002),
    gain: 0.15,
  });
}

function pops(notes: readonly (readonly [number, number])[], wave: 'sine' | 'triangle') {
  return (ctx: SfxContext): StereoClip => {
    const mono = new Float32Array(ctx.frames);
    for (const [startS, hz] of notes) addPop(mono, ctx, startS, hz, wave);
    return pixelFinish(mono, { crush: 0.25, haasMs: 0.2 });
  };
}

export const shapePop: SfxDefinition = {
  durationS: 0.18,
  category: 'ui',
  use: 'Flat 2D: a shape, icon or badge pops in; list items (round -> double -> bright).',
  variants: [
    { name: 'round', render: pops([[0, 520]], 'sine') },
    {
      name: 'double',
      render: pops(
        [
          [0, 600],
          [0.06, 820],
        ],
        'sine',
      ),
    },
    { name: 'bright', render: pops([[0, 980]], 'triangle') },
  ],
};

/** Airy band-passed noise moving `hz[0] -> hz[1]` while panning `pan[0] -> pan[1]`. */
function swoosh(hz: readonly [number, number], pan: readonly [number, number], peakAt: number) {
  return (ctx: SfxContext): StereoClip => {
    const lengthS = ctx.durationS * 0.9;
    const from = jitter(ctx.rng, hz[0], 0.06);
    const to = jitter(ctx.rng, hz[1], 0.06);
    const clip = stereoNoise(ctx.frames, ctx.rng, 0.25, (out, rng) => {
      addNoise(out, rng, {
        lengthS,
        color: 'pink',
        filter: 'bp',
        freq: (t) => expLerp(from, to, t / lengthS),
        q: 1.4,
        highpassHz: 250,
        envelope: (t) => swell(t / lengthS, peakAt, 2, 2.5),
      });
    });
    panSweep(clip, (position) => pan[0] + (pan[1] - pan[0]) * position);
    return applyReverb(crushStereo(clip, 0.15), PIXEL_ROOM);
  };
}

export const swooshSoft: SfxDefinition = {
  durationS: 0.4,
  category: 'motion',
  use: 'Flat 2D: something slides in (a card, a word, a shape); soft and airy.',
  variants: [
    { name: 'right', render: swoosh([700, 2600], [-0.45, 0.45], 0.55) },
    { name: 'left', render: swoosh([2400, 900], [0.45, -0.45], 0.4) },
    { name: 'up', render: swoosh([500, 3600], [0, 0], 0.7) },
  ],
};

/** A clean wide whoosh: lowpassed noise opening and closing, `span` of the clip. */
function whoosh(peakAt: number, rise: number, fall: number, top: number) {
  return (ctx: SfxContext): StereoClip => {
    const lengthS = ctx.durationS * 0.92;
    const peak = jitter(ctx.rng, top, 0.06);
    const clip = stereoNoise(ctx.frames, ctx.rng, 0.4, (out, rng) => {
      addNoise(out, rng, {
        lengthS,
        filter: 'lp',
        freq: (t) => {
          const position = t / lengthS;
          return position < peakAt
            ? expLerp(500, peak, position / peakAt)
            : expLerp(peak, 900, (position - peakAt) / (1 - peakAt));
        },
        q: 0.9,
        highpassHz: 300,
        envelope: (t) => swell(t / lengthS, peakAt, rise, fall),
      });
    });
    return applyReverb(crushStereo(clip, 0.15), PIXEL_ROOM);
  };
}

export const whooshFlat: SfxDefinition = {
  durationS: 0.55,
  category: 'motion',
  use: 'Flat 2D: a clean whoosh for cuts and board changes (cut = quick, reverse = builds up).',
  variants: [
    { name: 'cut', render: whoosh(0.3, 1.5, 3, 4200) },
    { name: 'long', render: whoosh(0.5, 2, 2, 3000) },
    { name: 'reverse', render: whoosh(0.85, 3, 1, 5200) },
  ],
};

/** A crisp tick: one short partial (or wood modes) plus a tiny click. */
function tick(hz: number, kind: 'sine' | 'triangle' | 'wood') {
  return (ctx: SfxContext): StereoClip => {
    const mono = new Float32Array(ctx.frames);
    const freq = jitter(ctx.rng, hz, 0.02);
    if (kind === 'wood') {
      addModal(mono, { freq, modes: WOOD_MODES, attackS: 0.0005, decayScale: 0.06 });
    } else {
      addTone(mono, { freq, wave: kind, attackS: 0.0005, decayS: 0.006, gain: 0.9 });
    }
    addNoise(mono, ctx.rng, {
      lengthS: 0.004,
      filter: 'hp',
      freq: 3000,
      envelope: (t) => Math.exp(-t / 0.0008),
      gain: 0.2,
    });
    return pixelFinish(mono, { crush: 0.2, haasMs: 0.15 });
  };
}

export const flatTick: SfxDefinition = {
  durationS: 0.05,
  category: 'ui',
  use: 'Flat 2D: a clean counter / progress tick (soft, wood, high).',
  variants: [
    { name: 'soft', render: tick(1700, 'triangle') },
    { name: 'wood', render: tick(1250, 'wood') },
    { name: 'high', render: tick(3300, 'sine') },
  ],
};

/** Rising bell-ish notes: [startS, Hz] sines with a soft octave, a small room. */
function chime(notes: readonly (readonly [number, number])[], decayS: number) {
  return (ctx: SfxContext): StereoClip => {
    const mono = new Float32Array(ctx.frames);
    for (const [startS, hz] of notes) {
      const freq = jitter(ctx.rng, hz, 0.004);
      const level = between(ctx.rng, 0.8, 1);
      addTone(mono, { startS, freq, attackS: 0.003, decayS, gain: 0.7 * level });
      addTone(mono, { startS, freq: freq * 2, attackS: 0.002, decayS: decayS * 0.35, gain: 0.18 });
      addTone(mono, { startS, freq: freq * 3, attackS: 0.002, decayS: decayS * 0.15, gain: 0.06 });
    }
    return pixelFinish(mono, {
      crush: 0.2,
      haasMs: 0.35,
      room: { decayS: 0.4, wet: 0.12, damping: 0.45, size: 0.6, width: 0.5 },
    });
  };
}

export const chimeUp: SfxDefinition = {
  durationS: 0.9,
  category: 'tonal',
  use: 'Flat 2D: a rising chime for a reveal, a big number landing or an end card.',
  variants: [
    {
      name: 'two',
      render: chime(
        [
          [0, 1046.5],
          [0.08, 1568],
        ],
        0.17,
      ),
    },
    {
      name: 'triad',
      render: chime(
        [
          [0, 1046.5],
          [0.07, 1318.5],
          [0.14, 1568],
        ],
        0.16,
      ),
    },
    {
      name: 'sparkle',
      render: chime(
        [
          [0, 1568],
          [0.05, 2093],
          [0.1, 2637],
          [0.15, 3136],
        ],
        0.12,
      ),
    },
  ],
};

/** A word lands: a band-passed snap and a short pitched body. */
function snap(clickHz: number, bodyHz: number, click: number, body: number) {
  return (ctx: SfxContext): StereoClip => {
    const mono = new Float32Array(ctx.frames);
    addNoise(mono, ctx.rng, {
      lengthS: 0.02,
      filter: 'bp',
      freq: jitter(ctx.rng, clickHz, 0.05),
      q: 1.8,
      envelope: (t) => Math.exp(-t / 0.003),
      gain: click,
    });
    const base = jitter(ctx.rng, bodyHz, 0.03);
    addTone(mono, {
      freq: (t) => base * expLerp(1.4, 1, t / 0.012),
      wave: 'triangle',
      attackS: 0.001,
      decayS: 0.014,
      gain: body,
    });
    return pixelFinish(mono, { crush: 0.25, haasMs: 0.15 });
  };
}

export const textSnap: SfxDefinition = {
  durationS: 0.09,
  category: 'ui',
  use: 'Flat 2D: a word or number lands (kinetic type, a value snaps into place).',
  variants: [
    { name: 'snap', render: snap(3200, 900, 1, 0.35) },
    { name: 'thock', render: snap(1600, 420, 0.4, 1) },
    { name: 'tap', render: snap(2200, 700, 0.6, 0.6) },
  ],
};
