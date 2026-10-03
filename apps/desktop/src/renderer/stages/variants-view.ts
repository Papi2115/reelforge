/**
 * View model of shot variants (PLAN.md#11.3): the default count (Economy: 2), whether variants of
 * a shot are being generated now, keyboard navigation of the cards (1/2/3, arrows, Enter) and the
 * V shortcut. Pure.
 */
import type { StageRunView, StagesState } from '../../shared/stages-contract.js';
import type {
  VariantCard,
  VariantCount,
  VariantSetView,
  VariantsState,
} from '../../shared/variants-contract.js';
import { isTextEntry, type TransportKey } from '../preview/transport-keys.js';

export const QA_SYMBOLS = { ok: '✓', warning: '⚠', failed: '✗' } as const;

export function defaultVariantCount(economy: boolean): VariantCount {
  return economy ? 2 : 3;
}

/** The scene run generating / deciding variants of `shotId`, if one runs now. */
export function variantsRun(
  running: StageRunView | null | undefined,
  shotId: string,
): StageRunView | null {
  if (running?.stage !== 'scenes' || running.action !== 'variants') return null;
  return running.targets?.includes(shotId) === true ? running : null;
}

/** Scenes built runs or waits: variant actions must wait. */
export function scenesBusy(state: StagesState | undefined): boolean {
  return state?.running?.stage === 'scenes' || state?.queue.includes('scenes') === true;
}

export function setOf(
  state: VariantsState | undefined,
  shotId: string,
): VariantSetView | undefined {
  return state?.sets.find((set) => set.shotId === shotId);
}

/** Shots that have variants waiting for a decision. */
export function shotsWithVariants(state: VariantsState | undefined): ReadonlySet<string> {
  return new Set((state?.sets ?? []).map((set) => set.shotId));
}

/** A variant card that can be picked. */
export function pickable(card: VariantCard | undefined): boolean {
  return card !== undefined && card.key !== 'current' && card.status === 'ready';
}

export function variantIndex(card: VariantCard): number | undefined {
  return card.key === 'current' ? undefined : Number(card.key.slice(1));
}

export type CardKeyAction =
  { readonly kind: 'select'; readonly index: number } | { readonly kind: 'pick' } | undefined;

/**
 * Keys of the Variants view: 1/2/3 select a variant card, arrows move the selection, Enter picks
 * ("Use this one"). `selected` is the card index (0 = current scene).
 */
export function cardKeyAction(
  event: TransportKey,
  cards: readonly VariantCard[],
  selected: number,
): CardKeyAction {
  if (event.ctrlKey || event.altKey || event.metaKey) return undefined;
  if (event.target !== undefined && isTextEntry(event.target)) return undefined;
  if (/^[1-3]$/.test(event.key)) {
    const index = cards.findIndex((card) => card.key === `v${event.key}`);
    return index === -1 ? undefined : { kind: 'select', index };
  }
  if (cards.length === 0) return undefined;
  switch (event.key) {
    case 'ArrowLeft':
    case 'ArrowUp':
      return { kind: 'select', index: (selected - 1 + cards.length) % cards.length };
    case 'ArrowRight':
    case 'ArrowDown':
      return { kind: 'select', index: (selected + 1) % cards.length };
    case 'Enter':
      return pickable(cards[selected]) ? { kind: 'pick' } : undefined;
    default:
      return undefined;
  }
}

/** V outside text fields: "Variants…" of the selected shot. */
export function isVariantsShortcut(event: TransportKey): boolean {
  if (event.ctrlKey || event.altKey || event.metaKey || event.shiftKey || event.repeat) {
    return false;
  }
  if (event.target !== undefined && isTextEntry(event.target)) return false;
  return event.key.toLowerCase() === 'v';
}

/** "Building variant 2/3 · Claude: scene-build s03 v2" while variants are generated. */
export function variantsProgressText(run: StageRunView, set: VariantSetView | undefined): string {
  const variants = set?.cards.filter((card) => card.key !== 'current') ?? [];
  const done = variants.filter((card) => card.status !== 'building').length;
  const head =
    variants.length === 0
      ? 'Generating variants'
      : `Variants: ${String(done)}/${String(variants.length)} done`;
  return run.label === null ? head : `${head} · ${run.label}`;
}

/** Card badge text: ✓ / ⚠ / ✗, "Building…", "Dropped". */
export function cardBadge(card: VariantCard): string {
  if (card.status === 'building') return 'Building…';
  if (card.status === 'dropped') return 'Dropped';
  return card.qa === null ? '○' : QA_SYMBOLS[card.qa];
}
