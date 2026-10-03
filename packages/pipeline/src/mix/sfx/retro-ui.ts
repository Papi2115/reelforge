/**
 * Retro-UI / CRT palette (PLAN.md#12.24): key and mouse clicks, keyboard bursts, window blips,
 * PC-speaker beeps and terminal ticks (disk, modem and CRT sounds: `retro-ui-machines.ts`). Chip
 * tones and plastic clicks, all through the shared pixel crush (`pixel.ts`).
 */
import type { StereoClip } from '../clip.js';
import { OnePole, attackDecay, expLerp } from '../synth.js';
import { applyReverb } from '../reverb.js';
import { addNoise, addTone, jitter, type SfxContext, type SfxDefinition } from './layers.js';
import {
  PIXEL_ROOM,
  addKey,
  crushStereo,
  pixelFinish,
  typingBurst,
  type KeyShape,
} from './pixel.js';

const MECHANICAL: KeyShape = {
  clickHz: 3400,
  clickDecayS: 0.0025,
  ringHz: 2300,
  ringDecayS: 0.006,
  ringGain: 0.3,
  thumpHz: 900,
  thumpDecayS: 0.006,
};
const MEMBRANE: KeyShape = {
  clickHz: 1700,
  clickDecayS: 0.004,
  ringHz: 800,
  ringDecayS: 0.006,
  ringGain: 0.2,
  thumpHz: 600,
  thumpDecayS: 0.01,
};
/** Buckling spring: a loud click, then the spring's ping a few ms later. */
const TERMINAL: KeyShape = {
  clickHz: 2900,
  clickDecayS: 0.002,
  ringHz: 3100,
  ringDecayS: 0.012,
  ringGain: 0.35,
  thumpHz: 1100,
  thumpDecayS: 0.005,
  secondS: 0.011,
};

function singleKey(shape: KeyShape) {
  return (ctx: SfxContext): StereoClip => {
    const mono = new Float32Array(ctx.frames);
    addKey(mono, ctx.rng, 0, shape);
    return pixelFinish(mono, { crush: 0.25 });
  };
}

export const keyClick: SfxDefinition = {
  durationS: 0.08,
  category: 'ui',
  use: 'Retro UI: one key press (menu choice, prompt confirmed).',
  variants: [
    { name: 'mechanical', render: singleKey(MECHANICAL) },
    { name: 'membrane', render: singleKey(MEMBRANE) },
    { name: 'terminal', render: singleKey(TERMINAL) },
  ],
};

function burst(shape: KeyShape, spacing: readonly [number, number]) {
  return (ctx: SfxContext): StereoClip =>
    applyReverb(crushStereo(typingBurst(ctx, shape, spacing), 0.25), PIXEL_ROOM);
}

export const keyboard: SfxDefinition = {
  durationS: 1.2,
  category: 'texture',
  use: 'Retro UI: typing on a beige keyboard (match the duration to the typing).',
  variants: [
    { name: 'mechanical', render: burst(MECHANICAL, [0.06, 0.11]) },
    { name: 'membrane', render: burst(MEMBRANE, [0.07, 0.12]) },
    { name: 'terminal', render: burst(TERMINAL, [0.09, 0.15]) },
  ],
};

/** Plastic mouse button: press, then the quieter release `releaseS` later (or a double click). */
function mouse(clickHz: number, bodyHz: number, presses: readonly (readonly [number, number])[]) {
  return (ctx: SfxContext): StereoClip => {
    const mono = new Float32Array(ctx.frames);
    for (const [startS, gain] of presses) {
      addNoise(mono, ctx.rng, {
        startS,
        lengthS: 0.02,
        filter: 'bp',
        freq: jitter(ctx.rng, clickHz, 0.05),
        q: 2,
        envelope: (t) => attackDecay(t, 0.0002, 0.0012),
        gain,
      });
      addTone(mono, {
        startS,
        freq: jitter(ctx.rng, bodyHz, 0.04),
        attackS: 0.0003,
        decayS: 0.004,
        gain: 0.35 * gain,
      });
    }
    return pixelFinish(mono, { crush: 0.2, haasMs: 0.15 });
  };
}

export const mouseClick: SfxDefinition = {
  durationS: 0.1,
  category: 'ui',
  use: 'Retro UI: mouse button click on an icon or a button.',
  variants: [
    {
      name: 'ball',
      render: mouse(3800, 1700, [
        [0, 1],
        [0.055, 0.45],
      ]),
    },
    { name: 'micro', render: mouse(5200, 2600, [[0, 1]]) },
    {
      name: 'double',
      render: mouse(4200, 2000, [
        [0, 1],
        [0.065, 0.85],
      ]),
    },
  ],
};

type Pitch = number | ((t: number) => number);

