/**
 * The research notes the frame critic and the fix turn judge facts by (real run Comic 1: the
 * critic enforced the storyboard's inverted fluorine levels against `research.md` and the fix turn
 * flipped a research-correct shot). Source links are dropped; notes that fit the budget go in
 * whole, longer ones as the lines that share the most words with the shot (its intent and spoken
 * words), in their original order, up to the budget. Pure and deterministic.
 */
import type { StoryboardShot, WordsFile } from '@reelforge/shared';

/** Largest excerpt (UTF-8 bytes): ≤ 1.5 KB. */
export const RESEARCH_EXCERPT_BYTES = 1536;
/** Words too common to tie a research line to a shot. */
const COMMON = new Set([
  'the',
  'and',
  'for',
  'are',
  'was',
  'were',
  'with',
  'that',
  'this',
  'from',
  'had',
  'has',
  'have',
  'his',
  'her',
  'its',
  'not',
  'but',
  'all',
  'one',
  'into',
  'than',
  'then',
  'they',
  'their',
  'which',
  'who',
  'what',
  'when',
  'more',
  'less',
  'very',
]);

const bytes = (text: string): number => Buffer.byteLength(text, 'utf8');

/** A line without its source links ("- claim — https://…" → "- claim"). */
function withoutLinks(line: string): string {
  return line
    .replace(/\s*[—–-]\s*https?:\/\/\S+(?:\s+(?:and|or|,)\s+https?:\/\/\S+)*/g, '')
    .replace(/\(?https?:\/\/[^\s)]+\)?/g, '')
    .replace(/\s+([,;.])/g, '$1')
    .replace(/[ \t]{2,}/g, ' ')
    .trimEnd();
}

function contentWords(text: string): Set<string> {
  const words = text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
  return new Set(words.filter((word) => word.length >= 3 && !COMMON.has(word)));
}

/** Lines that carry facts (no headings, no blank lines), links removed. */
function factLines(notes: string): string[] {
  return notes
    .split(/\r?\n/)
    .map(withoutLinks)
    .filter((line) => line.trim() !== '' && !/^\s*#/.test(line));
}

/**
 * The research notes for one shot; undefined when the project has none (prompts stay as they were
 * before research-aware QA).
 */
export function researchExcerpt(notes: string | undefined, focus: string): string | undefined {
  if (notes === undefined) return undefined;
  const lines = factLines(notes);
  const whole = lines.join('\n');
  if (whole.trim() === '') return undefined;
  if (bytes(whole) <= RESEARCH_EXCERPT_BYTES) return whole;
  const wanted = contentWords(focus);
  const scored = lines.map((line, index) => {
    const words = contentWords(line);
    const score = [...words].filter((word) => wanted.has(word)).length;
    return { line, index, score };
  });
  const ranked = [...scored].sort(
    (first, second) => second.score - first.score || first.index - second.index,
  );
  const chosen: typeof scored = [];
  let size = 0;
  for (const entry of ranked) {
    const cost = bytes(entry.line) + 1;
    if (size + cost > RESEARCH_EXCERPT_BYTES) continue;
    chosen.push(entry);
    size += cost;
  }
  return chosen
    .sort((first, second) => first.index - second.index)
    .map((entry) => entry.line)
    .join('\n');
}

/** What a shot is about: its intent and the words spoken during it. */
export function shotFocus(
  shot: Pick<StoryboardShot, 't0' | 't1' | 'intent'>,
  words: WordsFile | undefined,
): string {
  const spoken = (words?.words ?? [])
    .filter((word) => word.t >= shot.t0 && word.t < shot.t1)
    .map((word) => word.text);
  return [shot.intent, ...spoken].join(' ');
}
