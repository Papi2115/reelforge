/**
 * Retro-UI / CRT palette, the machines (PLAN.md#12.24): floppy / hard-disk seeks, a short modem
 * handshake and CRT zaps, through the shared pixel crush (`pixel.ts`). Clicks and blips live in
 * `retro-ui.ts`.
 */
import type { StereoClip } from '../clip.js';
import { Osc, OnePole, attackDecay, expLerp, gateEnvelope } from '../synth.js';
import {
  SR,
  addNoise,
  addTone,
  between,
  jitter,
  type SfxContext,
  type SfxDefinition,
} from './layers.js';
import { pixelFinish } from './pixel.js';

type Pitch = number | ((t: number) => number);

/** One head step: a short band-passed tick with a little tone (the stepper's buzz). */
function addStep(out: Float32Array, ctx: SfxContext, startS: number, hz: number, gain: number) {
  addNoise(out, ctx.rng, {
    startS,
    lengthS: 0.012,
    filter: 'bp',
    freq: jitter(ctx.rng, hz, 0.06),
    q: 3,
    envelope: (t) => attackDecay(t, 0.0003, 0.0015),
    gain,
  });
  addTone(out, { startS, freq: hz * 0.5, attackS: 0.0005, decayS: 0.003, gain: 0.4 * gain });
}

/** Bursts of head steps: [startS, steps, interval s]; `whirHz` > 0 adds a quiet motor whir. */
function seek(
  stepHz: number,
  bursts: readonly (readonly [number, number, number])[],
  whirHz: number,
) {
  return (ctx: SfxContext): StereoClip => {
    const mono = new Float32Array(ctx.frames);
    for (const [startS, steps, interval] of bursts) {
      for (let step = 0; step < steps; step++) {
        const at = startS + step * jitter(ctx.rng, interval, 0.05);
        if (at < ctx.durationS - 0.04) addStep(mono, ctx, at, stepHz, between(ctx.rng, 0.7, 1));
      }
    }
    if (whirHz > 0) {
      const lengthS = ctx.durationS - 0.03;
      addNoise(mono, ctx.rng, {
        lengthS,
        color: 'pink',
        filter: 'bp',
        freq: whirHz,
        q: 4,
        envelope: (t) => 0.12 * gateEnvelope(t, 0.05, 0.08, lengthS),
      });
    }
    return pixelFinish(mono, { crush: 0.3 });
  };
}

export const diskSeek: SfxDefinition = {
  durationS: 0.6,
  category: 'texture',
  use: 'Retro UI: floppy / hard-disk access while something loads or saves.',
  variants: [
    {
      name: 'floppy',
      render: seek(
        1300,
        [
          [0.01, 8, 0.012],
          [0.22, 14, 0.011],
        ],
        420,
      ),
    },
    {
      name: 'hard-disk',
      render: seek(
        2600,
        [
          [0.01, 4, 0.02],
          [0.12, 6, 0.016],
          [0.3, 3, 0.03],
          [0.42, 5, 0.018],
        ],
        0,
      ),
    },
    { name: 'stepper', render: seek(900, [[0.01, 40, 0.0125]], 300) },
  ],
};

/** Adds a gated tone to `out` (pure sine, or `square` through the shared low-pass). */
function addBeep(out: Float32Array, startS: number, hz: Pitch, lengthS: number, gain: number) {
  addTone(out, { startS, freq: hz, attackS: 0.003, decayS: lengthS * 4, lengthS, gain });
}

