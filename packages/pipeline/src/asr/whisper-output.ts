/**
 * Pure helpers around whisper.cpp I/O (ADR-003): `-ojf` JSON -> words, Silero VAD tool stdout ->
 * speech segments, VAD segments -> decode chunks, DTW token times -> calibrated word times.
 */
import { z } from 'zod';
import type { RawWord } from '../schemas/words.js';

/** Word as whisper reports it (segment offsets with `-ml 1 -sow`), times in seconds. */
export interface SegmentWord {
  readonly text: string;
  readonly t: number;
  readonly tEnd: number;
  readonly p: number;
  readonly tDtw: number | null;
}

const WhisperTokenSchema = z.object({
  text: z.string(),
  p: z.number(),
  t_dtw: z.number().optional(),
});

/** Subset of `whisper-cli -ojf` output that we rely on. */
export const WhisperJsonSchema = z.object({
  result: z.object({ language: z.string() }).optional(),
  transcription: z.array(
    z.object({
      offsets: z.object({ from: z.number(), to: z.number() }),
      text: z.string(),
      tokens: z.array(WhisperTokenSchema),
    }),
  ),
});
export type WhisperJson = z.infer<typeof WhisperJsonSchema>;

const isSpecialToken = (text: string): boolean => text.startsWith('[_') && text.endsWith(']');
const round3 = (value: number): number => Math.round(value * 1000) / 1000;

/** whisper -ojf (with -ml 1 -sow) -> one entry per word; DTW times are centiseconds in the JSON. */
export function wordsFromWhisperJson(json: WhisperJson): SegmentWord[] {
  const words: SegmentWord[] = [];
  for (const segment of json.transcription) {
    const tokens = segment.tokens.filter((token) => !isSpecialToken(token.text));
    const text = segment.text.trim();
    if (tokens.length === 0 || text.length === 0) continue;
    const firstDtw = tokens.find((token) => (token.t_dtw ?? -1) >= 0)?.t_dtw;
    const meanP = tokens.reduce((sum, token) => sum + token.p, 0) / tokens.length;
    words.push({
      text,
      t: segment.offsets.from / 1000,
      tEnd: segment.offsets.to / 1000,
      p: round3(Math.min(1, Math.max(0, meanP))),
      tDtw: firstDtw === undefined ? null : firstDtw / 100,
    });
  }
  return words;
}

/** Shifts chunk-relative word times onto the input timeline. */
export function shiftWords(words: readonly SegmentWord[], offsetS: number): SegmentWord[] {
  return words.map((word) => ({
    ...word,
    t: word.t + offsetS,
    tEnd: word.tEnd + offsetS,
    tDtw: word.tDtw === null ? null : word.tDtw + offsetS,
  }));
}

export interface TimeSpan {
  readonly start: number;
  readonly end: number;
}

/**
 * `whisper-vad-speech-segments` stdout ("Speech segment N: start = 157.00, end = 797.00", in
 * centiseconds) -> seconds. Its stderr repeats the segments in seconds: never parse stderr.
 */
export function parseVadSegments(stdout: string): TimeSpan[] {
  return [...stdout.matchAll(/Speech segment \d+: start = ([\d.]+), end = ([\d.]+)/g)].map(
    (match) => ({ start: Number(match[1]) / 100, end: Number(match[2]) / 100 }),
  );
}

export interface ChunkPlanOptions {
  /** Always split at pauses at least this long (default 1.5 s). */
  readonly splitGapS?: number;
  /** Merge neighbouring segments up to this chunk length (default 28 s; whisper's window is 30). */
  readonly maxChunkS?: number;
  /** Padding around each chunk (default 0.25 s). */
  readonly padS?: number;
}

/**
 * Groups VAD segments into decode chunks: split at long pauses, otherwise merge greedily up to
 * `maxChunkS`, then pad. Long silences never reach the decoder (they trigger dropped paragraphs,
 * repetition loops, hallucinations) while chunks stay long enough to give it context.
 */
export function planChunks(
  segments: readonly TimeSpan[],
  durationS: number,
  options: ChunkPlanOptions = {},
): TimeSpan[] {
  const splitGapS = options.splitGapS ?? 1.5;
  const maxChunkS = options.maxChunkS ?? 28;
  const padS = options.padS ?? 0.25;
  const chunks: { start: number; end: number }[] = [];
  for (const segment of segments) {
    const last = chunks.at(-1);
    const joinable =
      last !== undefined &&
      segment.start - last.end < splitGapS &&
      segment.end - last.start <= maxChunkS;
    if (joinable) last.end = segment.end;
    else chunks.push({ start: segment.start, end: segment.end });
  }
  return chunks.map((chunk) => ({
    start: round3(Math.max(0, chunk.start - padS)),
    end: round3(Math.min(durationS, chunk.end + padS)),
  }));
}

/**
 * Re-times words from DTW token times: t = t_dtw - leadS (DTW lags the spoken onset by a stable
 * per-model amount), tEnd = next word's start (last word: t + its segment length, max 1 s).
 * Words without a DTW time keep their segment start.
 */
export function calibrateDtw(words: readonly SegmentWord[], leadS: number): RawWord[] {
  const starts = words.map((word) => (word.tDtw === null ? null : Math.max(0, word.tDtw - leadS)));
  const nextStart: (number | null)[] = new Array<number | null>(words.length).fill(null);
  for (let k = words.length - 2; k >= 0; k--)
    nextStart[k] = starts[k + 1] ?? nextStart[k + 1] ?? null;
  return words.map((word, k) => {
    const t = starts[k] ?? word.t;
    const next = nextStart[k] ?? null;
    const tEnd = Math.max(t + 0.05, next ?? t + Math.min(1, word.tEnd - word.t));
    return {
      text: word.text,
      t: round3(Math.max(0, t)),
      tEnd: round3(Math.max(0, tEnd)),
      p: word.p,
      tDtw: word.tDtw === null ? null : round3(word.tDtw),
    };
  });
}
