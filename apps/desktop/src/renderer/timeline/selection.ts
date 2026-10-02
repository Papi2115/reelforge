/**
 * Timeline selection (PLAN.md#6.5): shots, cues and words, shared by the timeline, the shots list
 * and (later, PLAN.md#6.6) the chat scope. A tiny external store: `useSyncExternalStore` friendly,
 * snapshots are immutable arrays that change identity only when the selection changes.
 */
import { useSyncExternalStore } from 'react';
import type { CueTrack } from '../../shared/timeline-contract.js';

export type TimelineItem =
  | { readonly kind: 'shot'; readonly id: string }
  | { readonly kind: 'cue'; readonly track: CueTrack; readonly index: number }
  | { readonly kind: 'word'; readonly index: number };

export function itemKey(item: TimelineItem): string {
  switch (item.kind) {
    case 'shot':
      return `shot:${item.id}`;
    case 'cue':
      return `cue:${item.track}:${String(item.index)}`;
    case 'word':
      return `word:${String(item.index)}`;
  }
}

const EMPTY: readonly TimelineItem[] = [];

export class SelectionStore {
  private items: readonly TimelineItem[] = EMPTY;
  private keys = new Set<string>();
  private readonly listeners = new Set<() => void>();

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  readonly getSnapshot = (): readonly TimelineItem[] => this.items;

  has(item: TimelineItem): boolean {
    return this.keys.has(itemKey(item));
  }

  /** Replaces the selection (duplicates dropped, order kept). */
  set(items: readonly TimelineItem[]): void {
    const keys = new Set<string>();
    const unique = items.filter((item) => {
      const key = itemKey(item);
      if (keys.has(key)) return false;
      keys.add(key);
      return true;
    });
    if (unique.length === this.items.length && unique.every((item) => this.has(item))) return;
    this.items = unique.length === 0 ? EMPTY : unique;
    this.keys = keys;
    for (const listener of this.listeners) listener();
  }

  /** Click: select only `items`; Shift-click: add them, or remove them when all were selected. */
  select(items: readonly TimelineItem[], additive: boolean): void {
    if (!additive) {
      this.set(items);
      return;
    }
    const allSelected = items.length > 0 && items.every((item) => this.has(item));
    if (allSelected) {
      const removed = new Set(items.map(itemKey));
      this.set(this.items.filter((item) => !removed.has(itemKey(item))));
    } else {
      this.set([...this.items, ...items]);
    }
  }

  clear(): void {
    this.set(EMPTY);
  }

  /** Drops selected items that no longer exist (after an edit or a file change). */
  retain(exists: (item: TimelineItem) => boolean): void {
    if (this.items.every(exists)) return;
    this.set(this.items.filter(exists));
  }
}

export function useSelection(store: SelectionStore): readonly TimelineItem[] {
  return useSyncExternalStore(store.subscribe, store.getSnapshot);
}

/** Selected cues, grouped by track. */
export function selectedCues(
  items: readonly TimelineItem[],
): { readonly track: CueTrack; readonly index: number }[] {
  return items.flatMap((item) => (item.kind === 'cue' ? [item] : []));
}
