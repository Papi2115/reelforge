/** ElevenLabs voice generation (PLAN.md#13.14, docs/voice.md). */
export {
  ELEVENLABS_BASE_URL,
  DEFAULT_RETRY,
  ElevenLabsClient,
  speechRequestBody,
  type ElevenLabsClientOptions,
  type ElevenLabsSubscription,
  type ElevenLabsVoice,
  type GenerateSpeechRequest,
  type GeneratedSpeech,
  type RetryPolicy,
  type VoiceClientEvent,
} from './client.js';
export {
  REDACTED,
  isRetryable,
  redactSecret,
  voiceErrorHeadline,
  type VoiceError,
  type VoiceErrorKind,
} from './errors.js';
export { ConcurrencyLimiter, DEFAULT_CONCURRENCY, concurrencyForTier } from './limiter.js';
export {
  CHUNK_CAP_SHARE,
  DEFAULT_VOICE_MODEL,
  MAX_STITCH_IDS,
  REQUEST_ID_TTL_MS,
  VOICE_MODELS,
  chunkCharBudget,
  pickOutputFormat,
  voiceModelSpec,
  type OutputFormat,
  type VoiceModelSpec,
} from './models.js';
export {
  CONTEXT_CHARS,
  characterCount,
  planVoiceChunks,
  splitScriptParagraphs,
  splitSentences,
  type ChunkJoin,
  type ScriptParagraph,
  type ScriptSentence,
  type VoiceChunkPlan,
} from './script-chunks.js';
export {
  calibrateCosts,
  estimateCost,
  formatCount,
  measuredMultiplier,
  type CostCalibration,
  type CostEstimate,
  type QuotaSnapshot,
} from './cost.js';
export {
  alignmentToWords,
  buildApiWordsFile,
  compareWithWhisper,
  type ChunkWord,
  type TimingComparison,
} from './alignment.js';
export {
  EDGE_FADE_S,
  VOICE_SAMPLE_RATE,
  assembleTimeline,
  createTakeDecoder,
  type DecodedTake,
  type TakeDecoder,
} from './audio.js';
export { VOICE_FILES, readTakesManifest } from './takes-store.js';
export {
  DEFAULT_VOICE_PAUSES,
  type SpeechGenerator,
  type VoiceGenerationSettings,
} from './session.js';
export {
  generateVoiceover,
  pendingCharacters,
  type GenerateVoiceoverOptions,
  type VoiceProgress,
  type VoiceoverResult,
} from './generate.js';
export {
  retakeSentence,
  shotImpact,
  type RetakeOptions,
  type RetakeResult,
  type ShotImpact,
  type ShotSpan,
  type TimeRange,
} from './retake.js';
