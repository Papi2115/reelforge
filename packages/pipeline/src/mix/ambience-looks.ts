/**
 * Ambience beds of the look palettes (PLAN.md#12.24): a CRT hum with a faint disk for retro-UI,
 * an office and a server room for the diorama (its city and room use `city` / `room-tone`), and a
 * faint electrical tick bed for blueprint. They keep nothing below ~130 Hz, so they can sit under
 * the music. Rendered per channel like the beds in `ambience.ts`; tonal parts use whole-Hz
 * frequencies, so they line up across the 8 s loop point.
 */
import { Biquad, PinkNoise, Oscillator, secondsToFrames, whiteNoise, type Rng } from './dsp.js';

export interface ChannelContext {
  readonly rng: Rng;
  /** Per-channel deterministic phase offsets for slow modulations. */
  readonly phase: number;
  readonly humHz: number;
}

export type ChannelRecipe = (frames: number, ctx: ChannelContext) => Float32Array;

/** Two-pole high-pass pair at 130 Hz: the look beds stay off the music's low end. */
function lowCut(): (value: number) => number {
  const first = new Biquad().highpass(130);
  const second = new Biquad().highpass(130);
  return (value) => second.process(first.process(value));
}

/** Short band-passed ticks at the given frames (decaying noise bursts). */
function addTicks(
  out: Float32Array,
  rng: Rng,
  starts: readonly number[],
  hz: number,
  decayS: number,
  gain: number,
): void {
  const band = new Biquad().bandpass(hz, 2);
  const length = secondsToFrames(decayS * 8);
  for (const start of starts) {
    for (let offset = 0; offset < length && start + offset < out.length; offset++) {
      const envelope = Math.exp(-offset / secondsToFrames(decayS));
      out[start + offset] = (out[start + offset] ?? 0) + gain * envelope * whiteNoise(rng);
    }
  }
  for (let index = 0; index < out.length; index++) out[index] = band.process(out[index] ?? 0);
}

/** Frames of sparse events: one every `minS`..`maxS` seconds from a random first offset. */
function eventFrames(frames: number, rng: Rng, minS: number, maxS: number): number[] {
  const starts: number[] = [];
  let at = secondsToFrames(rng() * maxS);
  while (at < frames) {
    starts.push(at);
    at += secondsToFrames(minS + rng() * (maxS - minS));
  }
  return starts;
}

/** Bursts of `count` frames `stepS` apart starting at each of `starts`. */
function bursts(starts: readonly number[], rng: Rng, count: number, stepS: number): number[] {
  return starts.flatMap((start) =>
    Array.from(
      { length: count + Math.floor(rng() * count) },
      (_, index) => start + secondsToFrames(index * stepS),
    ),
  );
}

export function crtHum(frames: number, ctx: ChannelContext): Float32Array {
  const out = new Float32Array(frames);
  const disk = new Float32Array(frames);
  addTicks(
    disk,
    ctx.rng,
    bursts(eventFrames(frames, ctx.rng, 1.5, 3.5), ctx.rng, 6, 0.012),
    1300,
    0.0015,
    0.5,
  );
  const buzz = partials([
    [ctx.humHz * 3, 0.5],
    [ctx.humHz * 4, 0.35],
    [ctx.humHz * 5, 0.25],
    [ctx.humHz * 6, 0.15],
    [ctx.humHz * 8, 0.08],
  ]);
  const pink = new PinkNoise(ctx.rng);
  const air = new Biquad().bandpass(1500, 0.5);
  const cut = lowCut();
  for (let index = 0; index < frames; index++) {
    out[index] = cut(0.5 * buzz() + 0.6 * air.process(pink.next()) + (disk[index] ?? 0));
  }
  return out;
}

/** Sum of sines at [Hz, level] pairs, one sample per call. */
function partials(pairs: readonly (readonly [number, number])[]): () => number {
  const voices = pairs.map(([hz, level]) => ({ hz, level, oscillator: new Oscillator() }));
  return () =>
    voices.reduce((sum, voice) => sum + voice.level * voice.oscillator.sine(voice.hz), 0);
}

export function office(frames: number, ctx: ChannelContext): Float32Array {
  const out = new Float32Array(frames);
  const keys = new Float32Array(frames);
  addTicks(
    keys,
    ctx.rng,
    bursts(eventFrames(frames, ctx.rng, 1.2, 3), ctx.rng, 4, 0.11),
    1800,
    0.003,
    0.4,
  );
  const pink = new PinkNoise(ctx.rng);
  const hvac = new Biquad().bandpass(420, 0.7);
  const room = new Biquad().lowpass(1200);
  const cut = lowCut();
  for (let index = 0; index < frames; index++) {
    const noise = pink.next();
    out[index] = cut(0.8 * hvac.process(noise) + 0.5 * room.process(noise) + (keys[index] ?? 0));
  }
  return out;
}

export function serverRoom(frames: number, ctx: ChannelContext): Float32Array {
  const out = new Float32Array(frames);
  const fans = partials([
    [380, 0.4],
    [411, 0.6],
    [455, 0.4],
  ]);
  const tremolo = new Oscillator();
  const pink = new PinkNoise(ctx.rng);
  const air = new Biquad().bandpass(2000, 0.4);
  const leds = new Float32Array(frames);
  for (const start of eventFrames(frames, ctx.rng, 0.8, 2.5)) {
    const led = new Oscillator();
    const length = secondsToFrames(0.02);
    for (let offset = 0; offset < length && start + offset < frames; offset++) {
      leds[start + offset] = 0.08 * Math.sin((Math.PI * offset) / length) * led.sine(2000);
    }
  }
  const cut = lowCut();
  for (let index = 0; index < frames; index++) {
    const am = 0.85 + 0.15 * tremolo.sine(3);
    out[index] = cut(0.12 * fans() * am + 0.9 * air.process(pink.next()) + (leds[index] ?? 0));
  }
  return out;
}

export function electricTick(frames: number, ctx: ChannelContext): Float32Array {
  const out = new Float32Array(frames);
  addTicks(out, ctx.rng, eventFrames(frames, ctx.rng, 0.08, 0.35), 3000, 0.001, 1);
  const buzz = partials([4, 5, 6].map((harmonic) => [ctx.humHz * harmonic, 0.02] as const));
  const hiss = new Biquad().highpass(2000);
  const cut = lowCut();
  for (let index = 0; index < frames; index++) {
    out[index] = cut((out[index] ?? 0) + buzz() + 0.03 * hiss.process(whiteNoise(ctx.rng)));
  }
  return out;
}
