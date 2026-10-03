/**
 * Interface sounds: click, tick, tock, blip(-up/-down), notification, error-buzz, success.
 * Short, clean transients; the blips are square/pulse "chip" tones with a light bit-crush for the
 * pixel flavour, the musical cues are soft wooden/glass modes in a small room.
 */
import type { StereoClip } from '../clip.js';
import { applyReverb, type ReverbOptions } from '../reverb.js';
import { Osc, OnePole, attackDecay, bitcrush, gateEnvelope } from '../synth.js';
import {
  GLOCK_MODES,
  SR,
  WOOD_MODES,
  addFm,
  addModal,
  addNoise,
  addTone,
  between,
  jitter,
  placeMono,
  type SfxContext,
  type SfxDefinition,
} from './layers.js';

const TINY_ROOM: ReverbOptions = { decayS: 0.15, wet: 0.04, damping: 0.5, size: 0.4 };
const SOFT_ROOM: ReverbOptions = { decayS: 0.6, wet: 0.18, damping: 0.45, size: 0.8, width: 0.5 };

interface ClickShape {
  readonly toneHz: number;
  readonly toneDecayS: number;
  readonly noiseHz: number;
  readonly noiseFilter: 'lp' | 'hp' | 'bp';
  readonly noiseDecayS: number;
  readonly noiseGain: number;
  readonly q?: number;
}

function addClick(
  out: Float32Array,
  ctx: SfxContext,
  startS: number,
  shape: ClickShape,
  gain = 1,
): void {
  addTone(out, {
    startS,
    freq: jitter(ctx.rng, shape.toneHz, 0.04),
    attackS: 0.0003,
    decayS: shape.toneDecayS,
    gain,
  });
  addNoise(out, ctx.rng, {
    startS,
    lengthS: Math.max(0.004, shape.noiseDecayS * 12),
    filter: shape.noiseFilter,
    freq: shape.noiseHz,
    q: shape.q ?? 0.8,
    envelope: (t) => attackDecay(t, 0.0002, shape.noiseDecayS),
    gain: shape.noiseGain * gain,
  });
}

function clickVariant(
  shapes: readonly (readonly [number, ClickShape, number])[],
  room = TINY_ROOM,
) {
  return (ctx: SfxContext): StereoClip => {
    const mono = new Float32Array(ctx.frames);
    for (const [startS, shape, gain] of shapes) addClick(mono, ctx, startS, shape, gain);
    return applyReverb(placeMono(mono, 0, 0.2), room);
  };
}

const SOFT_CLICK: ClickShape = {
  toneHz: 1900,
  toneDecayS: 0.004,
  noiseHz: 3000,
  noiseFilter: 'lp',
  noiseDecayS: 0.001,
  noiseGain: 0.3,
};
const CRISP_CLICK: ClickShape = {
  toneHz: 2800,
  toneDecayS: 0.0025,
  noiseHz: 4000,
  noiseFilter: 'hp',
  noiseDecayS: 0.0008,
  noiseGain: 0.6,
};
const WOOD_CLICK: ClickShape = {
  toneHz: 900,
  toneDecayS: 0.008,
  noiseHz: 900,
  noiseFilter: 'bp',
  noiseDecayS: 0.01,
  noiseGain: 0.8,
  q: 12,
};

export const click: SfxDefinition = {
  durationS: 0.08,
  category: 'ui',
  use: 'Button press, cursor click, selection.',
  variants: [
    { name: 'soft', render: clickVariant([[0, SOFT_CLICK, 1]]) },
    { name: 'crisp', render: clickVariant([[0, CRISP_CLICK, 1]]) },
    { name: 'wooden', render: clickVariant([[0, WOOD_CLICK, 1]]) },
    {
      name: 'mouse',
      render: clickVariant([
        [0, { ...CRISP_CLICK, toneHz: 3200 }, 1],
        [0.022, { ...CRISP_CLICK, toneHz: 3600 }, 0.5],
      ]),
    },
  ],
};

function metalTick(first: number, second: number, noise: number) {
  return (ctx: SfxContext): StereoClip => {
    const mono = new Float32Array(ctx.frames);
    const base = jitter(ctx.rng, first, 0.03);
    addTone(mono, { freq: base, attackS: 0.0002, decayS: 0.0015 });
    addTone(mono, { freq: base * second, attackS: 0.0002, decayS: 0.001, gain: 0.4 });
    addNoise(mono, ctx.rng, {
      lengthS: 0.01,
      filter: 'hp',
      freq: 5000,
      envelope: (t) => attackDecay(t, 0.0001, 0.0005),
      gain: noise,
    });
    return applyReverb(placeMono(mono, 0, 0.15), TINY_ROOM);
  };
}

