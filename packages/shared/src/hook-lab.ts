/**
 * Hook lab (PLAN.md#12.16, ADR-021): three alternative openings of the script — a cold open, a
 * question, a shocking fact — written by Claude from the finished script, compared side by side;
 * the picked one replaces the script's opening paragraph. Every set is kept as
 * `.reelforge/hooks/<n>.json` (app state, not tracked by git), like the shot variants.
 */
import { z } from 'zod';

export const HOOK_LAB_VERSION = 1;
/** Project-relative folder of the hook sets (git-ignored app state). */
export const HOOK_LAB_DIR = '.reelforge/hooks';

export const HOOK_STYLES = ['cold-open', 'question', 'shocking-fact'] as const;
export const hookStyleSchema = z.enum(HOOK_STYLES);
export type HookStyle = z.infer<typeof hookStyleSchema>;

export const HOOK_STYLE_LABELS: Readonly<Record<HookStyle, string>> = {
  'cold-open': 'Cold open',
  question: 'Question',
  'shocking-fact': 'Shocking fact',
};

/** Spoken length of an opening: 40–70 words ≈ 15–25 s (PLAN.md#12.16). */
export const HOOK_MIN_WORDS = 40;
export const HOOK_MAX_WORDS = 70;
/** Speaking rate the estimates use (= `WORDS_PER_MINUTE` of the prompts package). */
export const HOOK_WORDS_PER_MINUTE = 150;

export const hookVariantSchema = z.object({
  /** 1-based, the order of `HOOK_STYLES`. */
  index: z.int().min(1).max(HOOK_STYLES.length),
  style: hookStyleSchema,
  /** The spoken opening (one paragraph). */
  text: z.string().min(1).max(1_200),
  /** One-line idea of the first image. */
  firstVisual: z.string().min(1).max(200),
  /** It states a number or a fact that should be sourced (or checked against research.md). */
  claimsToSource: z.boolean(),
  wordCount: z.int().nonnegative(),
});
export type HookVariant = z.infer<typeof hookVariantSchema>;

export const hookDecisionSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('pick'),
    index: z.int().min(1).max(HOOK_STYLES.length),
    at: z.iso.datetime(),
  }),
  z.object({ kind: z.literal('discard'), at: z.iso.datetime() }),
]);
export type HookDecision = z.infer<typeof hookDecisionSchema>;

export const hookSetSchema = z.object({
  version: z.literal(HOOK_LAB_VERSION),
  /** Sequence number: the file name `<number>.json`. */
  number: z.int().min(1),
  createdAt: z.iso.datetime(),
  /** The opening paragraph the hooks replace, as it was when they were written. */
  opening: z.string().min(1),
  /** `textFingerprint` of script.txt when the hooks were written. */
  scriptFingerprint: z.string().min(1),
  variants: z.array(hookVariantSchema).length(HOOK_STYLES.length),
  /** What the checks noted but did not refuse (e.g. a flagged number missing in research.md). */
  warnings: z.array(z.string()).default([]),
  /** Absent while the user has not decided. */
  decision: hookDecisionSchema.optional(),
});
export type HookSet = z.infer<typeof hookSetSchema>;

/** Project-relative file of hook set `number`. */
export function hookSetFile(number: number): string {
  return `${HOOK_LAB_DIR}/${String(number)}.json`;
}

/** Words a speaker says: tokens with a letter or a digit (as the script validator counts). */
export function countSpokenWords(text: string): number {
  return text.split(/\s+/).filter((token) => /[\p{L}\p{N}]/u.test(token)).length;
}

/** Seconds `words` take at the planned speaking rate. */
export function spokenSeconds(words: number): number {
  return (words / HOOK_WORDS_PER_MINUTE) * 60;
}

/** The opening paragraph of a script and where it sits (character offsets). */
export interface ScriptOpening {
  readonly text: string;
  readonly start: number;
  readonly end: number;
}

/** The first paragraph of script.txt (paragraphs are separated by blank lines). */
export function scriptOpening(script: string): ScriptOpening | undefined {
  const start = script.search(/\S/);
  if (start < 0) return undefined;
  const blank = /\r?\n[ \t]*\r?\n/g;
  blank.lastIndex = start;
  const found = blank.exec(script);
  let end = found === null ? script.length : found.index;
  while (end > start && /\s/.test(script.charAt(end - 1))) end -= 1;
  return { text: script.slice(start, end), start, end };
}

/** script.txt with its opening paragraph replaced by `opening`; the rest stays byte for byte. */
export function replaceScriptOpening(script: string, opening: string): string {
  const current = scriptOpening(script);
  const text = opening.trim();
  if (current === undefined) return `${text}\n`;
  return `${script.slice(0, current.start)}${text}${script.slice(current.end)}`;
}
