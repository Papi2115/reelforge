/**
 * Scales Needleman–Wunsch to long scripts (ADR-003: O(n²) took 21.6 s for 1,720 words): split
 * both sequences at k-grams that occur exactly once on each side (taken in a monotonic chain),
 * align the gaps between them recursively, and fall back to a diagonal band for gaps that are
 * still too large.
 */
import {
  compareTokens,
  needlemanWunsch,
  type AlignedPair,
  type Token,
} from './needleman-wunsch.js';

/** Gaps up to this many DP cells are aligned with the full matrix. */
const FULL_MATRIX_CELLS = 60_000;
const ANCHOR_GRAM_SIZES = [3, 2] as const;
const BAND_MARGIN = 48;

interface Anchor {
  readonly a: number;
  readonly b: number;
  readonly length: number;
}

function gramKey(tokens: readonly Token[], start: number, size: number): string {
  let key = '';
  for (let k = 0; k < size; k++) key += `${tokens[start + k]?.folded ?? ''}\u0000`;
  return key;
}

/** Positions of k-grams that occur exactly once in [from, to). */
function uniqueGrams(
  tokens: readonly Token[],
  from: number,
  to: number,
  size: number,
): Map<string, number> {
  const positions = new Map<string, number>();
  const repeated = new Set<string>();
  for (let start = from; start + size <= to; start++) {
    const key = gramKey(tokens, start, size);
    if (positions.has(key)) repeated.add(key);
    else positions.set(key, start);
  }
  for (const key of repeated) positions.delete(key);
  return positions;
}

/** Longest chain of candidates increasing in both a and b (patience sorting, O(n log n)). */
function longestIncreasingChain(candidates: readonly Anchor[]): Anchor[] {
  const sorted = [...candidates].sort((x, y) => x.a - y.a);
  const tails: number[] = [];
  const previous = new Int32Array(sorted.length).fill(-1);
  for (let index = 0; index < sorted.length; index++) {
    const b = sorted[index]?.b ?? 0;
    let low = 0;
    let high = tails.length;
    while (low < high) {
      const mid = (low + high) >> 1;
      if ((sorted[tails[mid] ?? 0]?.b ?? 0) < b) low = mid + 1;
      else high = mid;
    }
    if (low > 0) previous[index] = tails[low - 1] ?? -1;
    tails[low] = index;
  }
  const chain: Anchor[] = [];
  for (let index = tails.at(-1) ?? -1; index >= 0; index = previous[index] ?? -1) {
    const anchor = sorted[index];
    if (anchor !== undefined) chain.push(anchor);
  }
  return chain.reverse();
}

/** Monotonic, non-overlapping anchors inside the window; overlapping grams on one diagonal merge. */
function findAnchors(
  a: readonly Token[],
  b: readonly Token[],
  window: Window,
  size: number,
): Anchor[] {
  const inA = uniqueGrams(a, window.aFrom, window.aTo, size);
  const inB = uniqueGrams(b, window.bFrom, window.bTo, size);
  const candidates: Anchor[] = [];
  for (const [key, position] of inA) {
    const match = inB.get(key);
    if (match !== undefined) candidates.push({ a: position, b: match, length: size });
  }
  const anchors: Anchor[] = [];
  for (const anchor of longestIncreasingChain(candidates)) {
    const last = anchors.at(-1);
    if (
      last === undefined ||
      (anchor.a >= last.a + last.length && anchor.b >= last.b + last.length)
    ) {
      anchors.push(anchor);
    } else if (anchor.a - last.a === anchor.b - last.b) {
      anchors[anchors.length - 1] = { ...last, length: anchor.a + anchor.length - last.a };
    }
  }
  return anchors;
}

interface Window {
  readonly aFrom: number;
  readonly aTo: number;
  readonly bFrom: number;
  readonly bTo: number;
}

function alignWithMatrix(
  a: readonly Token[],
  b: readonly Token[],
  window: Window,
  out: AlignedPair[],
): void {
  const rows = window.aTo - window.aFrom;
  const cols = window.bTo - window.bFrom;
  const banded = rows * cols > FULL_MATRIX_CELLS;
  const pairs = needlemanWunsch(
    a.slice(window.aFrom, window.aTo),
    b.slice(window.bFrom, window.bTo),
    {
      bandHalfWidth: banded ? Math.abs(rows - cols) + BAND_MARGIN : undefined,
    },
  );
  for (const pair of pairs) {
    out.push({
      a: pair.a === null ? null : pair.a + window.aFrom,
      b: pair.b === null ? null : pair.b + window.bFrom,
      cmp: pair.cmp,
    });
  }
}

function alignWindow(
  a: readonly Token[],
  b: readonly Token[],
  window: Window,
  out: AlignedPair[],
): void {
  const rows = window.aTo - window.aFrom;
  const cols = window.bTo - window.bFrom;
  if (rows * cols > FULL_MATRIX_CELLS) {
    for (const size of ANCHOR_GRAM_SIZES) {
      const anchors = findAnchors(a, b, window, size);
      if (anchors.length > 0) {
        alignBetweenAnchors(a, b, window, anchors, out);
        return;
      }
    }
  }
  alignWithMatrix(a, b, window, out);
}

function alignBetweenAnchors(
  a: readonly Token[],
  b: readonly Token[],
  window: Window,
  anchors: readonly Anchor[],
  out: AlignedPair[],
): void {
  let aCursor = window.aFrom;
  let bCursor = window.bFrom;
  for (const anchor of anchors) {
    alignWindow(a, b, { aFrom: aCursor, aTo: anchor.a, bFrom: bCursor, bTo: anchor.b }, out);
    for (let k = 0; k < anchor.length; k++) {
      const tokenA = a[anchor.a + k];
      const tokenB = b[anchor.b + k];
      if (tokenA === undefined || tokenB === undefined) continue;
      out.push({ a: anchor.a + k, b: anchor.b + k, cmp: compareTokens(tokenA, tokenB) });
    }
    aCursor = anchor.a + anchor.length;
    bCursor = anchor.b + anchor.length;
  }
  alignWindow(a, b, { aFrom: aCursor, aTo: window.aTo, bFrom: bCursor, bTo: window.bTo }, out);
}

/**
 * Global alignment of `a` and `b` that stays fast for thousands of tokens. Small inputs use the
 * full Needleman–Wunsch matrix (identical to the spike).
 */
export function alignTokens(a: readonly Token[], b: readonly Token[]): AlignedPair[] {
  const out: AlignedPair[] = [];
  alignWindow(a, b, { aFrom: 0, aTo: a.length, bFrom: 0, bTo: b.length }, out);
  return out;
}