export const tick: SfxDefinition = {
  durationS: 0.03,
  category: 'ui',
  use: 'Clock tick, counter step, odometer digit.',
  variants: [
    { name: 'clock', render: metalTick(4200, 1.5, 0.3) },
    { name: 'fine', render: metalTick(5200, 1.52, 0.2) },
    { name: 'soft', render: metalTick(3000, 1.53, 0.1) },
  ],
};

function woodTock(hz: number) {
  return (ctx: SfxContext): StereoClip => {
    const mono = new Float32Array(ctx.frames);
    const pitch = jitter(ctx.rng, hz, 0.03);
    addModal(mono, { freq: pitch, modes: WOOD_MODES, attackS: 0.0004, decayScale: 0.08 });
    addNoise(mono, ctx.rng, {
      lengthS: 0.03,
      filter: 'bp',
      freq: pitch * 1.1,
      q: 10,
      envelope: (t) => attackDecay(t, 0.0002, 0.006),
      gain: 0.6,
    });
    return applyReverb(placeMono(mono, 0, 0.2), TINY_ROOM);
  };
}

export const tock: SfxDefinition = {
  durationS: 0.1,
  category: 'ui',
  use: 'Lower "tock" partner of tick; wood-block step, timer.',
  variants: [
    { name: 'wood', render: woodTock(800) },
    { name: 'low', render: woodTock(560) },
    { name: 'block', render: woodTock(1100) },
  ],
};

type ChipWave = 'square' | 'pulse' | 'triangle';

/** Chip-tone note sequence (each step re-triggers), lightly crushed; the last note rings longer. */
function chipNotes(notes: readonly number[], stepS: number, wave: ChipWave, crush: number) {
  return (ctx: SfxContext): StereoClip => {
    const mono = new Float32Array(ctx.frames);
    const detune = jitter(ctx.rng, 1, 0.01);
    notes.forEach((hz, index) => {
      const last = index === notes.length - 1;
      const startS = index * stepS;
      // Chip notes are gated (hold, then a short release); the last one rings a little longer.
      const lengthS = last ? Math.min(stepS * 1.8, ctx.durationS - startS - 0.05) : stepS;
      const decayS = last ? stepS * 0.9 : stepS;
      addTone(mono, {
        startS,
        freq: hz * detune,
        wave: wave === 'triangle' ? 'triangle' : 'square',
        width: wave === 'pulse' ? 0.25 : 0.5,
        attackS: 0.001,
        decayS,
        lengthS,
        gain: wave === 'triangle' ? 0.8 : 0.35,
      });
      addTone(mono, { startS, freq: hz * detune, attackS: 0.001, decayS, lengthS, gain: 0.35 });
    });
    const soften = new OnePole(7000);
    const smooth = mono.map((value) => soften.low(value));
    bitcrush(smooth, { bits: 6, hold: 4, mix: crush });
    return applyReverb(placeMono(smooth, 0, 0.3), TINY_ROOM);
  };
}

export const blip: SfxDefinition = {
  durationS: 0.15,
  category: 'ui',
  use: 'Retro UI blip, list item, small highlight (pixel flavour).',
  variants: [
    { name: 'square', render: chipNotes([880], 0.06, 'square', 0.5) },
    { name: 'pulse', render: chipNotes([1047], 0.055, 'pulse', 0.5) },
    { name: 'triangle', render: chipNotes([1319], 0.06, 'triangle', 0.6) },
    { name: 'low', render: chipNotes([660], 0.065, 'square', 0.45) },
  ],
};

export const blipUp: SfxDefinition = {
  durationS: 0.18,
  category: 'ui',
  use: 'Confirm, level up, item added (rising chip tones).',
  variants: [
    { name: 'fifth', render: chipNotes([660, 990], 0.05, 'square', 0.5) },
    { name: 'octave', render: chipNotes([523, 1047], 0.05, 'pulse', 0.5) },
    { name: 'triple', render: chipNotes([523, 659, 784], 0.04, 'square', 0.5) },
  ],
};

export const blipDown: SfxDefinition = {
  durationS: 0.18,
  category: 'ui',
  use: 'Cancel, item removed, back (falling chip tones).',
  variants: [
    { name: 'fifth', render: chipNotes([990, 660], 0.05, 'square', 0.5) },
    { name: 'octave', render: chipNotes([1047, 523], 0.05, 'pulse', 0.5) },
    { name: 'triple', render: chipNotes([784, 659, 523], 0.04, 'square', 0.5) },
  ],
};

/** Soft mallet notes: wooden bar + a quiet glass partial set; [startS, Hz] pairs. */
function malletNotes(notes: readonly (readonly [number, number])[], glass: number) {
  return (ctx: SfxContext): StereoClip => {
    const mono = new Float32Array(ctx.frames);
    for (const [startS, hz] of notes) {
      const gain = between(ctx.rng, 0.85, 1);
      addModal(mono, { startS, freq: hz, modes: WOOD_MODES, decayScale: 1.1, gain });
      addModal(mono, { startS, freq: hz, modes: GLOCK_MODES, decayScale: 0.6, gain: glass * gain });
    }
    return applyReverb(placeMono(mono, 0, 0.4), SOFT_ROOM);
  };
}

