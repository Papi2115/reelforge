/**
 * Approved script -> TTS request chunks (PLAN.md#13.14). Paragraphs are split exactly like
 * `tokenizeScript` (blank lines; same indices as words.json `paragraph`), sentences by end
 * punctuation (English). One chunk = one paragraph; a paragraph longer than the model's budget is
 * split between sentences, never inside one. Deterministic: same script, same chunks and ids.
 */
import { subTokens } from '../text/normalize.js';
import { err, ok, type Result } from '../result.js';
import { voiceError, type VoiceError } from './errors.js';

export interface ScriptSentence {
  /** `p<paragraph>-s<k>` (both 0-based, 2+ digits), e.g. `p03-s00`. */
  readonly id: string;
  readonly paragraph: number;
  readonly index: number;
  readonly text: string;
  /** Index of the sentence's first spoken word in words.json (`i`). */
  readonly firstWord: number;
  readonly wordCount: number;
}

export interface ScriptParagraph {
  readonly index: number;
  /** Whitespace collapsed to single spaces, trimmed. */
  readonly text: string;
  readonly sentences: readonly ScriptSentence[];
}

/** What precedes a chunk in the assembled audio: nothing, a paragraph break or a sentence join. */
export type ChunkJoin = 'start' | 'paragraph' | 'sentence';

export interface VoiceChunkPlan {
  /** `p<paragraph><part letter>`, e.g. `p03a`. */
  readonly id: string;
  readonly paragraph: number;
  readonly part: number;
  /** Exactly the text sent to the vendor (its alignment maps to these characters). */
  readonly text: string;
  readonly characters: number;
  readonly sentences: readonly ScriptSentence[];
  readonly firstWord: number;
  readonly wordCount: number;
  readonly join: ChunkJoin;
}

const pad2 = (value: number): string => String(value).padStart(2, '0');
const MAX_PARTS = 26;

export function chunkIdFor(paragraph: number, part: number): string {
  return `p${pad2(paragraph)}${String.fromCharCode(97 + part)}`;
}

export function sentenceIdFor(paragraph: number, index: number): string {
  return `p${pad2(paragraph)}-s${pad2(index)}`;
}

/** Billing unit: characters as code points. */
export function characterCount(text: string): number {
  return Array.from(text).length;
}

/** A whitespace-free token words.json counts as a word (same filter as `tokenizeScript`). */
export function isSpokenWord(raw: string): boolean {
  return subTokens(raw, 'en').length > 0;
}

/** Lower-case forms (without the final dot) after which a dot does not end a sentence. */
const ABBREVIATIONS = new Set([
  'mr',
  'mrs',
  'ms',
  'dr',
  'prof',
  'st',
  'jr',
  'sr',
  'vs',
  'e.g',
  'i.e',
  'u.s',
  'u.k',
  'inc',
  'ltd',
  'approx',
]);

