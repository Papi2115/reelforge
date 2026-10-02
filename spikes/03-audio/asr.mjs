// whisper.cpp runner: 16 kHz conversion, whisper-cli invocation, -ojf parsing -> words.raw.json.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { BIN_DIR, MODELS_DIR, ensureDir, runChecked, writeJson } from './lib/common.mjs';
import { durationSeconds, ffmpeg } from './lib/ffmpeg.mjs';

export const MODELS = {
  base: { file: 'ggml-base.bin', dtw: 'base' },
  small: { file: 'ggml-small.bin', dtw: 'small' },
  medium: { file: 'ggml-medium.bin', dtw: 'medium' },
  'turbo-q5': { file: 'ggml-large-v3-turbo-q5_0.bin', dtw: 'large.v3.turbo' },
};

export const BACKENDS = {
  cuda: path.join(BIN_DIR, 'cuda', 'Release', 'whisper-cli.exe'),
  cpu: path.join(BIN_DIR, 'cpu', 'Release', 'whisper-cli.exe'),
  blas: path.join(BIN_DIR, 'blas', 'Release', 'whisper-cli.exe'),
};

const VAD_MODEL = path.join(MODELS_DIR, 'ggml-silero-v6.2.0.bin');

/** whisper.cpp wants 16 kHz mono; convert explicitly instead of relying on its internal decoder. */
export async function toWhisperWav(input, output) {
  ensureDir(path.dirname(output));
  await ffmpeg(['-i', input, '-ar', '16000', '-ac', '1', '-c:a', 'pcm_s16le', output]);
  return output;
}

/**
 * mode 'dtw': -dtw token timestamps (requires -nfa: with flash attention t_dtw stays -1).
 * mode 'vad': Silero VAD; segment offsets are mapped back to the input timeline (t_dtw is not).
 * Without outBase, every input file gets "<file>.json" next to it (used for multi-file runs).
 */
export function whisperArgs({ model, lang, mode, files, outBase, threads = 6 }) {
  const spec = MODELS[model];
  const args = ['-m', path.join(MODELS_DIR, spec.file), '-l', lang, '-t', String(threads)];
  args.push('-ml', '1', '-sow', '-ojf', '-np');
  if (outBase) args.push('-of', outBase);
  if (mode === 'dtw') args.push('-nfa', '-dtw', spec.dtw);
  if (mode === 'vad') args.push('--vad', '-vm', VAD_MODEL);
  return [...args, ...files];
}

const isSpecial = (token) => token.text.startsWith('[_') && token.text.endsWith(']');

/** whisper -ojf (with -ml 1 -sow) -> word list; times in seconds. */
export function parseWhisperJson(json) {
  const words = [];
  for (const segment of json.transcription) {
    const tokens = segment.tokens.filter((token) => !isSpecial(token));
    const text = segment.text.trim();
    if (tokens.length === 0 || text.length === 0) continue;
    const firstDtw = tokens.find((token) => token.t_dtw >= 0)?.t_dtw;
    words.push({
      text,
      t: segment.offsets.from / 1000,
      tEnd: segment.offsets.to / 1000,
      p:
        Math.round((tokens.reduce((sum, token) => sum + token.p, 0) / tokens.length) * 1000) / 1000,
      tDtw: firstDtw === undefined ? null : firstDtw / 100,
    });
  }
  return words;
}

/** Silero VAD speech segments (seconds) via the whisper-vad-speech-segments tool. */
export async function vadSegments(backend, wav) {
  const tool = path.join(path.dirname(BACKENDS[backend]), 'whisper-vad-speech-segments.exe');
  const result = await runChecked(tool, ['-vm', VAD_MODEL, '-f', wav]);
  return [...result.stdout.matchAll(/start = ([\d.]+), end = ([\d.]+)/g)].map((m) => ({
    start: Number(m[1]) / 100,
    end: Number(m[2]) / 100,
  }));
}

