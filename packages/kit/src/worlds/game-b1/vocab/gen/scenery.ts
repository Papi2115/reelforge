/**
 * Playfield generators of the open vocabulary, seeded: a forest canopy over trunks, waves, dunes,
 * hills, a city skyline, a castle wall, a reef, clouds and ground with pits. Rows are 40-bit
 * asymmetric lines for natural scenery (a mirrored hill looks like a 2600 maze) and 20-bit
 * mirrored rows for built things; one colour per row, as the hardware draws it.
 */
import { hash } from '../../core/math.js';
import type { PlayfieldSpec } from '../playfield.js';

export const SCENERY_KINDS = [
  'canopy',
  'waves',
  'dunes',
  'hills',
  'skyline',
  'wall',
  'reef',
  'clouds',
  'ground',
] as const;

export type SceneryKind = (typeof SCENERY_KINDS)[number];

export interface SceneryParams {
  readonly kind: SceneryKind;
  readonly rows: number;
  readonly seed: number;
  readonly rowH?: number | undefined;
  /** Inks top-down; the generator spreads them over its rows. */
  readonly colours?: readonly string[] | undefined;
}

const DEFAULT_INKS: Record<SceneryKind, readonly string[]> = {
  canopy: ['avocado', 'oliveDark', 'walnut'],
  waves: ['aqua', 'teal', 'blue'],
  dunes: ['tan', 'teak'],
  hills: ['avocado', 'oliveDark'],
  skyline: ['greyDark', 'night'],
  wall: ['grey', 'greyDark'],
  reef: ['mauve', 'dusk', 'tealDark'],
  clouds: ['cream', 'grey'],
  ground: ['teak', 'walnut'],
};

/** A smooth seeded height profile over 40 columns in [0, 1]. */
function profile(seed: number, waves: number, rough: number): number[] {
  const phase = hash(seed, 1, 1) * 6.28;
  return Array.from({ length: 40 }, (_, x) => {
    const base = 0.5 + 0.5 * Math.sin((x / 40) * Math.PI * 2 * waves + phase);
    return Math.min(1, Math.max(0, base * (1 - rough) + hash(seed, x, 2) * rough));
  });
}

/** Rows filled where the column's height reaches them (bottom-up). */
function fromHeights(heights: readonly number[], rows: number): string[] {
  return Array.from({ length: rows }, (_, r) =>
    heights.map((h) => (h * rows >= rows - r ? '#' : '.')).join(''),
  );
}

function spread(inks: readonly string[], rows: number): (string | null)[] {
  return Array.from({ length: rows }, (_, r) => inks[Math.floor((r / rows) * inks.length)] ?? null);
}

function canopy(rows: number, seed: number): string[] {
  const leaf = Math.max(2, Math.ceil(rows * 0.45));
  const lower = profile(seed, 3.5, 0.5);
  const out: string[] = [];
  for (let r = 0; r < rows; r += 1) {
    if (r < leaf) {
      out.push(lower.map((h) => (r < 1 + Math.round(h * (leaf - 1)) ? '#' : '.')).join(''));
      continue;
    }
    // trunks: a block every 5-8 columns, never two touching
    let line = '';
    let next = Math.floor(hash(seed, 3, 3) * 4);
    for (let x = 0; x < 40; x += 1) {
      const on = x === next;
      if (on) next = x + 5 + Math.floor(hash(seed, x, 4) * 4);
      line += on ? '#' : '.';
    }
    out.push(line);
  }
  return out;
}

function generators(kind: SceneryKind, rows: number, seed: number): string[] {
  switch (kind) {
    case 'canopy':
      return canopy(rows, seed);
    case 'waves':
      return Array.from({ length: rows }, (_, r) =>
        Array.from({ length: 40 }, (_, x) =>
          (x + r * 2 + Math.floor(hash(seed, r, 5) * 4)) % 6 < 3 + (r % 2) ? '#' : '.',
        ).join(''),
      ).map((line, r) => (r === rows - 1 ? '#'.repeat(40) : line));
    case 'dunes':
      return fromHeights(profile(seed, 1.6, 0.12), rows);
    case 'hills':
      return fromHeights(profile(seed, 2.3, 0.2), rows);
    case 'skyline': {
      const heights: number[] = [];
      while (heights.length < 40) {
        const h = 0.2 + hash(seed, heights.length, 6) * 0.8;
        const w = 1 + Math.floor(hash(seed, heights.length, 7) * 3);
        for (let i = 0; i < w; i += 1) heights.push(h);
        if (hash(seed, heights.length, 8) < 0.3) heights.push(0.08);
      }
      return fromHeights(heights.slice(0, 40), rows);
    }
    case 'wall':
      return Array.from({ length: rows }, (_, r) => (r === 0 ? '##..'.repeat(5) : '#'.repeat(20)));
    case 'reef':
      return fromHeights(profile(seed, 4.2, 0.55), rows);
    case 'clouds':
      return Array.from({ length: rows }, (_, r) =>
        profile(seed + 9, 2, 0.3)
          .map((h, x) =>
            h > 0.62 - (r === Math.floor(rows / 2) ? 0.12 : 0) && x % 13 < 9 ? '#' : '.',
          )
          .join(''),
      );
    case 'ground':
      return Array.from({ length: rows }, () =>
        Array.from({ length: 40 }, (_, x) =>
          hash(seed, Math.floor(x / 3), 9) < 0.12 ? '.' : '#',
        ).join(''),
      );
  }
}

export function scenery(p: SceneryParams): PlayfieldSpec {
  const rows = Math.max(1, Math.min(24, Math.round(p.rows)));
  const inks = p.colours ?? DEFAULT_INKS[p.kind];
  return {
    describe: p.kind,
    rows: generators(p.kind, rows, p.seed),
    rowH: p.rowH ?? 4,
    colours: spread(inks, rows),
    mode: 'mirror',
  };
}
