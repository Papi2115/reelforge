/**
 * Accented words of the narration (PLAN.md#12.21, pure): the words a cut, a whoosh or a hit may
 * land on besides the beats — phrase openers (the first word, a word after a pause or after a
 * sentence / clause end), spoken numbers, emphasised words (`word!`, ALL CAPS) and sentence-final
 * words. Times are the words' starts.
 */
import type { AccentKind, BeatAccent } from '@reelforge/shared';
import { isNumberWord, type DirectorWord } from '../sound/cue-events.js';

/** A silence at least this long before a word opens a phrase (s). */
export const PHRASE_PAUSE_S = 0.15;

const CLAUSE_END = /[.!?:;,]["'”’)\]]*$/u;
const SENTENCE_END = /[.!?]["'”’)\]]*$/u;

function isEmphasis(text: string): boolean {
  if (/!["'”’)\]]*$/u.test(text)) return true;
  const letters = text.replace(/[^\p{L}]/gu, '');
  return (
    letters.length >= 2 && letters === letters.toUpperCase() && letters !== letters.toLowerCase()
  );
}

function accentKind(words: readonly DirectorWord[], index: number): AccentKind | undefined {
  const word = words[index];
  if (word === undefined) return undefined;
  if (isEmphasis(word.text)) return 'emphasis';
  if (isNumberWord(word.text)) return 'number';
  const previous = words[index - 1];
  if (
    previous === undefined ||
    word.t - previous.tEnd >= PHRASE_PAUSE_S - 1e-9 ||
    CLAUSE_END.test(previous.text)
  ) {
    return 'phrase';
  }
  return SENTENCE_END.test(word.text) ? 'final' : undefined;
}

/** The accented words, in time order (words are expected in time order, as in words.json). */
export function findAccents(words: readonly DirectorWord[]): BeatAccent[] {
  return words.flatMap((word, index): BeatAccent[] => {
    const kind = accentKind(words, index);
    return kind === undefined ? [] : [{ word: index, t: word.t, kind }];
  });
}
