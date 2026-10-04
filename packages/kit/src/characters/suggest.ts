/**
 * "Did you mean" for role specs and accessories (ADR-026): the closest vocabulary id to a
 * misspelt one (`firehelmet` -> `fireHelmet`, `helmet` -> `fireHelmet`), so a runtime Claude or a
 * user fixes a spec from the error alone.
 */

function distance(a: string, b: string): number {
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current.push(
        Math.min((previous[j] ?? 0) + 1, (current[j - 1] ?? 0) + 1, (previous[j - 1] ?? 0) + cost),
      );
    }
    previous = current;
  }
  return previous[b.length] ?? 0;
}

/** The candidate closest to `value` (case-insensitive edit distance or containment), if any. */
export function closestId(value: string, candidates: readonly string[]): string | undefined {
  const wanted = value.toLowerCase();
  if (wanted === '') return undefined;
  let best: { id: string; score: number } | undefined;
  for (const candidate of candidates) {
    const lower = candidate.toLowerCase();
    const contained =
      Math.min(wanted.length, lower.length) >= 4 &&
      (lower.includes(wanted) || wanted.includes(lower));
    const score = lower === wanted ? 0 : contained ? 0.5 : distance(wanted, lower);
    if (best === undefined || score < best.score) best = { id: candidate, score };
  }
  if (best === undefined) return undefined;
  const limit = Math.max(2, Math.floor(wanted.length / 3));
  return best.score <= limit ? best.id : undefined;
}

/** ` (did you mean "x"?)` or ''. */
export function didYouMean(value: string, candidates: readonly string[]): string {
  const id = closestId(value, candidates);
  return id === undefined || id === value ? '' : ` (did you mean "${id}"?)`;
}