function endsSentence(word: string, next: string | undefined): boolean {
  if (next === undefined) return true;
  if (!/[.!?…]["'”’)\]]*$/u.test(word)) return false;
  if (!/^["'“‘([]*[\p{Lu}\p{N}]/u.test(next)) return false;
  if (/[!?…]["'”’)\]]*$/u.test(word)) return true;
  const stem = word
    .replace(/["'”’)\]]*$/u, '')
    .replace(/\.$/, '')
    .replace(/^["'“‘([]+/u, '');
  if (/^\p{Lu}$/u.test(stem)) return false;
  return !ABBREVIATIONS.has(stem.toLowerCase());
}

/** Sentences of one paragraph (English end punctuation; abbreviations and initials kept). */
export function splitSentences(text: string): string[] {
  const words = text.split(/\s+/).filter((word) => word.length > 0);
  const sentences: string[] = [];
  let current: string[] = [];
  words.forEach((word, index) => {
    current.push(word);
    if (endsSentence(word, words[index + 1])) {
      sentences.push(current.join(' '));
      current = [];
    }
  });
  return sentences;
}

/** Paragraphs with their sentences and words.json word indices. Empty paragraphs are kept. */
export function splitScriptParagraphs(scriptText: string): ScriptParagraph[] {
  let wordIndex = 0;
  return scriptText
    .replace(/\r\n/g, '\n')
    .split(/\n\s*\n/)
    .map((raw, paragraph) => {
      const text = raw
        .split(/\s+/)
        .filter((word) => word.length > 0)
        .join(' ');
      const sentences = splitSentences(text).map((sentenceText, index): ScriptSentence => {
        const wordCount = sentenceText.split(' ').filter(isSpokenWord).length;
        const sentence = {
          id: sentenceIdFor(paragraph, index),
          paragraph,
          index,
          text: sentenceText,
          firstWord: wordIndex,
          wordCount,
        };
        wordIndex += wordCount;
        return sentence;
      });
      return { index: paragraph, text, sentences };
    });
}

function makeChunk(
  sentences: readonly ScriptSentence[],
  paragraph: number,
  part: number,
  join: ChunkJoin,
): VoiceChunkPlan {
  const text = sentences.map((sentence) => sentence.text).join(' ');
  return {
    id: chunkIdFor(paragraph, part),
    paragraph,
    part,
    text,
    characters: characterCount(text),
    sentences,
    firstWord: sentences[0]?.firstWord ?? 0,
    wordCount: sentences.reduce((sum, sentence) => sum + sentence.wordCount, 0),
    join,
  };
}

/** Greedy split of one paragraph's sentences into parts of at most `maxChars`. */
function packParagraph(
  paragraph: ScriptParagraph,
  maxChars: number,
): Result<ScriptSentence[][], VoiceError> {
  const parts: ScriptSentence[][] = [];
  let current: ScriptSentence[] = [];
  let currentChars = 0;
  for (const sentence of paragraph.sentences) {
    const chars = characterCount(sentence.text);
    if (chars > maxChars) {
      return err(
        voiceError(
          'invalid-input',
          `sentence ${sentence.id} has ${String(chars)} characters, more than the ${String(maxChars)} one request may carry; split it in the script`,
        ),
      );
    }
    const joined = current.length === 0 ? chars : currentChars + 1 + chars;
    if (joined > maxChars) {
      parts.push(current);
      current = [sentence];
      currentChars = chars;
    } else {
      current.push(sentence);
      currentChars = joined;
    }
  }
  if (current.length > 0) parts.push(current);
  return ok(parts);
}

/** Request chunks of the whole script (paragraphs without spoken words are skipped). */
export function planVoiceChunks(
  scriptText: string,
  maxChars: number,
): Result<VoiceChunkPlan[], VoiceError> {
  const chunks: VoiceChunkPlan[] = [];
  for (const paragraph of splitScriptParagraphs(scriptText)) {
    if (paragraph.sentences.every((sentence) => sentence.wordCount === 0)) continue;
    const parts = packParagraph(paragraph, maxChars);
    if (!parts.ok) return parts;
    if (parts.value.length > MAX_PARTS) {
      return err(
        voiceError('invalid-input', `paragraph ${String(paragraph.index)} is too long; split it`),
      );
    }
    parts.value.forEach((sentences, part) => {
      const join: ChunkJoin = chunks.length === 0 ? 'start' : part === 0 ? 'paragraph' : 'sentence';
      chunks.push(makeChunk(sentences, paragraph.index, part, join));
    });
  }
  return chunks.length > 0 ? ok(chunks) : err(voiceError('invalid-input', 'the script is empty'));
}

/** Default length of `previous_text` / `next_text` context (characters). */
export const CONTEXT_CHARS = 1_000;

function clipWords(text: string, maxChars: number, fromEnd: boolean): string {
  if (text.length <= maxChars) return text;
  const slice = fromEnd ? text.slice(text.length - maxChars) : text.slice(0, maxChars);
  const cut = fromEnd ? slice.indexOf(' ') : slice.lastIndexOf(' ');
  if (cut < 0) return slice;
  return fromEnd ? slice.slice(cut + 1) : slice.slice(0, cut);
}

/** Script text before chunk `index` (its tail, whole words). */
export function contextBefore(
  chunks: readonly VoiceChunkPlan[],
  index: number,
  maxChars: number = CONTEXT_CHARS,
): string {
  const text = chunks
    .slice(0, index)
    .map((chunk) => chunk.text)
    .join(' ');
  return clipWords(text, maxChars, true);
}

/** Script text after chunk `index` (its head, whole words). */
export function contextAfter(
  chunks: readonly VoiceChunkPlan[],
  index: number,
  maxChars: number = CONTEXT_CHARS,
): string {
  const text = chunks
    .slice(index + 1)
    .map((chunk) => chunk.text)
    .join(' ');
  return clipWords(text, maxChars, false);
}
