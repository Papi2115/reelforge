/**
 * Test-only: deterministic stand-ins for a mix (generated in Node, nothing committed): a 60 s
 * speech-like voice-over with gaps, a 44.1 kHz stereo music pad, a mono "boom" sample and a
 * stereo noise loop. User files use 44.1 kHz on purpose so the 48 kHz resampling path is covered.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Biquad, MIX_SAMPLE_RATE, Oscillator, fadeEdges, mulberry32, whiteNoise } from './dsp.js';
import { encodeWav } from './wav.js';

export const FIXTURE_DURATION_S = 60;
/** [start, end) seconds of speech; everything else is a gap. */
export const VO_SPANS: readonly (readonly [number, number])[] = [
  [1, 9],
  [12, 21],
  [24, 33],
  [36, 45],
  [48, 57],
];
const USER_RATE = 44_100;

/** Harmonic "voice" with vibrato, syllable envelope and fricative noise, gated to VO_SPANS. */
export function speechLikeVo(durationS: number, seed: number): Float32Array {
  const frames = Math.round(durationS * MIX_SAMPLE_RATE);
  const out = new Float32Array(frames);
  const rng = mulberry32(seed);
  const harmonics = [1, 2, 3, 4, 5, 6].map(() => new Oscillator());
  const fricative = new Biquad().bandpass(5000, 1.5);
  for (const [start, end] of VO_SPANS) {
    const from = Math.round(start * MIX_SAMPLE_RATE);
    const to = Math.min(frames, Math.round(end * MIX_SAMPLE_RATE));
    const span = new Float32Array(to - from);
    for (let index = 0; index < span.length; index++) {
      const t = (from + index) / MIX_SAMPLE_RATE;
      const pitch = 130 + 20 * Math.sin(2 * Math.PI * 0.5 * t);
      let voiced = 0;
      harmonics.forEach((oscillator, harmonic) => {
        voiced += oscillator.sine(pitch * (harmonic + 1)) / (harmonic + 1);
      });
      const syllable = (0.55 + 0.45 * Math.sin(2 * Math.PI * 3.7 * t)) ** 2;
      span[index] = 0.2 * syllable * voiced + 0.05 * syllable * fricative.process(whiteNoise(rng));
    }
    fadeEdges(span, 960, 960);
    out.set(span, from);
  }
  return out;
}

function chordPad(durationS: number): Float32Array[] {
  const frames = Math.round(durationS * USER_RATE);
  const notes = [220, 277.18, 329.63, 440];
  const channels = [0, 1].map((side) => {
    const oscillators = notes.map(() => new Oscillator(side * 0.7, USER_RATE));
    return Float32Array.from({ length: frames }, () =>
      oscillators.reduce(
        (sum, oscillator, note) =>
          sum + 0.08 * oscillator.sine((notes[note] ?? 0) * (1 + side * 0.002)),
        0,
      ),
    );
  });
  for (const channel of channels) fadeEdges(channel, 441, 441);
  return channels;
}

function boom(): Float32Array {
  const oscillator = new Oscillator(0, USER_RATE);
  return Float32Array.from({ length: USER_RATE / 2 }, (_, index) => {
    const t = index / USER_RATE;
    return 0.7 * oscillator.sine(60 + 40 * Math.exp(-t / 0.05)) * Math.exp(-t / 0.12);
  });
}

function noiseLoop(durationS: number, seed: number): Float32Array[] {
  const frames = Math.round(durationS * USER_RATE);
  return [seed, seed + 1].map((channelSeed) => {
    const rng = mulberry32(channelSeed);
    const filter = new Biquad(USER_RATE).lowpass(2000);
    return Float32Array.from({ length: frames }, () => 0.05 * filter.process(whiteNoise(rng)));
  });
}

export interface MixFixtures {
  readonly voPath: string;
  /** Cue-relative paths (under the project dir). */
  readonly musicFile: string;
  readonly boomFile: string;
  readonly loopFile: string;
}

/** Writes the fixtures into `projectDir` (folders with spaces and Polish letters). */
export async function writeMixFixtures(projectDir: string): Promise<MixFixtures> {
  const files: MixFixtures = {
    voPath: path.join(projectDir, 'audio', 'vo.clean.wav'),
    musicFile: path.join('audio', 'music', 'pad ł.wav'),
    boomFile: path.join('audio', 'sfx', 'boom ż.wav'),
    loopFile: path.join('audio', 'sfx', 'pętla.wav'),
  };
  const write = async (relative: string, channels: Float32Array[], rate: number): Promise<void> => {
    const target = path.resolve(projectDir, relative);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, encodeWav(channels, rate, 'pcm16'));
  };
  await write(files.voPath, [speechLikeVo(FIXTURE_DURATION_S, 42)], MIX_SAMPLE_RATE);
  await write(files.musicFile, chordPad(20), USER_RATE);
  await write(files.boomFile, [boom()], USER_RATE);
  await write(files.loopFile, noiseLoop(3, 9), USER_RATE);
  return files;
}
