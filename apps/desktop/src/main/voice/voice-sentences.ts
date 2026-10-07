/**
 * The sentence list of the Voiceover panel (PLAN.md#13.14), pure: the script's sentences in the
 * chunks the engine generated, each with its time in the generated voice-over (from the API's word
 * times when present, else its paragraph's span), the number of takes of its paragraph and what a
 * redo costs (the whole paragraph is spoken again).
 */
import {
  chunkCharBudget,
  planVoiceChunks,
  type VoiceChunkPlan,
  type WordsFile,
} from '@reelforge/pipeline';
import type { VoiceTakesFile } from '@reelforge/shared';
import type { VoiceSentence } from '../../shared/voice-contract.js';

interface Span {
  readonly start: number;
  readonly end: number;
}

function wordSpan(words: WordsFile | null, first: number, count: number): Span | null {
  if (words === null || count <= 0) return null;
  const last = first + count - 1;
  const inside = words.words.filter((word) => word.i >= first && word.i <= last);
  const head = inside[0];
  const tail = inside.at(-1);
  return head === undefined || tail === undefined ? null : { start: head.t, end: tail.tEnd };
}

function round(seconds: number): number {
  return Math.round(seconds * 1000) / 1000;
}

function rowsOfChunk(
  chunk: VoiceChunkPlan,
  manifest: VoiceTakesFile,
  words: WordsFile | null,
): VoiceSentence[] {
  const takes = manifest.takes.filter((take) => take.chunkId === chunk.id).length;
  const placed = manifest.output?.timeline.find((entry) => entry.chunkId === chunk.id);
  return chunk.sentences.map((sentence) => {
    const span =
      wordSpan(words, sentence.firstWord, sentence.wordCount) ??
      (placed === undefined ? null : { start: placed.start, end: placed.end });
    return {
      id: sentence.id,
      paragraph: sentence.paragraph,
      text: sentence.text,
      start: span === null ? null : round(span.start),
      end: span === null ? null : round(span.end),
      takes,
      redoCharacters: chunk.characters,
    };
  });
}

/** Sentences of the generated voice-over; empty when nothing was generated or it is invalid. */
export function sentenceRows(
  scriptText: string,
  manifest: VoiceTakesFile | null,
  words: WordsFile | null,
): VoiceSentence[] {
  if (manifest?.output === null || manifest === null) return [];
  const plan = planVoiceChunks(scriptText, chunkCharBudget(manifest.modelId));
  if (!plan.ok) return [];
  return plan.value.flatMap((chunk) => rowsOfChunk(chunk, manifest, words));
}
