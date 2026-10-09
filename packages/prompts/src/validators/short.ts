/**
 * Shorts (PLAN.md#13.18): the short-script outputs (`script.txt` as a retention teaser within its
 * word budget, a first sentence of at most 9 words, no call-to-action phrases; `hooks.md` with
 * three candidate hooks and the chosen one) and the short storyboard's retention editing (hook
 * shot, average shot length, overall length). The fixed end card is appended by the stage and
 * never checked here.
 */
import {
  SHORT_END_CARD_SECONDS,
  shortTargetWords,
  type ShortLength,
  type StoryboardShot,
} from '@reelforge/shared';
import { issue, report, type ValidationIssue, type ValidationReport } from './issues.js';
import { countWords, validateScript } from './script.js';

/** Longest first sentence of a short, words. */
export const SHORT_MAX_FIRST_SENTENCE_WORDS = 9;
/** Longest hook shot (the first shot), seconds. */
export const SHORT_MAX_HOOK_SHOT_S = 2.5;
/** Average shot length a short aims for, seconds (the validator allows ±10 %). */
export const SHORT_AVERAGE_SHOT_S = { min: 1.5, max: 3 } as const;
const AVERAGE_TOLERANCE = 0.1;
/** Overall length (end card included) may exceed the target by this share before a warning. */
const LENGTH_TOLERANCE = 0.15;

/** Shot length rules of a short (they win over the film's defaults; the end card is exempt). */
export const SHORT_STORYBOARD_RULES = {
  minShotS: 0.8,
  maxShotS: 3.5,
  typicalMinShotS: 1.5,
  typicalMaxShotS: 3,
} as const;

/** Call-to-action and meta phrases a short never says (the end card points to the film). */
const FORBIDDEN_PHRASES: readonly { readonly regex: RegExp; readonly phrase: string }[] = [
  { regex: /\bsubscrib/i, phrase: 'subscribe' },
  { regex: /\blike and\b/i, phrase: 'like and' },
  { regex: /\bin this video\b/i, phrase: 'in this video' },
  { regex: /\blink in\b/i, phrase: 'link in' },
  { regex: /\bsubskryb/i, phrase: 'subskrybuj' },
  { regex: /\bw tym filmie\b/i, phrase: 'w tym filmie' },
  { regex: /\blink w opisie\b/i, phrase: 'link w opisie' },
];

