/**
 * The `hooks` reply (PLAN.md#12.16, hook lab): `{"hooks":[{style,text,firstVisual,claimsToSource}]}`
 * with exactly one opening per form (cold open, question, shocking fact). Checks: 40–70 spoken
 * words, spoken text only (the script rules), the three differ from each other and from the
 * current opening, and every number appears in research.md — a number that does not is an error
 * unless the opening is flagged `claimsToSource` (then a warning). An opening stating a number is
 * always flagged in the result.
 */
import {
  HOOK_MAX_WORDS,
  HOOK_MIN_WORDS,
  HOOK_STYLES,
  countSpokenWords,
  hookStyleSchema,
  scriptOpening,
  type HookVariant,
  type VideoLanguage,
} from '@reelforge/shared';
import { z } from 'zod';
import {
  issue,
  parseJsonText,
  report,
  schemaIssues,
  type ValidationIssue,
  type ValidationReport,
} from './issues.js';
import { validateScript } from './script.js';

export const hooksReplySchema = z.strictObject({
  hooks: z
    .array(
      z.strictObject({
        style: hookStyleSchema,
        text: z.string().trim().min(1).max(1_200),
        firstVisual: z.string().trim().min(1).max(200),
        claimsToSource: z.boolean(),
      }),
    )
    .length(HOOK_STYLES.length),
});
export type HooksReply = z.infer<typeof hooksReplySchema>;

export interface HooksReplyOptions {
  /** The opening paragraph the hooks replace. */
  readonly currentOpening: string;
  /** research.md (numbers must appear in it). */
  readonly research: string;
}

/** Above this word overlap (Jaccard) two openings count as the same. */
export const HOOK_MAX_SIMILARITY = 0.8;
/** research.md is cut to this many characters in the prompt. */
export const HOOK_RESEARCH_MAX_CHARS = 8_000;

const LANGUAGE_NAMES: Readonly<Record<VideoLanguage, string>> = { en: 'English', pl: 'Polish' };

function normalizedWords(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word !== '');
}

function similarity(first: string, second: string): number {
  const a = new Set(normalizedWords(first));
  const b = new Set(normalizedWords(second));
  const union = new Set([...a, ...b]).size;
  if (union === 0) return 1;
  return [...a].filter((word) => b.has(word)).length / union;
}

/** Numbers written with digits, normalised (`1,672` = `1672`). */
export function numbersIn(text: string): string[] {
  return [...text.matchAll(/\d+(?:[.,]\d+)*/g)].map((match) =>
    match[0].replace(/,(?=\d{3}(?!\d))/g, ''),
  );
}

function formIssues(text: string, path: string): ValidationIssue[] {
  // Only the spoken-text rules of the script validator (the word count is checked below).
  const words = Math.max(1, countSpokenWords(text));
  return validateScript(text, { targetWords: words, tolerance: 1 }).issues.map((entry) => ({
    ...entry,
    path,
  }));
}

function hookIssues(
  hook: HooksReply['hooks'][number],
  index: number,
  options: HooksReplyOptions,
  researchNumbers: ReadonlySet<string>,
): { issues: ValidationIssue[]; claims: boolean } {
  const path = `hooks[${String(index)}]`;
  const issues = formIssues(hook.text, `${path}.text`);
  const words = countSpokenWords(hook.text);
  if (words < HOOK_MIN_WORDS || words > HOOK_MAX_WORDS) {
    issues.push(
      issue(
        'error',
        'hook-word-count',
        `${String(words)} words, expected ${String(HOOK_MIN_WORDS)}–${String(HOOK_MAX_WORDS)}`,
        `${path}.text`,
      ),
    );
  }
  if (similarity(hook.text, options.currentOpening) >= HOOK_MAX_SIMILARITY) {
    issues.push(
      issue('error', 'hook-unchanged', 'the same as the current opening', `${path}.text`),
    );
  }
  const numbers = numbersIn(hook.text);
  for (const number of numbers.filter((value) => !researchNumbers.has(value))) {
    issues.push(
      hook.claimsToSource
        ? issue(
            'warning',
            'hook-number-unsourced',
            `${number} is not in research.md (flagged to source)`,
            `${path}.text`,
          )
        : issue(
            'error',
            'hook-number-not-in-research',
            `${number} is not in research.md: use a number from the notes or flag the claim`,
            `${path}.text`,
          ),
    );
  }
  if (numbers.length > 0 && !hook.claimsToSource) {
    issues.push(
      issue(
        'warning',
        'hook-claim-flag',
        'states a number: marked as a claim to source',
        `${path}.claimsToSource`,
      ),
    );
  }
  return { issues, claims: hook.claimsToSource || numbers.length > 0 };
}

export function validateHooksReply(
  reply: string,
  options: HooksReplyOptions,
): ValidationReport<HookVariant[]> {
  const json = parseJsonText(reply);
  if (!json.parsed) return report<HookVariant[]>(undefined, json.issues);
  const parsed = hooksReplySchema.safeParse(json.value);
  if (!parsed.success) {
    return report<HookVariant[]>(undefined, [...json.issues, ...schemaIssues(parsed.error)]);
  }
  const issues: ValidationIssue[] = [...json.issues];
  const { hooks } = parsed.data;
  const styles = new Set(hooks.map((hook) => hook.style));
  if (styles.size !== HOOK_STYLES.length) {
    issues.push(
      issue('error', 'hook-styles', `one opening per form is needed: ${HOOK_STYLES.join(', ')}`),
    );
  }
  hooks.forEach((hook, index) => {
    hooks.slice(0, index).forEach((earlier, other) => {
      if (similarity(hook.text, earlier.text) >= HOOK_MAX_SIMILARITY) {
        issues.push(
          issue(
            'error',
            'hook-similar',
            `too close to hooks[${String(other)}]: the openings must differ`,
            `hooks[${String(index)}].text`,
          ),
        );
      }
    });
  });
  const researchNumbers = new Set(numbersIn(options.research));
  const variants = hooks.map((hook, index): HookVariant => {
    const checked = hookIssues(hook, index, options, researchNumbers);
    issues.push(...checked.issues);
    return {
      index: HOOK_STYLES.indexOf(hook.style) + 1,
      style: hook.style,
      text: hook.text,
      firstVisual: hook.firstVisual,
      claimsToSource: checked.claims,
      wordCount: countSpokenWords(hook.text),
    };
  });
  return report(
    [...variants].sort((first, second) => first.index - second.index),
    issues,
  );
}

/** Template variables of the `hooks` prompt; undefined when the script has no text. */
export function hooksPromptVars(input: {
  readonly script: string;
  readonly research: string;
  readonly language: VideoLanguage;
}): Record<string, string | number> | undefined {
  const opening = scriptOpening(input.script);
  if (opening === undefined) return undefined;
  const rest = input.script.slice(opening.end).trim();
  const research = input.research.trim();
  return {
    language: LANGUAGE_NAMES[input.language],
    opening: opening.text,
    rest: rest === '' ? '(nothing: the opening is the whole script)' : rest,
    research:
      research === ''
        ? '(no research notes: state no numbers or dates)'
        : research.slice(0, HOOK_RESEARCH_MAX_CHARS),
    minWords: HOOK_MIN_WORDS,
    maxWords: HOOK_MAX_WORDS,
  };
}
