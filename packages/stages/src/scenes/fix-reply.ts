/**
 * What an unattended fix turn's reply tells the stage (real run Game B2 1, s08: the final-review
 * fix ended with "Should I go ahead, or undo these edits?" and left its edits in place; nobody
 * answers in the auto or production-line flow). A reply whose last paragraph is a question makes
 * the shot ⚠, so a person looks at it instead of the shot silently passing.
 */
import type { QaFinding } from '@reelforge/shared';
import { finding } from './checks.js';

/** Longest question quoted in the finding. */
const MAX_QUOTED = 200;

/** The reply's last paragraph when it ends with a question mark; undefined otherwise. */
export function closingQuestion(reply: string): string | undefined {
  const paragraphs = reply
    .trim()
    .split(/\r?\n\s*\r?\n/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph !== '');
  const last = paragraphs.at(-1);
  if (last === undefined || !/\?[\s*_)"'`»”]*$/u.test(last)) return undefined;
  return last.replace(/\s+/g, ' ');
}

/** The ⚠ of a fix turn that ended with a question. */
export function questionFinding(question: string): QaFinding {
  const quoted = question.length > MAX_QUOTED ? `${question.slice(0, MAX_QUOTED - 1)}…` : question;
  return finding(
    'claude',
    'warning',
    `fix turn asked a question instead of finishing ("${quoted}"); its edits are in place unconfirmed: check the shot.`,
  );
}
