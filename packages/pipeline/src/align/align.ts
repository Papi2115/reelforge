/**
 * Script <-> ASR word alignment (PLAN 4.4, ported from spikes/03-audio/align.mjs). Every script
 * word gets t/tEnd; `status` says how: exact | folded (diacritics) | fuzzy (similar spelling,
 * merged/split words) | missing (interpolated between neighbours, confidence 0). Word starts are
 * clamped to be non-decreasing (clamped words are flagged).
 */
import { alignTokens } from './anchored.js';
import { wordErrorRate } from './levenshtein.js';
import type { Token } from './needleman-wunsch.js';
import { mismatchRegions, type MismatchRegion } from './regions.js';
import {
  cleanWord,
  foldDiacritics,
  subTokens,
  tokenizeScript,
  werTokens,
} from '../text/normalize.js';

export type WordStatus = 'exact' | 'folded' | 'fuzzy' | 'missing';

/** ASR word with calibrated times in seconds; `p` = mean token probability. */
export interface AsrWord {
  readonly text: string;
  readonly t: number;
  readonly tEnd: number;
  readonly p?: number | null | undefined;
}

export interface AlignedWord {
  readonly i: number;
  readonly text: string;
  readonly paragraph: number;
  readonly t: number;
  readonly tEnd: number;
  readonly confidence: number;
  readonly status: WordStatus;
  /** Start moved forward to keep times non-decreasing (ASR times went backwards). */
  readonly clamped?: true | undefined;
}

export interface AlignmentStats {
  readonly scriptWords: number;
  readonly asrWords: number;
  /** Raw ASR word error rate vs the script (punctuation/case-insensitive). */
  readonly wer: number;
  readonly werFolded: number;
  readonly exact: number;
  readonly folded: number;
  readonly fuzzy: number;
  readonly missing: number;
  /** Share of script words matched exactly or diacritics-folded. */
  readonly coverage: number;
  /** Share of script words timed from ASR (not interpolated). */
  readonly timedShare: number;
  readonly insertions: number;
  /** ASR-derived starts were already non-decreasing (before clamping). */
  readonly monotonic: boolean;
  readonly clamped: number;
}

export interface AlignmentResult {
  readonly words: AlignedWord[];
  readonly mismatches: MismatchRegion[];
  readonly stats: AlignmentStats;
}

export interface AlignOptions {
  /** Language for number spelling (en/pl; others keep digits). */
  readonly lang: string;
  /** Audio length; end of the interpolation range for trailing missing words. */
  readonly audioS?: number | undefined;
}

interface MutableWord {
  i: number;
  text: string;
  paragraph: number;
  t: number | null;
  tEnd: number | null;
  confidence: number;
  status: WordStatus;
  clamped?: true;
}

interface Link {
  readonly asr: Set<number>;
  readonly subTokens: Set<number>;
  readonly kinds: string[];
  readonly similarity: number[];
}

const round = (seconds: number): number => Math.round(seconds * 1000) / 1000;
const letterWeight = (text: string): number => Math.max(1, cleanWord(text).length);

function flatten(texts: readonly string[], lang: string): { tokens: Token[]; owner: number[] } {
  const tokens: Token[] = [];
  const owner: number[] = [];
  texts.forEach((text, index) => {
    for (const token of subTokens(text, lang)) {
      tokens.push({ text: token, folded: foldDiacritics(token) });
      owner.push(index);
    }
  });
  return { tokens, owner };
}

/** Spreads untimed words over the gap between timed neighbours, by letter count. */
function interpolateMissing(words: MutableWord[], totalEnd: number): void {
  let index = 0;
  while (index < words.length) {
    if (words[index]?.t !== null) {
      index++;
      continue;
    }
    let end = index;
    while (end < words.length && words[end]?.t === null) end++;
    const from = index > 0 ? (words[index - 1]?.tEnd ?? 0) : 0;
    const to = Math.max(from, end < words.length ? (words[end]?.t ?? from) : totalEnd);
    const span = words.slice(index, end);
    const total = span.reduce((sum, word) => sum + letterWeight(word.text), 0);
    let cursor = from;
    for (const word of span) {
      const length = ((to - from) * letterWeight(word.text)) / total;
      word.t = round(cursor);
      word.tEnd = round(cursor + length);
      cursor += length;
    }
    index = end;
  }
}

/** One ASR word heard for several script words ("asmolteam"): split its span by letter count. */
function splitSharedAsrWords(
  words: MutableWord[],
  links: readonly Link[],
  asr: readonly AsrWord[],
): void {
  const sharers = new Map<number, number[]>();
  links.forEach((link, index) => {
    if (link.asr.size !== 1) return;
    const [asrIndex] = link.asr;
    if (asrIndex === undefined) return;
    sharers.set(asrIndex, [...(sharers.get(asrIndex) ?? []), index]);
  });
  for (const [asrIndex, indexes] of sharers) {
    const heard = asr[asrIndex];
    if (indexes.length < 2 || heard === undefined) continue;
    const total = indexes.reduce((sum, k) => sum + letterWeight(words[k]?.text ?? ''), 0);
    let cursor = heard.t;
    for (const k of indexes) {
      const word = words[k];
      if (word === undefined) continue;
      const length = ((heard.tEnd - heard.t) * letterWeight(word.text)) / total;
      word.t = round(cursor);
      word.tEnd = round(cursor + length);
      cursor += length;
    }
  }
}

