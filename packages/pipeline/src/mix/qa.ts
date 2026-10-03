/**
 * Measurable mix QA (offline, streamed in 4096-frame blocks, deterministic): where the voice
 * speaks (VO stem level above a percentile-relative threshold), how deep the music is ducked there
 * (un-ducked music buses vs. the ducked music stem), an SII-like speech-band margin (voice minus
 * music level in the 500 Hz-4 kHz octave bands during speech, weighted by band importance), the
 * music stem's energy below 120 Hz, and full-scale samples in the final mix.
 */
import { describeError, type FfmpegError } from '../ffmpeg/errors.js';
import { err, ok, type Result } from '../result.js';
import { fft } from './analysis.js';
import { MIX_SAMPLE_RATE } from './dsp.js';
import { WavReader } from './wav-reader.js';

export interface MixQaMeasurements {
  /** Seconds of the timeline where the voice speaks. */
  readonly speechS: number;
  /** Share of the music stem's energy below 120 Hz (0..1); null without music. */
  readonly musicLowShare: number | null;
  /** Music reduction under speech vs. the un-ducked buses (dB); null without music under speech. */
  readonly duckingDepthDb: number | null;
  /** Voice minus music in the speech bands during speech, band-importance weighted (dB). */
  readonly speechMarginDb: number | null;
  /** The worst speech band's margin (dB). */
  readonly speechMarginMinDb: number | null;
  /** Samples of the final mix at digital full scale. */
  readonly clippedSamples: number;
}

export interface MixQaInputs {
  /** VO stem (as mixed, before the master gain). */
  readonly voStem: string;
  /** Ducked music stem. */
  readonly musicStem: string;
  /** The music buses before ducking (summed). */
  readonly musicBuses: readonly string[];
  /** Final mix (16-bit). */
  readonly mix: string;
  readonly totalFrames: number;
  readonly signal?: AbortSignal | undefined;
}

const BLOCK = 4096;
const BIN_HZ = MIX_SAMPLE_RATE / BLOCK;
const LOW_BAND_HZ = 120;
/** Octave bands (centre Hz) and their ANSI S3.5 octave-band importance (renormalized). */
const SPEECH_BANDS: readonly { readonly centre: number; readonly weight: number }[] = [
  { centre: 500, weight: 0.1671 },
  { centre: 1000, weight: 0.2373 },
  { centre: 2000, weight: 0.2648 },
  { centre: 4000, weight: 0.2142 },
];
/** Speech = VO block level above (95th percentile - this), and above SPEECH_FLOOR_DB. */
const SPEECH_RANGE_DB = 20;
const SPEECH_FLOOR_DB = -50;
const SILENCE = 1e-12;
const FULL_SCALE = 32767 / 32768;
const MAX_REPORTED_DB = 60;

const HANN = Float64Array.from(
  { length: BLOCK },
  (_, index) => 0.5 - 0.5 * Math.cos((2 * Math.PI * index) / BLOCK),
);

const powerDb = (power: number): number => 10 * Math.log10(Math.max(power, SILENCE));
const ratioDb = (num: number, den: number): number =>
  Math.min(MAX_REPORTED_DB, powerDb(num) - powerDb(den));
const round2 = (value: number): number => Math.round(value * 100) / 100;

function mono(channels: readonly Float32Array[], length: number): Float64Array {
  const out = new Float64Array(BLOCK);
  const count = Math.max(1, channels.length);
  for (const channel of channels) {
    for (let index = 0; index < length; index++)
      out[index] = (out[index] ?? 0) + (channel[index] ?? 0) / count;
  }
  return out;
}

function meanSquare(samples: Float64Array, length: number): number {
  let sum = 0;
  for (let index = 0; index < length; index++) sum += (samples[index] ?? 0) ** 2;
  return length > 0 ? sum / length : 0;
}

/** Power spectrum (Hann) of one block: bins 0..BLOCK/2. */
function spectrum(samples: Float64Array): Float64Array {
  const real = Float64Array.from(samples, (value, index) => value * (HANN[index] ?? 0));
  const imag = new Float64Array(BLOCK);
  fft(real, imag);
  return Float64Array.from(
    { length: BLOCK / 2 + 1 },
    (_, bin) => (real[bin] ?? 0) ** 2 + (imag[bin] ?? 0) ** 2,
  );
}

function bandPower(power: Float64Array, fromHz: number, toHz: number): number {
  let sum = 0;
  const first = Math.max(1, Math.ceil(fromHz / BIN_HZ));
  const last = Math.min(power.length - 1, Math.floor(toHz / BIN_HZ));
  for (let bin = first; bin <= last; bin++) sum += power[bin] ?? 0;
  return sum;
}

interface BlockStats {
  readonly voDb: number;
  readonly voBands: readonly number[];
  readonly musicBands: readonly number[];
  readonly music: number;
  readonly preMusic: number;
}

class Accumulator {
  readonly blocks: BlockStats[] = [];
  musicLow = 0;
  musicTotal = 0;

