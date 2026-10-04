/**
 * Deterministic building blocks of ambient variation: string hashing, seeded permutations and the
 * level sequence that guarantees neighbouring shots differ. Pure functions of their inputs.
 */

/** 32-bit FNV-1a of `text` mixed into `seed`, then finalized (lowbias32) for good low bits. */
export function hash32(text: string, seed: number): number {
  let hash = (0x811c9dc5 ^ seed) >>> 0;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x7feb352d);
  hash ^= hash >>> 15;
  hash = Math.imul(hash, 0x846ca68b);
  hash ^= hash >>> 16;
  return hash >>> 0;
}

/** `hash32` as a float in [0, 1). */
export function unitHash(text: string, seed: number): number {
  return hash32(text, seed) / 4294967296;
}

/** mulberry32 stream over a uint32 seed. */
function stream(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let mixed = state;
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

/** Seeded Fisher-Yates permutation of 0..size-1. */
export function seededPermutation(seed: number, size: number): number[] {
  const order = Array.from({ length: size }, (_, index) => index);
  const next = stream(seed);
  for (let index = size - 1; index > 0; index -= 1) {
    const other = Math.floor(next() * (index + 1));
    const value = order[index] ?? 0;
    order[index] = order[other] ?? 0;
    order[other] = value;
  }
  return order;
}

function cyclePermutation(seed: number, label: string, cycle: number, steps: number): number[] {
  return seededPermutation(hash32(`${label}:cycle:${String(cycle)}`, seed), steps);
}

/**
 * Level of shot `index` on a stepped axis: shots walk through a fresh seeded permutation of the
 * `steps` levels every `steps` shots, so two neighbours never share a level. Inside a cycle the
 * levels are distinct by construction; at a cycle boundary the first two entries are swapped
 * when the first equals the previous cycle's last. The swap never moves a cycle's last entry
 * (steps >= 3), so every level depends only on its own and the previous cycle (no chain).
 */
export function steppedLevel(seed: number, label: string, index: number, steps: number): number {
  if (!Number.isInteger(steps) || steps < 3) {
    throw new RangeError(`steppedLevel: steps must be an integer >= 3 (got ${String(steps)})`);
  }
  if (!Number.isInteger(index) || index < 0) {
    throw new RangeError(`steppedLevel: index must be an integer >= 0 (got ${String(index)})`);
  }
  const cycle = Math.floor(index / steps);
  const position = index % steps;
  const order = cyclePermutation(seed, label, cycle, steps);
  if (cycle > 0 && position < 2) {
    const previousLast = cyclePermutation(seed, label, cycle - 1, steps)[steps - 1];
    if (order[0] === previousLast) {
      const first = order[0] ?? 0;
      order[0] = order[1] ?? 0;
      order[1] = first;
    }
  }
  return order[position] ?? 0;
}

/** Level of a free (hashed) axis. */
export function hashedLevel(seed: number, label: string, steps: number): number {
  return hash32(label, seed) % steps;
}
