/**
 * Tonal accents: ding, chime, coin, sparkle. Bells are modal partial sets (plus a touch of FM
 * shimmer), chimes are staggered pentatonic glockenspiel notes across the stereo field, the coin is
 * the classic two-step chip tone (crushed), sparkle is a cloud of tiny high pings over soft air.
 */
import type { StereoClip } from '../clip.js';
import type { Rng } from '../dsp.js';
import { applyReverb, type ReverbOptions } from '../reverb.js';
import { OnePole, addPanned, bitcrush, createStereo, swell } from '../synth.js';
import {
  BELL_MODES,
  GLOCK_MODES,
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

const BELL_ROOM: ReverbOptions = { decayS: 0.6, wet: 0.2, damping: 0.4, size: 0.9, width: 0.5 };

function bell(hz: number, kind: 'bell' | 'glass' | 'soft') {
  return (ctx: SfxContext): StereoClip => {
    const mono = new Float32Array(ctx.frames);
    const pitch = jitter(ctx.rng, hz, 0.005);
    if (kind === 'bell') {
      addModal(mono, { freq: pitch, modes: BELL_MODES, decayScale: 1.6 });
      addFm(mono, {
        freq: pitch,
        ratio: 3.5,
        index: 1,
        indexDecayS: 0.05,
        attackS: 0.001,
        decayS: 0.4,
        gain: 0.25,
      });
    } else if (kind === 'glass') {
      addModal(mono, { freq: pitch, modes: GLOCK_MODES, decayScale: 0.9 });
    } else {
      addModal(mono, { freq: pitch, modes: WOOD_MODES, decayScale: 2.5 });
      addTone(mono, { freq: pitch, attackS: 0.002, decayS: 0.5, gain: 0.5 });
    }
    return applyReverb(placeMono(mono, 0, 0.5), BELL_ROOM);
  };
}

/** Retro ding: square + sine, crushed, with one quieter echo. */
function pixelDing(ctx: SfxContext): StereoClip {
  const mono = new Float32Array(ctx.frames);
  const pitch = jitter(ctx.rng, 1319, 0.005);
  for (const [startS, gain] of [
    [0, 1],
    [0.12, 0.35],
  ] as const) {
    addTone(mono, {
      startS,
      freq: pitch,
      wave: 'square',
      attackS: 0.001,
      decayS: 0.25,
      gain: 0.3 * gain,
    });
    addTone(mono, { startS, freq: pitch, attackS: 0.001, decayS: 0.35, gain: 0.5 * gain });
  }
  const soften = new OnePole(7000);
  const smooth = mono.map((value) => soften.low(value));
  bitcrush(smooth, { bits: 6, hold: 4, mix: 0.55 });
  return applyReverb(placeMono(smooth, 0, 0.4), { ...BELL_ROOM, wet: 0.12 });
}

export const ding: SfxDefinition = {
  durationS: 1.7,
  category: 'tonal',
  use: 'Correct / fact highlighted / "ding!" moment.',
  variants: [
    { name: 'bell', render: bell(1568, 'bell') },
    { name: 'glass', render: bell(2093, 'glass') },
    { name: 'pixel', render: pixelDing },
    { name: 'soft', render: bell(1047, 'soft') },
  ],
};

/** C major pentatonic, two octaves from C6. */
const PENTATONIC = [1047, 1175, 1319, 1568, 1760, 2093, 2349, 2637];

function chimeVariant(order: 'up' | 'down' | 'cluster') {
  return (ctx: SfxContext): StereoClip => {
    const { rng } = ctx;
    const count = 4 + Math.floor(rng() * 2);
    const first = Math.floor(rng() * 3);
    const notes = Array.from({ length: count }, (_, index) =>
      order === 'cluster'
        ? (PENTATONIC[Math.floor(rng() * PENTATONIC.length)] ?? 1047)
        : (PENTATONIC[first + index] ?? 2093),
    );
    if (order === 'down') notes.reverse();
    const out = createStereo(ctx.frames);
    let startS = 0;
    notes.forEach((hz, index) => {
      const mono = new Float32Array(ctx.frames);
      addModal(mono, {
        startS,
        freq: hz,
        modes: GLOCK_MODES,
        decayScale: 0.8,
        gain: between(rng, 0.7, 1),
      });
      addPanned(out, mono, 0, 1, -0.5 + index / Math.max(1, count - 1));
      startS += between(rng, 0.06, 0.09);
    });
    return applyReverb(out, { decayS: 0.8, wet: 0.25, damping: 0.4, size: 1, width: 0.5 });
  };
}

export const chime: SfxDefinition = {
  durationS: 1.8,
  category: 'tonal',
  use: 'Magic / idea / discovery moment, gentle intro sting.',
  variants: [
    { name: 'up', render: chimeVariant('up') },
    { name: 'down', render: chimeVariant('down') },
    { name: 'cluster', render: chimeVariant('cluster') },
  ],
};

/** Classic chip coin: short first note, ringing second note; square + sine, crushed. */
function coinVariant(notes: readonly number[], stepS: number, wave: 'square' | 'triangle') {
  return (ctx: SfxContext): StereoClip => {
    const mono = new Float32Array(ctx.frames);
    const detune = jitter(ctx.rng, 1, 0.008);
    notes.forEach((note, index) => {
      const hz = note * detune;
      const last = index === notes.length - 1;
      const startS = index * stepS;
      const decayS = last ? 0.12 : stepS * 0.6;
      addTone(mono, {
        startS,
        freq: hz,
        wave,
        attackS: 0.001,
        decayS,
        gain: wave === 'square' ? 0.3 : 0.7,
      });
      addTone(mono, { startS, freq: hz, attackS: 0.001, decayS, gain: 0.4 });
    });
    const soften = new OnePole(8000);
    const smooth = mono.map((value) => soften.low(value));
    bitcrush(smooth, { bits: 6, hold: 3, mix: 0.5 });
    return applyReverb(placeMono(smooth, 0, 0.3), { decayS: 0.4, wet: 0.1, size: 0.6 });
  };
}

export const coin: SfxDefinition = {
  durationS: 0.6,
  category: 'tonal',
  use: 'Money, points, reward, collected item (retro).',
  variants: [
    { name: 'classic', render: coinVariant([988, 1319], 0.07, 'square') },
    { name: 'high', render: coinVariant([1319, 1760], 0.06, 'square') },
    { name: 'triple', render: coinVariant([1047, 1319, 1568], 0.045, 'square') },
    { name: 'gem', render: coinVariant([1568, 2093, 2637], 0.05, 'triangle') },
  ],
};

/** Adds `count` tiny pings; pitch from `pitchAt(position, rng)`, density from a swell. */
function addPings(
  out: StereoClip,
  rng: Rng,
  frames: number,
  lengthS: number,
  count: number,
  pitchAt: (position: number) => number,
): void {
  for (let index = 0; index < count; index++) {
    const position = rng();
    if (rng() > swell(position, 0.3, 1.5, 2) + 0.15) continue;
    const mono = new Float32Array(frames);
    addTone(mono, {
      startS: position * lengthS,
      freq: pitchAt(position),
      attackS: 0.0008,
      decayS: between(rng, 0.03, 0.08),
      gain: between(rng, 0.3, 1),
    });
    addPanned(out, mono, 0, 1, between(rng, -0.7, 0.7));
  }
}

function sparkleVariant(count: number, pitch: (position: number, rng: Rng) => number) {
  return (ctx: SfxContext): StereoClip => {
    const out = createStereo(ctx.frames);
    const lengthS = ctx.durationS * 0.65;
    addPings(out, ctx.rng, ctx.frames, lengthS, count, (position) => pitch(position, ctx.rng));
    const air = new Float32Array(ctx.frames);
    addNoise(air, ctx.rng, {
      lengthS,
      filter: 'hp',
      freq: 6000,
      envelope: (t) => swell(t / lengthS, 0.3, 1.5, 2),
      gain: 0.06,
    });
    addPanned(out, air, 0, 1, 0);
    return applyReverb(out, { decayS: 0.7, wet: 0.25, damping: 0.3, size: 0.9 });
  };
}

export const sparkle: SfxDefinition = {
  durationS: 1,
  category: 'tonal',
  use: 'Shine, magic, "new!", clean / polished result.',
  variants: [
    { name: 'dense', render: sparkleVariant(40, (_, rng) => between(rng, 3000, 8000)) },
    { name: 'sparse', render: sparkleVariant(12, (_, rng) => between(rng, 3500, 7000)) },
    {
      name: 'rising',
      render: sparkleVariant(
        28,
        (position, rng) => 2500 * 2 ** (1.5 * position) * jitter(rng, 1, 0.05),
      ),
    },
    {
      name: 'magic',
      render: sparkleVariant(
        20,
        (_, rng) => 2 * (PENTATONIC[Math.floor(rng() * PENTATONIC.length)] ?? 2093),
      ),
    },
  ],
};
