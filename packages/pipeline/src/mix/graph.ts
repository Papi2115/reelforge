/**
 * ffmpeg argument builders for the mix:
 *   premix: VO (any format -> 48 kHz stereo, voGain, padded/trimmed to the timeline) + SFX bus +
 *           ambience bus + music buses (each ducked by the VO with `sidechaincompress`) summed
 *           with `amix normalize=0`; also writes the VO and ducked-music stems (pre-gain).
 *   stems:  applies the final mix gain to every stem.
 * All inputs/outputs are argv entries (no shell, no filtergraph path escaping needed).
 */
import type { DuckingSettings } from './cues.js';
import { MIX_SAMPLE_RATE, dbToGain } from './dsp.js';

/** Filters the mix needs (checked before the first ffmpeg run). */
export const MIX_REQUIRED_FILTERS = [
  'aresample',
  'aformat',
  'pan',
  'volume',
  'apad',
  'atrim',
  'asplit',
  'anull',
  'amix',
  'sidechaincompress',
  'loudnorm',
  'alimiter',
] as const;

/** sidechaincompress `threshold` bounds (linear). */
const THRESHOLD_MIN = 0.000976563;

export interface MusicBusInput {
  readonly path: string;
  readonly ducking: DuckingSettings | null;
}

export interface PremixInputs {
  readonly voPath: string;
  readonly sfxBusPath: string;
  readonly ambienceBusPath: string;
  /** At least one. */
  readonly musicBuses: readonly MusicBusInput[];
  readonly totalFrames: number;
  readonly voGainDb: number;
}

export interface PremixOutputs {
  readonly premix: string;
  readonly voStem: string;
  readonly musicStem: string;
}

export function duckingFilter(ducking: DuckingSettings): string {
  const threshold = Math.min(1, Math.max(THRESHOLD_MIN, dbToGain(ducking.thresholdDb)));
  return (
    `sidechaincompress=threshold=${threshold.toFixed(6)}:ratio=${String(ducking.ratio)}` +
    `:attack=${String(ducking.attackMs)}:release=${String(ducking.releaseMs)}` +
    ':makeup=1:detection=rms:link=average'
  );
}

/**
 * Extra frames fed through `sidechaincompress` past the timeline end. When one of its inputs hits
 * EOF it drops whatever is still queued for the other, and how much is queued depends on thread
 * timing (seen: 512 frames missing in one of two identical runs). Padding both inputs and trimming
 * the result keeps that loss outside the timeline, so the output is deterministic.
 */
export const SIDECHAIN_TAIL_FRAMES = MIX_SAMPLE_RATE;

/** Builds the premix filter_complex; outputs are labelled `[premix]`, `[vo_stem]`, `[music_stem]`. */
export function premixGraph(inputs: PremixInputs): string {
  const frames = String(inputs.totalFrames);
  const padded = String(inputs.totalFrames + SIDECHAIN_TAIL_FRAMES);
  const ducked = inputs.musicBuses.filter((bus) => bus.ducking !== null).length;
  const sidechains = Array.from({ length: ducked }, (_, index) => `[vo_sc${String(index)}]`);
  const parts = [
    `[0:a]aresample=${String(MIX_SAMPLE_RATE)},aformat=sample_fmts=fltp:channel_layouts=mono,` +
      `pan=stereo|c0=c0|c1=c0,volume=${inputs.voGainDb.toFixed(2)}dB,` +
      `apad=whole_len=${padded},atrim=end_sample=${padded},` +
      `asplit=${String(2 + ducked)}[vo_mix_full][vo_stem_full]${sidechains.join('')}`,
    `[vo_mix_full]atrim=end_sample=${frames}[vo_mix]`,
    `[vo_stem_full]atrim=end_sample=${frames}[vo_stem]`,
  ];
  let sidechain = 0;
  const musicLabels = inputs.musicBuses.map((bus, index) => {
    const input = `[${String(3 + index)}:a]`;
    const label = `[m${String(index)}]`;
    if (bus.ducking === null) {
      parts.push(`${input}anull${label}`);
    } else {
      parts.push(
        `${input}apad=whole_len=${padded}[mp${String(index)}];` +
          `[mp${String(index)}][vo_sc${String(sidechain)}]${duckingFilter(bus.ducking)},` +
          `atrim=end_sample=${frames}${label}`,
      );
      sidechain++;
    }
    return label;
  });
  const musicSum =
    musicLabels.length === 1
      ? musicLabels.join('')
      : `${musicLabels.join('')}amix=inputs=${String(musicLabels.length)}:normalize=0:duration=longest,`;
  parts.push(`${musicSum}asplit=2[music_mix][music_stem]`);
  parts.push('[vo_mix][1:a][2:a][music_mix]amix=inputs=4:normalize=0:duration=longest[premix]');
  return parts.join(';');
}

/** Output options for an intermediate / stem: 48 kHz float32 WAV without metadata. */
function floatWavOutput(label: string, outputPath: string): string[] {
  return [
    '-map',
    label,
    '-map_metadata',
    '-1',
    '-fflags',
    '+bitexact',
    '-c:a',
    'pcm_f32le',
    '-ar',
    String(MIX_SAMPLE_RATE),
    '-f',
    'wav',
    outputPath,
  ];
}

export function premixArgs(inputs: PremixInputs, outputs: PremixOutputs): string[] {
  const files = [
    inputs.voPath,
    inputs.sfxBusPath,
    inputs.ambienceBusPath,
    ...inputs.musicBuses.map((bus) => bus.path),
  ];
  return [
    '-y',
    ...files.flatMap((file) => ['-i', file]),
    '-filter_complex',
    premixGraph(inputs),
    ...floatWavOutput('[premix]', outputs.premix),
    ...floatWavOutput('[vo_stem]', outputs.voStem),
    ...floatWavOutput('[music_stem]', outputs.musicStem),
  ];
}

export interface StemJob {
  readonly input: string;
  readonly output: string;
}

/** Applies `gainDb` to every stem in one run (one output per input). */
export function stemArgs(stems: readonly StemJob[], gainDb: number): string[] {
  const graph = stems
    .map((_, index) => `[${String(index)}:a]volume=${gainDb.toFixed(2)}dB[s${String(index)}]`)
    .join(';');
  return [
    '-y',
    ...stems.flatMap((stem) => ['-i', stem.input]),
    '-filter_complex',
    graph,
    ...stems.flatMap((stem, index) => floatWavOutput(`[s${String(index)}]`, stem.output)),
  ];
}
