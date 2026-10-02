/** @reelforge/pipeline: ffmpeg, audio cleaning, whisper.cpp ASR, script alignment, anchors, mix, video export. */
export const packageName = '@reelforge/pipeline';

export { err, ok, type Result } from './result.js';
export { stderrTail, type FfmpegError, type FfmpegErrorKind } from './ffmpeg/errors.js';
export {
  FFMPEG_ENV_VAR,
  commonWindowsDirs,
  locateFfmpeg,
  nodeFileSystem,
  type FfmpegBinary,
  type FfmpegSource,
  type LocateFileSystem,
  type LocateOptions,
} from './ffmpeg/locate.js';
export {
  capabilitiesOf,
  parseEncoders,
  parseFilters,
  parseVersionOutput,
  type FfmpegCapabilities,
  type FfmpegLicense,
  type FfmpegVersionInfo,
  type HardwareH264,
} from './ffmpeg/probe.js';
export { ProgressParser, parseClockTime, type FfmpegProgress } from './ffmpeg/progress.js';
export {
  escapeFilterOptionValue,
  escapeFiltergraphText,
  filterPathValue,
} from './ffmpeg/filtergraph.js';
export { killProcessTree, runProcess, type ProcessOutput } from './ffmpeg/process.js';
export {
  FfmpegManager,
  buildRunArgs,
  probeFfmpeg,
  type FfmpegInfo,
  type FfmpegRunOptions,
  type FfmpegRunOutput,
} from './ffmpeg/manager.js';
export {
  DEFAULT_TARGET_LUFS,
  cleanAudio,
  type CleanAudioOptions,
  type CleanProgress,
  type CleanStage,
  type FfmpegRunner,
} from './audio/clean.js';
export { CLEAN_PRESETS, type CleanPreset, type OutputChannels } from './audio/presets.js';
export {
  CLEAN_REPORT_VERSION,
  CleanReportSchema,
  LoudnessSchema,
  type CleanReport,
  type CleanSkippedStep,
} from './audio/report.js';
export { readJsonFile, writeJsonAtomic, type JsonFileError } from './schemas/json-file.js';
export {
  AlignmentStatsSchema,
  AsrLanguageSchema,
  MismatchRegionSchema,
  RawWordSchema,
  TimedScriptWordSchema,
  WORDS_FILE_VERSION,
  WORDS_RAW_VERSION,
  WhisperBackendSchema,
  WordStatusSchema,
  WordsFileSchema,
  WordsRawSchema,
  type AsrLanguage,
  type RawWord,
  type WhisperBackend,
  type WordsFile,
  type WordsRaw,
} from './schemas/words.js';
export {
  cleanWord,
  foldDiacritics,
  normalizeText,
  subTokens,
  tokenizeScript,
  werTokens,
  type ScriptWord,
} from './text/normalize.js';
export { numberToWords, ordinalToWords, type SpelledLanguage } from './text/numbers.js';
export {
  alignScript,
  type AlignOptions,
  type AlignedWord,
  type AlignmentResult,
  type AlignmentStats,
  type AsrWord,
  type WordStatus,
} from './align/align.js';
export type { MismatchRegion } from './align/regions.js';
export { wordErrorRate } from './align/levenshtein.js';
export {
  alignRawWords,
  buildWordsFile,
  readWordsFile,
  readWordsRawFile,
  timeScriptWords,
  writeWordsFile,
} from './align/words-file.js';
export {
  AnchorIndex,
  resolveAnchor,
  type AnchorCandidate,
  type AnchorError,
  type AnchorIndexOptions,
  type AnchorMatch,
  type AnchorWord,
} from './anchors/resolve.js';
export {
  DEFAULT_WHISPER_MODEL,
  RNNOISE_SH_MODEL,
  SILERO_VAD_MODEL,
  WHISPER_BINARIES,
  WHISPER_MODELS,
  WHISPER_MODEL_IDS,
  WHISPER_RELEASE_TAG,
  type AssetHash,
  type AssetSpec,
  type BinaryBackend,
  type WhisperModelId,
  type WhisperModelSpec,
} from './asr/assets.js';
export {
  downloadVerified,
  hashFile,
  type DownloadOptions,
  type DownloadProgress,
  type FetchLike,
} from './asr/download.js';
export type { WhisperAttemptFailure, WhisperError, WhisperErrorKind } from './asr/errors.js';
export {
  BACKEND_ORDER,
  WHISPER_ENV_VAR,
  backendDir,
  defaultWhisperRoot,
  locateWhisper,
  type WhisperInstall,
  type WhisperLocateOptions,
  type WhisperSource,
} from './asr/locate.js';
export {
  WhisperManager,
  type InstallOptions,
  type WhisperManagerOptions,
  type WhisperTranscribeOptions,
} from './asr/manager.js';
export {
  type AsrFfmpeg,
  type ProcessRunner,
  type TranscribeOptions,
  type TranscribeProgress,
  type TranscribeStage,
} from './asr/transcribe.js';
export { extractZip } from './asr/unzip.js';
export {
  calibrateDtw,
  parseVadSegments,
  planChunks,
  wordsFromWhisperJson,
  type ChunkPlanOptions,
  type SegmentWord,
  type TimeSpan,
} from './asr/whisper-output.js';
export {
  CUES_FILE_VERSION,
  MAX_MIX_DURATION_S,
  AmbienceCueSchema,
  CuesFileSchema,
  DuckingSchema,
  MixGlobalSchema,
  MusicCueSchema,
  SfxCueSchema,
  readCuesFile,
  writeCuesFile,
  type AmbienceCue,
  type CuesFile,
  type CuesFileInput,
  type DuckingSettings,
  type MixGlobal,
  type MusicCue,
  type SfxCue,
} from './mix/cues.js';
export {
  SFX_DEFAULT_DURATION_S,
  SFX_MAX_DURATION_S,
  SFX_MIN_DURATION_S,
  SFX_PEAK,
  SFX_RECIPES,
  synthesizeSfx,
  writeSfxWav,
  type SfxRecipe,
  type SfxSynthOptions,
} from './mix/sfx.js';
export {
  AMBIENCE_RECIPES,
  synthesizeAmbience,
  type AmbienceRecipe,
  type AmbienceSynthOptions,
} from './mix/ambience.js';
export { MIX_SAMPLE_RATE, hashSeed, mulberry32 } from './mix/dsp.js';
export { makeSeamlessLoop, type LoopCurve, type StereoClip } from './mix/clip.js';
export { encodeWav, writeWavAtomic, type WavSampleFormat } from './mix/wav.js';
export {
  MIX_REPORT_VERSION,
  MixReportSchema,
  STEM_NAMES,
  type MixReport,
  type StemName,
} from './mix/report.js';
export { STEM_FILE_NAMES } from './mix/master.js';
export { mixAudio, type MixAudioOptions, type MixProgress, type MixStage } from './mix/mix.js';
export {
  EXPORT_PRESETS,
  EXPORT_PRESET_IDS,
  DEFAULT_EXPORT_PRESET,
  isExportPresetId,
  resolveOutputScale,
  type ExportPreset,
  type ExportPresetId,
  type OutputScale,
} from './export/presets.js';
export type { ExportError, ExportErrorKind } from './export/errors.js';
export {
  isSoftwareRenderer,
  type FrameSource,
  type FrameSourceFactory,
  type FrameSourceInfo,
  type ShotRange,
} from './export/frame-source.js';
export {
  SEGMENT_CACHE_VERSION,
  extractAnchorUses,
  segmentCacheKey,
  stableStringify,
  type AnchorResolver,
  type AnchorSpan,
  type AnchorUse,
  type RenderIdentity,
} from './export/cache-key.js';
export {
  HARDWARE_ENCODERS,
  VIDEO_ENCODER_IDS,
  detectEncoder,
  upscaleFilter,
  videoCodecArgs,
  type DetectEncoderOptions,
  type EncoderChoice,
  type EncoderProbe,
  type ExportQuality,
  type HardwareEncoderId,
  type VideoEncoderId,
} from './export/encoders.js';
export type {
  ExportMedia,
  MuxSpec,
  SegmentSpec,
  SegmentWriter,
  ThumbnailSpec,
} from './export/media.js';
export { AUDIO_BITRATE, createFfmpegMedia, type ExportFfmpeg } from './export/ffmpeg-media.js';
export {
  MIN_CHAPTERS,
  MIN_CHAPTER_SECONDS,
  buildChaptersTxt,
  formatChapterTime,
  type Chapter,
} from './export/chapters.js';
export { planShots, type PlannedShot, type ShotPlan } from './export/shot-plan.js';
export {
  EXPORT_STATE_VERSION,
  ExportStateSchema,
  exportPaths,
  readExportState,
  type ExportPaths,
  type ExportState,
} from './export/state.js';
export { THUMBNAIL_MIN_WIDTH, thumbnailFactor } from './export/thumbnail.js';
export { safeOutputName } from './export/output-name.js';
export {
  defaultWorkerCount,
  exportVideo,
  type ExportProgress,
  type ExportResult,
  type ExportVideoOptions,
} from './export/export-video.js';