/** Modem: dial digits, then answer/carrier tones and data hiss, fading at the end. */
function modem(kind: 'dialup' | 'carrier' | 'fax') {
  return (ctx: SfxContext): StereoClip => {
    const mono = new Float32Array(ctx.frames);
    const endS = ctx.durationS - 0.08;
    let t = 0;
    if (kind === 'dialup') {
      for (const [low, high] of [
        [697, 1209],
        [770, 1336],
        [852, 1477],
      ] as const) {
        addBeep(mono, t, low, 0.06, 0.3);
        addBeep(mono, t, high, 0.06, 0.3);
        t += 0.08;
      }
    }
    if (kind === 'fax') {
      addBeep(mono, 0, 1100, 0.18, 0.5);
      t = 0.24;
    }
    const carrierHz = kind === 'carrier' ? 2100 : 1800;
    const warble = new Osc(ctx.rng());
    const lengthS = Math.max(0.05, endS - t);
    addTone(mono, {
      startS: t,
      freq: (local) =>
        kind === 'fax'
          ? 1750 + 100 * Math.sign(warble.sine(18))
          : carrierHz + 30 * Math.sin(local * 40),
      attackS: 0.01,
      decayS: lengthS * 4,
      lengthS,
      gain: 0.3,
    });
    addNoise(mono, ctx.rng, {
      startS: t + lengthS * 0.35,
      lengthS: lengthS * 0.65,
      filter: 'bp',
      freq: 1900,
      q: 0.9,
      envelope: (local) => 0.5 * gateEnvelope(local, 0.05, 0.03, lengthS * 0.65 - 0.002),
    });
    return pixelFinish(mono, { crush: 0.35 });
  };
}

export const modemHandshake: SfxDefinition = {
  durationS: 1.2,
  category: 'texture',
  use: 'Retro UI: going online, connecting, data being sent (short modem handshake).',
  variants: [
    { name: 'dialup', render: modem('dialup') },
    { name: 'carrier', render: modem('carrier') },
    { name: 'fax', render: modem('fax') },
  ],
};

/** Buzzy CRT body (square harmonics above 150 Hz) plus the static "zing" of the tube. */
function zap(kind: 'degauss' | 'power-on' | 'static') {
  return (ctx: SfxContext): StereoClip => {
    const mono = new Float32Array(ctx.frames);
    const bodyS = ctx.durationS * 0.85;
    if (kind !== 'static') {
      const osc = new Osc(ctx.rng());
      const lowpass = new OnePole(1600);
      const highpass = [new OnePole(200), new OnePole(200)] as const;
      const hz = kind === 'degauss' ? jitter(ctx.rng, 150, 0.03) : jitter(ctx.rng, 180, 0.03);
      const decayS = kind === 'degauss' ? bodyS * 0.35 : bodyS * 0.12;
      const frames = Math.min(ctx.frames, Math.round(bodyS * SR));
      for (let index = 0; index < frames; index++) {
        const t = index / SR;
        const wobble = kind === 'degauss' ? 1 + 0.04 * Math.sin(2 * Math.PI * 9 * t) : 1;
        const raw = highpass[1].high(highpass[0].high(lowpass.low(osc.square(hz * wobble, 0.3))));
        mono[index] = (mono[index] ?? 0) + 0.5 * raw * attackDecay(t, 0.004, decayS);
      }
    }
    addNoise(mono, ctx.rng, {
      lengthS: bodyS,
      filter: 'bp',
      freq: (t) => (kind === 'power-on' ? expLerp(2500, 5500, t / bodyS) : 4200),
      q: 1.2,
      envelope: (t) =>
        kind === 'static'
          ? (0.3 + 0.7 * Math.abs(Math.sin(t * 61))) * gateEnvelope(t, 0.02, bodyS * 0.4, bodyS)
          : 0.4 * attackDecay(t, 0.002, bodyS * 0.2),
    });
    return pixelFinish(mono, { crush: 0.3, haasMs: 0.4 });
  };
}

export const crtZap: SfxDefinition = {
  durationS: 0.8,
  category: 'texture',
  use: 'Retro UI: CRT degauss / power-on / static (a screen wakes up, a hard visual switch).',
  variants: [
    { name: 'degauss', render: zap('degauss') },
    { name: 'power-on', render: zap('power-on') },
    { name: 'static', render: zap('static') },
  ],
};
