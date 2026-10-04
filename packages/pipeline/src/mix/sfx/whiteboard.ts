/**
 * Whiteboard palette (PLAN.md#12.7): felt marker strokes and squeaks on the board, the marker cap
 * popping off and on, the eraser's felt swipe, taps on the board, soft chimes and pitched ticks.
 * Clean and short (high-passed, no heavy bass), finished with the shared pixel crush (`pixel.ts`).
 */
import type { StereoClip } from '../clip.js';
import { applyReverb } from '../reverb.js';
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
import { PIXEL_ROOM, Scatter, crushStereo, pixelFinish } from './pixel.js';

/** Felt tip on melamine: smooth band-passed noise with a faint resonant squeal riding on it. */
function addMarker(
  out: Float32Array,
  ctx: SfxContext,
  startS: number,
  lengthS: number,
  hz: number,
): void {
  const drift = between(ctx.rng, 0, Math.PI * 2);
  addNoise(out, ctx.rng, {
    startS,
    lengthS,
    filter: 'bp',
    freq: (t) => hz * (1 + 0.12 * Math.sin(t * 9 + drift)),
    q: 2.2,
    highpassHz: 400,
    envelope: (t) => swell(t / lengthS, 0.2, 2, 1.6),
  });
  addTone(out, {
    startS,
    freq: (t) => hz * 1.6 * (1 + 0.03 * Math.sin(t * 38 + drift)),
    attackS: lengthS * 0.3,
    decayS: lengthS * 0.25,
    lengthS,
    gain: 0.12,
  });
}

/** Marker strokes: [startS, lengthS] at a base pitch, scattered a little in the stereo field. */
function marker(strokes: readonly (readonly [number, number])[], hz: number) {
  return (ctx: SfxContext): StereoClip => {
    const scatter = new Scatter(ctx.frames);
    for (const [startS, lengthS] of strokes) {
      scatter.add(between(ctx.rng, -0.2, 0.2), (out) => {
        addMarker(out, ctx, startS, lengthS, jitter(ctx.rng, hz, 0.06));
      });
    }
    return applyReverb(crushStereo(scatter.clip, 0.2), PIXEL_ROOM);
  };
}

export const markerStroke: SfxDefinition = {
  durationS: 0.6,
  category: 'texture',
  use: 'Whiteboard: a felt marker draws a stroke (short line, long line or a quick scribble).',
  variants: [
    { name: 'short', render: marker([[0, 0.24]], 2300) },
    { name: 'long', render: marker([[0, 0.55]], 2000) },
    {
      name: 'scribble',
      render: marker(
        [
          [0, 0.09],
          [0.12, 0.09],
          [0.24, 0.09],
          [0.36, 0.12],
        ],
        2700,
      ),
    },
  ],
};

/** A marker squeak: a narrow resonant chirp gliding from `from` to `to` Hz. */
function squeak(chirps: readonly (readonly [number, number, number])[]) {
  return (ctx: SfxContext): StereoClip => {
    const mono = new Float32Array(ctx.frames);
    for (const [startS, from, to] of chirps) {
      const lengthS = 0.11;
      const wobble = between(ctx.rng, 0, Math.PI);
      const freq = (t: number): number =>
        expLerp(from, to, Math.min(1, t / lengthS)) * (1 + 0.02 * Math.sin(t * 160 + wobble));
      addTone(mono, {
        startS,
        freq,
        wave: 'triangle',
        attackS: 0.012,
        decayS: 0.05,
        lengthS,
        gain: 0.7,
      });
      addNoise(mono, ctx.rng, {
        startS,
        lengthS,
        filter: 'bp',
        freq,
        q: 6,
        envelope: (t) => swell(t / lengthS, 0.3, 2, 2),
        gain: 0.5,
      });
    }
    return pixelFinish(mono, { crush: 0.3, haasMs: 0.2 });
  };
}

