/** "Voice changed — timing out of date" per shot: the pure derivation and the project reader. */
import { mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { WordsFile } from '@reelforge/pipeline';
import { VOICE_TAKES_FILE_VERSION, type VoiceTakesFile } from '@reelforge/shared';
import { afterEach, describe, expect, it } from 'vitest';
import { readVoiceTiming, staleVoiceTiming, type VoiceTimingInput } from './voice-timing.js';

const HASH = 'a'.repeat(64);
const VOICE_SHA = 'b'.repeat(64);
const WORDS_WRITTEN = Date.parse('2026-10-07T10:00:00.000Z');
const BEFORE = '2026-10-07T09:00:00.000Z';
const AFTER = '2026-10-07T11:00:00.000Z';

function take(chunkId: string, n: number, createdAt: string): VoiceTakesFile['takes'][number] {
  return {
    id: `${chunkId}-${String(n)}`,
    chunkId,
    n,
    file: `audio/takes/${chunkId}-${String(n)}.mp3`,
    textSha256: HASH,
    characters: 20,
    voiceId: 'voice-a',
    modelId: 'eleven_multilingual_v2',
    voiceSettings: {},
    seed: null,
    outputFormat: 'mp3_44100_128',
    requestId: null,
    characterCost: null,
    alignmentFile: null,
    durationS: 2,
    createdAt,
  };
}

/** Three paragraphs of two words each; p01a was redone (take 2) at `redoneAt`. */
function manifest(redoneAt: string): VoiceTakesFile {
  const chunk = (paragraph: number, active: string): VoiceTakesFile['chunks'][number] => ({
    id: `p0${String(paragraph)}a`,
    paragraph,
    part: 0,
    sentenceIds: [`p0${String(paragraph)}-s00`, `p0${String(paragraph)}-s01`],
    firstWord: paragraph * 2,
    wordCount: 2,
    textSha256: HASH,
    activeTakeId: active,
  });
  return {
    version: VOICE_TAKES_FILE_VERSION,
    provider: 'elevenlabs',
    scriptSha256: HASH,
    voiceId: 'voice-a',
    modelId: 'eleven_multilingual_v2',
    pauses: { paragraphS: 0.6, sentenceS: 0.25 },
    chunks: [chunk(0, 'p00a-1'), chunk(1, 'p01a-2'), chunk(2, 'p02a-1')],
    takes: [
      take('p00a', 1, BEFORE),
      take('p01a', 1, BEFORE),
      take('p01a', 2, redoneAt),
      take('p02a', 1, BEFORE),
    ],
    output: {
      file: 'audio/vo.original.wav',
      sha256: VOICE_SHA,
      sampleRate: 44_100,
      durationS: 7.2,
      timeline: [
        { chunkId: 'p00a', takeId: 'p00a-1', start: 0, end: 2 },
        { chunkId: 'p01a', takeId: 'p01a-2', start: 2.6, end: 4.9 },
        { chunkId: 'p02a', takeId: 'p02a-1', start: 5.5, end: 7.2 },
      ],
    },
  };
}

function words(count = 6): WordsFile {
  return {
    version: 1,
    lang: 'en',
    asrModel: null,
    words: Array.from({ length: count }, (_, i) => ({
      i,
      text: `w${String(i)}`,
      paragraph: Math.floor(i / 2),
      t: i * 1.2,
      tEnd: i * 1.2 + 0.8,
      confidence: 1,
      status: 'exact' as const,
    })),
    mismatches: [],
    stats: {
      scriptWords: count,
      asrWords: count,
      wer: 0,
      werFolded: 0,
      exact: count,
      folded: 0,
      fuzzy: 0,
      missing: 0,
      coverage: 1,
      timedShare: 1,
      insertions: 0,
      monotonic: true,
      clamped: 0,
    },
  };
}

// p01 words: i=2 at 2.4..3.2, i=3 at 3.6..4.4 -> shots s02 (2..3) and s03 (3..5) overlap.
const SHOTS = [
  { id: 's01', t0: 0, t1: 2 },
  { id: 's02', t0: 2, t1: 3 },
  { id: 's03', t0: 3, t1: 5 },
  { id: 's04', t0: 5, t1: 8 },
];

function input(overrides: Partial<VoiceTimingInput> = {}): VoiceTimingInput {
  return {
    manifest: manifest(AFTER),
    voiceoverSha256: VOICE_SHA,
    words: words(),
    wordsWrittenMs: WORDS_WRITTEN,
    shots: SHOTS,
    ...overrides,
  };
}

describe('staleVoiceTiming', () => {
  it('marks the shots under a paragraph redone after the words were timed', () => {
    expect(staleVoiceTiming(input())).toEqual({
      shotIds: ['s02', 's03'],
      sentenceIds: ['p01-s00', 'p01-s01'],
      changedAt: AFTER,
    });
  });

  it('clears once the words are newer than every active take (Re-time ran)', () => {
    expect(staleVoiceTiming(input({ wordsWrittenMs: Date.parse(AFTER) + 1 }))).toBeNull();
    expect(staleVoiceTiming(input({ manifest: manifest(BEFORE) }))).toBeNull();
  });

  it('says nothing without timed words, a generated voice or with another voice-over in use', () => {
    expect(staleVoiceTiming(input({ words: null }))).toBeNull();
    expect(staleVoiceTiming(input({ wordsWrittenMs: null }))).toBeNull();
    expect(staleVoiceTiming(input({ manifest: null }))).toBeNull();
    expect(staleVoiceTiming(input({ manifest: { ...manifest(AFTER), output: null } }))).toBeNull();
    expect(staleVoiceTiming(input({ voiceoverSha256: 'c'.repeat(64) }))).toBeNull();
  });

  it("falls back to the take's place in the voice-over when its words are not timed", () => {
    // Only p00's words exist: p01a sits at 2.6..4.9 in the assembled file.
    expect(staleVoiceTiming(input({ words: words(2) }))?.shotIds).toEqual(['s02', 's03']);
  });

  it('keeps the sentences when no storyboard shot is under them yet', () => {
    expect(staleVoiceTiming(input({ shots: [] }))).toMatchObject({
      shotIds: [],
      sentenceIds: ['p01-s00', 'p01-s01'],
    });
  });
});

describe('readVoiceTiming', () => {
  const dirs: string[] = [];
  afterEach(() => {
    for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
  });

  function project(): string {
    const dir = mkdtempSync(path.join(os.tmpdir(), 'rf voice timing ż '));
    dirs.push(dir);
    const files: Record<string, unknown> = {
      'audio/takes/takes.json': manifest(AFTER),
      '.reelforge/voiceover.json': {
        version: 1,
        file: 'audio/vo.original.wav',
        sha256: VOICE_SHA,
        sourceName: 'elevenlabs-voiceover.wav',
        importedAt: AFTER,
        durationS: 7.2,
        previous: null,
      },
      'timing/words.json': words(),
      'storyboard.json': {
        version: 1,
        shots: SHOTS.map((shot) => ({
          ...shot,
          treatment: 'title-card',
          intent: 'x',
          scene: `scenes/${shot.id}.js`,
        })),
      },
    };
    for (const [relative, value] of Object.entries(files)) {
      const file = path.join(dir, ...relative.split('/'));
      mkdirSync(path.dirname(file), { recursive: true });
      writeFileSync(file, JSON.stringify(value), 'utf8');
    }
    return dir;
  }

  it('compares the active takes with the time timing/words.json was written', async () => {
    const dir = project();
    const wordsFile = path.join(dir, 'timing', 'words.json');
    utimesSync(wordsFile, WORDS_WRITTEN / 1000, WORDS_WRITTEN / 1000);
    expect(await readVoiceTiming(dir)).toMatchObject({ shotIds: ['s02', 's03'] });
    const retimed = (Date.parse(AFTER) + 60_000) / 1000;
    utimesSync(wordsFile, retimed, retimed);
    expect(await readVoiceTiming(dir)).toBeNull();
  });

  it('is null for a project without generated takes', async () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), 'rf voice timing none '));
    dirs.push(dir);
    expect(await readVoiceTiming(dir)).toBeNull();
  });
});
