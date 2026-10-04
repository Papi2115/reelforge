/** Grouping of time-ordered occurrences for repetition control (PLAN.md#12.23, pure). */

/** Greedy groups of at least `count` occurrences within `windowS` (time order). */
export function clusters<T extends { readonly t: number }>(
  items: readonly T[],
  count: number,
  windowS: number,
): T[][] {
  const out: T[][] = [];
  let start = 0;
  while (start < items.length) {
    const first = items[start];
    if (first === undefined) break;
    let end = start;
    while ((items[end + 1]?.t ?? Number.POSITIVE_INFINITY) - first.t <= windowS) end += 1;
    if (end - start + 1 >= count) {
      out.push(items.slice(start, end + 1));
      start = end + 1;
    } else start += 1;
  }
  return out;
}
