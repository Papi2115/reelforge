/**
 * Interface cues: notification, success, error-buzz (clicks, ticks and blips: `ui.ts`). The
 * musical cues are soft wooden/glass modes in a small room; errors are soft low buzzes.
 */
import type { StereoClip } from '../clip.js';
import { applyReverb, type ReverbOptions } from '../reverb.js';
import { Osc, OnePole, attackDecay, gateEnvelope } from '../synth.js';
import {
  GLOCK_MODES,
  SR,
  WOOD_MODES,
  addFm,
  addModal,
  addNoise,
  addTone,
  between,
  placeMono,
  type SfxContext,
  type SfxDefinition,
} from './layers.js';
import { TINY_ROOM } from './ui.js';

const SOFT_ROOM: ReverbOptions = { decayS: 0.6, wet: 0.18, damping: 0.45, size: 0.8, width: 0.5 };

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
