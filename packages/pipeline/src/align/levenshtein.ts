/** Edit distance over strings or token arrays, and word error rate. */

/** Levenshtein distance between two sequences (characters of a string or array items). */
export function levenshtein<T>(a: ArrayLike<T>, b: ArrayLike<T>): number {
  const previous = new Uint32Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) previous[j] = j;
  for (let i = 1; i <= a.length; i++) {
    let diagonal = previous[0] ?? 0;
    previous[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const above = previous[j] ?? 0;
      const left = previous[j - 1] ?? 0;
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      previous[j] = Math.min(above + 1, left + 1, diagonal + cost);
      diagonal = above;
    }
  }
  return previous[b.length] ?? 0;
}

/** Word error rate of a hypothesis vs a reference token list (can exceed 1 with insertions). */
export function wordErrorRate(reference: readonly string[], hypothesis: readonly string[]): number {
  if (reference.length === 0) return hypothesis.length === 0 ? 0 : 1;
  return levenshtein(reference, hypothesis) / reference.length;
}

/** 1 - normalised edit distance, in [0, 1]. */
export function stringSimilarity(a: string, b: string): number {
  const longest = Math.max(a.length, b.length);
  if (longest === 0) return 1;
  return 1 - levenshtein(a, b) / longest;
}
