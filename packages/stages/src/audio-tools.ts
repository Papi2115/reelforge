/**
 * The audio tools the non-Claude stages need (ffmpeg clean/mix/probe, whisper.cpp), behind one
 * interface so tests can swap in fakes. `createPipelineAudioTools` is the real implementation over
 * `@reelforge/pipeline` (ffmpeg located once, lazily; whisper models must be installed already).
 */
import {
  FfmpegManager,
  WhisperManager,
  cleanAudio,
  mixAudio,
  parseMediaAudioInfo,
  type AsrLanguage,
  type CleanPreset,
  type CleanReport,
  type CuesFile,
  type MixReport,
  type WhisperDecoding,
  type WhisperManagerOptions,
  type WhisperModelId,
  type WordsRaw,
} from '@reelforge/pipeline';
import { err, ok, type Result } from '@reelforge/claude-bridge';
import type { MixSilence } from '@reelforge/shared';

export interface ToolError {
  /** `cancelled` when aborted; otherwise the pipeline's error kind (`not-found`, `exit-code`, …). */
  readonly kind: string;
  readonly message: string;
}

export interface ToolProgress {
  readonly label: string;
  /** 0..1 or null when unknown. */
  readonly ratio: number | null;
}

interface ToolCall {
  readonly signal?: AbortSignal | undefined;
  readonly onProgress?: ((progress: ToolProgress) => void) | undefined;
}

export interface CleanRequest extends ToolCall {
  readonly input: string;
  readonly output: string;
  readonly preset: CleanPreset;
  readonly targetLufs?: number | undefined;
  readonly shortenSilence?: { readonly maxPauseS: number } | undefined;
  readonly arnndnModelPath?: string | undefined;
}

export interface TranscribeRequest extends ToolCall {
  readonly input: string;
  readonly workDir: string;
  readonly lang: AsrLanguage;
  readonly model: WhisperModelId;
  readonly decoding?: WhisperDecoding | undefined;
  readonly threads?: number | undefined;
}

export interface MixRequest extends ToolCall {
  readonly voPath: string;
  readonly outputPath: string;
  readonly baseDir: string;
  readonly workDir: string;
  /** Also write the stems here. */
  readonly stemsDir?: string | undefined;
  /** Bed silences before the hits of accepted reveal moments (PLAN.md#12.27), film seconds. */
  readonly silences?: readonly MixSilence[] | undefined;
}

export interface AudioTools {
  /** Length of a media file in seconds (null when ffmpeg does not report one). */
  durationS(file: string, signal?: AbortSignal): Promise<Result<number | null, ToolError>>;
  clean(request: CleanRequest): Promise<Result<CleanReport, ToolError>>;
  transcribe(request: TranscribeRequest): Promise<Result<WordsRaw, ToolError>>;
  hasWhisperModel(model: WhisperModelId): boolean;
  mix(cues: CuesFile, request: MixRequest): Promise<Result<MixReport, ToolError>>;
}

export interface PipelineAudioToolsOptions {
  /** ffmpeg binary or folder from the settings; undefined/null = auto-detect. */
  readonly ffmpegPath?: string | null | undefined;
  readonly whisper?: WhisperManagerOptions | undefined;
}

const toToolError = (error: { readonly kind: string; readonly message: string }): ToolError => ({
  kind: error.kind,
  message: error.message,
});

/** Real tools over @reelforge/pipeline. */
export function createPipelineAudioTools(options: PipelineAudioToolsOptions = {}): AudioTools {
  let ffmpeg: Promise<Result<FfmpegManager, ToolError>> | undefined;
  const whisper = new WhisperManager(options.whisper ?? {});
  const getFfmpeg = (): Promise<Result<FfmpegManager, ToolError>> => {
    ffmpeg ??= FfmpegManager.create({ configuredPath: options.ffmpegPath ?? undefined }).then(
      (created) => (created.ok ? created : err(toToolError(created.error))),
    );
    return ffmpeg;
  };
  return {
    async durationS(file, signal) {
      const manager = await getFfmpeg();
      if (!manager.ok) return manager;
      // A 0.1 s decode prints the input banner (with Duration) without reading the whole file.
      const run = await manager.value.run(['-i', file, '-t', '0.1', '-f', 'null', '-'], {
        signal,
      });
      if (!run.ok) return err(toToolError(run.error));
      return ok(parseMediaAudioInfo(run.value.stderr).durationS);
    },
    async clean(request) {
      const manager = await getFfmpeg();
      if (!manager.ok) return manager;
      const { onProgress } = request;
      const report = await cleanAudio(request.input, request.output, request.preset, {
        ffmpeg: manager.value,
        ...(request.targetLufs === undefined ? {} : { targetLufs: request.targetLufs }),
        shortenSilence: request.shortenSilence,
        arnndnModelPath: request.arnndnModelPath,
        signal: request.signal,
        onProgress:
          onProgress === undefined
            ? undefined
            : (progress) => {
                onProgress({ label: progress.stage, ratio: progress.ratio });
              },
      });
      return report.ok ? report : err(toToolError(report.error));
    },
    async transcribe(request) {
      const manager = await getFfmpeg();
      if (!manager.ok) return manager;
      const { onProgress } = request;
      const raw = await whisper.transcribe({
        input: request.input,
        workDir: request.workDir,
        lang: request.lang,
        model: request.model,
        decoding: request.decoding,
        threads: request.threads,
        ffmpeg: manager.value,
        signal: request.signal,
        onProgress:
          onProgress === undefined
            ? undefined
            : (progress) => {
                onProgress({ label: progress.stage, ratio: progress.ratio });
              },
      });
      return raw.ok ? raw : err(toToolError(raw.error));
    },
    hasWhisperModel(model) {
      return whisper.locate().ok && whisper.hasModel(model);
    },
    async mix(cues, request) {
      const manager = await getFfmpeg();
      if (!manager.ok) return manager;
      const { onProgress } = request;
      const report = await mixAudio(cues, {
        ffmpeg: manager.value,
        voPath: request.voPath,
        outputPath: request.outputPath,
        baseDir: request.baseDir,
        workDir: request.workDir,
        stemsDir: request.stemsDir,
        silences: request.silences,
        signal: request.signal,
        onProgress:
          onProgress === undefined
            ? undefined
            : (progress) => {
                onProgress({ label: progress.stage, ratio: progress.ratio });
              },
      });
      return report.ok ? report : err(toToolError(report.error));
    },
  };
}
