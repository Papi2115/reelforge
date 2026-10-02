/** "Check this" regions of an alignment: runs of fuzzy/missing script words and ASR insertions. */
import type { AlignedWord, AsrWord } from './align.js';

export interface MismatchRegion {
  /** 'script': script words not heard cleanly; 'insertion': ASR words absent from the script. */
  readonly kind: 'script' | 'insertion';
  /** Script word index range (inclusive); null for insertions. */
  readonly from: number | null;
  readonly to: number | null;
  readonly script: string;
  readonly heard: string;
  readonly t: number;
  readonly tEnd: number;
}

const HEARD_MARGIN_S = 0.05;

const isClean = (word: AlignedWord): boolean => word.status === 'exact' || word.status === 'folded';

function scriptRegion(
  span: readonly AlignedWord[],
  asr: readonly AsrWord[],
): MismatchRegion | null {
  const first = span[0];
  const last = span.at(-1);
  if (first === undefined || last === undefined) return null;
  const heard = asr.filter(
    (word) => word.tEnd > first.t - HEARD_MARGIN_S && word.t < last.tEnd + HEARD_MARGIN_S,
  );
  return {
    kind: 'script',
    from: first.i,
    to: last.i,
    script: span.map((word) => word.text).join(' '),
    heard: heard.map((word) => word.text.trim()).join(' '),
    t: first.t,
    tEnd: last.tEnd,
  };
}

/** Regions sorted by time. `insertions` = indexes of unmatched, non-empty ASR words. */
export function mismatchRegions(
  words: readonly AlignedWord[],
  asr: readonly AsrWord[],
  insertions: readonly number[],
): MismatchRegion[] {
  const regions: MismatchRegion[] = [];
  let start = -1;
  for (let k = 0; k <= words.length; k++) {
    const word = words[k];
    const bad = word !== undefined && !isClean(word);
    if (bad && start < 0) start = k;
    if (!bad && start >= 0) {
      const region = scriptRegion(words.slice(start, k), asr);
      if (region !== null) regions.push(region);
      start = -1;
    }
  }
  for (const k of insertions) {
    const word = asr[k];
    if (word === undefined) continue;
    regions.push({
      kind: 'insertion',
      from: null,
      to: null,
      script: '',
      heard: word.text.trim(),
      t: word.t,
      tEnd: word.tEnd,
    });
  }
  return regions.sort((x, y) => x.t - y.t);
}
