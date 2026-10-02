/**
 * End-to-end: real whisper.cpp + model on a spike 03 voice-over -> words.raw.json -> words.json ->
 * anchors. Skipped unless everything is available locally (never downloads):
 * - whisper build: REELFORGE_WHISPER, else spikes/03-audio/.cache/bin/cuda (from the spike);
 * - models: REELFORGE_WHISPER_MODELS, else spikes/03-audio/.cache/models;
 * - audio: spikes/03-audio/.cache/out/<sample>/vo.original.wav (spike `prepare` step);
 * - ffmpeg: located like FfmpegManager does (REELFORGE_FFMPEG / PATH).
 */
import { existsSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { WHISPER_ENV_VAR } from './locate.js';
import { WhisperManager } from './manager.js';
import { alignScript } from '../align/align.js';
import { SPIKE_DIR, loadSpikeFixture, startErrors } from '../align/test-fixtures.js';
import { alignRawWords, readWordsFile, writeWordsFile } from '../align/words-file.js';
import { resolveAnchor } from '../anchors/resolve.js';
import { FfmpegManager } from '../ffmpeg/manager.js';

const CACHE = path.join(SPIKE_DIR, '.cache');
const whisperPath = process.env[WHISPER_ENV_VAR] ?? path.join(CACHE, 'bin', 'cuda');
const modelsDir = process.env['REELFORGE_WHISPER_MODELS'] ?? path.join(CACHE, 'models');
const audio = (sample: string): string => path.join(CACHE, 'out', sample, 'vo.original.wav');

const ffmpegResult = await FfmpegManager.create();
const ffmpeg = ffmpegResult.ok ? ffmpegResult.value : null;
const manager = new WhisperManager({ configuredPath: whisperPath, modelsDir });
const ready =
  ffmpeg !== null &&
  manager.locate().ok &&
  manager.hasModel('large-v3-turbo-q5_0') &&
  existsSync(manager.vadModelPath()) &&
  existsSync(audio('en-doom')) &&
  existsSync(audio('pl-apollo'));

const title = ready
  ? 'whisper.cpp integration'
  : 'whisper.cpp integration (SKIPPED: needs the spike 03 cache or REELFORGE_WHISPER + REELFORGE_WHISPER_MODELS)';

describe.skipIf(!ready)(title, () => {
  const runner = ffmpeg as FfmpegManager;
  let workDir = '';

  beforeAll(async () => {
    workDir = await mkdtemp(path.join(os.tmpdir(), 'reelforge asr żółć '));
  });
  afterAll(async () => {
    await rm(workDir, { recursive: true, force: true });
  });

  it('transcribes EN with VAD chunks + DTW, aligns and resolves anchors within tolerance', async () => {
    const fixture = loadSpikeFixture('en-doom');
    const rawPath = path.join(workDir, 'timing', 'words.raw.json');
    const raw = await manager.transcribe({
      input: audio('en-doom'),
      workDir: path.join(workDir, 'en'),
      lang: 'en',
      ffmpeg: runner,
      outPath: rawPath,
    });
    expect(raw.ok).toBe(true);
    if (!raw.ok) return;
    expect(raw.value.chunks.length).toBeGreaterThan(1);
    expect(raw.value.audioS).toBeCloseTo(fixture.truth.durationS, 0);

    const words = alignRawWords(fixture.script, raw.value);
    expect(words.stats.coverage).toBeGreaterThanOrEqual(0.92);
    expect(words.stats.wer).toBeLessThanOrEqual(0.07);
    const errors = startErrors(words.words, fixture.truth);
    expect(errors.maeMs).toBeLessThanOrEqual(120);
    expect(errors.within150).toBeGreaterThanOrEqual(0.85);

    const wordsPath = path.join(workDir, 'timing', 'words.json');
    expect((await writeWordsFile(wordsPath, words)).ok).toBe(true);
    const reread = await readWordsFile(wordsPath);
    expect(reread.ok && reread.value.words.length).toBe(fixture.truth.words.length);

    const hit = resolveAnchor(words.words, 'four floppy disks');
    const truthIndex = fixture.truth.words.findIndex((word) => word.text === 'four');
    const truthT = fixture.truth.words[truthIndex]?.t ?? Number.NaN;
    expect(hit.ok && Math.abs(hit.value.t - truthT)).toBeLessThanOrEqual(0.15);
  }, 180_000);

  it('detects Polish when the language is auto', async () => {
    const fixture = loadSpikeFixture('pl-apollo');
    const raw = await manager.transcribe({
      input: audio('pl-apollo'),
      workDir: path.join(workDir, 'pl'),
      lang: 'auto',
      ffmpeg: runner,
    });
    expect(raw.ok && raw.value.decodedLang).toBe('pl');
    if (!raw.ok) return;
    const aligned = alignScript(fixture.script, raw.value.words, { lang: 'pl' });
    expect(aligned.stats.coverage).toBeGreaterThanOrEqual(0.92);
  }, 180_000);

  it('cancels a running transcription by killing the process tree', async () => {
    const controller = new AbortController();
    const started = Date.now();
    const raw = await manager.transcribe({
      input: audio('en-doom'),
      workDir: path.join(workDir, 'cancel'),
      lang: 'en',
      ffmpeg: runner,
      signal: controller.signal,
      onProgress: (progress) => {
        if (progress.stage === 'transcribe') {
          setTimeout(() => {
            controller.abort();
          }, 300);
        }
      },
    });
    expect(raw).toMatchObject({ ok: false, error: { kind: 'cancelled' } });
    expect(Date.now() - started).toBeLessThan(60_000);
  }, 120_000);
});
