import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { voiceTakesFileSchema } from '@reelforge/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { WordsFileSchema } from '../schemas/words.js';
import { tokenizeScript } from '../text/normalize.js';
import { createTakeDecoder, decodeWavBytes } from './audio.js';
import { ElevenLabsClient } from './client.js';
import { generateVoiceover, pendingCharacters } from './generate.js';
import { retakeSentence, shotImpact } from './retake.js';
import { DEFAULT_VOICE_PAUSES, type VoiceGenerationSettings } from './session.js';
import { VOICE_FILES } from './takes-store.js';
import { startFakeElevenLabs, type FakeElevenLabs } from './testing/fake-elevenlabs.js';

const KEY = 'sk_test_key_for_generation';
const SCRIPT = [
  'Doom runs on almost anything.',
  'But this one is special. It is a calculator.',
  'If it has a screen, it runs Doom.',
].join('\n\n');

const SETTINGS: VoiceGenerationSettings = {
  voiceId: 'voice-a',
  modelId: 'eleven_multilingual_v2',
  voiceSettings: { stability: 0.5 },
  seed: 42,
  outputFormat: 'pcm_44100',
  withTimestamps: true,
  pauses: DEFAULT_VOICE_PAUSES,
  stitching: 'request-ids',
  parallel: 1,
};

let fake: FakeElevenLabs;
let projectDir = '';
let clock = Date.parse('2026-10-07T10:00:00.000Z');
const now = (): Date => new Date(clock);

beforeEach(async () => {
  fake = await startFakeElevenLabs({ apiKey: KEY, secondsPerChar: 0.02 });
  projectDir = await mkdtemp(path.join(os.tmpdir(), 'reelforge voice project '));
  clock = Date.parse('2026-10-07T10:00:00.000Z');
});

afterEach(async () => {
  await fake.close();
  await rm(projectDir, { recursive: true, force: true });
});

function client(): ElevenLabsClient {
  return new ElevenLabsClient({
    apiKey: KEY,
    baseUrl: fake.url,
    retry: { maxAttempts: 2, baseDelayMs: 1 },
    sleep: () => Promise.resolve(true),
  });
}

function run(script = SCRIPT, settings: VoiceGenerationSettings = SETTINGS) {
  return generateVoiceover({
    projectDir,
    scriptText: script,
    settings,
    client: client(),
    decoder: createTakeDecoder(null),
    now,
  });
}

const ttsBodies = (): Record<string, unknown>[] =>
  fake.requests
    .filter((request) => request.method === 'POST')
    .map((request) => request.body as Record<string, unknown>);

async function readManifest() {
  const text = await readFile(path.join(projectDir, 'audio', 'takes', 'takes.json'), 'utf8');
  return voiceTakesFileSchema.parse(JSON.parse(text));
}