/** The first sentence of a text (up to the first `.`, `?`, `!` or `…`). */
export function firstSentence(text: string): string {
  const trimmed = text.trim();
  const match = /^[\s\S]*?[.?!…]+["'”’)]*(?=\s|$)/.exec(trimmed);
  return (match?.[0] ?? trimmed).trim();
}

export interface ShortScriptStats {
  readonly wordCount: number;
  readonly targetWords: number;
  readonly firstSentenceWords: number;
}

/** `script.txt` of a short: the script checks with the short's budget plus the short's rules. */
export function validateShortScript(
  text: string,
  options: { readonly lengthS: ShortLength },
): ValidationReport<ShortScriptStats> {
  const targetWords = shortTargetWords(options.lengthS);
  const base = validateScript(text, { targetWords });
  if (base.value === undefined) return report<ShortScriptStats>(undefined, base.issues);
  const issues: ValidationIssue[] = [...base.issues];
  const firstSentenceWords = countWords(firstSentence(text));
  if (firstSentenceWords > SHORT_MAX_FIRST_SENTENCE_WORDS) {
    issues.push(
      issue(
        'error',
        'short-first-sentence',
        `the first sentence has ${String(firstSentenceWords)} words; the hook must be at most ${String(SHORT_MAX_FIRST_SENTENCE_WORDS)}`,
      ),
    );
  }
  for (const entry of FORBIDDEN_PHRASES) {
    if (entry.regex.test(text)) {
      issues.push(
        issue(
          'error',
          'short-forbidden-phrase',
          `"${entry.phrase}": a short never asks to subscribe/like, names a link or says "in this video" (the end card points to the film)`,
        ),
      );
    }
  }
  return report({ wordCount: base.value.wordCount, targetWords, firstSentenceWords }, issues);
}

export interface ShortHooks {
  readonly hooks: readonly string[];
  /** 1-based number of the chosen hook. */
  readonly chosen: number;
}

function normalized(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

/** The hook sentence of a candidate line (`<hook> — <why it works>`). */
function hookText(line: string): string {
  return (line.split(/\s+[—–]\s+|\s+-\s+/)[0] ?? line).trim();
}

/**
 * `hooks.md`: three numbered candidate hooks and `Chosen: <n>`; with `script`, the script should
 * open with the chosen hook (a warning otherwise).
 */
export function validateShortHooks(
  text: string,
  options: { readonly script?: string } = {},
): ValidationReport<ShortHooks> {
  const candidates = new Map<number, string>();
  for (const match of text.matchAll(/^\s*([1-3])[.)]\s+(\S.*)$/gm)) {
    const number = Number(match[1]);
    if (!candidates.has(number)) candidates.set(number, hookText(match[2] ?? ''));
  }
  const issues: ValidationIssue[] = [];
  if (candidates.size !== 3) {
    issues.push(
      issue(
        'error',
        'hooks-count',
        `hooks.md lists ${String(candidates.size)} numbered hooks (1., 2., 3.); it needs exactly 3`,
      ),
    );
  }
  const hooks = [1, 2, 3].flatMap((number) => {
    const hook = candidates.get(number);
    return hook === undefined ? [] : [hook];
  });
  if (new Set(hooks.map(normalized)).size !== hooks.length) {
    issues.push(issue('error', 'hooks-duplicate', 'two candidate hooks are the same'));
  }
  const chosenMatch = /^\s*chosen\s*:\s*([1-3])\b/im.exec(text);
  if (chosenMatch === null) {
    issues.push(issue('error', 'hooks-chosen', 'hooks.md needs a line "Chosen: <1-3>"'));
    return report<ShortHooks>(undefined, issues);
  }
  const chosen = Number(chosenMatch[1]);
  const chosenHook = candidates.get(chosen);
  if (options.script !== undefined && chosenHook !== undefined) {
    const opening = normalized(firstSentence(options.script));
    if (opening !== normalized(firstSentence(chosenHook))) {
      issues.push(
        issue(
          'warning',
          'hooks-mismatch',
          `script.txt does not open with the chosen hook ${String(chosen)} ("${chosenHook}")`,
        ),
      );
    }
  }
  return report({ hooks, chosen }, issues);
}

export interface ShortStoryboardOptions {
  readonly lengthS: ShortLength;
}

/** Retention editing of a short's narration shots (the end card already removed). */
export function checkShortStoryboard(
  shots: readonly Pick<StoryboardShot, 't0' | 't1' | 'hook'>[],
  options: ShortStoryboardOptions,
): ValidationIssue[] {
  const first = shots[0];
  const last = shots.at(-1);
  if (first === undefined || last === undefined) return [];
  const issues: ValidationIssue[] = [];
  const hookS = first.t1 - first.t0;
  if (hookS > SHORT_MAX_HOOK_SHOT_S + 1e-6) {
    issues.push(
      issue(
        'error',
        'short-hook-length',
        `the hook shot runs ${hookS.toFixed(2)} s; a short opens with a shot of at most ${String(SHORT_MAX_HOOK_SHOT_S)} s`,
        'shots[0]',
      ),
    );
  }
  if (first.hook !== true) {
    issues.push(
      issue('warning', 'short-hook-flag', 'mark the first shot "hook": true', 'shots[0]'),
    );
  }
  const durationS = last.t1 - first.t0;
  const average = durationS / shots.length;
  const low = SHORT_AVERAGE_SHOT_S.min * (1 - AVERAGE_TOLERANCE);
  const high = SHORT_AVERAGE_SHOT_S.max * (1 + AVERAGE_TOLERANCE);
  if (average < low || average > high) {
    const fewest = Math.ceil(durationS / SHORT_AVERAGE_SHOT_S.max);
    const most = Math.floor(durationS / SHORT_AVERAGE_SHOT_S.min);
    issues.push(
      issue(
        'error',
        'short-shot-rate',
        `${String(shots.length)} shots in ${durationS.toFixed(1)} s (average ${average.toFixed(2)} s); a short cuts every ${String(SHORT_AVERAGE_SHOT_S.min)}–${String(SHORT_AVERAGE_SHOT_S.max)} s: about ${String(fewest)}–${String(most)} shots`,
      ),
    );
  }
  const totalS = last.t1 + SHORT_END_CARD_SECONDS;
  if (totalS > options.lengthS * (1 + LENGTH_TOLERANCE)) {
    issues.push(
      issue(
        'warning',
        'short-length',
        `the short runs ${totalS.toFixed(1)} s with the end card; the target is ${String(options.lengthS)} s`,
      ),
    );
  }
  return issues;
}
