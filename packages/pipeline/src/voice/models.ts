/**
 * ElevenLabs models the voice generation knows (docs/spikes/elevenlabs-api.md §2, docs/voice.md).
 * Per-request character caps are VERIFIED on the vendor's models page; credit multipliers are
 * UNVERIFIED defaults that the first real request calibrates from the `character-cost` header.
 */

export const DEFAULT_VOICE_MODEL = 'eleven_multilingual_v2';

export interface VoiceModelSpec {
  readonly id: string;
  /** Max characters per request. */
  readonly maxChars: number;
  /** Credits per character (UNVERIFIED default). */
  readonly costMultiplier: number;
  /** Accepts `previous_request_ids` / `next_request_ids`. */
  readonly stitching: boolean;
}

export const VOICE_MODELS: Readonly<Record<string, VoiceModelSpec>> = {
  eleven_multilingual_v2: {
    id: 'eleven_multilingual_v2',
    maxChars: 10_000,
    costMultiplier: 1,
    stitching: true,
  },
  eleven_v4: { id: 'eleven_v4', maxChars: 10_000, costMultiplier: 1, stitching: true },
  eleven_v3: { id: 'eleven_v3', maxChars: 5_000, costMultiplier: 1, stitching: false },
  eleven_flash_v2_5: {
    id: 'eleven_flash_v2_5',
    maxChars: 40_000,
    costMultiplier: 0.5,
    stitching: true,
  },
  eleven_flash_v2: {
    id: 'eleven_flash_v2',
    maxChars: 30_000,
    costMultiplier: 0.5,
    stitching: true,
  },
};

/** Conservative spec for a model id this build does not know. */
const UNKNOWN_MODEL: Omit<VoiceModelSpec, 'id'> = {
  maxChars: 5_000,
  costMultiplier: 1,
  stitching: false,
};

export function voiceModelSpec(modelId: string): VoiceModelSpec {
  return VOICE_MODELS[modelId] ?? { id: modelId, ...UNKNOWN_MODEL };
}

/** Share of the per-request cap a chunk may use (headroom for vendor-side counting). */
export const CHUNK_CAP_SHARE = 0.8;

export function chunkCharBudget(modelId: string): number {
  return Math.floor(voiceModelSpec(modelId).maxChars * CHUNK_CAP_SHARE);
}

/** Request ids older than this cannot be used for stitching (VERIFIED: 2 hours). */
export const REQUEST_ID_TTL_MS = 2 * 60 * 60 * 1000;
/** Max ids in `previous_request_ids` / `next_request_ids` (VERIFIED). */
export const MAX_STITCH_IDS = 3;

export type OutputFormat = 'mp3_44100_128' | 'mp3_44100_192' | 'pcm_44100';

const PCM_TIERS = ['pro', 'scale', 'growing_business', 'business', 'enterprise'];
const MP3_192_TIERS = ['creator', ...PCM_TIERS];

function tierIn(tier: string, list: readonly string[]): boolean {
  const lower = tier.toLowerCase();
  return list.some((entry) => lower === entry || lower.startsWith(`${entry}_`));
}

/**
 * Best format the tier allows (VERIFIED gates: pcm 44.1 kHz needs Pro+, mp3 192 kbps Creator+):
 * lossless pcm when possible, so the take is never a lossy generation, else the best mp3.
 */
export function pickOutputFormat(tier: string): OutputFormat {
  if (tierIn(tier, PCM_TIERS)) return 'pcm_44100';
  if (tierIn(tier, MP3_192_TIERS)) return 'mp3_44100_192';
  return 'mp3_44100_128';
}

/** File extension a take of `format` is stored with (pcm is wrapped in a WAV header). */
export function takeExtension(format: string): string {
  if (format.startsWith('pcm_') || format.startsWith('wav_')) return 'wav';
  if (format.startsWith('opus_')) return 'opus';
  return 'mp3';
}

/** Sample rate of a `pcm_<rate>` / `wav_<rate>` format; null for compressed formats. */
export function pcmSampleRate(format: string): number | null {
  const match = /^(?:pcm|wav)_(\d+)$/.exec(format);
  return match?.[1] === undefined ? null : Number(match[1]);
}
