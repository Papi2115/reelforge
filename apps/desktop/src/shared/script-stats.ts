/**
 * Live word counter and duration estimate of the script editor (PLAN.md#7.1): words are counted
 * the way the script validator of @reelforge/prompts counts them (tokens with a letter or digit;
 * a test keeps both in step), spoken at 150 words per minute, compared with the brief's target.
 * Pure; runs in the renderer.
 */

export const WORDS_PER_MINUTE = 150;
/** The script stage accepts ±15 % around the target (validator tolerance). */
export const SCRIPT_TOLERANCE = 0.15;
/** Beyond this the estimate turns red. */
export const SCRIPT_FAR_OFF = 0.3;

export type ScriptVerdict = 'none' | 'ok' | 'warn' | 'bad';

export interface ScriptEstimate {
  readonly words: number;
  readonly seconds: number;
  /** null without a target length. */
  readonly targetWords: number | null;
  readonly targetSeconds: number | null;
  /** (words - target) / target, null without a target. */
  readonly deviation: number | null;
  readonly verdict: ScriptVerdict;
}

/** Words a speaker says: tokens containing a letter or digit. */
export function countSpokenWords(text: string): number {
  return text.split(/\s+/).filter((token) => /[\p{L}\p{N}]/u.test(token)).length;
}

export function verdictOf(deviation: number | null): ScriptVerdict {
  if (deviation === null) return 'none';
  const off = Math.abs(deviation);
  if (off <= SCRIPT_TOLERANCE) return 'ok';
  return off <= SCRIPT_FAR_OFF ? 'warn' : 'bad';
}

export function scriptEstimate(text: string, targetMinutes: number | null): ScriptEstimate {
  const words = countSpokenWords(text);
  const seconds = (words / WORDS_PER_MINUTE) * 60;
  const targetWords =
    targetMinutes === null || targetMinutes <= 0
      ? null
      : Math.round(targetMinutes * WORDS_PER_MINUTE);
  const deviation = targetWords === null ? null : (words - targetWords) / targetWords;
  return {
    words,
    seconds,
    targetWords,
    targetSeconds: targetMinutes === null || targetWords === null ? null : targetMinutes * 60,
    deviation,
    verdict: verdictOf(deviation),
  };
}

/** `m:ss` (rounded to whole seconds). */
export function formatMinutes(seconds: number): string {
  const rounded = Math.max(0, Math.round(seconds));
  return `${String(Math.floor(rounded / 60))}:${String(rounded % 60).padStart(2, '0')}`;
}

/** One line for the editor footer, e.g. `84 words · ~0:34 · target 0:30 (+12 %)`. */
export function estimateLine(estimate: ScriptEstimate): string {
  const head = `${String(estimate.words)} ${estimate.words === 1 ? 'word' : 'words'} · ~${formatMinutes(estimate.seconds)}`;
  if (estimate.targetSeconds === null || estimate.deviation === null) return head;
  const percent = Math.round(estimate.deviation * 100);
  const sign = percent > 0 ? '+' : '';
  return `${head} · target ${formatMinutes(estimate.targetSeconds)} (${sign}${String(percent)} %)`;
}
