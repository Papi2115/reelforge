/**
 * IPC payloads of ElevenLabs voice generation in the Voiceover step (PLAN.md#13.14, ADR-033):
 * the panel state (is the project's channel ready: voice + key; the generated sentences), the
 * cost estimate before spending characters, Generate with progress pushes and Cancel, "Redo this
 * sentence" and the key test of a channel. The API key never appears in any payload: main reads
 * it from the channel secret store and only answers with plain-English results. Merged into
 * ipc-contract.ts.
 */
import { channelIdSchema } from '@reelforge/shared';
import { z } from 'zod';

/** Why a voice request could not run, in words the panel can show as they are. */
export const VOICE_PROBLEM_KINDS = [
  'no-project',
  /** The project's channel has no ElevenLabs voice chosen. */
  'no-voice',
  /** No API key saved for the project's channel. */
  'no-key',
  /** ElevenLabs refused the key (401). */
  'key-rejected',
  /** Out of credits / payment required / quota exceeded (402). */
  'quota',
  /** The key lacks a permission (403). */
  'forbidden',
  /** Still rate limited after the retries (429). */
  'rate-limited',
  /** ElevenLabs cannot be reached / timed out / server error. */
  'network',
  'not-approved',
  /** Another voice job or the Voiceover step is running. */
  'busy',
  /** takes.json no longer matches the script (Generate again first). */
  'script-changed',
  'failed',
] as const;
export const voiceProblemKindSchema = z.enum(VOICE_PROBLEM_KINDS);
export type VoiceProblemKind = z.infer<typeof voiceProblemKindSchema>;

const voiceProblemSchema = z.object({
  status: z.literal('error'),
  kind: voiceProblemKindSchema,
  message: z.string(),
});
export type VoiceProblem = z.infer<typeof voiceProblemSchema>;

/** Is the project's channel ready to generate (voice chosen + key saved)? No network. */
export const voiceSetupSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('ready'),
    channelId: z.string(),
    channelName: z.string(),
    voiceId: z.string(),
    model: z.string(),
  }),
  z.object({
    status: z.literal('missing'),
    channelId: z.string(),
    channelName: z.string(),
    missing: z.array(z.enum(['voice', 'key'])).min(1),
  }),
  /** No project / channels unreadable: Generate is not offered. */
  z.object({ status: z.literal('unavailable'), message: z.string() }),
]);
export type VoiceSetup = z.infer<typeof voiceSetupSchema>;

export const VOICE_PHASES = ['generating', 'retaking', 'importing'] as const;

/** Live progress of a voice job (pushed while it runs, also part of the panel state). */
export const voiceProgressSchema = z.object({
  projectDir: z.string(),
  phase: z.enum(VOICE_PHASES),
  /** Paragraphs finished (generated or reused). */
  done: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
  /** Characters sent so far in this run. */
  characters: z.number().int().nonnegative(),
  /** Characters taken from the quota so far (estimate: characters x model multiplier). */
  costSoFar: z.number().int().nonnegative(),
  /** e.g. "ElevenLabs is busy (rate limited), retrying in 4 s…"; null when all is well. */
  note: z.string().nullable(),
  /** The job finished (any outcome); the panel reloads its state. */
  finished: z.boolean(),
});
export type VoiceProgress = z.infer<typeof voiceProgressSchema>;

export const voiceSentenceSchema = z.object({
  /** `p03-s01` (paragraph 3, sentence 1). */
  id: z.string(),
  paragraph: z.number().int().nonnegative(),
  text: z.string(),
  /** Seconds in the generated voice-over; null when unknown. */
  start: z.number().nonnegative().nullable(),
  end: z.number().nonnegative().nullable(),
  /** Takes made of its paragraph so far (1 = never redone). */
  takes: z.number().int().nonnegative(),
  /** Characters a redo sends (the whole paragraph is spoken again). */
  redoCharacters: z.number().int().nonnegative(),
});
export type VoiceSentence = z.infer<typeof voiceSentenceSchema>;

export const voiceStateSchema = z.object({
  setup: voiceSetupSchema,
  /** The voice-over in use is the one Generate made (the sentence list applies to it). */
  generated: z.boolean(),
  /** A generated voice exists but the script changed since. */
  scriptChanged: z.boolean(),
  /** Project-relative audio the sentence times refer to. */
  audioFile: z.string().nullable(),
  sentences: z.array(voiceSentenceSchema).max(5_000),
  running: voiceProgressSchema.nullable(),
});
export type VoiceState = z.infer<typeof voiceStateSchema>;

