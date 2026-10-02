/**
 * Needleman–Wunsch global alignment of two token sequences with gap moves and merge/split moves
 * (up to MAX_MERGE tokens of one side ~ one token of the other: "a small team" ~ "asmolteam",
 * "cannot" ~ "can not"). Optional diagonal band bounds time and memory for long sequences.
 */
import { stringSimilarity } from './levenshtein.js';

export interface Token {
  /** Normalised token (see text/normalize.ts). */
  readonly text: string;
  /** Diacritics-folded `text`. */
  readonly folded: string;
}

export type MatchKind = 'exact' | 'folded' | 'fuzzy' | 'sub';

export interface TokenComparison {
  readonly score: number;
  readonly kind: MatchKind;
  /** 1 for exact/folded, letter similarity otherwise. */
  readonly similarity: number;
}

/** One alignment column: indexes into a / b (null = gap) and how the tokens compared. */
export interface AlignedPair {
  readonly a: number | null;
  readonly b: number | null;
  readonly cmp: TokenComparison | null;
}

const GAP = -1;
const MAX_MERGE = 3;
const MERGE_PENALTY = 0.25;
const MIN_FUZZY_SIMILARITY = 0.5;
const SUB: TokenComparison = { score: -1, kind: 'sub', similarity: 0 };

export function compareTokens(a: Token, b: Token): TokenComparison {
  if (a.text === b.text) return { score: 2, kind: 'exact', similarity: 1 };
  if (a.folded === b.folded) return { score: 1.6, kind: 'folded', similarity: 1 };
  const shorter = Math.min(a.folded.length, b.folded.length);
  const longer = Math.max(a.folded.length, b.folded.length);
  // similarity <= shorter / longer, so a large length ratio cannot reach the fuzzy threshold.
  if (shorter < longer * MIN_FUZZY_SIMILARITY) return SUB;
  const similarity = stringSimilarity(a.folded, b.folded);
  if (similarity >= MIN_FUZZY_SIMILARITY) {
    return { score: 2 * similarity - 1, kind: 'fuzzy', similarity };
  }
  return { ...SUB, similarity };
}

function joinTokens(tokens: readonly Token[], end: number, count: number): Token {
  if (count === 1) return tokens[end - 1] ?? { text: '', folded: '' };
  const slice = tokens.slice(end - count, end);
  return { text: slice.map((t) => t.text).join(''), folded: slice.map((t) => t.folded).join('') };
}

/** Column window [lo, hi] per row; the full matrix when `halfWidth` is unset. */
class BandedMatrix {
  readonly lo: Int32Array;
  readonly hi: Int32Array;
  readonly offset: Float64Array;
  readonly score: Float64Array;
  readonly stepA: Uint8Array;
  readonly stepB: Uint8Array;

  constructor(rows: number, cols: number, halfWidth: number | undefined) {
    this.lo = new Int32Array(rows + 1);
    this.hi = new Int32Array(rows + 1);
    this.offset = new Float64Array(rows + 2);
    for (let i = 0; i <= rows; i++) {
      if (halfWidth === undefined) {
        this.lo[i] = 0;
        this.hi[i] = cols;
      } else {
        const center = rows === 0 ? 0 : Math.round((i * cols) / rows);
        this.lo[i] = Math.max(0, center - halfWidth);
        this.hi[i] = Math.min(cols, center + halfWidth);
      }
      this.offset[i + 1] = (this.offset[i] ?? 0) + (this.hi[i] ?? 0) - (this.lo[i] ?? 0) + 1;
    }
    const total = this.offset[rows + 1] ?? 0;
    this.score = new Float64Array(total);
    this.stepA = new Uint8Array(total);
    this.stepB = new Uint8Array(total);
  }

  /** Flat index of (i, j), or -1 outside the band. */
  index(i: number, j: number): number {
    const lo = this.lo[i] ?? 0;
    if (i < 0 || j < lo || j > (this.hi[i] ?? -1)) return -1;
    return (this.offset[i] ?? 0) + j - lo;
  }

  get(i: number, j: number): number {
    const index = this.index(i, j);
    return index < 0 ? -Infinity : (this.score[index] ?? -Infinity);
  }
}