function linkWords(
  scriptCount: number,
  pairs: ReturnType<typeof alignTokens>,
  aOwner: readonly number[],
  bOwner: readonly number[],
): { links: Link[]; usedAsr: Set<number> } {
  const links: Link[] = Array.from({ length: scriptCount }, () => ({
    asr: new Set<number>(),
    subTokens: new Set<number>(),
    kinds: [],
    similarity: [],
  }));
  const usedAsr = new Set<number>();
  for (const { a, b, cmp } of pairs) {
    if (a === null || b === null || cmp === null || cmp.kind === 'sub') continue;
    const link = links[aOwner[a] ?? -1];
    const asrIndex = bOwner[b];
    if (link === undefined || asrIndex === undefined) continue;
    link.asr.add(asrIndex);
    usedAsr.add(asrIndex);
    if (link.subTokens.has(a)) continue; // 1:k split -> count the script sub-token once
    link.subTokens.add(a);
    link.kinds.push(cmp.kind);
    link.similarity.push(cmp.similarity);
  }
  return { links, usedAsr };
}

function timedWord(
  index: number,
  text: string,
  paragraph: number,
  link: Link,
  asr: readonly AsrWord[],
  lang: string,
): MutableWord {
  if (link.asr.size === 0) {
    return { i: index, text, paragraph, t: null, tEnd: null, confidence: 0, status: 'missing' };
  }
  const expected = Math.max(1, subTokens(text, lang).length);
  const hits = [...link.asr].flatMap((k) => (asr[k] === undefined ? [] : [asr[k]]));
  const complete = link.kinds.length === expected;
  const status: WordStatus =
    !complete || link.kinds.includes('fuzzy')
      ? 'fuzzy'
      : link.kinds.includes('folded')
        ? 'folded'
        : 'exact';
  const probability = hits.reduce((sum, hit) => sum + (hit.p ?? 1), 0) / hits.length;
  const matchShare = link.similarity.reduce((sum, s) => sum + s, 0) / expected;
  const factor = status === 'exact' ? 1 : status === 'folded' ? 0.9 : 0.6 * matchShare;
  return {
    i: index,
    text,
    paragraph,
    t: round(Math.min(...hits.map((hit) => hit.t))),
    tEnd: round(Math.max(...hits.map((hit) => hit.tEnd))),
    confidence: round(Math.min(1, Math.max(0, probability * factor))),
    status,
  };
}

/** Keeps starts non-decreasing and ends >= starts; returns whether the input already was. */
function clampMonotonic(words: AlignedWord[]): { words: AlignedWord[]; monotonic: boolean } {
  let monotonic = true;
  let previousT = 0;
  const clamped = words.map((word, index) => {
    if (index > 0 && word.t < previousT - 1e-9) {
      monotonic = false;
      return {
        ...word,
        t: previousT,
        tEnd: Math.max(word.tEnd, previousT),
        clamped: true as const,
      };
    }
    previousT = word.t;
    return word.tEnd < word.t ? { ...word, tEnd: word.t } : word;
  });
  return { words: clamped, monotonic };
}

export function alignScript(
  scriptText: string,
  asr: readonly AsrWord[],
  options: AlignOptions,
): AlignmentResult {
  const { lang } = options;
  const script = tokenizeScript(scriptText);
  const a = flatten(
    script.map((word) => word.text),
    lang,
  );
  const b = flatten(
    asr.map((word) => word.text),
    lang,
  );
  const pairs = alignTokens(a.tokens, b.tokens);
  const { links, usedAsr } = linkWords(script.length, pairs, a.owner, b.owner);
  const mutable = script.map((word, index) => {
    const link = links[index] ?? {
      asr: new Set<number>(),
      subTokens: new Set<number>(),
      kinds: [],
      similarity: [],
    };
    return timedWord(index, word.text, word.paragraph, link, asr, lang);
  });
  splitSharedAsrWords(mutable, links, asr);
  const lastEnd = asr.at(-1)?.tEnd ?? 0;
  interpolateMissing(mutable, Math.max(lastEnd, options.audioS ?? 0));
  const timed: AlignedWord[] = mutable.map((word) => ({
    ...word,
    t: word.t ?? 0,
    tEnd: word.tEnd ?? 0,
  }));
  const { words, monotonic } = clampMonotonic(timed);
  const insertions = asr.flatMap((word, k) =>
    usedAsr.has(k) || cleanWord(word.text) === '' ? [] : [k],
  );
  return {
    words,
    mismatches: mismatchRegions(words, asr, insertions),
    stats: alignmentStats(scriptText, asr, words, insertions.length, monotonic),
  };
}

function alignmentStats(
  scriptText: string,
  asr: readonly AsrWord[],
  words: readonly AlignedWord[],
  insertions: number,
  monotonic: boolean,
): AlignmentStats {
  const count = (status: WordStatus): number => words.filter((w) => w.status === status).length;
  const reference = werTokens(scriptText);
  const hypothesis = werTokens(asr.map((w) => w.text).join(' '));
  const total = Math.max(1, words.length);
  return {
    scriptWords: words.length,
    asrWords: asr.length,
    wer: round(wordErrorRate(reference, hypothesis)),
    werFolded: round(wordErrorRate(reference.map(foldDiacritics), hypothesis.map(foldDiacritics))),
    exact: count('exact'),
    folded: count('folded'),
    fuzzy: count('fuzzy'),
    missing: count('missing'),
    coverage: round((count('exact') + count('folded')) / total),
    timedShare: round(1 - count('missing') / total),
    insertions,
    monotonic,
    clamped: words.filter((w) => w.clamped === true).length,
  };
}
