/**
 * Word lookup for live co-direction commands (PLAN.md#12.14): "arrow on the word X" resolves X
 * against the shot's timed words, case- and diacritics-insensitive, tolerating one typo in longer
 * words, and picks the occurrence nearest to the playhead. Pure.
 */

export interface DirectionWord {
  readonly text: string;
  readonly t: number;
  readonly tEnd: number;
}

export interface WordMatch {
  /** Index of the first matched word in the words list. */
  readonly index: number;
  /** Number of consecutive words matched (a phrase). */
  readonly length: number;
  readonly t: number;
  readonly tEnd: number;
  /** The words as spoken. */
  readonly text: string;
  /** Other occurrences in the shot (the nearest to the playhead was taken). */
  readonly others: number;
  /** True when the match needed a prefix or a one-letter typo. */
  readonly fuzzy: boolean;
}

/** Lowercase, without diacritics (ł too) and anything but letters and digits. */
export function foldText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .replace(/ł/g, 'l')
    .replace(/Ł/g, 'l')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '');
}

/** Levenshtein distance capped at 2 (enough to accept one typo). */
function closeEnough(first: string, second: string): boolean {
  if (Math.abs(first.length - second.length) > 1) return false;
  let previous = Array.from({ length: second.length + 1 }, (_, index) => index);
  for (let row = 1; row <= first.length; row += 1) {
    const current = [row];
    for (let column = 1; column <= second.length; column += 1) {
      const cost = first[row - 1] === second[column - 1] ? 0 : 1;
      current.push(
        Math.min(
          (previous[column] ?? 0) + 1,
          (current[column - 1] ?? 0) + 1,
          (previous[column - 1] ?? 0) + cost,
        ),
      );
    }
    previous = current;
  }
  return (previous[second.length] ?? 2) <= 1;
}

type Quality = 0 | 1 | 2;

/** 2 = exact, 1 = prefix / typo, 0 = no match. */
function wordQuality(spoken: string, wanted: string): Quality {
  if (spoken === '' || wanted === '') return 0;
  if (spoken === wanted) return 2;
  if (wanted.length >= 3 && spoken.startsWith(wanted)) return 1;
  if (wanted.length >= 4 && closeEnough(spoken, wanted)) return 1;
  return 0;
}

interface Candidate {
  readonly index: number;
  readonly quality: Quality;
}

/**
 * The occurrence of `phrase` (one or more words) among `words[from..to)` nearest to `playhead`;
 * exact matches win over fuzzy ones. Undefined when nothing matches.
 */
export function findWord(
  words: readonly DirectionWord[],
  phrase: string,
  range: { readonly from: number; readonly to: number },
  playhead: number,
): WordMatch | undefined {
  const wanted = phrase
    .split(/\s+/)
    .map(foldText)
    .filter((part) => part !== '');
  if (wanted.length === 0) return undefined;
  const folded = words.map((word) => foldText(word.text));
  const candidates: Candidate[] = [];
  for (let index = range.from; index + wanted.length <= range.to; index += 1) {
    let quality: Quality = 2;
    for (const [offset, part] of wanted.entries()) {
      const next = wordQuality(folded[index + offset] ?? '', part);
      quality = Math.min(quality, next) as Quality;
      if (quality === 0) break;
    }
    if (quality > 0) candidates.push({ index, quality });
  }
  const best = Math.max(0, ...candidates.map((candidate) => candidate.quality));
  const pool = candidates.filter((candidate) => candidate.quality === best);
  const distance = (candidate: Candidate): number =>
    Math.abs((words[candidate.index]?.t ?? 0) - playhead);
  const chosen = pool.reduce<Candidate | undefined>(
    (nearest, candidate) =>
      nearest === undefined || distance(candidate) < distance(nearest) ? candidate : nearest,
    undefined,
  );
  if (chosen === undefined) return undefined;
  const first = words[chosen.index];
  const last = words[chosen.index + wanted.length - 1];
  if (first === undefined || last === undefined) return undefined;
  return {
    index: chosen.index,
    length: wanted.length,
    t: first.t,
    tEnd: last.tEnd,
    text: words
      .slice(chosen.index, chosen.index + wanted.length)
      .map((word) => word.text)
      .join(' '),
    others: pool.length - 1,
    fuzzy: best < 2,
  };
}

/** The word spoken at the playhead (or the nearest one) inside the range; undefined when none. */
export function wordAtPlayhead(
  words: readonly DirectionWord[],
  range: { readonly from: number; readonly to: number },
  playhead: number,
): WordMatch | undefined {
  let chosen: number | undefined;
  let best = Number.POSITIVE_INFINITY;
  for (let index = range.from; index < range.to; index += 1) {
    const word = words[index];
    if (word === undefined) continue;
    const distance =
      playhead >= word.t && playhead <= word.tEnd
        ? 0
        : Math.min(Math.abs(word.t - playhead), Math.abs(word.tEnd - playhead));
    if (distance < best) {
      best = distance;
      chosen = index;
    }
  }
  const word = chosen === undefined ? undefined : words[chosen];
  if (chosen === undefined || word === undefined) return undefined;
  return {
    index: chosen,
    length: 1,
    t: word.t,
    tEnd: word.tEnd,
    text: word.text,
    others: 0,
    fuzzy: false,
  };
}

/** Index range [from, to) of the words that start inside [t0, t1). */
export function wordRange(
  words: readonly DirectionWord[],
  t0: number,
  t1: number,
): { from: number; to: number } {
  let from = words.findIndex((word) => word.t >= t0);
  if (from < 0) from = words.length;
  let to = from;
  while (to < words.length && (words[to]?.t ?? Number.POSITIVE_INFINITY) < t1) to += 1;
  return { from, to };
}
