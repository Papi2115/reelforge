/**
 * Chunked whisper.cpp transcription (ADR-003): input -> 16 kHz mono WAV -> Silero VAD segments ->
 * chunks split at long pauses -> ONE `whisper-cli -dtw -nfa` call over all chunks (the model loads
 * once) -> words shifted back onto the input timeline -> DTW times calibrated -> words.raw.json.
 * The attempt plan (GPU probe, `-ng` retry, CPU fallbacks) comes from gpu-plan.ts.
 */
import { mkdir, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { explainNonAsciiFailure, runAsciiSafe, type AsciiScratchOptions } from './ascii-scratch.js';
import type { WhisperModelSpec } from './assets.js';
import type { WhisperAttemptFailure, WhisperError } from './errors.js';
import { gpuAwarePlan, type Attempt } from './gpu-plan.js';
import type { WhisperInstall } from './locate.js';
import {
  WhisperJsonSchema,
  calibrateDtw,
  parseVadSegments,
  planChunks,
  shiftWords,
  wordsFromWhisperJson,
  type ChunkPlanOptions,
  type SegmentWord,
  type TimeSpan,
} from './whisper-output.js';
import { parseMediaAudioInfo } from '../audio/measure.js';
import type { FfmpegManager } from '../ffmpeg/manager.js';
import type { ProcessOutput, ProcessRunOptions } from '../ffmpeg/process.js';
import type { FfmpegError } from '../ffmpeg/errors.js';
import { err, ok, type Result } from '../result.js';
import { readJsonFile, writeJsonAtomic } from '../schemas/json-file.js';
import {
  WORDS_RAW_VERSION,
  WordsRawSchema,
  type AsrLanguage,
  type WordsRaw,
} from '../schemas/words.js';

export type AsrFfmpeg = Pick<FfmpegManager, 'run'>;
export type ProcessRunner = (
  command: string,
  args: readonly string[],
  options: ProcessRunOptions,
) => Promise<Result<ProcessOutput, FfmpegError>>;

export type TranscribeStage =
  'prepare' | 'vad' | 'chunk' | 'detect-language' | 'transcribe' | 'write';

export interface TranscribeProgress {
  readonly stage: TranscribeStage;
  /** Rough overall completion 0..1 at the start of the stage. */
  readonly ratio: number;
}

const STAGE_RATIO: Readonly<Record<TranscribeStage, number>> = {
  prepare: 0,
  vad: 0.05,
  chunk: 0.1,
  'detect-language': 0.15,
  transcribe: 0.2,
  write: 0.98,
};

export interface TranscribeOptions {
  /** Original recording (any format ffmpeg reads); ASR runs on it, not on the cleaned stem. */
  readonly input: string;
  /** Scratch dir for the 16 kHz WAV, chunks and whisper JSON (created; chunks are replaced). */
  readonly workDir: string;
  readonly lang: AsrLanguage;
  /** Overrides the model's DTW lead (seconds); keep measured values in config. */
  readonly dtwLeadS?: number | undefined;
  readonly threads?: number | undefined;
  /**
   * Decoder overrides for a retry after a poor result (spike 03 retry policy: `-bs 5 -tp 0.2`):
   * whisper-cli `--beam-size` / `--temperature`.
   */
  readonly decoding?: WhisperDecoding | undefined;
  readonly chunking?: ChunkPlanOptions | undefined;
  /** When set, words.raw.json is written here atomically. */
  readonly outPath?: string | undefined;
  readonly signal?: AbortSignal | undefined;
  readonly onProgress?: ((progress: TranscribeProgress) => void) | undefined;
}

export interface WhisperDecoding {
  readonly beamSize?: number | undefined;
  /** Sampling temperature 0..1. */
  readonly temperature?: number | undefined;
}

/** `-bs N` / `-tp N` for the decode call (flags as listed by `whisper-cli --help`, b5130). */
export function decodingArgs(decoding: WhisperDecoding | undefined): string[] {
  const args: string[] = [];
  if (decoding?.beamSize !== undefined) args.push('-bs', String(decoding.beamSize));
  if (decoding?.temperature !== undefined) args.push('-tp', String(decoding.temperature));
  return args;
}

export interface TranscribeContext {
  /** Usable installs in preference order (see locateWhisper). */
  readonly installs: readonly WhisperInstall[];
  readonly model: WhisperModelSpec;
  readonly modelPath: string;
  readonly vadModelPath: string;
  readonly ffmpeg: AsrFfmpeg;
  readonly run: ProcessRunner;
  /** Non-ASCII paths on Windows run in an ASCII scratch folder (see ascii-scratch.ts). */
  readonly asciiScratch?: AsciiScratchOptions | undefined;
}

/** VAD max speech duration: longer speech runs are split so chunks stay under whisper's window. */
const VAD_MAX_SPEECH_S = '25';
const PCM_BYTES_PER_SECOND = 16_000 * 2;
const WAV_HEADER_BYTES = 44;

const ffmpegFailed = (step: string, error: FfmpegError): WhisperError =>
  error.kind === 'cancelled'
    ? { kind: 'cancelled', message: `${step} cancelled` }
    : { kind: 'ffmpeg-failed', message: `${step}: ${error.message}` };

async function prepareWav(
  ctx: TranscribeContext,
  options: TranscribeOptions,
  wav: string,
): Promise<Result<number, WhisperError>> {
  const converted = await ctx.ffmpeg.run(
    ['-y', '-i', options.input, '-vn', '-ar', '16000', '-ac', '1', '-c:a', 'pcm_s16le', wav],
    { signal: options.signal },
  );
  if (!converted.ok) return err(ffmpegFailed('converting to 16 kHz WAV', converted.error));
  const fromHeader = parseMediaAudioInfo(converted.value.stderr).durationS;
  if (fromHeader !== null) return ok(fromHeader);
  const size = await stat(wav).then(
    (info) => info.size,
    () => WAV_HEADER_BYTES,
  );
  return ok(Math.max(0, size - WAV_HEADER_BYTES) / PCM_BYTES_PER_SECOND);
}

async function speechChunks(
  ctx: TranscribeContext,
  options: TranscribeOptions,
  wav: string,
  durationS: number,
): Promise<Result<TimeSpan[], WhisperError>> {
  const vadTool = ctx.installs.find((install) => install.vadToolPath !== null)?.vadToolPath;
  if (vadTool === undefined || vadTool === null) {
    return err({
      kind: 'not-installed',
      message: 'whisper-vad-speech-segments not found next to whisper-cli',
      searched: ctx.installs.map((i) => i.cliPath),
    });
  }
  const threads = String(options.threads ?? 4);
  // Without -np: the tool prints the segment list on stdout only when prints are enabled.
  const args = ['-vm', ctx.vadModelPath, '-f', wav, '-t', threads, '-vmsd', VAD_MAX_SPEECH_S];
  const vad = await ctx.run(vadTool, args, { signal: options.signal });
  if (!vad.ok) {
    if (vad.error.kind === 'cancelled') return err({ kind: 'cancelled', message: 'VAD cancelled' });
    const message = explainNonAsciiFailure(`VAD failed: ${vad.error.message}`, args);
    return err({ kind: 'process-failed', message, attempts: [] });
  }
  const chunks = planChunks(parseVadSegments(vad.value.stdout), durationS, options.chunking);
  if (chunks.length === 0)
    return err({ kind: 'no-speech', message: 'no speech detected in the voice-over' });
  return ok(chunks);
}

async function cutChunks(
  ctx: TranscribeContext,
  options: TranscribeOptions,
  wav: string,
  chunks: readonly TimeSpan[],
): Promise<Result<string[], WhisperError>> {
  const dir = path.join(options.workDir, 'chunks');
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
  const files = chunks.map((_, index) => path.join(dir, `c${String(index).padStart(3, '0')}.wav`));
  const outputs = chunks.flatMap((chunk, index) => [
    '-ss',
    chunk.start.toFixed(3),
    '-to',
    chunk.end.toFixed(3),
    '-c:a',
    'pcm_s16le',
    files[index] ?? '',
  ]);
  const cut = await ctx.ffmpeg.run(['-y', '-i', wav, ...outputs], { signal: options.signal });
  if (!cut.ok) return err(ffmpegFailed('cutting VAD chunks', cut.error));
  return ok(files);
}

interface RunSuccess {
  readonly attemptIndex: number;
  readonly output: ProcessOutput;
}

/** Runs whisper-cli through the attempt plan starting at `from`; collects failures. */
async function runWithFallback(
  ctx: TranscribeContext,
  plan: readonly Attempt[],
  from: number,
  buildArgs: (attempt: Attempt) => string[],
  failures: WhisperAttemptFailure[],
  signal: AbortSignal | undefined,
): Promise<Result<RunSuccess, WhisperError>> {
  for (let index = from; index < plan.length; index++) {
    const attempt = plan[index];
    if (attempt === undefined) continue;
    const args = buildArgs(attempt);
    const result = await ctx.run(attempt.install.cliPath, args, { signal });
    if (result.ok) return ok({ attemptIndex: index, output: result.value });
    if (result.error.kind === 'cancelled')
      return err({ kind: 'cancelled', message: 'transcription cancelled' });
    failures.push({
      backend: attempt.install.backend,
      gpu: !attempt.noGpu,
      message: explainNonAsciiFailure(result.error.message, args),
    });
  }
  return err({
    kind: 'process-failed',
    message: `whisper-cli failed on every backend (${failures.map((f) => `${f.backend}${f.gpu ? '' : ' -ng'}: ${f.message}`).join('; ')})`,
    attempts: failures,
  });
}

const gpuArgs = (attempt: Attempt): string[] => (attempt.noGpu ? ['-ng'] : []);

async function detectLanguage(
  ctx: TranscribeContext,
  options: TranscribeOptions,
  plan: readonly Attempt[],
  files: readonly string[],
  chunks: readonly TimeSpan[],
  failures: WhisperAttemptFailure[],
): Promise<Result<{ lang: string; attemptIndex: number }, WhisperError>> {
  let longest = 0;
  chunks.forEach((chunk, index) => {
    const best = chunks[longest];
    if (best !== undefined && chunk.end - chunk.start > best.end - best.start) longest = index;
  });
  const base = path.join(options.workDir, 'detect-language');
  const threads = String(options.threads ?? 4);
  const run = await runWithFallback(
    ctx,
    plan,
    0,
    (attempt) => [
      '-m',
      ctx.modelPath,
      '-l',
      'auto',
      '-dl',
      '-ojf',
      '-np',
      '-t',
      threads,
      ...gpuArgs(attempt),
      '-of',
      base,
      files[longest] ?? '',
    ],
    failures,
    options.signal,
  );
  if (!run.ok) return run;
  const json = await readJsonFile(`${base}.json`, WhisperJsonSchema);
  const lang = json.ok ? json.value.result?.language : undefined;
  if (lang === undefined || lang === '')
    return err({
      kind: 'parse-failed',
      message: 'whisper did not report a detected language',
      path: `${base}.json`,
    });
  return ok({ lang, attemptIndex: run.value.attemptIndex });
}

async function readChunkWords(
  files: readonly string[],
  chunks: readonly TimeSpan[],
): Promise<Result<SegmentWord[], WhisperError>> {
  const words: SegmentWord[] = [];
  for (const [index, file] of files.entries()) {
    const json = await readJsonFile(`${file}.json`, WhisperJsonSchema);
    if (!json.ok)
      return err({ kind: 'parse-failed', message: json.error.message, path: `${file}.json` });
    words.push(...shiftWords(wordsFromWhisperJson(json.value), chunks[index]?.start ?? 0));
  }
  return ok(words);
}

/**
 * Never throws: unexpected filesystem failures become an `io` error. Non-ASCII project / model
 * paths on Windows are handled by running in an ASCII scratch folder (runAsciiSafe).
 */
export async function transcribeChunked(
  ctx: TranscribeContext,
  options: TranscribeOptions,
): Promise<Result<WordsRaw, WhisperError>> {
  try {
    return await runAsciiSafe(ctx, options, transcribe);
  } catch (error) {
    return err({
      kind: 'io',
      message: `transcription failed: ${error instanceof Error ? error.message : String(error)}`,
      path: options.workDir,
    });
  }
}

async function transcribe(
  ctx: TranscribeContext,
  options: TranscribeOptions,
): Promise<Result<WordsRaw, WhisperError>> {
  const started = process.hrtime.bigint();
  const progress = (stage: TranscribeStage): void =>
    options.onProgress?.({ stage, ratio: STAGE_RATIO[stage] });
  await mkdir(options.workDir, { recursive: true });
  const wav = path.join(options.workDir, 'asr.16k.wav');
  progress('prepare');
  const durationS = await prepareWav(ctx, options, wav);
  if (!durationS.ok) return durationS;
  progress('vad');
  const chunks = await speechChunks(ctx, options, wav, durationS.value);
  if (!chunks.ok) return chunks;
  progress('chunk');
  const files = await cutChunks(ctx, options, wav, chunks.value);
  if (!files.ok) return files;

  const { attempts: plan, skipped } = await gpuAwarePlan(ctx.installs, ctx.run, options.signal);
  const failures: WhisperAttemptFailure[] = [...skipped];
  let decodedLang: string = options.lang;
  let firstAttempt = 0;
  if (options.lang === 'auto') {
    progress('detect-language');
    const detected = await detectLanguage(ctx, options, plan, files.value, chunks.value, failures);
    if (!detected.ok) return detected;
    decodedLang = detected.value.lang;
    firstAttempt = detected.value.attemptIndex;
  }
  progress('transcribe');
  const threads = String(options.threads ?? 4);
  const run = await runWithFallback(
    ctx,
    plan,
    firstAttempt,
    (attempt) => [
      '-m',
      ctx.modelPath,
      '-l',
      decodedLang,
      '-t',
      threads,
      '-ml',
      '1',
      '-sow',
      '-ojf',
      '-np',
      '-nfa',
      '-dtw',
      ctx.model.dtwPreset,
      ...decodingArgs(options.decoding),
      ...gpuArgs(attempt),
      ...files.value,
    ],
    failures,
    options.signal,
  );
  if (!run.ok) return run;
  const segmentWords = await readChunkWords(files.value, chunks.value);
  if (!segmentWords.ok) return segmentWords;

  const attempt = plan[run.value.attemptIndex];
  const log = `${run.value.output.stdout}\n${run.value.output.stderr}`;
  const dtwLeadS = options.dtwLeadS ?? ctx.model.dtwLeadS;
  const raw: WordsRaw = {
    version: WORDS_RAW_VERSION,
    engine: 'whisper.cpp',
    model: ctx.model.id,
    lang: options.lang,
    decodedLang,
    mode: 'chunk',
    backend: attempt?.install.backend ?? 'custom',
    usedGpu: attempt?.noGpu === false && /ggml_cuda_init: found [1-9]/.test(log),
    fallbacks: failures,
    dtwLeadS,
    audioS: Math.round(durationS.value * 1000) / 1000,
    wallMs: Math.round(Number(process.hrtime.bigint() - started) / 1e6),
    chunks: chunks.value,
    words: calibrateDtw(segmentWords.value, dtwLeadS),
  };
  if (options.outPath === undefined) return ok(raw);
  progress('write');
  const written = await writeJsonAtomic(options.outPath, WordsRawSchema, raw);
  return written.ok
    ? ok(written.value)
    : err({ kind: 'io', message: written.error.message, path: options.outPath });
}
