import { describe, expect, it } from 'vitest';
import type { VoiceError } from '@reelforge/pipeline';
import { retryNote, voiceProblem } from './voice-errors.js';
import {
  FALLBACK_OUTPUT_FORMAT,
  generationSettings,
  outputFormatFor,
  ttsVoiceSettings,
  voiceIdOf,
  voiceModelOf,
} from './voice-settings.js';
import { elevenLabsTestUrl } from './test-hooks.js';

describe('channel voice -> generation settings', () => {
  it('maps the channel sliders to the vendor names (similarity -> similarityBoost)', () => {
    expect(
      ttsVoiceSettings({
        provider: 'elevenlabs',
        voiceId: 'v1',
        settings: { stability: 0.4, similarity: 0.8, style: 0.1, speed: 1.1 },
      }),
    ).toEqual({ stability: 0.4, similarityBoost: 0.8, style: 0.1, speed: 1.1 });
    expect(ttsVoiceSettings({ provider: 'elevenlabs', settings: { similarity: 0.7 } })).toEqual({
      similarityBoost: 0.7,
    });
    expect(ttsVoiceSettings(undefined)).toEqual({});
  });

  it('defaults the model and needs a voice id', () => {
    expect(voiceModelOf(undefined)).toBe('eleven_multilingual_v2');
    expect(voiceModelOf({ provider: 'elevenlabs', model: 'eleven_v3' })).toBe('eleven_v3');
    expect(voiceIdOf({ provider: 'elevenlabs', voiceId: '  ' })).toBeUndefined();
    expect(voiceIdOf({ provider: 'elevenlabs', voiceId: 'abc' })).toBe('abc');
    expect(voiceIdOf(undefined)).toBeUndefined();
  });

  it('builds sequential, stitched, timestamped settings', () => {
    expect(
      generationSettings(
        'v1',
        { provider: 'elevenlabs', settings: { stability: 0.5 } },
        'pcm_44100',
      ),
    ).toEqual({
      voiceId: 'v1',
      modelId: 'eleven_multilingual_v2',
      voiceSettings: { stability: 0.5 },
      seed: null,
      outputFormat: 'pcm_44100',
      withTimestamps: true,
      pauses: { paragraphS: 0.6, sentenceS: 0.25 },
      stitching: 'request-ids',
      parallel: 1,
    });
  });

  it('picks the output format from the tier, else the last take, else the safe default', () => {
    expect(outputFormatFor('pro', null)).toBe('pcm_44100');
    expect(outputFormatFor('creator', 'pcm_44100')).toBe('mp3_44100_192');
    expect(outputFormatFor(null, 'pcm_44100')).toBe('pcm_44100');
    expect(outputFormatFor(null, null)).toBe(FALLBACK_OUTPUT_FORMAT);
  });
});

describe('voice errors in plain words', () => {
  const error = (kind: VoiceError['kind'], message = 'HTTP 500: boom'): VoiceError => ({
    kind,
    message,
  });

  it('names the problem the user can act on', () => {
    expect(voiceProblem(error('auth'), 'k').kind).toBe('key-rejected');
    expect(voiceProblem(error('payment'), 'k').kind).toBe('quota');
    expect(voiceProblem(error('forbidden'), 'k').kind).toBe('forbidden');
    expect(voiceProblem(error('rate-limit'), 'k').kind).toBe('rate-limited');
    for (const kind of ['network', 'timeout', 'server', 'http'] as const) {
      expect(voiceProblem(error(kind), 'k').kind).toBe('network');
    }
    expect(voiceProblem(error('stale-manifest'), 'k').kind).toBe('script-changed');
    expect(voiceProblem(error('decode'), 'k')).toEqual({
      status: 'error',
      kind: 'failed',
      message: 'Voice generation failed (HTTP 500: boom).',
    });
  });

  it('redacts the key once more', () => {
    const leaked = voiceProblem(error('network', 'connect failed for sk_SECRET_1'), 'sk_SECRET_1');
    expect(leaked.message).not.toContain('sk_SECRET_1');
    expect(leaked.message).toContain('[redacted]');
  });

  it('writes a retry note', () => {
    expect(retryNote(error('rate-limit'), 3_600)).toBe(
      'ElevenLabs is busy (rate limited), retrying in 4 s…',
    );
    expect(retryNote(error('network'), 100)).toBe(
      'The connection to ElevenLabs failed, retrying in 1 s…',
    );
  });
});

describe('ElevenLabs test hook', () => {
  it('only takes a loopback URL with the hooks on', () => {
    const env = { REELFORGE_TEST_ELEVENLABS_URL: 'http://127.0.0.1:4321' };
    expect(elevenLabsTestUrl(env, true)).toBe('http://127.0.0.1:4321');
    expect(elevenLabsTestUrl(env, false)).toBeUndefined();
    expect(
      elevenLabsTestUrl({ REELFORGE_TEST_ELEVENLABS_URL: 'https://evil.example' }, true),
    ).toBeUndefined();
    expect(elevenLabsTestUrl({}, true)).toBeUndefined();
  });
});
