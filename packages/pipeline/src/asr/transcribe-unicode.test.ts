/**
 * Projects in non-ASCII folders (`Déjà Vu ✓ 日本`) against a fake whisper.cpp: a real child process
 * (`node -e`) that, like the real Windows builds, cannot open any non-ASCII argument. The script is
 * passed inline: a freshly written script file can be held for seconds by antivirus scanning.
 */
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { WHISPER_MODELS } from './assets.js';
import { transcribeChunked, type AsrFfmpeg, type TranscribeContext } from './transcribe.js';
import { runProcess } from '../ffmpeg/process.js';
import { ok } from '../result.js';

const FAKE_WHISPER = String.raw`
const fs = require('node:fs');
const [tool, mode, ...args] = process.argv.slice(1);
const fail = (code, line) => { process.stderr.write(line + '\n'); process.exit(code); };
const bad = args.find((arg) => /[^\x20-\x7e]/.test(arg));
if (bad !== undefined)
  fail(2, 'error: failed to read audio data from ' + bad.replace(/[^\x20-\x7e]/g, '?'));
const value = (flag) => args[args.indexOf(flag) + 1];
const need = (file) => { if (!fs.existsSync(file)) fail(3, 'failed to open ' + file); };
if (tool === 'whisper-vad-speech-segments.exe') {
  need(value('-vm'));
  need(value('-f'));
  process.stdout.write('Speech segment 0: start = 50.00, end = 400.00\nSpeech segment 1: start = 700.00, end = 1100.00\n');
  process.exit(0);
}
need(value('-m'));
if (mode === 'slow') setTimeout(() => process.exit(0), 60000);
else if (mode === 'fail') fail(5, 'whisper_init: failed to initialize');
else {
  const segment = (text, from, to) => ({ offsets: { from, to }, text, tokens: [{ text, p: 0.9, t_dtw: from / 10 }] });
  for (const file of args.filter((arg) => arg.endsWith('.wav'))) {
    need(file);
    fs.writeFileSync(file + '.json', JSON.stringify({ transcription: [segment(' hello', 300, 700), segment(' world', 700, 1200)] }));
  }
}
`;

type Mode = 'ok' | 'slow' | 'fail';
/**
 * Generous: on a busy Windows machine starting a child process occasionally stalls for ~30 s
 * (seen ≈ 1 in 10 runs of the whole ASR suite); a real run takes well under a second.
 */
const SPAWN_TEST_TIMEOUT_MS = 120_000;

