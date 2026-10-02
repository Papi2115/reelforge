/** Test helper: a KitRng with the engine's algorithm (mulberry32), without depending on the engine. */
import type { KitRng } from '../types.js';

export function testRng(seed: number): KitRng {
  let state = seed >>> 0;
  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let mixed = state;
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
  return Object.assign(() => next(), {
    range: (min: number, max: number) => min + (max - min) * next(),
    int: (min: number, max: number) => Math.floor(min + (max - min + 1) * next()),
    pick: <T>(items: readonly T[]): T => {
      const item = items[Math.floor(items.length * next())];
      if (item === undefined) throw new RangeError('pick: empty list');
      return item;
    },
    fork: (label: string) => testRng(hashLabel(label, seed)),
  });
}

/** 32-bit FNV-1a of `label` mixed into `seed` (as the engine's hashString). */
function hashLabel(label: string, seed: number): number {
  let hash = (0x811c9dc5 ^ seed) >>> 0;
  for (let index = 0; index < label.length; index += 1) {
    hash ^= label.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash;
}
