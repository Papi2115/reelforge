/**
 * Words timed retry policy (spike 03 §9): a transcription is poor when the script coverage of the
 * alignment is below the minimum or whisper looped (the same n-gram repeated many times). Poor
 * results are retried with `-bs 5 -tp 0.2`, then with another installed model; the best one wins.
 */
import type { WhisperDecoding, WhisperModelId } from '@reelforge/pipeline';

export interface RepetitionLoop {
  /** Index of the first word of the loop. */
  readonly start: number;
  /** n-gram length. */
  readonly n: number;
  readonly repeats: number;
}

const MAX_NGRAM = 6;
/** One word repeated this often in a row is a loop ("the the the …"). */
const MIN_REPEATS_UNIGRAM = 6;
const MIN_REPEATS_NGRAM = 4;

const normalize = (text: string): string =>
  text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '')
    .trim();

function repeatsAt(tokens: readonly string[], start: number, n: number): number {
  let repeats = 1;
  for (;;) {
    const next = start + repeats * n;
    if (next + n > tokens.length) return repeats;
    for (let k = 0; k < n; k += 1) {
      if (tokens[start + k] !== tokens[next + k]) return repeats;
    }
    repeats += 1;
  }
}

/** First decoder loop in the raw words, if any. */
export function findRepetitionLoop(
  words: readonly { readonly text: string }[],
): RepetitionLoop | undefined {
  const tokens = words.map((word) => normalize(word.text)).filter((token) => token !== '');
  for (let start = 0; start < tokens.length; start += 1) {
    for (let n = 1; n <= MAX_NGRAM; n += 1) {
      const needed = n === 1 ? MIN_REPEATS_UNIGRAM : MIN_REPEATS_NGRAM;
      if (start + n * needed > tokens.length) break;
      const repeats = repeatsAt(tokens, start, n);
      if (repeats >= needed) return { start, n, repeats };
    }
  }
  return undefined;
}

export interface AttemptPlan {
  readonly model: WhisperModelId;
  readonly decoding: WhisperDecoding | undefined;
}

/** Spike 03 retry decoding. */
export const RETRY_DECODING: WhisperDecoding = { beamSize: 5, temperature: 0.2 };

export function attemptPlan(
  model: WhisperModelId,
  fallback: WhisperModelId | null,
  isInstalled: (model: WhisperModelId) => boolean,
): AttemptPlan[] {
  const plan: AttemptPlan[] = [
    { model, decoding: undefined },
    { model, decoding: RETRY_DECODING },
  ];
  if (fallback !== null && fallback !== model && isInstalled(fallback)) {
    plan.push({ model: fallback, decoding: undefined });
  }
  return plan;
}

export interface Scored {
  readonly coverage: number;
  readonly loop: boolean;
}

/** Loop-free beats looping; then higher coverage; ties keep the earlier attempt. */
export function isBetter(candidate: Scored, best: Scored | undefined): boolean {
  if (best === undefined) return true;
  if (candidate.loop !== best.loop) return !candidate.loop;
  return candidate.coverage > best.coverage;
}
