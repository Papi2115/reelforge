/**
 * Clean presets and filter-chain building (ADR-003, spike 03):
 *   light    = highpass 70 Hz + afftdn nr=10 (nf = measured floor)
 *   standard = highpass 80 Hz + afftdn nr=20 (default)
 *   heavy    = highpass 80 Hz + arnndn (rnnoise model); afftdn nr=30 when the model is unavailable.
 * arnndn is never placed after afftdn (that order suppressed speech by ~30 dB in the spike).
 * Normalisation = linear `volume` gain + `alimiter`, not two-pass loudnorm.
 */
import { filterPathValue } from '../ffmpeg/filtergraph.js';

export const CLEAN_PRESETS = ['light', 'standard', 'heavy'] as const;
export type CleanPreset = (typeof CLEAN_PRESETS)[number];

export const OUTPUT_SAMPLE_RATE = 48_000;

interface PresetSpec {
  readonly highpassHz: number;
  readonly afftdnNr: number;
  /** heavy only: rnnoise replaces afftdn when a model is available. */
  readonly preferArnndn: boolean;
}

export const PRESET_SPECS: Readonly<Record<CleanPreset, PresetSpec>> = {
  light: { highpassHz: 70, afftdnNr: 10, preferArnndn: false },
  standard: { highpassHz: 80, afftdnNr: 20, preferArnndn: false },
  heavy: { highpassHz: 80, afftdnNr: 30, preferArnndn: true },
};

/** One filter in the chain; `label` is what the report shows (no absolute paths). */
export interface FilterStep {
  readonly filter: string;
  readonly label: string;
}

export interface SilenceShortening {
  /** Pauses longer than this are cut down to roughly this length (seconds). */
  readonly maxPauseS: number;
  /** RMS level under which audio counts as silence (dBFS). */
  readonly thresholdDb: number;
}

/** Why arnndn was not applied in the heavy preset. */
export const ARNNDN_UNAVAILABLE_REASONS = ['no-model', 'model-missing', 'filter-missing'] as const;
export type ArnndnUnavailable = (typeof ARNNDN_UNAVAILABLE_REASONS)[number];

export interface CleanChainParams {
  readonly preset: CleanPreset;
  readonly noiseFloorDb: number;
  /** Absolute path to an rnnoise model when it can be used; otherwise the reason it cannot. */
  readonly arnndn: { readonly modelPath: string } | { readonly unavailable: ArnndnUnavailable };
  readonly silence: SilenceShortening | null;
  readonly channels: OutputChannels;
}

export type OutputChannels = 'mono' | 'source';

/** RMS detection window used for silence shortening. */
export const SILENCE_WINDOW_S = 0.05;
export const MIN_MAX_PAUSE_S = 0.25;

const step = (filter: string, label: string = filter): FilterStep => ({ filter, label });

/** Resample to 48 kHz (and down-mix to mono) first so every measurement sees the final format. */
export function formatSteps(channels: OutputChannels): FilterStep[] {
  const steps = [step(`aresample=${String(OUTPUT_SAMPLE_RATE)}`)];
  if (channels === 'mono') steps.push(step('aformat=channel_layouts=mono'));
  return steps;
}

export function highpassStep(preset: CleanPreset): FilterStep {
  return step(`highpass=f=${String(PRESET_SPECS[preset].highpassHz)}`);
}

/**
 * silenceremove keeps about `stop_duration + window` of each long pause (measured with ffmpeg 8.1),
 * so stop_duration = maxPause - window and nothing extra is kept.
 */
export function silenceStep(silence: SilenceShortening): FilterStep {
  const maxPause = Math.max(MIN_MAX_PAUSE_S, silence.maxPauseS);
  const stopDuration = Math.max(SILENCE_WINDOW_S, maxPause - SILENCE_WINDOW_S);
  return step(
    'silenceremove=stop_periods=-1' +
      `:stop_duration=${stopDuration.toFixed(3)}:stop_silence=0` +
      `:stop_threshold=${silence.thresholdDb.toFixed(1)}dB` +
      `:detection=rms:window=${String(SILENCE_WINDOW_S)}`,
  );
}

/** Format + high-pass + denoise (+ silence shortening): everything before the gain stage. */
export function buildCleanChain(params: CleanChainParams): FilterStep[] {
  const spec = PRESET_SPECS[params.preset];
  const steps = [...formatSteps(params.channels), highpassStep(params.preset)];
  if (spec.preferArnndn && 'modelPath' in params.arnndn) {
    const modelName = params.arnndn.modelPath.split(/[\\/]/).at(-1) ?? 'model';
    steps.push(
      step(`arnndn=m=${filterPathValue(params.arnndn.modelPath)}`, `arnndn=m=${modelName}`),
    );
  } else {
    steps.push(step(`afftdn=nr=${String(spec.afftdnNr)}:nf=${String(params.noiseFloorDb)}`));
  }
  if (params.silence !== null) steps.push(silenceStep(params.silence));
  return steps;
}

/** Linear gain followed by a look-ahead limiter with delay compensation (`latency=1`). */
export function gainSteps(gainDb: number, ceilingDb: number): FilterStep[] {
  const limit = Math.min(1, Math.max(0.0625, 10 ** (ceilingDb / 20)));
  return [
    step(`volume=${gainDb.toFixed(2)}dB`),
    step(`alimiter=limit=${limit.toFixed(4)}:attack=5:release=60:level=false:latency=1`),
  ];
}

export function joinFilters(steps: readonly FilterStep[]): string {
  return steps.map((entry) => entry.filter).join(',');
}

/** Full render args: first audio stream -> chain -> 48 kHz 16-bit PCM WAV without metadata. */
export function renderArgs(inputPath: string, chain: string, outputPath: string): string[] {
  return [
    '-i',
    inputPath,
    '-map',
    '0:a:0',
    '-af',
    chain,
    '-map_metadata',
    '-1',
    '-fflags',
    '+bitexact',
    '-c:a',
    'pcm_s16le',
    '-ar',
    String(OUTPUT_SAMPLE_RATE),
    '-f',
    'wav',
    '-y',
    outputPath,
  ];
}

/** Analysis args: first audio stream -> chain -> null muxer (no file written). */
export function analysisArgs(inputPath: string, chain: string): string[] {
  return ['-i', inputPath, '-map', '0:a:0', '-af', chain, '-f', 'null', '-'];
}