  add(vo: Float64Array, music: Float64Array, pre: Float64Array, length: number): void {
    const voSpectrum = spectrum(vo);
    const musicSpectrum = spectrum(music);
    const bands = (power: Float64Array): number[] =>
      SPEECH_BANDS.map(({ centre }) => bandPower(power, centre / Math.SQRT2, centre * Math.SQRT2));
    this.musicLow += bandPower(musicSpectrum, 0, LOW_BAND_HZ);
    this.musicTotal += bandPower(musicSpectrum, 0, MIX_SAMPLE_RATE / 2);
    this.blocks.push({
      voDb: powerDb(meanSquare(vo, length)),
      voBands: bands(voSpectrum),
      musicBands: bands(musicSpectrum),
      music: meanSquare(music, length),
      preMusic: meanSquare(pre, length),
    });
  }
}

function speechBlocks(blocks: readonly BlockStats[]): BlockStats[] {
  const levels = blocks
    .map((block) => block.voDb)
    .filter((db) => db > -70)
    .sort((a, b) => a - b);
  if (levels.length === 0) return [];
  const p95 = levels[Math.min(levels.length - 1, Math.floor(levels.length * 0.95))] ?? -70;
  const threshold = Math.max(SPEECH_FLOOR_DB, p95 - SPEECH_RANGE_DB);
  return blocks.filter((block) => block.voDb > threshold);
}

function summarize(acc: Accumulator, clippedSamples: number): MixQaMeasurements {
  const speech = speechBlocks(acc.blocks);
  const hasMusic = acc.musicTotal > SILENCE * acc.blocks.length;
  const underSpeech = speech.filter((block) => block.preMusic > SILENCE);
  const sum = (values: readonly number[]): number => values.reduce((total, v) => total + v, 0);
  let margin: number | null = null;
  let marginMin: number | null = null;
  if (hasMusic && speech.length > 0) {
    const perBand = SPEECH_BANDS.map((_, band) =>
      ratioDb(
        sum(speech.map((block) => block.voBands[band] ?? 0)),
        sum(speech.map((block) => block.musicBands[band] ?? 0)),
      ),
    );
    const weights = sum(SPEECH_BANDS.map((band) => band.weight));
    margin = sum(perBand.map((db, band) => db * (SPEECH_BANDS[band]?.weight ?? 0))) / weights;
    marginMin = Math.min(...perBand);
  }
  return {
    speechS: round2((speech.length * BLOCK) / MIX_SAMPLE_RATE),
    musicLowShare: hasMusic ? Math.round((acc.musicLow / acc.musicTotal) * 10_000) / 10_000 : null,
    duckingDepthDb:
      hasMusic && underSpeech.length > 0
        ? round2(
            ratioDb(
              sum(underSpeech.map((block) => block.preMusic)),
              sum(underSpeech.map((block) => block.music)),
            ),
          )
        : null,
    speechMarginDb: margin === null ? null : round2(margin),
    speechMarginMinDb: marginMin === null ? null : round2(marginMin),
    clippedSamples,
  };
}

async function countClipped(mix: WavReader, signal: AbortSignal | undefined): Promise<number> {
  let clipped = 0;
  for (let from = 0; from < mix.info.frames; from += BLOCK * 16) {
    if (signal?.aborted === true) break;
    for (const channel of await mix.read(from, BLOCK * 16)) {
      for (const value of channel) if (Math.abs(value) >= FULL_SCALE) clipped++;
    }
  }
  return clipped;
}

async function measure(inputs: MixQaInputs, readers: WavReader[]): Promise<MixQaMeasurements> {
  const open = async (file: string): Promise<WavReader> => {
    const reader = await WavReader.open(file);
    readers.push(reader);
    return reader;
  };
  const vo = await open(inputs.voStem);
  const music = await open(inputs.musicStem);
  const buses: WavReader[] = [];
  for (const bus of inputs.musicBuses) buses.push(await open(bus));
  const acc = new Accumulator();
  for (let from = 0; from < inputs.totalFrames; from += BLOCK) {
    if (inputs.signal?.aborted === true) break;
    const length = Math.min(BLOCK, inputs.totalFrames - from);
    const pre = new Float64Array(BLOCK);
    for (const bus of buses) {
      const block = mono(await bus.read(from, length), length);
      for (let index = 0; index < length; index++)
        pre[index] = (pre[index] ?? 0) + (block[index] ?? 0);
    }
    acc.add(
      mono(await vo.read(from, length), length),
      mono(await music.read(from, length), length),
      pre,
      length,
    );
  }
  return summarize(acc, await countClipped(await open(inputs.mix), inputs.signal));
}

/** Measures the mix (see the module comment). */
export async function analyzeMix(
  inputs: MixQaInputs,
): Promise<Result<MixQaMeasurements, FfmpegError>> {
  const readers: WavReader[] = [];
  try {
    const measured = await measure(inputs, readers);
    if (inputs.signal?.aborted === true)
      return err({ kind: 'cancelled', message: 'mix cancelled' });
    return ok(measured);
  } catch (error) {
    return err({ kind: 'parse-failed', message: `mix QA failed: ${describeError(error)}` });
  } finally {
    await Promise.all(readers.map((reader) => reader.close()));
  }
}
