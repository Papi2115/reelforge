/**
 * Drum machine voices (one-shot samples synthesized once per kit and round-robin slot, then
 * placed with velocity): kick (pitch-dropping sine + click), snare (tone + band noise), clap
 * (three bursts + tail), closed/open hat (high-passed noise), shaker, rim. Kits differ in tuning,
 * decay and tone (lo-fi is low-passed, electro is tighter, retro has a longer snare body).
 */
import { normalizePeak, type Rng } from '../dsp.js';
import { addNoise, addTone } from '../sfx/layers.js';
import { approach } from '../sfx/impact.js';
import { OnePole, attackDecay } from '../synth.js';
import type { DrumKit, DrumVoice } from './moods.js';

/** Kick [start Hz, end Hz, decay s]: short and tuned above the bed's 80 Hz high-pass knee. */
const KICK: Readonly<Record<DrumKit, readonly [number, number, number]>> = {
  soft: [120, 62, 0.14],
  lofi: [110, 60, 0.16],
  electro: [150, 65, 0.13],
  retro: [135, 60, 0.16],
};

/** Peak level per voice (mix balance inside the kit). */
const LEVEL: Readonly<Record<DrumVoice, number>> = {
  kick: 0.6,
  snare: 0.55,
  clap: 0.5,
  hat: 0.28,
  openHat: 0.2,
  shaker: 0.16,
  rim: 0.3,
};

const LENGTH_S: Readonly<Record<DrumVoice, number>> = {
  kick: 0.5,
  snare: 0.35,
  clap: 0.3,
  hat: 0.12,
  openHat: 0.4,
  shaker: 0.15,
  rim: 0.1,
};

function kick(out: Float32Array, kit: DrumKit, rng: Rng): void {
  const [from, to, decayS] = KICK[kit];
  addTone(out, { freq: approach(from * (0.98 + 0.04 * rng()), to, 0.03), attackS: 0.001, decayS });
  addNoise(out, rng, {
    lengthS: 0.02,
    filter: 'lp',
    freq: kit === 'electro' ? 4000 : 1800,
    envelope: (t) => attackDecay(t, 0.0003, 0.002),
    gain: kit === 'electro' ? 0.35 : 0.2,
  });
}

function snare(out: Float32Array, kit: DrumKit, rng: Rng): void {
  const body = kit === 'retro' ? 0.09 : 0.06;
  addTone(out, { freq: approach(240, 185, 0.02), attackS: 0.0008, decayS: body, gain: 0.6 });
  addTone(out, { freq: 330, attackS: 0.0008, decayS: body * 0.6, gain: 0.25 });
  addNoise(out, rng, {
    lengthS: 0.3,
    filter: 'bp',
    freq: kit === 'lofi' ? 1600 : 2200,
    q: 0.7,
    envelope: (t) => attackDecay(t, 0.0008, kit === 'retro' ? 0.16 : 0.11),
    gain: 0.8,
  });
}

function clap(out: Float32Array, rng: Rng): void {
  for (const [startS, decayS, gain] of [
    [0, 0.006, 0.7],
    [0.01, 0.006, 0.8],
    [0.021, 0.07, 1],
  ] as const) {
    addNoise(out, rng, {
      startS,
      lengthS: decayS * 10,
      filter: 'bp',
      freq: 1200 + 300 * rng(),
      q: 1.4,
      envelope: (t) => attackDecay(t, 0.0005, decayS),
      gain,
    });
  }
}

function hats(out: Float32Array, rng: Rng, decayS: number, hz: number): void {
  addNoise(out, rng, {
    lengthS: decayS * 10,
    filter: 'hp',
    freq: hz,
    q: 0.8,
    envelope: (t) => attackDecay(t, 0.0005, decayS),
  });
  addNoise(out, rng, {
    lengthS: decayS * 6,
    filter: 'bp',
    freq: hz * 1.3,
    q: 3,
    envelope: (t) => attackDecay(t, 0.0005, decayS * 0.6),
    gain: 0.4,
  });
}

/** Synthesizes one drum hit (normalized to the voice's level). */
export function drumSample(kit: DrumKit, voice: DrumVoice, rng: Rng): Float32Array {
  const out = new Float32Array(Math.round(LENGTH_S[voice] * 48_000));
  if (voice === 'kick') kick(out, kit, rng);
  else if (voice === 'snare') snare(out, kit, rng);
  else if (voice === 'clap') clap(out, rng);
  else if (voice === 'hat')
    hats(out, rng, kit === 'lofi' ? 0.03 : 0.022, kit === 'lofi' ? 6000 : 8000);
  else if (voice === 'openHat') hats(out, rng, 0.16, 7000);
  else if (voice === 'shaker') {
    addNoise(out, rng, {
      lengthS: 0.15,
      filter: 'bp',
      freq: 6000,
      q: 1,
      envelope: (t) => attackDecay(t, 0.012, 0.03),
    });
  } else {
    addNoise(out, rng, {
      lengthS: 0.08,
      filter: 'bp',
      freq: 1700,
      q: 6,
      envelope: (t) => attackDecay(t, 0.0003, 0.012),
    });
    addTone(out, { freq: 820, attackS: 0.0005, decayS: 0.012, gain: 0.4 });
  }
  if (kit === 'lofi' && voice !== 'kick') {
    const dull = new OnePole(5500);
    for (let index = 0; index < out.length; index++) out[index] = dull.low(out[index] ?? 0);
  }
  // Short fade at the end so a cut-off tail never clicks.
  const fade = Math.min(out.length, 240);
  for (let index = 0; index < fade; index++) {
    const at = out.length - 1 - index;
    out[at] = (out[at] ?? 0) * (index / fade);
  }
  return normalizePeak(out, LEVEL[voice]);
}
