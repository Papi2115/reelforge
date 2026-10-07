/**
 * Offensive words in a stage's text output (real run Comic 1): the narration of `script.txt` and
 * every string of the storyboard (intents, annotation texts, sound words in a plan). A hit is an
 * error, so the stage's repair turn replaces the word (shared `findOffensiveWords`).
 */
import { findOffensiveWords, offensiveWordMessage } from '@reelforge/shared';
import { issue, type ValidationIssue } from './issues.js';

export const OFFENSIVE_WORD_CODE = 'offensive-word';

/** One issue per offensive word of a text (repeats of the same word at one path are merged). */
export function offensiveTextIssues(text: string, path?: string): ValidationIssue[] {
  const words = [...new Set(findOffensiveWords(text).map((hit) => hit.word))];
  return words.map((word) => issue('error', OFFENSIVE_WORD_CODE, offensiveWordMessage(word), path));
}

/** Every string inside a parsed JSON value, with its JSON-ish path (`shots[2].intent`). */
function jsonStrings(value: unknown, path: string): { path: string; text: string }[] {
  if (typeof value === 'string') return [{ path, text: value }];
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => jsonStrings(item, `${path}[${String(index)}]`));
  }
  if (typeof value === 'object' && value !== null) {
    return Object.entries(value).flatMap(([key, item]) =>
      jsonStrings(item, path === '' ? key : `${path}.${key}`),
    );
  }
  return [];
}

/** Offensive words in any string of a parsed JSON output (the storyboard). */
export function offensiveJsonIssues(value: unknown): ValidationIssue[] {
  return jsonStrings(value, '').flatMap((entry) => offensiveTextIssues(entry.text, entry.path));
}
