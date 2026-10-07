import { describe, expect, it } from 'vitest';
import {
  VOICE_TAKES_FILE_VERSION,
  voiceAlignmentFileSchema,
  voiceTakesFileSchema,
  type VoiceTakesFile,
} from './takes.js';

const HASH = 'a'.repeat(64);

function manifest(): VoiceTakesFile {
  return {
    version: VOICE_TAKES_FILE_VERSION,
    provider: 'elevenlabs',
    scriptSha256: HASH,
    voiceId: 'voice-a',
    modelId: 'eleven_multilingual_v2',
    pauses: { paragraphS: 0.6, sentenceS: 0.25 },
    chunks: [
      {
        id: 'p00a',
        paragraph: 0,
        part: 0,
        sentenceIds: ['p00-s00'],
        firstWord: 0,
        wordCount: 4,
        textSha256: HASH,
        activeTakeId: 'p00a-2',
      },
    ],
    takes: [1, 2].map((n) => ({
      id: `p00a-${String(n)}`,
      chunkId: 'p00a',
      n,
      file: `audio/takes/p00a-${String(n)}.mp3`,
      textSha256: HASH,
      characters: 29,
      voiceId: 'voice-a',
      modelId: 'eleven_multilingual_v2',
      voiceSettings: { stability: 0.5 },
      seed: null,
      outputFormat: 'mp3_44100_128',
      requestId: `req-${String(n)}`,
      characterCost: 29,
      alignmentFile: null,
      durationS: 1.5,
      createdAt: '2026-10-07T10:00:00.000Z',
    })),
    output: {
      file: 'audio/vo.original.wav',
      sha256: HASH,
      sampleRate: 44_100,
      durationS: 1.5,
      timeline: [{ chunkId: 'p00a', takeId: 'p00a-2', start: 0, end: 1.5 }],
    },
  };
}

describe('voiceTakesFileSchema', () => {
  it('accepts a valid manifest', () => {
    expect(voiceTakesFileSchema.parse(manifest())).toEqual(manifest());
  });

  it('rejects an active take of another chunk, a wrong take id and Windows paths', () => {
    const wrongActive = manifest();
    expect(
      voiceTakesFileSchema.safeParse({
        ...wrongActive,
        chunks: wrongActive.chunks.map((chunk) => ({ ...chunk, activeTakeId: 'p01a-1' })),
      }).success,
    ).toBe(false);
    const base = manifest();
    const [first, second] = base.takes;
    if (first === undefined || second === undefined) throw new Error('fixture');
    expect(
      voiceTakesFileSchema.safeParse({ ...base, takes: [{ ...first, n: 3 }, second] }).success,
    ).toBe(false);
    expect(
      voiceTakesFileSchema.safeParse({
        ...base,
        takes: [{ ...first, file: 'audio\\takes\\x.mp3' }, second],
      }).success,
    ).toBe(false);
    expect(voiceTakesFileSchema.safeParse({ ...base, takes: [first, first] }).success).toBe(false);
  });
});

describe('voiceAlignmentFileSchema', () => {
  it('requires equal array lengths', () => {
    const file = {
      version: 1,
      takeId: 'p00a-1',
      alignment: { characters: ['H', 'i'], starts: [0, 0.1], ends: [0.1, 0.2] },
      normalized: null,
    };
    expect(voiceAlignmentFileSchema.safeParse(file).success).toBe(true);
    expect(
      voiceAlignmentFileSchema.safeParse({ ...file, alignment: { ...file.alignment, ends: [0.1] } })
        .success,
    ).toBe(false);
  });
});
