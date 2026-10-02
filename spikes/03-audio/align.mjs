// Script <-> ASR word alignment (Needleman-Wunsch) for the audio spike.
// Library + CLI:  node align.mjs <script.txt> <words.raw.json> <out words.json> [en|pl]
// words.raw.json: { words: [{ text, t, tEnd, p }] } with times in seconds.
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { numberToWords } from './lib/numbers.mjs';

const PL_FOLD = { ą: 'a', ć: 'c', ę: 'e', ł: 'l', ń: 'n', ó: 'o', ś: 's', ź: 'z', ż: 'z' };

/** Lowercase, unify apostrophes, strip punctuation; keeps letters (incl. diacritics) and digits. */
export function cleanWord(raw) {
  return raw
    .toLowerCase()
    .replace(/[’‘`]/g, "'")
    .replace(/[^\p{L}\p{N}'.,-]/gu, '')
    .replace(/'/g, '')
    .replace(/[.,](?!\d)|(?<!\d)[.,]/g, '')
    .replace(/(?<=\d)[,.](?=\d{3}(?!\d))/g, '')
    .replace(/^-+|-+$/g, '');
}

/** Diacritics-insensitive form (Polish ł is not decomposed by NFD, so fold it explicitly). */
export function foldDiacritics(word) {
  return word
    .replace(/[ąćęłńóśźż]/g, (ch) => PL_FOLD[ch] ?? ch)
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

/** Tokens used for WER: cleaned words, hyphenated compounds split, digits kept as-is. */
export function werTokens(text) {
  return text
    .split(/\s+/)
    .flatMap((raw) => cleanWord(raw).split('-'))
    .filter((token) => token.length > 0);
}

/** Alignment sub-tokens of one surface word: hyphens split, integers spelled out. */
export function subTokens(raw, lang) {
  return cleanWord(raw)
    .split('-')
    .filter((part) => part.length > 0)
    .flatMap((part) => {
      if (/^\d+$/.test(part)) {
        const spelled = numberToWords(Number(part), lang);
        if (spelled) return spelled.split(/[\s-]+/);
      }
      return [part];
    });
}

/** Script text -> surface words with their paragraph index. */
export function tokenizeScript(text) {
  const words = [];
  text
    .replace(/\r\n/g, '\n')
    .split(/\n\s*\n/)
    .forEach((paragraph, paragraphIndex) => {
      for (const raw of paragraph.split(/\s+/)) {
        if (cleanWord(raw).length > 0) words.push({ text: raw, paragraph: paragraphIndex });
      }
    });
  return words;
}

function levenshtein(a, b) {
  const previous = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) previous[j] = j;
  for (let i = 1; i <= a.length; i++) {
    let diagonal = previous[0];
    previous[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const above = previous[j];
      previous[j] = Math.min(
        above + 1,
        previous[j - 1] + 1,
        diagonal + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      diagonal = above;
    }
  }
  return previous[b.length];
}

/** Word error rate of hypothesis vs reference token lists. */
export function wordErrorRate(reference, hypothesis) {
  if (reference.length === 0) return hypothesis.length === 0 ? 0 : 1;
  return levenshtein(reference, hypothesis) / reference.length;
}

const GAP = -1;

/** Similarity of two sub-tokens -> { score, kind }. */
export function compareTokens(a, b) {
  if (a === b) return { score: 2, kind: 'exact' };
  if (foldDiacritics(a) === foldDiacritics(b)) return { score: 1.6, kind: 'folded' };
  const similarity =
    1 - levenshtein(foldDiacritics(a), foldDiacritics(b)) / Math.max(a.length, b.length);
  if (similarity >= 0.5) return { score: 2 * similarity - 1, kind: 'fuzzy', similarity };
  return { score: -1, kind: 'sub', similarity };
}

const MAX_MERGE = 3;
const MERGE_PENALTY = 0.25;

/**
 * Global alignment of sequences a and b with gaps plus merge/split moves: up to MAX_MERGE tokens
 * of one side may match a single token of the other ("a small team" ~ "asmolteam",
 * "cannot" ~ "can not"). Returns pairs [i|null, j|null, comparison|null] in order.
 */
export function needlemanWunsch(a, b) {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const score = new Float64Array(rows * cols);
  const stepA = new Uint8Array(rows * cols); // tokens of a consumed by the best move into a cell
  const stepB = new Uint8Array(rows * cols);
  for (let i = 1; i < rows; i++) {
    score[i * cols] = i * GAP;
    stepA[i * cols] = 1;
  }
  for (let j = 1; j < cols; j++) {
    score[j] = j * GAP;
    stepB[j] = 1;
  }
  const compareAt = (i, j, da, db) => {
    const left = da === 1 ? a[i - 1] : a.slice(i - da, i).join('');
    const right = db === 1 ? b[j - 1] : b.slice(j - db, j).join('');
    return compareTokens(left, right);
  };
  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      let best = score[(i - 1) * cols + j] + GAP;
      let bestA = 1;
      let bestB = 0;
      const consider = (value, da, db) => {
        if (value > best) {
          best = value;
          bestA = da;
          bestB = db;
        }
      };
      consider(score[i * cols + j - 1] + GAP, 0, 1);
      consider(score[(i - 1) * cols + j - 1] + compareAt(i, j, 1, 1).score, 1, 1);
      for (let k = 2; k <= MAX_MERGE; k++) {
        if (i >= k) {
          const cmp = compareAt(i, j, k, 1);
          if (cmp.kind !== 'sub')
            consider(score[(i - k) * cols + j - 1] + cmp.score * k - MERGE_PENALTY, k, 1);
        }
        if (j >= k) {
          const cmp = compareAt(i, j, 1, k);
          if (cmp.kind !== 'sub')
            consider(score[(i - 1) * cols + j - k] + cmp.score * k - MERGE_PENALTY, 1, k);
        }
      }
      score[i * cols + j] = best;
      stepA[i * cols + j] = bestA;
      stepB[i * cols + j] = bestB;
    }
  }
  const pairs = [];
  let i = a.length;
  let j = b.length;
  while (i > 0 || j > 0) {
    const da = stepA[i * cols + j];
    const db = stepB[i * cols + j];
    if (da > 0 && db > 0) {
      const cmp = compareAt(i, j, da, db);
      const group = [];
      for (let x = 0; x < Math.max(da, db); x++) {
        group.push([i - Math.min(da, x + 1), j - Math.min(db, x + 1), cmp]);
      }
      pairs.push(...group);
    } else if (da > 0) {
      pairs.push([i - 1, null, null]);
    } else {
      pairs.push([null, j - 1, null]);
    }
    i -= da;
    j -= db;
  }
  return pairs.reverse();
}

function flatten(words, lang) {
  const tokens = [];
  const owner = [];
  words.forEach((word, index) => {
    for (const token of subTokens(word.text, lang)) {
      tokens.push(token);
      owner.push(index);
    }
  });
  return { tokens, owner };
}

/** Fills t/tEnd of untimed words by spreading them over the gap between timed neighbours. */
function interpolateMissing(result, totalEnd) {
  let index = 0;
  while (index < result.length) {
    if (result[index].t !== null) {
      index++;
      continue;
    }
    let end = index;
    while (end < result.length && result[end].t === null) end++;
    const from = index > 0 ? result[index - 1].tEnd : 0;
    const to = end < result.length ? result[end].t : totalEnd;
    const weights = result
      .slice(index, end)
      .map((word) => Math.max(1, cleanWord(word.text).length));
    const total = weights.reduce((sum, weight) => sum + weight, 0);
    let cursor = from;
    for (let k = index; k < end; k++) {
      const span = ((to - from) * weights[k - index]) / total;
      result[k].t = round(cursor);
      result[k].tEnd = round(cursor + span);
      cursor += span;
    }
    index = end;
  }
}

const round = (seconds) => Math.round(seconds * 1000) / 1000;

/** One ASR word heard for several script words ("asmolteam"): split its span by letter count. */
function splitSharedAsrWords(words, linked, asrWords) {
  const sharers = new Map();
  linked.forEach((entry, index) => {
    if (entry.asr.size !== 1) return;
    const [asrIndex] = entry.asr;
    sharers.set(asrIndex, [...(sharers.get(asrIndex) ?? []), index]);
  });
  for (const [asrIndex, indexes] of sharers) {
    if (indexes.length < 2) continue;
    const { t, tEnd } = asrWords[asrIndex];
    const weights = indexes.map((k) => Math.max(1, cleanWord(words[k].text).length));
    const total = weights.reduce((sum, weight) => sum + weight, 0);
    let cursor = t;
    indexes.forEach((k, n) => {
      const span = ((tEnd - t) * weights[n]) / total;
      words[k].t = round(cursor);
      words[k].tEnd = round(cursor + span);
      cursor += span;
    });
  }
}

/**
 * Aligns script words to ASR words. Every script word gets t/tEnd; status tells how it was timed:
 * exact | folded (diacritics) | fuzzy (similar spelling) | missing (interpolated).
 */
export function alignScript(scriptText, asrWords, lang) {
  const script = tokenizeScript(scriptText);
  const a = flatten(script, lang);
  const b = flatten(asrWords, lang);
  const pairs = needlemanWunsch(a.tokens, b.tokens);
  const linked = script.map(() => ({
    asr: new Set(),
    subTokens: new Set(),
    kinds: [],
    similarity: [],
  }));
  const usedAsr = new Set();
  for (const [i, j, cmp] of pairs) {
    if (i === null || j === null || cmp === null || cmp.kind === 'sub') continue;
    const entry = linked[a.owner[i]];
    entry.asr.add(b.owner[j]);
    usedAsr.add(b.owner[j]);
    if (entry.subTokens.has(i)) continue; // 1:k split -> count the script sub-token once
    entry.subTokens.add(i);
    entry.kinds.push(cmp.kind);
    entry.similarity.push(cmp.similarity ?? 1);
  }
  const words = script.map((word, index) => {
    const entry = linked[index];
    const expected = subTokens(word.text, lang).length;
    if (entry.asr.size === 0) {
      return { i: index, text: word.text, t: null, tEnd: null, confidence: 0, status: 'missing' };
    }
    const hits = [...entry.asr].map((k) => asrWords[k]);
    const complete = entry.kinds.length === expected;
    const status =
      !complete || entry.kinds.includes('fuzzy')
        ? 'fuzzy'
        : entry.kinds.includes('folded')
          ? 'folded'
          : 'exact';
    const probability = hits.reduce((sum, hit) => sum + (hit.p ?? 1), 0) / hits.length;
    const matchShare = entry.similarity.reduce((sum, s) => sum + s, 0) / expected;
    const factor = status === 'exact' ? 1 : status === 'folded' ? 0.9 : 0.6 * matchShare;
    return {
      i: index,
      text: word.text,
      t: round(Math.min(...hits.map((hit) => hit.t))),
      tEnd: round(Math.max(...hits.map((hit) => hit.tEnd))),
      confidence: round(probability * factor),
      status,
    };
  });
  splitSharedAsrWords(words, linked, asrWords);
  const totalEnd = asrWords.length > 0 ? asrWords[asrWords.length - 1].tEnd : 0;
  interpolateMissing(words, totalEnd);
  const insertions = asrWords.map((_, k) => k).filter((k) => !usedAsr.has(k));
  return {
    words,
    mismatches: mismatchRegions(words, asrWords, insertions),
    stats: alignmentStats(scriptText, asrWords, words, insertions),
  };
}

function mismatchRegions(words, asrWords, insertions) {
  const regions = [];
  let start = -1;
  for (let k = 0; k <= words.length; k++) {
    const bad = k < words.length && words[k].status !== 'exact' && words[k].status !== 'folded';
    if (bad && start < 0) start = k;
    if (!bad && start >= 0) {
      const span = words.slice(start, k);
      const t = span[0].t;
      const tEnd = span[span.length - 1].tEnd;
      const heard = asrWords.filter((w) => w.tEnd > t - 0.05 && w.t < tEnd + 0.05);
      regions.push({
        from: start,
        to: k - 1,
        script: span.map((w) => w.text).join(' '),
        heard: heard.map((w) => w.text.trim()).join(' '),
        t,
        tEnd,
      });
      start = -1;
    }
  }
  for (const k of insertions) {
    const word = asrWords[k];
    if (cleanWord(word.text).length === 0) continue;
    regions.push({
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

function alignmentStats(scriptText, asrWords, words, insertions) {
  const count = (status) => words.filter((w) => w.status === status).length;
  const reference = werTokens(scriptText);
  const hypothesis = werTokens(asrWords.map((w) => w.text).join(' '));
  return {
    scriptWords: words.length,
    asrWords: asrWords.length,
    wer: round(wordErrorRate(reference, hypothesis)),
    werFolded: round(wordErrorRate(reference.map(foldDiacritics), hypothesis.map(foldDiacritics))),
    exact: count('exact'),
    folded: count('folded'),
    fuzzy: count('fuzzy'),
    missing: count('missing'),
    coverage: round((count('exact') + count('folded')) / Math.max(1, words.length)),
    timedShare: round(1 - count('missing') / Math.max(1, words.length)),
    insertions: insertions.filter((k) => cleanWord(asrWords[k].text).length > 0).length,
    monotonic: words.every((w, k) => k === 0 || w.t >= words[k - 1].t - 1e-9),
  };
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const [scriptFile, rawFile, outFile, lang = 'en'] = process.argv.slice(2);
  if (!scriptFile || !rawFile || !outFile) {
    process.stderr.write(
      'usage: node align.mjs <script.txt> <words.raw.json> <out.json> [en|pl]\n',
    );
    process.exit(2);
  }
  const { writeJson } = await import('./lib/common.mjs');
  const raw = JSON.parse(readFileSync(rawFile, 'utf8'));
  const result = alignScript(readFileSync(scriptFile, 'utf8'), raw.words, lang);
  writeJson(outFile, { version: 1, lang, ...result });
  process.stdout.write(`${JSON.stringify(result.stats)}\n`);
}