export interface NeedlemanWunschOptions {
  /** Max distance (in tokens of `b`) from the scaled diagonal; unset = full matrix. */
  readonly bandHalfWidth?: number | undefined;
}

/** Minimum band that keeps neighbouring rows connected for any length ratio. */
export function minimumBand(rows: number, cols: number): number {
  return Math.ceil(cols / Math.max(1, rows)) + MAX_MERGE + 1;
}

function fillCell(
  matrix: BandedMatrix,
  a: readonly Token[],
  b: readonly Token[],
  i: number,
  j: number,
): void {
  let best = matrix.get(i - 1, j) + GAP;
  let bestA = 1;
  let bestB = 0;
  const consider = (value: number, da: number, db: number): void => {
    if (value > best) {
      best = value;
      bestA = da;
      bestB = db;
    }
  };
  consider(matrix.get(i, j - 1) + GAP, 0, 1);
  const diagonal = matrix.get(i - 1, j - 1);
  if (diagonal > -Infinity) {
    consider(diagonal + compareTokens(joinTokens(a, i, 1), joinTokens(b, j, 1)).score, 1, 1);
  }
  for (let k = 2; k <= MAX_MERGE; k++) {
    if (i >= k) {
      const from = matrix.get(i - k, j - 1);
      if (from > -Infinity) {
        const cmp = compareTokens(joinTokens(a, i, k), joinTokens(b, j, 1));
        if (cmp.kind !== 'sub') consider(from + cmp.score * k - MERGE_PENALTY, k, 1);
      }
    }
    if (j >= k) {
      const from = matrix.get(i - 1, j - k);
      if (from > -Infinity) {
        const cmp = compareTokens(joinTokens(a, i, 1), joinTokens(b, j, k));
        if (cmp.kind !== 'sub') consider(from + cmp.score * k - MERGE_PENALTY, 1, k);
      }
    }
  }
  const index = matrix.index(i, j);
  matrix.score[index] = best;
  matrix.stepA[index] = bestA;
  matrix.stepB[index] = bestB;
}

/** Global alignment; pairs are returned in sequence order. */
export function needlemanWunsch(
  a: readonly Token[],
  b: readonly Token[],
  options: NeedlemanWunschOptions = {},
): AlignedPair[] {
  const rows = a.length;
  const cols = b.length;
  const band =
    options.bandHalfWidth === undefined
      ? undefined
      : Math.max(options.bandHalfWidth, minimumBand(rows, cols));
  const matrix = new BandedMatrix(rows, cols, band);
  for (let i = 0; i <= rows; i++) {
    for (let j = matrix.lo[i] ?? 0; j <= (matrix.hi[i] ?? -1); j++) {
      const index = matrix.index(i, j);
      if (i === 0 || j === 0) {
        matrix.score[index] = (i + j) * GAP;
        matrix.stepA[index] = i === 0 ? 0 : 1;
        matrix.stepB[index] = i === 0 ? 1 : 0;
      } else {
        fillCell(matrix, a, b, i, j);
      }
    }
  }
  return traceBack(matrix, a, b);
}

function traceBack(matrix: BandedMatrix, a: readonly Token[], b: readonly Token[]): AlignedPair[] {
  const pairs: AlignedPair[] = [];
  let i = a.length;
  let j = b.length;
  while (i > 0 || j > 0) {
    const index = matrix.index(i, j);
    const da = matrix.stepA[index] ?? 1;
    const db = matrix.stepB[index] ?? 0;
    if (da > 0 && db > 0) {
      const cmp = compareTokens(joinTokens(a, i, da), joinTokens(b, j, db));
      for (let x = 0; x < Math.max(da, db); x++) {
        pairs.push({ a: i - Math.min(da, x + 1), b: j - Math.min(db, x + 1), cmp });
      }
    } else if (da > 0) {
      pairs.push({ a: i - 1, b: null, cmp: null });
    } else {
      pairs.push({ a: null, b: j - 1, cmp: null });
    }
    i -= da;
    j -= db;
  }
  return pairs.reverse();
}
