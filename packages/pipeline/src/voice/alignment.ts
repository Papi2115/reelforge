/**
 * ElevenLabs character alignment -> words.json (PLAN.md#13.14). The `/with-timestamps` alignment
 * maps to the original text sent, so words are the script's own whitespace tokens (the same ones
 * `tokenizeScript` counts) timed by their first/last letter or digit. Chunk offsets in the
 * assembled vo.original.wav are added. `compareWithWhisper` measures how far these times are from
 * whisper's on the same audio; using them instead of Words timed stays off until measured.
 */
import type { VoiceCharAlignment } from '@reelforge/shared';
import { err, ok, type Result } from '../result.js';
import { WORDS_FILE_VERSION, type WordsFile } from '../schemas/words.js';
import { voiceError, type VoiceError } from './errors.js';
import { isSpokenWord, type VoiceChunkPlan } from './script-chunks.js';

export interface ChunkWord {
  readonly text: string;
  /** Seconds from the start of the take. */
  readonly t: number;
  readonly tEnd: number;
}

interface CharTime {
  readonly start: number;
  readonly end: number;
}

/** Times of every non-whitespace code point of `text`, keyed by its code-unit offset. */
function charTimes(
  text: string,
  alignment: VoiceCharAlignment,
): Result<Map<number, CharTime>, VoiceError> {
  const timed: { char: string; time: CharTime }[] = [];
  alignment.characters.forEach((entry, index) => {
    const time = { start: alignment.starts[index] ?? 0, end: alignment.ends[index] ?? 0 };
    for (const char of entry) if (!/\s/u.test(char)) timed.push({ char, time });
  });
  const times = new Map<number, CharTime>();
  let next = 0;
  let offset = 0;
  for (const char of text) {
    if (!/\s/u.test(char)) {
      const entry = timed[next];
      if (entry?.char !== char) {
        return err(
          voiceError(
            'alignment',
            `alignment does not match the text at character ${String(offset)} ("${char}" vs "${entry?.char ?? 'end'}")`,
          ),
        );
      }
      times.set(offset, entry.time);
      next += 1;
    }
    offset += char.length;
  }
  if (next !== timed.length) {
    return err(
      voiceError('alignment', `alignment has ${String(timed.length - next)} extra characters`),
    );
  }
  return ok(times);
}

/** Spoken words of `text` with their times inside the take. */
export function alignmentToWords(
  text: string,
  alignment: VoiceCharAlignment,
): Result<ChunkWord[], VoiceError> {
  const times = charTimes(text, alignment);
  if (!times.ok) return times;
  const words: ChunkWord[] = [];
  for (const match of text.matchAll(/\S+/gu)) {
    const token = match[0];
    if (!isSpokenWord(token)) continue;
    const spans: { time: CharTime; core: boolean }[] = [];
    let offset = match.index;
    for (const char of token) {
      const time = times.value.get(offset);
      if (time !== undefined) spans.push({ time, core: /[\p{L}\p{N}]/u.test(char) });
      offset += char.length;
    }
    const core = spans.filter((span) => span.core);
    const used = core.length > 0 ? core : spans;
    const first = used[0];
    const last = used[used.length - 1];
    if (first === undefined || last === undefined) continue;
    const t = Math.max(0, first.time.start);
    words.push({ text: token, t, tEnd: Math.max(t, last.time.end) });
  }
  return ok(words);
}

export interface PlacedChunkWords {
  readonly chunk: VoiceChunkPlan;
  /** Where the chunk's take starts in vo.original.wav (seconds). */
  readonly offsetS: number;
  readonly words: readonly ChunkWord[];
}

const round4 = (value: number): number => Math.round(value * 10_000) / 10_000;

/** words.json from the takes' alignments (all chunks, in order). */
export function buildApiWordsFile(
  placed: readonly PlacedChunkWords[],
  modelId: string,
): Result<WordsFile, VoiceError> {
  const words: WordsFile['words'] = [];
  let clamped = 0;
  for (const { chunk, offsetS, words: chunkWords } of placed) {
    if (chunkWords.length !== chunk.wordCount) {
      return err(
        voiceError(
          'alignment',
          `chunk ${chunk.id}: ${String(chunkWords.length)} timed words, the script has ${String(chunk.wordCount)}`,
        ),
      );
    }
    chunkWords.forEach((word, k) => {
      const previous = words[words.length - 1];
      let t = round4(offsetS + word.t);
      const wasClamped = previous !== undefined && t < previous.t;
      if (wasClamped) {
        t = previous.t;
        clamped += 1;
      }
      words.push({
        i: chunk.firstWord + k,
        text: word.text,
        paragraph: chunk.paragraph,
        t,
        tEnd: Math.max(t, round4(offsetS + word.tEnd)),
        confidence: 1,
        status: 'exact',
        ...(wasClamped ? { clamped: true as const } : {}),
      });
    });
  }
  const count = words.length;
  return ok({
    version: WORDS_FILE_VERSION,
    lang: 'en',
    asrModel: `elevenlabs/${modelId}`,
    words,
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
      monotonic: clamped === 0,
      clamped,
    },
  });
}

export interface TimingComparison {
  /** Words timed by both (same index and text; whisper's `missing` words excluded). */
  readonly pairs: number;
  readonly medianAbsS: number | null;
  readonly p95AbsS: number | null;
  readonly maxAbsS: number | null;
  /** Median of api - whisper start (positive = API later). */
  readonly medianSignedS: number | null;
}

type ComparableWord = Pick<WordsFile['words'][number], 'i' | 'text' | 't' | 'status'>;

/** Nearest-rank percentile of an ascending list. */
function percentile(sorted: readonly number[], share: number): number | null {
  if (sorted.length === 0) return null;
  const rank = Math.min(sorted.length, Math.max(1, Math.ceil(share * sorted.length)));
  return sorted[rank - 1] ?? null;
}

/** Start-time differences between API-derived words and whisper words (both words.json shaped). */
export function compareWithWhisper(
  apiWords: readonly ComparableWord[],
  whisperWords: readonly ComparableWord[],
): TimingComparison {
  const whisperByIndex = new Map(
    whisperWords.filter((word) => word.status !== 'missing').map((word) => [word.i, word]),
  );
  const deltas: number[] = [];
  for (const word of apiWords) {
    const other = whisperByIndex.get(word.i);
    if (other?.text !== word.text) continue;
    deltas.push(word.t - other.t);
  }
  const absolute = deltas.map(Math.abs).sort((a, b) => a - b);
  const signed = [...deltas].sort((a, b) => a - b);
  return {
    pairs: deltas.length,
    medianAbsS: percentile(absolute, 0.5),
    p95AbsS: percentile(absolute, 0.95),
    maxAbsS: absolute[absolute.length - 1] ?? null,
    medianSignedS: percentile(signed, 0.5),
  };
}
