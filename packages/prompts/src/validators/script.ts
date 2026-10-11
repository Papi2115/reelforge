/**
 * `script.txt`: spoken narration only (no markdown, headings, stage directions, emojis, offensive
 * words) and a word count within the tolerance of the target (the app aligns this text to the
 * recording).
 */
import { issue, report, type ValidationIssue, type ValidationReport } from './issues.js';
import { offensiveTextIssues } from './offensive.js';

/** Speaking rate the script prompt plans with (PLAN.md: ≈150 words per minute). */
export const WORDS_PER_MINUTE = 150;

export function targetWordsFor(minutes: number): number {
  return Math.round(minutes * WORDS_PER_MINUTE);
}

export interface ScriptCheckOptions {
  readonly targetWords: number;
  /** Allowed relative deviation from the target. Default 0.15 (±15 %). */
  readonly tolerance?: number;
  /**
   * A world's words budget (PLAN.md#14.18, `WorldPromptText.wordBudget`): a warning when the
   * script runs over `words` by more than `over` (a share).
   */
  readonly budget?: { readonly words: number; readonly over: number };
}

export interface ScriptStats {
  readonly wordCount: number;
  readonly estimatedMinutes: number;
}

interface Pattern {
  readonly code: string;
  readonly regex: RegExp;
  readonly message: string;
}

const FORBIDDEN: readonly Pattern[] = [
  { code: 'markdown-heading', regex: /^\s{0,3}#{1,6}\s/m, message: 'markdown heading' },
  { code: 'markdown-list', regex: /^\s*(?:[-*+•]|\d+[.)])\s/m, message: 'list item' },
  { code: 'markdown-emphasis', regex: /\*\*|__|`/, message: 'markdown emphasis/code' },
  { code: 'stage-direction', regex: /\[[^\]\n]*\]/, message: 'bracketed direction like [VISUAL]' },
  {
    code: 'stage-direction',
    regex: /^\s*\([^)\n]*\)\s*$/m,
    message: 'parenthetical direction line',
  },
  {
    code: 'speaker-label',
    regex: /^\s*(?:NARRATOR|VO|V\.O\.|VOICE ?OVER|HOST|SCENE|VISUAL|CUT TO|MUSIC|SFX)\s*:/im,
    message: 'speaker label or scene marker',
  },
  { code: 'emoji', regex: /\p{Extended_Pictographic}/u, message: 'emoji' },
];

/** Words a speaker says: tokens containing a letter or digit. */
export function countWords(text: string): number {
  return text.split(/\s+/).filter((token) => /[\p{L}\p{N}]/u.test(token)).length;
}

function lineOf(text: string, regex: RegExp): number {
  const match = regex.exec(text);
  return match === null ? 0 : text.slice(0, match.index).split('\n').length;
}

export function validateScript(
  text: string,
  options: ScriptCheckOptions,
): ValidationReport<ScriptStats> {
  const issues: ValidationIssue[] = [];
  if (text.trim() === '')
    return report<ScriptStats>(undefined, [issue('error', 'empty', 'script is empty')]);
  for (const pattern of FORBIDDEN) {
    if (pattern.regex.test(text)) {
      issues.push(
        issue(
          'error',
          pattern.code,
          `${pattern.message} (line ${String(lineOf(text, pattern.regex))})`,
        ),
      );
    }
  }
  // Slurs and profanity are never narrated (real run Comic 1): an error, the repair turn rewords.
  issues.push(...offensiveTextIssues(text));
  const wordCount = countWords(text);
  const tolerance = options.tolerance ?? 0.15;
  const deviation = (wordCount - options.targetWords) / options.targetWords;
  if (Math.abs(deviation) > tolerance) {
    issues.push(
      issue(
        'error',
        'word-count',
        `${String(wordCount)} words, target ${String(options.targetWords)} ±${String(Math.round(tolerance * 100))} % (${deviation > 0 ? '+' : ''}${String(Math.round(deviation * 100))} %)`,
      ),
    );
  }
  const budget = options.budget;
  if (budget !== undefined && wordCount > budget.words * (1 + budget.over)) {
    issues.push(
      issue(
        'warning',
        'word-budget',
        `${String(wordCount)} words, over the budget of ${String(budget.words)} (150 wpm × the target length) by more than ${String(Math.round(budget.over * 100))} %: the film runs long; cut sentences, not facts`,
      ),
    );
  }
  return report({ wordCount, estimatedMinutes: wordCount / WORDS_PER_MINUTE }, issues);
}