/**
 * Groups VAD segments into chunks: always split at long pauses (>= splitGapS), otherwise merge
 * greedily up to maxChunkS (whisper's window is 30 s); pad by padS. Long silences never reach the
 * decoder (they trigger whisper's dropped-paragraph / repetition-loop / hallucination failures),
 * while chunks stay long enough to give the decoder context (short chunks hurt WER in noise).
 */
export function planChunks(
  segments,
  durationS,
  { splitGapS = 1.5, maxChunkS = 28, padS = 0.25 } = {},
) {
  const chunks = [];
  for (const segment of segments) {
    const last = chunks[chunks.length - 1];
    const joinable =
      last && segment.start - last.end < splitGapS && segment.end - last.start <= maxChunkS;
    if (joinable) last.end = segment.end;
    else chunks.push({ start: segment.start, end: segment.end });
  }
  return chunks.map((chunk) => ({
    start: Math.max(0, chunk.start - padS),
    end: Math.min(durationS, chunk.end + padS),
  }));
}

function rawResult({ backend, model, lang, mode, wallMs, audioS, stderr, words }) {
  return {
    version: 1,
    engine: 'whisper.cpp',
    backend,
    model,
    lang,
    mode,
    wallMs: Math.round(wallMs),
    audioS,
    rtf: Math.round((wallMs / 1000 / audioS) * 1000) / 1000,
    usedGpu: /ggml_cuda_init: found/.test(stderr),
    words,
  };
}

/** VAD -> chunk wavs -> ONE whisper-cli call over all chunks (model loads once) -> shift times. */
async function transcribeChunked({ backend, model, lang, input, outBase, audioS }) {
  const started = process.hrtime.bigint();
  const chunks = planChunks(await vadSegments(backend, input), audioS);
  const dir = ensureDir(`${outBase}.chunks`);
  const files = [];
  for (const [index, chunk] of chunks.entries()) {
    const file = path.join(dir, `c${String(index).padStart(3, '0')}.wav`);
    const span = ['-ss', chunk.start.toFixed(3), '-to', chunk.end.toFixed(3)];
    await ffmpeg(['-i', input, ...span, '-c:a', 'pcm_s16le', file]);
    files.push(file);
  }
  const args = whisperArgs({ model, lang, mode: 'dtw', files });
  const result = await runChecked(BACKENDS[backend], args);
  const words = chunks.flatMap((chunk, index) =>
    parseWhisperJson(JSON.parse(readFileSync(`${files[index]}.json`, 'utf8'))).map((w) => ({
      ...w,
      t: w.t + chunk.start,
      tEnd: w.tEnd + chunk.start,
      tDtw: w.tDtw === null ? null : w.tDtw + chunk.start,
    })),
  );
  const wallMs = Number(process.hrtime.bigint() - started) / 1e6;
  return rawResult({
    backend,
    model,
    lang,
    mode: 'chunk',
    wallMs,
    audioS,
    stderr: result.stderr,
    words,
  });
}

/**
 * Runs whisper and writes <outBase>.raw.json ({ words, wallMs, audioS, rtf }).
 * mode: 'dtw' | 'vad' (single call over the whole file) | 'chunk' (VAD chunks + DTW).
 */
export async function transcribe({ backend, model, lang, mode, input, outBase }) {
  ensureDir(path.dirname(outBase));
  const audioS = await durationSeconds(input);
  let raw;
  if (mode === 'chunk') {
    raw = await transcribeChunked({ backend, model, lang, input, outBase, audioS });
  } else {
    const args = whisperArgs({ model, lang, mode, files: [input], outBase });
    const result = await runChecked(BACKENDS[backend], args);
    const words = parseWhisperJson(JSON.parse(readFileSync(`${outBase}.json`, 'utf8')));
    raw = rawResult({
      backend,
      model,
      lang,
      mode,
      wallMs: result.ms,
      audioS,
      stderr: result.stderr,
      words,
    });
  }
  writeJson(`${outBase}.raw.json`, raw);
  return raw;
}
