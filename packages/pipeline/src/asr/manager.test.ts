/** WhisperManager with a fake process runner, fake ffmpeg and fake fetch (no binaries, no network). */
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  SILERO_VAD_MODEL,
  WHISPER_BINARIES,
  WHISPER_MODELS,
  type AssetSpec,
  type BinaryBackend,
} from './assets.js';
import type { FetchLike } from './download.js';
import { backendDir } from './locate.js';
import { WhisperManager } from './manager.js';
import { buildZip } from './test-zip.js';
import type { AsrFfmpeg, ProcessRunner, TranscribeProgress } from './transcribe.js';
import { err, ok } from '../result.js';
import { WordsRawSchema } from '../schemas/words.js';

let root = '';
beforeEach(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), 'reelforge whisper żółć '));
});
afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

/**
 * The pinned release zips are Windows builds (`whisper-cli.exe`), so every manager here locates
 * binaries as on Windows, whatever OS runs the suite (CI also runs on Linux).
 */
const PLATFORM = 'win32';

const cliOf = (backend: BinaryBackend): string =>
  path.join(backendDir(root, backend), 'Release', 'whisper-cli.exe');

async function touch(file: string, content = ''): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, content);
}

async function installFakeBuilds(backends: readonly BinaryBackend[]): Promise<WhisperManager> {
  for (const backend of backends) {
    await touch(cliOf(backend));
    await touch(path.join(path.dirname(cliOf(backend)), 'whisper-vad-speech-segments.exe'));
  }
  const manager = new WhisperManager({ root, env: {}, platform: PLATFORM, run: fakeRunner.run });
  await touch(manager.modelPath('large-v3-turbo-q5_0'));
  await touch(manager.vadModelPath());
  return manager;
}

/** Two speech segments with a 3 s pause -> two chunks. */
const VAD_STDOUT =
  'Speech segment 0: start = 50.00, end = 400.00\nSpeech segment 1: start = 700.00, end = 1100.00\n';

function chunkJson(language: string): string {
  const segment = (text: string, from: number, to: number, dtw: number): object => ({
    offsets: { from, to },
    text: ` ${text}`,
    tokens: [{ text: ` ${text}`, p: 0.9, t_dtw: dtw }],
  });
  return JSON.stringify({
    result: { language },
    transcription: [segment('hello', 300, 700, 50), segment('world', 700, 1200, 90)],
  });
}

interface FakeBehaviour {
  /** Backends whose GPU run fails; with `always` the `-ng` run fails too. */
  failing: Map<string, 'gpu' | 'always'>;
  detected: string;
}

const newBehaviour = (): FakeBehaviour => ({ failing: new Map(), detected: 'pl' });

const fakeRunner = {
  behaviour: newBehaviour(),
  calls: [] as { command: string; args: readonly string[] }[],
  run: vi.fn<ProcessRunner>(async (command, args, options) => {
    fakeRunner.calls.push({ command, args });
    if (options.signal?.aborted === true) return err({ kind: 'cancelled', message: 'cancelled' });
    const name = path.basename(command);
    if (name === 'nvidia-smi')
      return ok({
        stdout: 'GPU 0: NVIDIA GeForce RTX 4050 (UUID: x)\n',
        stderr: '',
        durationMs: 1,
      });
    if (name === 'whisper-vad-speech-segments.exe')
      return ok({ stdout: VAD_STDOUT, stderr: '', durationMs: 1 });
    const backend = path.basename(path.dirname(path.dirname(command)));
    const noGpu = args.includes('-ng');
    const failing = fakeRunner.behaviour.failing.get(backend);
    if (failing === 'always' || (failing === 'gpu' && !noGpu)) {
      return err({
        kind: 'exit-code',
        message: 'whisper-cli.exe exited with 3221226505',
        code: 3221226505,
        signal: null,
        stderrTail: 'CUDA error',
      });
    }
    const files = args.filter((arg) => arg.endsWith('.wav'));
    if (args.includes('-dl')) {
      const base = args[args.indexOf('-of') + 1] ?? '';
      await writeFile(
        `${base}.json`,
        JSON.stringify({ result: { language: fakeRunner.behaviour.detected }, transcription: [] }),
      );
    } else {
      const lang = args[args.indexOf('-l') + 1] ?? 'en';
      for (const file of files) await writeFile(`${file}.json`, chunkJson(lang));
    }
    const banner = backend === 'cuda' && !noGpu ? 'ggml_cuda_init: found 1 CUDA devices' : '';
    return ok({ stdout: '', stderr: banner, durationMs: 1 });
  }),
};