describe('generateVoiceover', () => {
  it('generates paragraph by paragraph, stitched, into vo.original.wav + words', async () => {
    const result = await run();
    if (!result.ok) throw new Error(result.error.message);
    const bodies = ttsBodies();
    expect(bodies.map((body) => body['text'])).toEqual(SCRIPT.split('\n\n'));
    expect(bodies.map((body) => body['previous_request_ids'])).toEqual([
      undefined,
      ['req-1'],
      ['req-1', 'req-2'],
    ]);
    expect(bodies[0]?.['previous_text']).toBeUndefined();
    expect(bodies[0]?.['next_text']).toBe(
      'But this one is special. It is a calculator. If it has a screen, it runs Doom.',
    );
    expect(bodies[1]?.['previous_text']).toBeUndefined();
    expect(bodies[1]).toMatchObject({ seed: 42, voice_settings: { stability: 0.5 } });

    const manifest = await readManifest();
    expect(manifest.chunks.map((chunk) => chunk.activeTakeId)).toEqual([
      'p00a-1',
      'p01a-1',
      'p02a-1',
    ]);
    expect(manifest.takes.map((take) => [take.file, take.requestId, take.characterCost])).toEqual([
      ['audio/takes/p00a-1.wav', 'req-1', 29],
      ['audio/takes/p01a-1.wav', 'req-2', 44],
      ['audio/takes/p02a-1.wav', 'req-3', 33],
    ]);
    const timeline = manifest.output?.timeline ?? [];
    expect(timeline[1]?.start).toBeCloseTo((timeline[0]?.end ?? 0) + 0.6, 4);
    expect(result.value).toMatchObject({ characters: 106, characterCost: 106, reusedChunkIds: [] });

    const wav = decodeWavBytes(await readFile(path.join(projectDir, 'audio', 'vo.original.wav')));
    expect(wav.ok && wav.value.samples.length / 44_100).toBeCloseTo(
      manifest.output?.durationS ?? 0,
      6,
    );
    expect(manifest.output?.durationS).toBeCloseTo(106 * 0.02 + 1.2, 2);

    expect(result.value.wordsFile).toBe(VOICE_FILES.apiWords);
    const words = WordsFileSchema.parse(
      JSON.parse(await readFile(path.join(projectDir, 'timing', 'words.elevenlabs.json'), 'utf8')),
    );
    expect(words.words.map((word) => word.text)).toEqual(
      tokenizeScript(SCRIPT).map((word) => word.text),
    );
    const secondParagraph = words.words.find((word) => word.paragraph === 1);
    expect(secondParagraph?.t).toBeGreaterThanOrEqual(timeline[1]?.start ?? Infinity);
  });

  it('reuses unchanged takes and regenerates only an edited paragraph', async () => {
    expect((await run()).ok).toBe(true);
    const again = await run();
    expect(again.ok && again.value.generatedChunkIds).toEqual([]);
    expect(ttsBodies()).toHaveLength(3);

    const edited = SCRIPT.replace('It is a calculator.', 'It is a school calculator.');
    const pending = await pendingCharacters(projectDir, edited, SETTINGS);
    expect(pending.ok && pending.value).toEqual({ characters: 51, chunks: 1, reused: 2 });
    const result = await run(edited);
    if (!result.ok) throw new Error(result.error.message);
    expect(result.value.generatedChunkIds).toEqual(['p01a']);
    const last = ttsBodies().at(-1);
    expect(last).toMatchObject({ previous_request_ids: ['req-1'], next_request_ids: ['req-3'] });
    const manifest = await readManifest();
    expect(manifest.takes.map((take) => take.id)).toEqual(['p00a-1', 'p01a-1', 'p02a-1', 'p01a-2']);
    expect(manifest.chunks[1]?.activeTakeId).toBe('p01a-2');
  });

  it('falls back to context text when request ids are older than 2 hours', async () => {
    expect((await run()).ok).toBe(true);
    clock += 3 * 60 * 60 * 1000;
    expect((await run(SCRIPT.replace('anything', 'everything'))).ok).toBe(true);
    const last = ttsBodies().at(-1);
    expect(last?.['previous_request_ids']).toBeUndefined();
    expect(last?.['next_request_ids']).toBeUndefined();
    expect(last?.['next_text']).toBe(
      'But this one is special. It is a calculator. If it has a screen, it runs Doom.',
    );
  });

  it('keeps paid takes when a run fails and resumes with the rest', async () => {
    const failing = new ElevenLabsClient({
      apiKey: KEY,
      baseUrl: fake.url,
      retry: { maxAttempts: 1 },
    });
    let calls = 0;
    const flaky = {
      generate: (...args: Parameters<ElevenLabsClient['generate']>) => {
        calls += 1;
        if (calls === 2) fake.failNext({ status: 402 });
        return failing.generate(...args);
      },
    };
    const first = await generateVoiceover({
      projectDir,
      scriptText: SCRIPT,
      settings: SETTINGS,
      client: flaky,
      decoder: createTakeDecoder(null),
      now,
    });
    expect(!first.ok && first.error.kind).toBe('payment');
    const partial = await readManifest();
    expect(partial.chunks.map((chunk) => chunk.activeTakeId)).toEqual(['p00a-1', null, null]);
    expect(partial.output).toBeNull();
    const resumed = await run();
    expect(resumed.ok && resumed.value.generatedChunkIds).toEqual(['p01a', 'p02a']);
  });

  it('runs text-stitched chunks in parallel without request ids', async () => {
    const result = await run(SCRIPT, {
      ...SETTINGS,
      stitching: 'text',
      parallel: 3,
      withTimestamps: false,
    });
    if (!result.ok) throw new Error(result.error.message);
    expect(ttsBodies().every((body) => body['previous_request_ids'] === undefined)).toBe(true);
    expect(
      ttsBodies().find((body) => body['text'] === 'If it has a screen, it runs Doom.')?.[
        'previous_text'
      ],
    ).toBe('Doom runs on almost anything. But this one is special. It is a calculator.');
    expect(fake.requests.every((request) => !request.path.endsWith('/with-timestamps'))).toBe(true);
    expect(result.value.wordsFile).toBeNull();
    const manifest = await readManifest();
    expect(manifest.output?.timeline.map((entry) => entry.chunkId)).toEqual([
      'p00a',
      'p01a',
      'p02a',
    ]);
  });

  it('uses the short sentence pause inside a split paragraph', async () => {
    const long = Array.from(
      { length: 4 },
      (_, k) => `Sentence number ${String(k)} ${'is long '.repeat(400)}here.`,
    ).join(' ');
    const result = await run(long, { ...SETTINGS, withTimestamps: false });
    if (!result.ok) throw new Error(result.error.message);
    const timeline = result.value.manifest.output?.timeline ?? [];
    expect(timeline.map((entry) => entry.chunkId)).toEqual(['p00a', 'p00b']);
    expect((timeline[1]?.start ?? 0) - (timeline[0]?.end ?? 0)).toBeCloseTo(0.25, 4);
  });
});