let base = '';
let scratchRoot = '';
beforeEach(async () => {
  base = await mkdtemp(path.join(os.tmpdir(), 'rf asr unicode '));
  scratchRoot = path.join(base, 'scratch');
});
afterEach(async () => {
  await rm(base, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
});

const fakeFfmpeg: AsrFfmpeg = {
  async run(args) {
    const outputs = args.flatMap((arg, k) => (arg === 'pcm_s16le' ? [args[k + 1] ?? ''] : []));
    for (const output of outputs) await writeFile(output, 'RIFF');
    return ok({ stdout: '', stderr: '  Duration: 00:00:12.50, start: 0.000000', durationMs: 1 });
  },
};

interface Setup {
  readonly ctx: TranscribeContext;
  readonly project: string;
  readonly calls: string[][];
}

async function setup(
  folder: string,
  mode: Mode,
  platform: NodeJS.Platform,
  onSpawn?: () => void,
): Promise<Setup> {
  const project = path.join(base, folder);
  const models = path.join(project, 'models');
  await mkdir(models, { recursive: true });
  await writeFile(path.join(models, 'ggml-large-v3-turbo-q5_0.bin'), 'model');
  await writeFile(path.join(models, 'ggml-silero-v6.2.0.bin'), 'vad');
  const bin = path.join(project, 'bin');
  const calls: string[][] = [];
  const ctx: TranscribeContext = {
    installs: [
      {
        cliPath: path.join(bin, 'whisper-cli.exe'),
        vadToolPath: path.join(bin, 'whisper-vad-speech-segments.exe'),
        backend: 'blas',
        source: 'app-data',
      },
    ],
    model: WHISPER_MODELS['large-v3-turbo-q5_0'],
    modelPath: path.join(models, 'ggml-large-v3-turbo-q5_0.bin'),
    vadModelPath: path.join(models, 'ggml-silero-v6.2.0.bin'),
    ffmpeg: fakeFfmpeg,
    run: (command, args, options) => {
      calls.push([...args]);
      onSpawn?.();
      const fakeArgs = ['-e', FAKE_WHISPER, path.basename(command), mode, ...args];
      return runProcess(process.execPath, fakeArgs, options);
    },
    asciiScratch: { platform, roots: [scratchRoot] },
  };
  return { ctx, project, calls };
}

const workOf = (project: string): string => path.join(project, '.reelforge', 'cache', 'asr');

describe('transcription of a project with a non-ASCII path', () => {
  it(
    'fails like the real whisper.cpp when nothing is staged, and says why',
    async () => {
      const { ctx, project } = await setup('Déjà Vu ✓ 日本', 'ok', 'linux');
      const result = await transcribeChunked(ctx, {
        input: path.join(project, 'vo.wav'),
        workDir: workOf(project),
        lang: 'en',
      });
      expect(result).toMatchObject({ ok: false, error: { kind: 'process-failed' } });
      const message = result.ok ? '' : result.error.message;
      expect(message).toContain('failed to read audio data');
      expect(message).toContain('non-ASCII characters on Windows');
    },
    SPAWN_TEST_TIMEOUT_MS,
  );

  it(
    'runs every whisper tool in an ASCII scratch folder and copies the results back',
    async () => {
      const { ctx, project, calls } = await setup('Déjà Vu ✓ 日本', 'ok', 'win32');
      const outPath = path.join(project, 'timing', 'words.raw.json');
      const result = await transcribeChunked(ctx, {
        input: path.join(project, 'vo.wav'),
        workDir: workOf(project),
        lang: 'en',
        outPath,
      });
      expect(result.ok && result.value.words.map((word) => word.text)).toEqual([
        'hello',
        'world',
        'hello',
        'world',
      ]);
      expect(calls.flat().every((arg) => /^[\x20-\x7e]*$/.test(arg))).toBe(true);
      expect(existsSync(outPath)).toBe(true);
      expect(existsSync(path.join(workOf(project), 'asr.16k.wav'))).toBe(true);
      expect((await readdir(path.join(workOf(project), 'chunks'))).sort()).toEqual([
        'c000.wav',
        'c000.wav.json',
        'c001.wav',
        'c001.wav.json',
      ]);
      expect(await readdir(scratchRoot)).toEqual([]);
    },
    SPAWN_TEST_TIMEOUT_MS,
  );

  it(
    'keeps ASCII projects in place without a scratch folder',
    async () => {
      const { ctx, project, calls } = await setup('Why Do We Get Deja Vu', 'ok', 'win32');
      const result = await transcribeChunked(ctx, {
        input: path.join(project, 'vo.wav'),
        workDir: workOf(project),
        lang: 'en',
      });
      expect(result.ok).toBe(true);
      expect(calls[0]).toEqual(
        expect.arrayContaining([ctx.vadModelPath, path.join(workOf(project), 'asr.16k.wav')]),
      );
      expect(calls[1]).toEqual(expect.arrayContaining([ctx.modelPath]));
      expect(existsSync(scratchRoot)).toBe(false);
    },
    SPAWN_TEST_TIMEOUT_MS,
  );

  it(
    'removes the scratch folder when whisper-cli fails',
    async () => {
      const { ctx, project } = await setup('Déjà Vu ✓ 日本', 'fail', 'win32');
      const result = await transcribeChunked(ctx, {
        input: path.join(project, 'vo.wav'),
        workDir: workOf(project),
        lang: 'en',
      });
      expect(result).toMatchObject({ ok: false, error: { kind: 'process-failed' } });
      expect(await readdir(scratchRoot)).toEqual([]);
    },
    SPAWN_TEST_TIMEOUT_MS,
  );

  it(
    'removes the scratch folder when a running transcription is cancelled',
    async () => {
      const controller = new AbortController();
      let spawned = 0;
      const { ctx, project } = await setup('Déjà Vu ✓ 日本', 'slow', 'win32', () => {
        spawned += 1;
        // Second spawn = the decode call (the first is VAD): kill it while it runs.
        if (spawned === 2) {
          setTimeout(() => {
            controller.abort();
          }, 300);
        }
      });
      const result = await transcribeChunked(ctx, {
        input: path.join(project, 'vo.wav'),
        workDir: workOf(project),
        lang: 'en',
        signal: controller.signal,
      });
      expect(result).toMatchObject({ ok: false, error: { kind: 'cancelled' } });
      expect(await readdir(scratchRoot)).toEqual([]);
    },
    SPAWN_TEST_TIMEOUT_MS,
  );
});