const fakeFfmpeg: AsrFfmpeg & { calls: string[][] } = {
  calls: [],
  async run(args) {
    fakeFfmpeg.calls.push([...args]);
    const outputs = args.flatMap((arg, k) => (arg === 'pcm_s16le' ? [args[k + 1] ?? ''] : []));
    for (const output of outputs) await writeFile(output, 'RIFF');
    return ok({
      stdout: '',
      stderr: '  Duration: 00:00:12.50, start: 0.000000, bitrate: 256 kb/s',
      durationMs: 1,
    });
  },
};

beforeEach(() => {
  fakeRunner.behaviour = newBehaviour();
  fakeRunner.calls = [];
  fakeFfmpeg.calls = [];
});

const whisperCalls = (): { command: string; args: readonly string[] }[] =>
  fakeRunner.calls.filter((call) => path.basename(call.command) === 'whisper-cli.exe');

describe('WhisperManager.transcribe', () => {
  it('runs VAD, cuts chunks, decodes all chunks in one DTW call and writes words.raw.json', async () => {
    const manager = await installFakeBuilds(['cuda', 'blas']);
    const outPath = path.join(root, 'project', 'timing', 'words.raw.json');
    const stages: TranscribeProgress['stage'][] = [];
    const result = await manager.transcribe({
      input: path.join(root, 'vo original.m4a'),
      workDir: path.join(root, 'work'),
      lang: 'en',
      ffmpeg: fakeFfmpeg,
      outPath,
      onProgress: (progress) => stages.push(progress.stage),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const raw = result.value;
    expect(raw).toMatchObject({
      backend: 'cuda',
      usedGpu: true,
      decodedLang: 'en',
      audioS: 12.5,
      dtwLeadS: 0.21,
      fallbacks: [],
    });
    expect(raw.chunks).toEqual([
      { start: 0.25, end: 4.25 },
      { start: 6.75, end: 11.25 },
    ]);
    // chunk 2: "hello" t_dtw 0.5 s + chunk start 6.75 - lead 0.21
    expect(raw.words.map((w) => [w.text, w.t])).toEqual([
      ['hello', 0.54],
      ['world', 0.94],
      ['hello', 7.04],
      ['world', 7.44],
    ]);
    const calls = whisperCalls();
    expect(calls).toHaveLength(1);
    const args = calls[0]?.args ?? [];
    expect(args).toEqual(
      expect.arrayContaining([
        '-nfa',
        '-dtw',
        'large.v3.turbo',
        '-ml',
        '1',
        '-sow',
        '-ojf',
        '-l',
        'en',
      ]),
    );
    expect(args.filter((arg) => arg.endsWith('.wav'))).toHaveLength(2);
    expect(args).not.toContain('-ng');
    const vadCall = fakeRunner.calls.find((call) =>
      call.command.endsWith('whisper-vad-speech-segments.exe'),
    );
    expect(vadCall?.args).toEqual(expect.arrayContaining(['-vmsd', '25']));
    expect(vadCall?.args).not.toContain('-np');
    expect(fakeFfmpeg.calls[0]).toEqual(expect.arrayContaining(['-ar', '16000', '-ac', '1']));
    expect(WordsRawSchema.parse(JSON.parse(await readFile(outPath, 'utf8')))).toEqual(raw);
    expect(stages).toEqual(['prepare', 'vad', 'chunk', 'transcribe', 'write']);
  });

  it('retries a failing GPU run with -ng', async () => {
    const manager = await installFakeBuilds(['cuda', 'blas']);
    fakeRunner.behaviour.failing.set('cuda', 'gpu');
    const result = await manager.transcribe({
      input: 'in.wav',
      workDir: path.join(root, 'work'),
      lang: 'en',
      ffmpeg: fakeFfmpeg,
    });
    expect(result.ok && result.value).toMatchObject({
      backend: 'cuda',
      usedGpu: false,
      fallbacks: [{ backend: 'cuda', gpu: true }],
    });
    expect(whisperCalls().map((call) => call.args.includes('-ng'))).toEqual([false, true]);
  });

  it('falls back to the CPU build when the CUDA build cannot run at all', async () => {
    const manager = await installFakeBuilds(['cuda', 'blas']);
    fakeRunner.behaviour.failing.set('cuda', 'always');
    const result = await manager.transcribe({
      input: 'in.wav',
      workDir: path.join(root, 'work'),
      lang: 'en',
      ffmpeg: fakeFfmpeg,
    });
    expect(result.ok && result.value).toMatchObject({ backend: 'blas', usedGpu: false });
    expect(result.ok && result.value.fallbacks).toHaveLength(2);
  });

  it('reports every failed attempt when no backend works', async () => {
    const manager = await installFakeBuilds(['blas']);
    fakeRunner.behaviour.failing.set('blas', 'always');
    const result = await manager.transcribe({
      input: 'in.wav',
      workDir: path.join(root, 'work'),
      lang: 'en',
      ffmpeg: fakeFfmpeg,
    });
    expect(result).toMatchObject({
      ok: false,
      error: { kind: 'process-failed', attempts: [{ backend: 'blas' }] },
    });
  });

  it('detects the language once on the longest chunk when lang is auto', async () => {
    const manager = await installFakeBuilds(['cuda']);
    const result = await manager.transcribe({
      input: 'in.wav',
      workDir: path.join(root, 'work'),
      lang: 'auto',
      ffmpeg: fakeFfmpeg,
    });
    expect(result.ok && result.value).toMatchObject({ lang: 'auto', decodedLang: 'pl' });
    const [detect, decode] = whisperCalls();
    expect(detect?.args).toEqual(expect.arrayContaining(['-l', 'auto', '-dl']));
    expect(detect?.args.filter((arg) => arg.endsWith('.wav'))).toEqual([
      path.join(root, 'work', 'chunks', 'c001.wav'),
    ]);
    expect(decode?.args).toEqual(expect.arrayContaining(['-l', 'pl']));
  });

  it('returns cancelled when aborted', async () => {
    const manager = await installFakeBuilds(['cuda']);
    const controller = new AbortController();
    const result = await manager.transcribe({
      input: 'in.wav',
      workDir: path.join(root, 'work'),
      lang: 'en',
      ffmpeg: fakeFfmpeg,
      signal: controller.signal,
      onProgress: (progress) => {
        if (progress.stage === 'transcribe') controller.abort();
      },
    });
    expect(result).toMatchObject({ ok: false, error: { kind: 'cancelled' } });
  });

  it('requires the model files', async () => {
    const manager = await installFakeBuilds(['cuda']);
    await rm(manager.modelPath('large-v3-turbo-q5_0'));
    const result = await manager.transcribe({
      input: 'in.wav',
      workDir: path.join(root, 'work'),
      lang: 'en',
      ffmpeg: fakeFfmpeg,
    });
    expect(result).toMatchObject({ ok: false, error: { kind: 'model-missing' } });
  });

  it('reports silence as no-speech', async () => {
    const manager = await installFakeBuilds(['cuda']);
    fakeRunner.run.mockImplementationOnce(() =>
      Promise.resolve(ok({ stdout: '', stderr: '', durationMs: 1 })),
    );
    const result = await manager.transcribe({
      input: 'in.wav',
      workDir: path.join(root, 'work'),
      lang: 'en',
      ffmpeg: fakeFfmpeg,
    });
    expect(result).toMatchObject({ ok: false, error: { kind: 'no-speech' } });
  });
});

describe('WhisperManager.install', () => {
  const zip = buildZip([
    { name: 'Release/whisper-cli.exe', data: Buffer.from('cli') },
    { name: 'Release/whisper-vad-speech-segments.exe', data: Buffer.from('vad') },
  ]);
  /** Pinned release assets, re-hashed to the test zip. */
  function fakeAssets(): Record<BinaryBackend, AssetSpec> {
    const value = createHash('sha256').update(zip).digest('hex');
    const withHash = (backend: BinaryBackend): AssetSpec => ({
      ...WHISPER_BINARIES[backend],
      hash: { algo: 'sha256', value },
    });
    return { cuda: withHash('cuda'), blas: withHash('blas'), cpu: withHash('cpu') };
  }

  /** Pre-verified model files (marker matches the pinned hash), so no model download happens. */
  async function placeVerified(file: string, asset: AssetSpec): Promise<void> {
    await touch(file, 'model');
    await writeFile(`${file}.verified`, `${asset.hash.algo}:${asset.hash.value}:5\n`);
  }

  it('installs the CUDA build plus the CPU fallback when nvidia-smi finds a GPU', async () => {
    const fetch = vi.fn<FetchLike>(() => Promise.resolve(new Response(zip)));
    const manager = new WhisperManager({
      root,
      env: {},
      platform: PLATFORM,
      run: fakeRunner.run,
      fetch,
      binaryAssets: fakeAssets(),
    });
    await placeVerified(
      manager.modelPath('large-v3-turbo-q5_0'),
      WHISPER_MODELS['large-v3-turbo-q5_0'],
    );
    await placeVerified(manager.vadModelPath(), SILERO_VAD_MODEL);
    const result = await manager.install();
    expect(result).toMatchObject({ ok: true, value: { backends: ['cuda', 'blas'] } });
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(await readFile(cliOf('cuda'), 'utf8')).toBe('cli');
    const located = manager.locate();
    expect(located.ok && located.value.map((install) => install.backend)).toEqual(['cuda', 'blas']);
    // Second install is a no-op: binaries are stamped, models verified.
    expect((await manager.install()).ok).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('installs only the CPU build without an NVIDIA GPU', async () => {
    const fetch = vi.fn<FetchLike>(() => Promise.resolve(new Response(zip)));
    const run = vi.fn<ProcessRunner>(() =>
      Promise.resolve(
        err({ kind: 'spawn-failed', message: 'nvidia-smi not found', command: 'nvidia-smi' }),
      ),
    );
    const manager = new WhisperManager({
      root,
      env: {},
      platform: PLATFORM,
      run,
      fetch,
      binaryAssets: fakeAssets(),
    });
    await placeVerified(manager.modelPath('small'), WHISPER_MODELS.small);
    await placeVerified(manager.vadModelPath(), SILERO_VAD_MODEL);
    const result = await manager.install({ model: 'small' });
    expect(result).toMatchObject({ ok: true, value: { backends: ['blas'] } });
  });

  it('surfaces a checksum mismatch of the release zip', async () => {
    const fetch = vi.fn<FetchLike>(() => Promise.resolve(new Response('tampered')));
    const manager = new WhisperManager({
      root,
      env: {},
      platform: PLATFORM,
      run: fakeRunner.run,
      fetch,
      binaryAssets: fakeAssets(),
    });
    expect(await manager.installBinary('blas')).toMatchObject({
      ok: false,
      error: { kind: 'checksum-mismatch' },
    });
    expect(manager.locate().ok).toBe(false);
  });
});