export const markerSqueak: SfxDefinition = {
  durationS: 0.3,
  category: 'texture',
  use: 'Whiteboard: the marker squeaks (a sharp turn, a tick mark, an emphatic underline).',
  variants: [
    { name: 'up', render: squeak([[0, 1500, 2400]]) },
    { name: 'down', render: squeak([[0, 2600, 1600]]) },
    {
      name: 'double',
      render: squeak([
        [0, 1800, 2300],
        [0.14, 2000, 2600],
      ]),
    },
  ],
};

const PLASTIC: readonly Mode[] = [
  [1, 1, 0.004],
  [2.4, 0.5, 0.002],
  [4.1, 0.2, 0.0015],
];

/** Small plastic body struck at [startS, gain], plus a short air puff when `puff`. */
function plastic(hz: number, strikes: readonly (readonly [number, number])[], puff: boolean) {
  return (ctx: SfxContext): StereoClip => {
    const mono = new Float32Array(ctx.frames);
    for (const [startS, gain] of strikes) {
      addModal(mono, {
        startS,
        freq: jitter(ctx.rng, hz, 0.03),
        modes: PLASTIC,
        attackS: 0.0003,
        gain,
      });
      addNoise(mono, ctx.rng, {
        startS,
        lengthS: 0.006,
        filter: 'hp',
        freq: 2500,
        envelope: (t) => attackDecay(t, 0.0002, 0.0008),
        gain: 0.3 * gain,
      });
    }
    if (puff) {
      addNoise(mono, ctx.rng, {
        startS: 0.002,
        lengthS: 0.04,
        filter: 'bp',
        freq: (t) => expLerp(1800, 700, t / 0.04),
        q: 1.2,
        highpassHz: 300,
        envelope: (t) => attackDecay(t, 0.001, 0.008),
        gain: 0.8,
      });
    }
    return pixelFinish(mono, { crush: 0.3, haasMs: 0.15 });
  };
}

export const capPop: SfxDefinition = {
  durationS: 0.08,
  category: 'ui',
  use: 'Whiteboard: the marker cap pops off (a new drawing starts) or clicks back on (done).',
  variants: [
    { name: 'off', render: plastic(1500, [[0, 1]], true) },
    {
      name: 'on',
      render: plastic(
        2300,
        [
          [0, 0.8],
          [0.018, 1],
        ],
        false,
      ),
    },
    { name: 'click', render: plastic(2900, [[0, 1]], false) },
  ],
};

/** Felt rubbing the board: low-passed pink noise in back-and-forth swells. */
function eraser(passes: number, lengthS: number) {
  return (ctx: SfxContext): StereoClip => {
    const scatter = new Scatter(ctx.frames);
    const each = lengthS / passes;
    for (let pass = 0; pass < passes; pass += 1) {
      scatter.add(pass % 2 === 0 ? -0.25 : 0.25, (out) => {
        addNoise(out, ctx.rng, {
          startS: pass * each,
          lengthS: each,
          color: 'pink',
          filter: 'bp',
          freq: (t) => 900 + 500 * Math.sin((t / each) * Math.PI),
          q: 0.7,
          highpassHz: 250,
          envelope: (t) => swell(t / each, 0.45, 2, 2),
        });
      });
    }
    return applyReverb(crushStereo(scatter.clip, 0.15), PIXEL_ROOM);
  };
}

export const eraserSwipe: SfxDefinition = {
  durationS: 0.6,
  category: 'texture',
  use: 'Whiteboard: the eraser wipes the board (one long swipe or a quick scrub).',
  variants: [
    { name: 'swipe', render: eraser(1, 0.55) },
    { name: 'scrub', render: eraser(4, 0.55) },
    { name: 'flick', render: eraser(1, 0.22) },
  ],
};

const BOARD: readonly Mode[] = [
  [1, 1, 0.012],
  [1.9, 0.45, 0.007],
  [3.3, 0.2, 0.004],
];