/** Gated chip notes (square + sine) at [startS, Hz, lengthS], crushed: window and menu blips. */
function chip(notes: readonly (readonly [number, Pitch, number])[], width: number, crush: number) {
  return (ctx: SfxContext): StereoClip => {
    const mono = new Float32Array(ctx.frames);
    const detune = jitter(ctx.rng, 1, 0.01);
    for (const [startS, pitch, lengthS] of notes) {
      const freq = (t: number): number => (typeof pitch === 'number' ? pitch : pitch(t)) * detune;
      const decayS = lengthS * 0.8;
      addTone(mono, {
        startS,
        freq,
        wave: 'square',
        width,
        attackS: 0.001,
        decayS,
        lengthS,
        gain: 0.3,
      });
      addTone(mono, { startS, freq, attackS: 0.001, decayS, lengthS, gain: 0.4 });
    }
    const soften = new OnePole(6500);
    return pixelFinish(
      mono.map((value) => soften.low(value)),
      { crush, haasMs: 0.3 },
    );
  };
}

const glide =
  (from: number, to: number, overS: number) =>
  (t: number): number =>
    expLerp(from, to, t / overS);

export const windowOpen: SfxDefinition = {
  durationS: 0.22,
  category: 'ui',
  use: 'Retro UI: a window, dialog or menu opens (rising chip blip).',
  variants: [
    {
      name: 'chime',
      render: chip(
        [
          [0, 784, 0.05],
          [0.05, 1175, 0.11],
        ],
        0.5,
        0.45,
      ),
    },
    { name: 'chirp', render: chip([[0, glide(600, 1500, 0.09), 0.13]], 0.25, 0.5) },
    { name: 'pop', render: chip([[0, glide(420, 900, 0.03), 0.07]], 0.5, 0.35) },
  ],
};

export const windowClose: SfxDefinition = {
  durationS: 0.22,
  category: 'ui',
  use: 'Retro UI: a window or dialog closes, minimizes or goes away (falling chip blip).',
  variants: [
    {
      name: 'chime',
      render: chip(
        [
          [0, 1175, 0.05],
          [0.05, 784, 0.11],
        ],
        0.5,
        0.45,
      ),
    },
    { name: 'chirp', render: chip([[0, glide(1500, 600, 0.09), 0.13]], 0.25, 0.5) },
    { name: 'pop', render: chip([[0, glide(900, 420, 0.03), 0.07]], 0.5, 0.35) },
  ],
};

/** PC-speaker beeps: [startS, Hz, lengthS] squares, low-passed and crushed. */
function speaker(notes: readonly (readonly [number, number, number])[]) {
  return (ctx: SfxContext): StereoClip => {
    const mono = new Float32Array(ctx.frames);
    for (const [startS, hz, lengthS] of notes) {
      const freq = jitter(ctx.rng, hz, 0.005);
      addTone(mono, {
        startS,
        freq,
        wave: 'square',
        attackS: 0.002,
        decayS: 2,
        lengthS,
        gain: 0.3,
      });
      addTone(mono, { startS, freq, attackS: 0.002, decayS: 2, lengthS, gain: 0.3 });
    }
    const soften = new OnePole(5000);
    return pixelFinish(
      mono.map((value) => soften.low(value)),
      { crush: 0.5 },
    );
  };
}

export const errorBeep: SfxDefinition = {
  durationS: 0.35,
  category: 'ui',
  use: 'Retro UI: PC-speaker beep (error dialog, invalid input, alert).',
  variants: [
    { name: 'beep', render: speaker([[0, 880, 0.16]]) },
    {
      name: 'double',
      render: speaker([
        [0, 660, 0.08],
        [0.12, 660, 0.08],
      ]),
    },
    { name: 'low', render: speaker([[0, 440, 0.22]]) },
  ],
};

/** A tiny pitched tick (square blip + click): list items rise low -> mid -> high. */
function terminalTick(hz: number) {
  return (ctx: SfxContext): StereoClip => {
    const mono = new Float32Array(ctx.frames);
    const freq = jitter(ctx.rng, hz, 0.01);
    addTone(mono, {
      freq,
      wave: 'square',
      width: 0.25,
      attackS: 0.0005,
      decayS: 0.005,
      gain: 0.35,
    });
    addTone(mono, { freq, attackS: 0.0005, decayS: 0.006, gain: 0.5 });
    addNoise(mono, ctx.rng, {
      lengthS: 0.006,
      filter: 'hp',
      freq: 3000,
      envelope: (t) => attackDecay(t, 0.0002, 0.0006),
      gain: 0.25,
    });
    return pixelFinish(mono, { crush: 0.4, haasMs: 0.15 });
  };
}

export const terminalTickSfx: SfxDefinition = {
  durationS: 0.06,
  category: 'ui',
  use: 'Retro UI: terminal cursor / line tick; list items (low -> mid -> high).',
  variants: [
    { name: 'low', render: terminalTick(1200) },
    { name: 'mid', render: terminalTick(1600) },
    { name: 'high', render: terminalTick(2130) },
  ],
};