describe('retakeSentence', () => {
  const shots = [
    { id: 's01', t0: 0, t1: 0.8 },
    { id: 's02', t0: 0.8, t1: 2 },
    { id: 's03', t0: 2, t1: 3.5 },
    { id: 's04', t0: 3.5, t1: 4 },
  ];

  it('regenerates only the chunk of the sentence and reports affected shots', async () => {
    expect((await run()).ok).toBe(true);
    const before = await readManifest();
    const result = await retakeSentence({
      projectDir,
      scriptText: SCRIPT,
      sentenceId: 'p01-s01',
      settings: { ...SETTINGS, seed: 7 },
      client: client(),
      decoder: createTakeDecoder(null),
      shots,
      now,
    });
    if (!result.ok) throw new Error(result.error.message);
    expect(result.value.take.id).toBe('p01a-2');
    expect(result.value.sentenceIds).toEqual(['p01-s00', 'p01-s01']);
    expect(ttsBodies().at(-1)).toMatchObject({
      text: 'But this one is special. It is a calculator.',
      seed: 7,
      previous_request_ids: ['req-1'],
      next_request_ids: ['req-3'],
    });
    expect(result.value.before).toEqual({
      start: before.output?.timeline[1]?.start,
      end: before.output?.timeline[1]?.end,
    });
    expect(result.value.impact).toEqual({
      changedShotIds: ['s02', 's03'],
      shiftedShotIds: [],
      shiftS: 0,
    });
    const after = await readManifest();
    expect(after.chunks[1]?.activeTakeId).toBe('p01a-2');
    expect(after.output?.sha256).toBeDefined();
    await expect(
      stat(path.join(projectDir, 'audio', 'takes', 'p01a-1.wav')),
    ).resolves.toBeDefined();
  });

  it('separates overlapping shots from shots that only move', () => {
    expect(shotImpact(shots, { start: 1, end: 2 }, { start: 1, end: 2.5 })).toEqual({
      changedShotIds: ['s02'],
      shiftedShotIds: ['s03', 's04'],
      shiftS: 0.5,
    });
  });

  it('refuses when the script changed or the sentence is unknown', async () => {
    expect((await run()).ok).toBe(true);
    const base = {
      projectDir,
      settings: SETTINGS,
      client: client(),
      decoder: createTakeDecoder(null),
      now,
    };
    const changed = await retakeSentence({
      ...base,
      scriptText: `${SCRIPT} More.`,
      sentenceId: 'p00-s00',
    });
    expect(!changed.ok && changed.error.kind).toBe('stale-manifest');
    const unknown = await retakeSentence({ ...base, scriptText: SCRIPT, sentenceId: 'p09-s00' });
    expect(!unknown.ok && unknown.error.kind).toBe('invalid-input');
    expect(ttsBodies()).toHaveLength(3);
  });
});