/** Marker tip taps at [startS, gain] on the board's resonant panel. */
function taps(hz: number, strikes: readonly (readonly [number, number])[], click: boolean) {
  return (ctx: SfxContext): StereoClip => {
    const mono = new Float32Array(ctx.frames);
    for (const [startS, gain] of strikes) {
      addModal(mono, {
        startS,
        freq: jitter(ctx.rng, hz, 0.03),
        modes: BOARD,
        attackS: 0.0005,
        gain,
      });
      if (click) {
        addNoise(mono, ctx.rng, {
          startS,
          lengthS: 0.008,
          filter: 'hp',
          freq: 3000,
          envelope: (t) => attackDecay(t, 0.0002, 0.001),
          gain: 0.4 * gain,
        });
      }
    }
    return pixelFinish(mono, { crush: 0.25, haasMs: 0.2 });
  };
}

export const boardTap: SfxDefinition = {
  durationS: 0.12,
  category: 'ui',
  use: 'Whiteboard: a marker tip taps the board (a dot, pointing at something, a bullet).',
  variants: [
    { name: 'tip', render: taps(820, [[0, 1]], true) },
    {
      name: 'knock',
      render: taps(
        560,
        [
          [0, 1],
          [0.055, 0.8],
        ],
        false,
      ),
    },
    {
      name: 'double',
      render: taps(
        1050,
        [
          [0, 0.9],
          [0.03, 1],
        ],
        true,
      ),
    },
  ],
};

/** A soft chime: sine notes [startS, Hz] with a bell partial, in a small room. */
function chime(notes: readonly (readonly [number, number])[], decayS: number) {
  return (ctx: SfxContext): StereoClip => {
    const mono = new Float32Array(ctx.frames);
    for (const [startS, hz] of notes) {
      const freq = jitter(ctx.rng, hz, 0.004);
      addTone(mono, { startS, freq, attackS: 0.004, decayS, gain: 0.8 });
      addTone(mono, {
        startS,
        freq: freq * 2.76,
        attackS: 0.002,
        decayS: decayS * 0.3,
        gain: 0.15,
      });
    }
    return pixelFinish(mono, {
      crush: 0.2,
      haasMs: 0.4,
      room: { decayS: 0.6, wet: 0.15, damping: 0.5, size: 0.7, width: 0.5 },
    });
  };
}

export const boardChime: SfxDefinition = {
  durationS: 0.7,
  category: 'tonal',
  use: 'Whiteboard: a soft chime (the idea clicks, a box is ticked, the closing card).',
  variants: [
    { name: 'single', render: chime([[0, 1175]], 0.14) },
    {
      name: 'double',
      render: chime(
        [
          [0, 1175],
          [0.1, 1568],
        ],
        0.11,
      ),
    },
    { name: 'soft', render: chime([[0, 880]], 0.16) },
  ],
};

/** A pitched tick: a short triangle blip with a click (list items rise low -> high). */
function tick(hz: number) {
  return (ctx: SfxContext): StereoClip => {
    const mono = new Float32Array(ctx.frames);
    const base = jitter(ctx.rng, hz, 0.01);
    addTone(mono, {
      freq: base,
      wave: 'triangle',
      attackS: 0.001,
      decayS: 0.012,
      lengthS: 0.04,
      gain: 0.8,
    });
    addNoise(mono, ctx.rng, {
      lengthS: 0.005,
      filter: 'bp',
      freq: base * 3,
      q: 2,
      envelope: (t) => attackDecay(t, 0.0002, 0.001),
      gain: 0.3,
    });
    return pixelFinish(mono, { crush: 0.35, haasMs: 0.15 });
  };
}

export const boardTick: SfxDefinition = {
  durationS: 0.05,
  category: 'ui',
  use: 'Whiteboard: a tiny pitched tick (counter steps, list items low -> mid -> high).',
  variants: [
    { name: 'low', render: tick(740) },
    { name: 'mid', render: tick(988) },
    { name: 'high', render: tick(1319) },
  ],
};
