/**
 * Hook lab view model (PLAN.md#12.16): what the dialog shows for the lab's state — the current
 * opening next to the three alternative openings with their word count, spoken length at
 * 150 wpm, first-visual idea, "needs a source" flag and a word diff against the current opening —
 * and what picking one means (re-record the voice-over, locked shots kept, later steps out of
 * date). Pure.
 */
import {
  HOOK_STYLE_LABELS,
  countSpokenWords,
  spokenSeconds,
  type HookSet,
} from '@reelforge/shared';
import type { HookLabView } from '../../shared/hook-lab-contract.js';

export type DiffKind = 'same' | 'added' | 'removed';

export interface DiffToken {
  readonly kind: DiffKind;
  readonly text: string;
}

/** Word-level diff (longest common subsequence); runs of one kind are merged. */
export function wordDiff(before: string, after: string): DiffToken[] {
  const a = before.split(/\s+/).filter((word) => word !== '');
  const b = after.split(/\s+/).filter((word) => word !== '');
  const table: number[][] = Array.from({ length: a.length + 1 }, () =>
    new Array<number>(b.length + 1).fill(0),
  );
  for (let i = a.length - 1; i >= 0; i -= 1) {
    const row = table[i] ?? [];
    const below = table[i + 1] ?? [];
    for (let j = b.length - 1; j >= 0; j -= 1) {
      row[j] = a[i] === b[j] ? (below[j + 1] ?? 0) + 1 : Math.max(below[j] ?? 0, row[j + 1] ?? 0);
    }
  }
  const tokens: DiffToken[] = [];
  const push = (kind: DiffKind, word: string): void => {
    const last = tokens.at(-1);
    if (last?.kind === kind) tokens[tokens.length - 1] = { kind, text: `${last.text} ${word}` };
    else tokens.push({ kind, text: word });
  };
  let i = 0;
  let j = 0;
  while (i < a.length || j < b.length) {
    const wordA = a[i];
    const wordB = b[j];
    if (wordA !== undefined && wordA === wordB) {
      push('same', wordA);
      i += 1;
      j += 1;
    } else if (
      wordB !== undefined &&
      (wordA === undefined || (table[i]?.[j + 1] ?? 0) >= (table[i + 1]?.[j] ?? 0))
    ) {
      push('added', wordB);
      j += 1;
    } else if (wordA !== undefined) {
      push('removed', wordA);
      i += 1;
    }
  }
  return tokens;
}

/** `≈ 18 s` at the planned speaking rate. */
export function durationLabel(words: number): string {
  return `≈ ${String(Math.round(spokenSeconds(words)))} s`;
}

export interface OpeningCard {
  /** 0 = the current opening, 1–3 = the variants. */
  readonly index: number;
  readonly title: string;
  readonly text: string;
  readonly words: number;
  readonly duration: string;
  readonly firstVisual: string | null;
  readonly needsSource: boolean;
  /** Against the current opening (empty for the current one). */
  readonly diff: readonly DiffToken[];
}

export function openingCards(opening: string, set: HookSet): OpeningCard[] {
  const words = countSpokenWords(opening);
  return [
    {
      index: 0,
      title: 'Current opening',
      text: opening,
      words,
      duration: durationLabel(words),
      firstVisual: null,
      needsSource: false,
      diff: [],
    },
    ...set.variants.map((variant) => ({
      index: variant.index,
      title: `${String(variant.index)} · ${HOOK_STYLE_LABELS[variant.style]}`,
      text: variant.text,
      words: variant.wordCount,
      duration: durationLabel(variant.wordCount),
      firstVisual: variant.firstVisual,
      needsSource: variant.claimsToSource,
      diff: wordDiff(opening, variant.text),
    })),
  ];
}

export type LabPhase =
  | { readonly kind: 'no-script' }
  | { readonly kind: 'busy' }
  | { readonly kind: 'generating' }
  /** Nothing to compare: offer "Write three openings". */
  | { readonly kind: 'empty'; readonly history: number }
  /** The openings were written for an older version of the opening. */
  | { readonly kind: 'stale' }
  | { readonly kind: 'compare'; readonly set: HookSet; readonly opening: string };

export function labPhase(view: HookLabView): LabPhase {
  if (view.opening === null) return { kind: 'no-script' };
  if (view.generating) return { kind: 'generating' };
  if (view.scriptBusy) return { kind: 'busy' };
  const set = view.set;
  if (set === null || set.decision !== undefined) return { kind: 'empty', history: view.history };
  if (view.stale) return { kind: 'stale' };
  return { kind: 'compare', set, opening: view.opening };
}

/** What "Use this opening" means, shown before the user confirms. */
export function pickConsequences(view: HookLabView): string[] {
  const lines = [
    'The opening paragraph of the script is replaced; the rest stays as it is (a commit you can revert).',
    'Later steps that already ran (timed words, storyboard, scenes…) become out of date.',
  ];
  if (view.voiceover) {
    lines.push(
      'You will need to re-record the opening: the voice-over no longer matches the script.',
    );
  }
  if (view.lockedShots.length > 0) {
    lines.push(
      `Locked shots stay exactly as they are and are never rebuilt automatically: ${view.lockedShots.join(', ')}.`,
    );
  }
  return lines;
}
