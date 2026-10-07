/**
 * The inventory, shop and split-timer breakthroughs (PLAN.md#13.15 B1 rework) without a GPU:
 * intent required, readable errors that say what to change (the beat of silence before the
 * result, the hold after the last beat, buys too close, cumulative splits), the derived game
 * logic (a buy the wallet cannot pay, the timer landing exactly on each value) and the cues.
 */
import { describe, expect, it } from 'vitest';
import { ScreenModel } from '../screen/model.js';
import { playToolkits } from '../screen/play-toolkits.js';
import { formatValue, splitsSchema, planSplits, timerAt } from './splits.js';

const at = (when: number | string): number => Number(when);

function setup() {
  const model = new ScreenModel(5, 6, 2);
  for (const id of ['a', 'b', 'c', 'd'])
    model.vocab.defineSprite(id, {
      rows: ['.##.', '####', '.##.'],
      colours: 'cream',
      size: 2,
      rowH: 3,
    });
  return { model, kit: playToolkits(model, at, 6) };
}

const INVENTORY = {
  intent: 'the cue and the routine combine into the habit',
  at: 0,
  until: 5,
  slots: [{ sprite: 'a', label: 'CUE' }, { sprite: 'b', label: 'ROUTINE' }, { sprite: 'c', label: 'REWARD' }],
  cursor: [[1, 0], [1.4, 1]],
  craft: { a: 0, b: 1, at: 2, result: { sprite: 'd', label: 'HABIT' } },
}; // prettier-ignore

const SHOP = {
  intent: 'thirty minutes buy the walk or the show, not both',
  at: 0,
  until: 5,
  wallet: { label: 'MINUTES', amount: 30 },
  items: [{ sprite: 'a', label: 'WALK', price: 20 }, { sprite: 'b', label: 'SHOW', price: 25 }],
  buys: [{ item: 0, at: 1.5 }, { item: 1, at: 2.6 }],
}; // prettier-ignore

const SPLITS = {
  intent: 'the routine gets faster with every week of practice',
  at: 0,
  until: 5,
  unit: 'clock',
  splits: [{ name: 'WEEK 1', value: 95, at: 1 }, { name: 'WEEK 4', value: 150, at: 2.2, delta: -40 }],
}; // prettier-ignore

describe('inventory()', () => {
  it('names what to change', () => {
    const { kit } = setup();
    expect(() => kit.inventory({ ...INVENTORY, intent: undefined })).toThrow(/intent/);
    expect(() => kit.inventory({ ...INVENTORY, craft: { ...INVENTORY.craft, b: 0 } })).toThrow(/two different/);
    expect(() => kit.inventory({ ...INVENTORY, craft: { ...INVENTORY.craft, reveal: 2.3 } })).toThrow(/beat of silence/);
    expect(() => kit.inventory({ ...INVENTORY, until: 12 })).toThrow(/max 4 s/);
    expect(() => kit.inventory({ ...INVENTORY, craft: { ...INVENTORY.craft, a: 5 } })).toThrow(/3 slots/);
  }); // prettier-ignore

  it('lifts, waits a beat, then the result lands with its cues', () => {
    const { kit } = setup();
    const r = kit.inventory(INVENTORY);
    expect(r.cues.find((cue) => cue.name === 'pop')?.t).toBe(2);
    expect(r.cues.find((cue) => cue.name === 'success')?.t).toBe(3);
  });
});

describe('shop()', () => {
  it('names what to change and blinks NOT ENOUGH for a buy the wallet cannot pay', () => {
    const { kit } = setup();
    expect(() => kit.shop({ ...SHOP, intent: undefined })).toThrow(/intent/);
    expect(() => kit.shop({ ...SHOP, buys: [{ item: 0, at: 1.5 }, { item: 1, at: 1.7 }] })).toThrow(/0.3 s/);
    expect(() => kit.shop({ ...SHOP, buys: [{ item: 3, at: 1.5 }] })).toThrow(/2 items/);
    const r = kit.shop(SHOP);
    expect(r.cues.filter((cue) => cue.name === 'coin').map((cue) => cue.t)).toEqual([1.5]);
    expect(r.cues.filter((cue) => cue.name === 'error-buzz').map((cue) => cue.t)).toEqual([2.6]);
  }); // prettier-ignore
});

describe('splits()', () => {
  it('names what to change', () => {
    const { kit } = setup();
    expect(() => kit.splits({ ...SPLITS, intent: undefined })).toThrow(/intent/);
    const back = [{ name: 'A', value: 90, at: 1 }, { name: 'B', value: 60, at: 2 }];
    expect(() => kit.splits({ ...SPLITS, splits: back })).toThrow(/cumulative/);
    expect(() => kit.splits({ ...SPLITS, until: 9 })).toThrow(/max 4 s/);
  }); // prettier-ignore

  it('lands the timer exactly on each value on its beat', () => {
    const plan = planSplits(splitsSchema.parse(SPLITS), at, () => {
      throw new Error('no sprite');
    });
    expect(timerAt(plan, 1)).toBe(95);
    expect(timerAt(plan, 2.2)).toBe(150);
    expect(timerAt(plan, 1.6)).toBeGreaterThan(95);
    expect(formatValue(95, 'clock')).toBe('1:35');
    expect(formatValue(3725, 'clock')).toBe('1:02:05');
    expect(formatValue(66, 'DAYS')).toBe('66');
    expect(plan.splits[1]?.delta).toBe('-0:40');
  });
});