export const notification: SfxDefinition = {
  durationS: 1,
  category: 'ui',
  use: 'Message / alert / new item appears (friendly two-note).',
  variants: [
    {
      name: 'rise',
      render: malletNotes(
        [
          [0, 1047],
          [0.09, 1319],
        ],
        0.25,
      ),
    },
    {
      name: 'chirp',
      render: malletNotes(
        [
          [0, 784],
          [0.07, 1047],
          [0.14, 1568],
        ],
        0.2,
      ),
    },
    {
      name: 'soft',
      render: malletNotes(
        [
          [0, 659],
          [0.11, 988],
        ],
        0.1,
      ),
    },
  ],
};

/** Plucky FM note + glass sparkle on the last note; [startS, Hz] pairs. */
function successNotes(notes: readonly (readonly [number, number])[]) {
  return (ctx: SfxContext): StereoClip => {
    const mono = new Float32Array(ctx.frames);
    notes.forEach(([startS, hz], index) => {
      addFm(mono, {
        startS,
        freq: hz,
        ratio: 1,
        index: 1.6,
        indexDecayS: 0.08,
        attackS: 0.002,
        decayS: 0.25,
        gain: between(ctx.rng, 0.8, 1),
      });
      if (index === notes.length - 1) {
        addModal(mono, { startS, freq: hz * 2, modes: GLOCK_MODES, decayScale: 0.5, gain: 0.25 });
      }
    });
    return applyReverb(placeMono(mono, 0, 0.5), { ...SOFT_ROOM, wet: 0.22 });
  };
}

export const success: SfxDefinition = {
  durationS: 1.1,
  category: 'ui',
  use: 'Task done, correct answer, unlocked (bright, short arpeggio).',
  variants: [
    {
      name: 'arp',
      render: successNotes([
        [0, 523],
        [0.07, 659],
        [0.14, 784],
        [0.21, 1047],
      ]),
    },
    {
      name: 'chord',
      render: successNotes([
        [0, 392],
        [0, 494],
        [0.12, 523],
        [0.12, 659],
        [0.12, 784],
      ]),
    },
    {
      name: 'bright',
      render: successNotes([
        [0, 784],
        [0.05, 880],
        [0.1, 1047],
        [0.15, 1175],
        [0.2, 1568],
      ]),
    },
  ],
};

/** Two soft low buzzes: beating detuned saws through a low-pass. */
function buzz(
  notes: readonly (readonly [number, number])[],
  lengthS: number,
  wave: 'saw' | 'triangle',
) {
  return (ctx: SfxContext): StereoClip => {
    const mono = new Float32Array(ctx.frames);
    for (const [startS, hz] of notes) {
      const first = new Osc(ctx.rng());
      const second = new Osc(ctx.rng());
      const filter = new OnePole(1400);
      const start = Math.round(startS * SR);
      const end = Math.min(ctx.frames, start + Math.round(lengthS * SR));
      for (let index = start; index < end; index++) {
        const t = (index - start) / SR;
        const raw =
          wave === 'saw'
            ? first.saw(hz) + second.saw(hz * 1.01)
            : first.triangle(hz) + second.triangle(hz * 1.005);
        mono[index] =
          (mono[index] ?? 0) + filter.low(filter.low(raw)) * gateEnvelope(t, 0.004, 0.025, lengthS);
      }
    }
    return applyReverb(placeMono(mono, 0, 0.3), TINY_ROOM);
  };
}

function bonk(ctx: SfxContext): StereoClip {
  const mono = new Float32Array(ctx.frames);
  addTone(mono, {
    freq: (t) => 140 + 80 * Math.exp(-t / 0.03),
    wave: 'triangle',
    attackS: 0.002,
    decayS: 0.1,
  });
  addNoise(mono, ctx.rng, {
    lengthS: 0.1,
    filter: 'lp',
    freq: 500,
    envelope: (t) => attackDecay(t, 0.001, 0.015),
    gain: 0.5,
  });
  return applyReverb(placeMono(mono, 0, 0.3), TINY_ROOM);
}

export const errorBuzz: SfxDefinition = {
  durationS: 0.4,
  category: 'ui',
  use: 'Wrong answer, denied, error state (soft, not harsh).',
  variants: [
    {
      name: 'double',
      render: buzz(
        [
          [0, 150],
          [0.16, 150],
        ],
        0.11,
        'saw',
      ),
    },
    {
      name: 'descend',
      render: buzz(
        [
          [0, 392],
          [0.15, 330],
        ],
        0.12,
        'triangle',
      ),
    },
    { name: 'bonk', render: bonk },
  ],
};
