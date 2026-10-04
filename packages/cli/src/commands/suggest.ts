/** "Did you mean" suggestions for mistyped names (kit-docs topics, kit functions). */

function editDistance(first: string, second: string): number {
  const previous = Array.from({ length: second.length + 1 }, (_, index) => index);
  for (let row = 1; row <= first.length; row += 1) {
    let diagonal = previous[0] ?? 0;
    previous[0] = row;
    for (let column = 1; column <= second.length; column += 1) {
      const above = previous[column] ?? 0;
      const left = previous[column - 1] ?? 0;
      const cost = first[row - 1] === second[column - 1] ? 0 : 1;
      previous[column] = Math.min(above + 1, left + 1, diagonal + cost);
      diagonal = above;
    }
  }
  return previous[second.length] ?? 0;
}

/**
 * Up to `limit` known names closest to `input` (case-insensitive): names containing it or
 * contained in it first (both at least 4 letters), then those within an edit distance of a
 * third of the longer name (at least 2).
 */
export function suggestNames(input: string, known: readonly string[], limit = 3): string[] {
  const wanted = input.toLowerCase();
  if (wanted === '') return [];
  const scored = [...new Set(known)].flatMap((name) => {
    const candidate = name.toLowerCase();
    const shortest = Math.min(candidate.length, wanted.length);
    if (shortest >= 4 && (candidate.includes(wanted) || wanted.includes(candidate))) {
      return [{ name, score: Math.abs(candidate.length - wanted.length) / 100 }];
    }
    const distance = editDistance(wanted, candidate);
    const allowed = Math.max(2, Math.floor(Math.max(wanted.length, candidate.length) / 3));
    return distance <= allowed ? [{ name, score: distance }] : [];
  });
  return scored
    .sort((first, second) => first.score - second.score || first.name.localeCompare(second.name))
    .slice(0, limit)
    .map((entry) => entry.name);
}
