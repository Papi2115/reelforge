/**
 * A tiny bitmap for the parametric generators: `w` bits (<= 8 for a player, 20 for a playfield
 * half) by `h` rows, drawn with set / rect / hline and read back as DSL rows ('#' / '.'). Seeded
 * roughness comes from the world's `hash`, so a generator is a pure function of its params.
 */
import { hash } from '../../core/math.js';

export class Bits {
  private readonly cells: boolean[][];

  constructor(
    readonly w: number,
    readonly h: number,
  ) {
    this.cells = Array.from({ length: h }, () => Array.from({ length: w }, () => false));
  }

  set(x: number, y: number, on = true): this {
    const row = this.cells[Math.round(y)];
    const xi = Math.round(x);
    if (row !== undefined && xi >= 0 && xi < this.w) row[xi] = on;
    return this;
  }

  rect(x: number, y: number, w: number, h: number, on = true): this {
    for (let yy = y; yy < y + h; yy += 1)
      for (let xx = x; xx < x + w; xx += 1) this.set(xx, yy, on);
    return this;
  }

  hline(x0: number, x1: number, y: number, on = true): this {
    return this.rect(x0, y, x1 - x0 + 1, 1, on);
  }

  /** Rows as '#' / '.' strings. */
  rows(): string[] {
    return this.cells.map((row) => row.map((on) => (on ? '#' : '.')).join(''));
  }
}

/** Seeded integer in [lo, hi]. */
export function pick(seed: number, salt: number, lo: number, hi: number): number {
  return lo + Math.floor(hash(seed, salt, 977) * (hi - lo + 1));
}

/** Seeded coin with probability p. */
export function chance(seed: number, salt: number, p: number): boolean {
  return hash(seed, salt, 331) < p;
}

/** Rows from literal art, with '#' / '.' only (a template generators perturb). */
export function art(...rows: readonly string[]): string[] {
  return [...rows];
}

/** Row stops { "0": a, "3": b } from [row, colour] pairs (rows clamped to the height). */
export function stops(height: number, ...pairs: readonly (readonly [number, string])[]) {
  const out: Record<string, string> = {};
  for (const [row, colour] of pairs) if (row < height) out[String(Math.max(0, row))] = colour;
  return out;
}