export const voiceEstimateResultSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('ok'),
    /** Characters of the whole script. */
    characters: z.number().int().nonnegative(),
    /** Characters this Generate would send (paragraphs without a reusable take). */
    pendingCharacters: z.number().int().nonnegative(),
    paragraphs: z.number().int().nonnegative(),
    reusedParagraphs: z.number().int().nonnegative(),
    /** Quota the run is expected to take (pending x model multiplier, rounded up). */
    estimatedCredits: z.number().int().nonnegative(),
    remaining: z.number().nonnegative().nullable(),
    /** estimatedCredits / remaining; null when the quota is unknown or empty. */
    share: z.number().nonnegative().nullable(),
    /** The engine's one-line summary ("about 5,400 characters (35% of your remaining 15,000)"). */
    summary: z.string(),
    /** Set when the run would not fit in the quota left. */
    warning: z.string().nullable(),
    /** Why the quota is unknown (offline, …); null when it was read. */
    quotaNote: z.string().nullable(),
  }),
  voiceProblemSchema,
]);
export type VoiceEstimateResult = z.infer<typeof voiceEstimateResultSchema>;

export const voiceGenerateResultSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('ok'),
    generatedParagraphs: z.number().int().nonnegative(),
    reusedParagraphs: z.number().int().nonnegative(),
    characters: z.number().int().nonnegative(),
    message: z.string(),
  }),
  z.object({ status: z.literal('cancelled'), message: z.string() }),
  voiceProblemSchema,
]);
export type VoiceGenerateResult = z.infer<typeof voiceGenerateResultSchema>;

export const voiceRetakeResultSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('ok'),
    /** Sentences spoken again (the whole paragraph). */
    sentenceIds: z.array(z.string()),
    /** Shots under the re-spoken paragraph: rebuild these. */
    changedShotIds: z.array(z.string()),
    /** Later shots that only move by `shiftS`. */
    shiftedShotIds: z.array(z.string()),
    shiftS: z.number(),
    characters: z.number().int().nonnegative(),
  }),
  z.object({ status: z.literal('cancelled'), message: z.string() }),
  voiceProblemSchema,
]);
export type VoiceRetakeResult = z.infer<typeof voiceRetakeResultSchema>;

export const voiceTestKeyResultSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('ok'),
    tier: z.string(),
    remaining: z.number().nonnegative(),
    limit: z.number().nonnegative(),
    /** `YYYY-MM-DD` of the next quota reset, null when unknown. */
    resetsOn: z.string().nullable(),
  }),
  voiceProblemSchema,
]);
export type VoiceTestKeyResult = z.infer<typeof voiceTestKeyResultSchema>;

const noPayload = z.null();

export const VOICE_IPC = {
  voiceListSentences: {
    name: 'voice:list-sentences',
    request: noPayload,
    response: voiceStateSchema,
  },
  /** Reads the account quota (network) when the channel has a key; works offline. */
  voiceEstimate: {
    name: 'voice:estimate',
    request: noPayload,
    response: voiceEstimateResultSchema,
  },
  /** Generates the whole voice-over; resolves when done (progress comes as pushes). */
  voiceGenerate: {
    name: 'voice:generate',
    request: noPayload,
    response: voiceGenerateResultSchema,
  },
  voiceCancel: { name: 'voice:cancel', request: noPayload, response: z.boolean() },
  voiceRetake: {
    name: 'voice:retake',
    request: z.strictObject({ sentenceId: z.string().regex(/^p\d{2,}-s\d{2,}$/) }),
    response: voiceRetakeResultSchema,
  },
  voiceTestKey: {
    name: 'voice:test-key',
    request: z.strictObject({ channelId: channelIdSchema }),
    response: voiceTestKeyResultSchema,
  },
} as const;

export const VOICE_PUSH = {
  voiceProgress: { name: 'voice:progress', payload: voiceProgressSchema },
} as const;

export interface VoiceApi {
  getVoiceState(): Promise<VoiceState>;
  estimateVoice(): Promise<VoiceEstimateResult>;
  generateVoice(): Promise<VoiceGenerateResult>;
  cancelVoice(): Promise<boolean>;
  retakeSentence(sentenceId: string): Promise<VoiceRetakeResult>;
  /** Checks a channel's saved key with ElevenLabs (the key itself never leaves main). */
  testVoiceKey(channelId: string): Promise<VoiceTestKeyResult>;
  /** Subscribes to `voiceProgress`; returns the unsubscribe function. */
  onVoiceProgress(listener: (progress: VoiceProgress) => void): () => void;
}
