/**
 * Channel voice -> ElevenLabs generation settings (PLAN.md#13.14), pure. The channel stores the
 * slider names of Settings → Channels (`similarity`); the vendor's field is `similarity_boost`
 * (the engine's `similarityBoost`). The model defaults to the engine's default model. Films are
 * English; the paragraph pauses and stitching are the engine defaults (docs/voice.md).
 */
import {
  DEFAULT_VOICE_MODEL,
  DEFAULT_VOICE_PAUSES,
  pickOutputFormat,
  type VoiceGenerationSettings,
} from '@reelforge/pipeline';
import type { ChannelVoice, TtsVoiceSettings } from '@reelforge/shared';

/** Output format when the tier is unknown (offline estimate): the format every plan allows. */
export const FALLBACK_OUTPUT_FORMAT = 'mp3_44100_128';

/** The channel's slider values in the engine's (vendor's) names; unset sliders stay unset. */
export function ttsVoiceSettings(voice: ChannelVoice | undefined): TtsVoiceSettings {
  const settings = voice?.settings;
  return {
    ...(settings?.stability === undefined ? {} : { stability: settings.stability }),
    ...(settings?.similarity === undefined ? {} : { similarityBoost: settings.similarity }),
    ...(settings?.style === undefined ? {} : { style: settings.style }),
    ...(settings?.speed === undefined ? {} : { speed: settings.speed }),
  };
}

export function voiceModelOf(voice: ChannelVoice | undefined): string {
  return voice?.model ?? DEFAULT_VOICE_MODEL;
}

/** The chosen voice id, or undefined when the channel has none (or another provider). */
export function voiceIdOf(voice: ChannelVoice | undefined): string | undefined {
  if (voice?.provider !== 'elevenlabs') return undefined;
  const id = voice.voiceId?.trim() ?? '';
  return id === '' ? undefined : id;
}

/**
 * Settings of a Generate / Retake run. `outputFormat`: from the account tier
 * (`pickOutputFormat`) or, without a tier, the format the existing takes used (so an offline
 * estimate still recognises them as reusable).
 */
export function generationSettings(
  voiceId: string,
  voice: ChannelVoice | undefined,
  outputFormat: string,
): VoiceGenerationSettings {
  return {
    voiceId,
    modelId: voiceModelOf(voice),
    voiceSettings: ttsVoiceSettings(voice),
    seed: null,
    outputFormat,
    withTimestamps: true,
    pauses: DEFAULT_VOICE_PAUSES,
    stitching: 'request-ids',
    parallel: 1,
  };
}

/** Format for a tier, else the newest take's format, else the format every plan allows. */
export function outputFormatFor(tier: string | null, lastTakeFormat: string | null): string {
  if (tier !== null) return pickOutputFormat(tier);
  return lastTakeFormat ?? FALLBACK_OUTPUT_FORMAT;
}
