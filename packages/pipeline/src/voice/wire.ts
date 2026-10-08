/**
 * Response shapes of the ElevenLabs endpoints the app calls (docs/spikes/elevenlabs-api.md).
 * Loose objects: unknown fields are ignored, so vendor additions never break parsing; only the
 * fields the app reads are required. Also the request body and header/alignment conversions.
 */
import { z } from 'zod';
import type { TtsVoiceSettings, VoiceCharAlignment } from '@reelforge/shared';

export const subscriptionResponseSchema = z.looseObject({
  tier: z.string(),
  status: z.string().nullish(),
  character_count: z.number().nonnegative(),
  character_limit: z.number().nonnegative(),
  next_character_count_reset_unix: z.number().nullish(),
});

const voiceSchema = z.looseObject({
  voice_id: z.string().min(1),
  name: z.string(),
  category: z.string().nullish(),
  labels: z.record(z.string(), z.unknown()).nullish(),
  preview_url: z.string().nullish(),
});

export const voicesPageSchema = z.looseObject({
  voices: z.array(voiceSchema),
  has_more: z.boolean().nullish(),
  next_page_token: z.string().nullish(),
});

const alignmentSchema = z
  .looseObject({
    characters: z.array(z.string()),
    character_start_times_seconds: z.array(z.number()),
    character_end_times_seconds: z.array(z.number()),
  })
  .refine(
    (alignment) =>
      alignment.character_start_times_seconds.length === alignment.characters.length &&
      alignment.character_end_times_seconds.length === alignment.characters.length,
    { message: 'alignment arrays differ in length' },
  );

export const timestampsResponseSchema = z.looseObject({
  audio_base64: z.string().min(1),
  alignment: alignmentSchema.nullish(),
  normalized_alignment: alignmentSchema.nullish(),
});

export interface GenerateSpeechRequest {
  readonly voiceId: string;
  readonly text: string;
  readonly modelId: string;
  readonly outputFormat: string;
  readonly voiceSettings?: TtsVoiceSettings;
  readonly seed?: number | null;
  /** Ignored by the vendor when `previousRequestIds` is given, so it is then not sent. */
  readonly previousText?: string;
  readonly nextText?: string;
  /** At most 3, oldest first. */
  readonly previousRequestIds?: readonly string[];
  readonly nextRequestIds?: readonly string[];
  /** Use `/with-timestamps` (JSON with base64 audio + character alignment). */
  readonly withTimestamps?: boolean;
}

export interface GeneratedSpeech {
  readonly audio: Uint8Array;
  readonly requestId: string | null;
  readonly characterCost: number | null;
  readonly alignment: VoiceCharAlignment | null;
  readonly normalizedAlignment: VoiceCharAlignment | null;
}

function snakeSettings(settings: TtsVoiceSettings): Record<string, number | boolean> {
  const out: Record<string, number | boolean> = {};
  if (settings.stability !== undefined) out['stability'] = settings.stability;
  if (settings.similarityBoost !== undefined) out['similarity_boost'] = settings.similarityBoost;
  if (settings.style !== undefined) out['style'] = settings.style;
  if (settings.speed !== undefined) out['speed'] = settings.speed;
  if (settings.useSpeakerBoost !== undefined) out['use_speaker_boost'] = settings.useSpeakerBoost;
  return out;
}

/** JSON body of a TTS request (spike rule: context text only when no request ids replace it). */
export function speechRequestBody(request: GenerateSpeechRequest): Record<string, unknown> {
  const body: Record<string, unknown> = { text: request.text, model_id: request.modelId };
  if (request.voiceSettings !== undefined) {
    const settings = snakeSettings(request.voiceSettings);
    if (Object.keys(settings).length > 0) body['voice_settings'] = settings;
  }
  if (request.seed !== undefined && request.seed !== null) body['seed'] = request.seed;
  const previousIds = request.previousRequestIds ?? [];
  const nextIds = request.nextRequestIds ?? [];
  if (previousIds.length > 0) body['previous_request_ids'] = [...previousIds];
  else if (request.previousText !== undefined && request.previousText !== '') {
    body['previous_text'] = request.previousText;
  }
  if (nextIds.length > 0) body['next_request_ids'] = [...nextIds];
  else if (request.nextText !== undefined && request.nextText !== '') {
    body['next_text'] = request.nextText;
  }
  return body;
}

export function stringLabels(
  labels: Readonly<Record<string, unknown>> | null | undefined,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(labels ?? {}).filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string',
    ),
  );
}

export function headerNumber(value: string | null): number | null {
  if (value === null || value.trim() === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

export function toAlignment(
  wire: z.infer<typeof timestampsResponseSchema>['alignment'],
): VoiceCharAlignment | null {
  if (wire === null || wire === undefined) return null;
  const nonNegative = (value: number): number => Math.max(0, value);
  return {
    characters: wire.characters,
    starts: wire.character_start_times_seconds.map(nonNegative),
    ends: wire.character_end_times_seconds.map(nonNegative),
  };
}
