import { describe, expect, it } from 'vitest';
import { itemKey, SelectionStore, selectedCues } from './selection.js';

const shot = { kind: 'shot', id: 's01' } as const;
const cue = { kind: 'cue', track: 'sfx', index: 2 } as const;
const word = { kind: 'word', index: 7 } as const;

describe('SelectionStore', () => {
  it('selects, adds with Shift and toggles off', () => {
    const store = new SelectionStore();
    let notified = 0;
    store.subscribe(() => {
      notified += 1;
    });
    store.select([shot], false);
    store.select([cue], true);
    expect(store.getSnapshot()).toEqual([shot, cue]);
    store.select([cue], true);
    expect(store.getSnapshot()).toEqual([shot]);
    store.select([word], false);
    expect(store.getSnapshot()).toEqual([word]);
    expect(notified).toBe(4);
  });

  it('keeps the snapshot identity when nothing changes', () => {
    const store = new SelectionStore();
    store.set([shot, shot, cue]);
    const snapshot = store.getSnapshot();
    expect(snapshot).toEqual([shot, cue]);
    store.set([cue, shot]);
    expect(store.getSnapshot()).toBe(snapshot);
  });

  it('drops items that no longer exist', () => {
    const store = new SelectionStore();
    store.set([shot, cue, word]);
    store.retain((item) => item.kind !== 'cue');
    expect(store.getSnapshot()).toEqual([shot, word]);
    store.clear();
    expect(store.getSnapshot()).toEqual([]);
  });

  it('keys and filters items', () => {
    expect([shot, cue, word].map(itemKey)).toEqual(['shot:s01', 'cue:sfx:2', 'word:7']);
    expect(selectedCues([shot, cue, word])).toEqual([cue]);
  });
});
