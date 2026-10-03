/**
 * Built-in ambience beds (room tone, hum, wind, city, and the look palettes' beds from
 * `ambience-looks.ts`), synthesized offline as seamless stereo loops (deterministic per seed).
 * Channels use independent noise streams for width. Every bed is normalized to -30 dBFS RMS, so
 * `gainDb: 0` sits quietly under a -16 LUFS voice-over.
 */
import {
  crtHum,
  electricTick,
  office,
  serverRoom,
  type ChannelContext,
  type ChannelRecipe,
} from './ambience-looks.js';
import { makeSeamlessLoop, type LoopCurve, type StereoClip } from './clip.js';
import {
  Biquad,
  BrownNoise,
  MIX_SAMPLE_RATE,
  Oscillator,
  PinkNoise,
  dbToGain,
  mulberry32,
  secondsToFrames,
  whiteNoise,
} from './dsp.js';

/** The first four are the v1 beds; the look palettes' beds (PLAN.md#12.24) follow. */
export const AMBIENCE_RECIPES = [
  'room-tone',
  'hum',
  'wind',
  'city',
  'crt-hum',
  'office',
  'server-room',
  'electric-tick',
] as const;
export type AmbienceRecipe = (typeof AMBIENCE_RECIPES)[number];

export const AMBIENCE_LOOP_S = 8;
export const AMBIENCE_CROSSFADE_S = 0.5;
export const AMBIENCE_RMS_DB = -30;

export interface AmbienceSynthOptions {
  readonly seed: number;
  /** Mains frequency for `hum`, `crt-hum` and `electric-tick` (default 50 Hz). */
  readonly humHz?: 50 | 60;
}

const SR = MIX_SAMPLE_RATE;
const SWEEP_STEP = 32;

function roomTone(frames: number, ctx: ChannelContext): Float32Array {
  const out = new Float32Array(frames);
  const pink = new PinkNoise(ctx.rng);
  const low = new Biquad().lowpass(1200);
  const lower = new Biquad().lowpass(1200);
  const rumble = new Biquad().highpass(40);
  for (let index = 0; index < frames; index++) {
    out[index] = rumble.process(lower.process(low.process(pink.next())));
  }
  return out;
}

function hum(frames: number, ctx: ChannelContext): Float32Array {
  const out = new Float32Array(frames);
  const harmonics = [1, 2, 3, 4].map(() => new Oscillator());
  const levels = [1, 0.5, 0.25, 0.12];
  const hiss = new Biquad().lowpass(4000);
  for (let index = 0; index < frames; index++) {
    let sample = 0;
    harmonics.forEach((oscillator, harmonic) => {
      sample += (levels[harmonic] ?? 0) * oscillator.sine(ctx.humHz * (harmonic + 1));
    });
    out[index] = sample + 0.05 * hiss.process(whiteNoise(ctx.rng));
  }
  return out;
}

function wind(frames: number, ctx: ChannelContext): Float32Array {
  const out = new Float32Array(frames);
  const gust = new Biquad();
  const rumble = new Biquad().lowpass(150);
  for (let index = 0; index < frames; index++) {
    const t = index / SR;
    const slow = Math.sin(2 * Math.PI * 0.13 * t + ctx.phase);
    const slower = Math.sin(2 * Math.PI * 0.31 * t + 2 * ctx.phase);
    if (index % SWEEP_STEP === 0) gust.bandpass(450 + 250 * slow + 150 * slower, 0.7);
    const strength = 0.6 + 0.3 * slow * slower + 0.1 * slower;
    const noise = whiteNoise(ctx.rng);
    out[index] = strength * gust.process(noise) + 0.6 * rumble.process(noise);
  }
  return out;
}

function city(frames: number, ctx: ChannelContext): Float32Array {
  const out = new Float32Array(frames);
  const brown = new BrownNoise(ctx.rng);
  const traffic = new Biquad().lowpass(300);
  const hiss = new Biquad().bandpass(800, 0.6);
  const passBy = new Biquad();
  let nextPass = secondsToFrames(0.5 + ctx.rng() * 2);
  let passStart = -1;
  const passLength = secondsToFrames(2.5);
  for (let index = 0; index < frames; index++) {
    const t = index / SR;
    if (index === nextPass) {
      passStart = index;
      nextPass = index + secondsToFrames(2 + ctx.rng() * 2);
    }
    const passPosition = passStart < 0 ? 1 : (index - passStart) / passLength;
    const passing = passPosition < 1 ? Math.sin(Math.PI * passPosition) ** 2 : 0;
    if (index % SWEEP_STEP === 0) passBy.bandpass(300 + 900 * (1 - passPosition), 1.2);
    const swell = 0.7 + 0.3 * Math.sin(2 * Math.PI * 0.07 * t + ctx.phase);
    const noise = whiteNoise(ctx.rng);
    out[index] =
      traffic.process(brown.next()) +
      0.4 * swell * hiss.process(noise) +
      0.8 * passing * passBy.process(noise);
  }
  return out;
}

const RECIPES: Readonly<Record<AmbienceRecipe, { render: ChannelRecipe; curve: LoopCurve }>> = {
  'room-tone': { render: roomTone, curve: 'equal-power' },
  // Hum is periodic and correlated across the loop point: a linear crossfade keeps its level.
  hum: { render: hum, curve: 'linear' },
  wind: { render: wind, curve: 'equal-power' },
  city: { render: city, curve: 'equal-power' },
  // Tone-led beds (whole-Hz partials, correlated across the loop point) crossfade linearly.
  'crt-hum': { render: crtHum, curve: 'linear' },
  office: { render: office, curve: 'equal-power' },
  'server-room': { render: serverRoom, curve: 'linear' },
  'electric-tick': { render: electricTick, curve: 'equal-power' },
};

function scaleToRms(clip: StereoClip, targetRms: number): StereoClip {
  let sum = 0;
  for (const value of clip.left) sum += value * value;
  for (const value of clip.right) sum += value * value;
  const rms = Math.sqrt(sum / Math.max(1, clip.left.length + clip.right.length));
  if (rms === 0) return clip;
  const scale = targetRms / rms;
  for (let index = 0; index < clip.left.length; index++) {
    clip.left[index] = (clip.left[index] ?? 0) * scale;
    clip.right[index] = (clip.right[index] ?? 0) * scale;
  }
  return clip;
}

/** Synthesizes a seamless 8 s stereo loop of `recipe` at -30 dBFS RMS. */
export function synthesizeAmbience(
  recipe: AmbienceRecipe,
  options: AmbienceSynthOptions,
): StereoClip {
  const spec = RECIPES[recipe];
  const crossfade = secondsToFrames(AMBIENCE_CROSSFADE_S);
  const frames = secondsToFrames(AMBIENCE_LOOP_S) + crossfade;
  const humHz = options.humHz ?? 50;
  const channel = (salt: number): Float32Array => {
    const rng = mulberry32((options.seed ^ salt) >>> 0);
    return spec.render(frames, { rng, phase: rng() * 2 * Math.PI, humHz });
  };
  const raw: StereoClip = { left: channel(0), right: channel(0x9e3779b9) };
  const loop = makeSeamlessLoop(raw, crossfade, spec.curve);
  return scaleToRms(loop, dbToGain(AMBIENCE_RMS_DB));
}
