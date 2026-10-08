/**
 * Plant and rock sprites for the open vocabulary, 8 bits wide, seeded: pine / round / palm /
 * birch / dead trees, bushes, a saguaro cactus, swaying seaweed and rocks. Each returns a sprite
 * spec (rows or frames + one colour per row) that goes through the same validator as hand-drawn
 * sprites; the seed moves a few bits so two trees of a forest are never twins.
 */
import type { SpriteSpec } from '../sprite.js';
import { Bits, chance, pick, stops } from './bits.js';

export type TreeShape = 'pine' | 'round' | 'palm' | 'birch' | 'dead';

export interface TreeParams {
  readonly shape: TreeShape;
  readonly height: number;
  readonly seed: number;
  readonly leaf?: string | undefined;
  readonly trunk?: string | undefined;
}

function pine(b: Bits, h: number, seed: number): number {
  const trunk = Math.max(2, Math.round(h / 6));
  const crown = h - trunk;
  for (let y = 0; y < crown; y += 1) {
    const tier = (y * 3) / crown;
    const inTier = tier - Math.floor(tier);
    const half = Math.min(4, 1 + Math.floor(tier) + Math.round(inTier * 2));
    const lean = chance(seed, y, 0.2) ? 1 : 0;
    b.hline(4 - half + lean, 3 + half, y);
  }
  b.rect(3, crown, 2, trunk);
  return crown;
}

function round(b: Bits, h: number, seed: number): number {
  const trunk = Math.max(3, Math.round(h / 3));
  const crown = h - trunk;
  for (let y = 0; y < crown; y += 1) {
    const k = (y + 0.5) / crown;
    const half = Math.max(1, Math.round(Math.sin(Math.PI * Math.min(1, k * 1.15)) * 4));
    b.hline(4 - half, 3 + half, y);
    if (chance(seed, y, 0.35)) b.set(pick(seed, y + 40, 0, 7), y, false);
  }
  b.rect(3, crown, 2, trunk);
  if (trunk > 3) b.set(pick(seed, 7, 0, 1) === 0 ? 2 : 5, crown + 1);
  return crown;
}

function palm(b: Bits, h: number, seed: number): number {
  const crown = 4;
  const fronds = [
    [1, 2, 5, 6],
    [0, 1, 3, 4, 6, 7],
    [0, 3, 4, 7],
    [3, 4],
  ];
  fronds.forEach((xs, y) => {
    for (const x of xs) b.set(x, y);
  });
  const bend = pick(seed, 3, 0, 1) === 0 ? 1 : -1;
  for (let y = crown; y < h; y += 1) {
    const x = 3 + Math.round(bend * Math.sin(((y - crown) / (h - crown)) * 2.4) * 1.5);
    b.set(x, y).set(x + 1, y);
  }
  return crown;
}

function dead(b: Bits, h: number, seed: number): number {
  for (let y = 0; y < h; y += 1) b.set(3, y).set(4, y >= h / 3 ? y : -1);
  const branches = pick(seed, 1, 2, 3);
  for (let i = 0; i < branches; i += 1) {
    const y = 1 + Math.floor(((h * 0.6) / branches) * i) + pick(seed, i, 0, 1);
    const left = (i + seed) % 2 === 0;
    for (let k = 1; k <= 2; k += 1) b.set(left ? 3 - k : 4 + k, y - k + 1);
  }
  return 0;
}

export function tree(p: TreeParams): SpriteSpec {
  const h = Math.max(8, Math.min(40, Math.round(p.height)));
  const b = new Bits(8, h);
  const shape = p.shape === 'birch' ? 'round' : p.shape;
  const crown = { pine, round, palm, dead }[shape](b, h, p.seed);
  const leaf = p.leaf ?? (p.shape === 'palm' ? 'avocado' : 'avocado');
  const shade = p.shape === 'pine' ? 'oliveDark' : leaf;
  const trunk = p.trunk ?? (p.shape === 'birch' ? 'cream' : 'walnut');
  const colours: (string | null)[] = Array.from({ length: h }, (_, y) => {
    if (y >= crown) return p.shape === 'birch' && y % 3 === 1 ? 'greyDark' : trunk;
    if (p.shape === 'dead') return trunk;
    return y % 3 === 2 ? shade : leaf;
  });
  return { describe: `${p.shape} tree`, rows: b.rows(), colours, rowH: 2 };
}

export function bush(p: { width: number; seed: number; colour?: string | undefined }): SpriteSpec {
  const w = Math.max(3, Math.min(8, Math.round(p.width)));
  const b = new Bits(8, 4);
  const x0 = Math.floor((8 - w) / 2);
  b.hline(x0 + 1, x0 + w - 2, 0)
    .hline(x0, x0 + w - 1, 1)
    .hline(x0, x0 + w - 1, 2);
  b.hline(x0 + 1, x0 + w - 2, 3);
  if (chance(p.seed, 1, 0.6)) b.set(x0 + pick(p.seed, 2, 1, w - 2), 0, false);
  return {
    describe: 'bush',
    rows: b.rows(),
    colours: stops(4, [0, p.colour ?? 'avocado'], [2, 'oliveDark']),
    rowH: 2,
  };
}

export function cactus(p: { height: number; arms: number; seed: number }): SpriteSpec {
  const h = Math.max(8, Math.min(32, Math.round(p.height)));
  const b = new Bits(8, h);
  b.rect(3, 0, 2, h).set(3, 0, false);
  const arms = Math.max(0, Math.min(2, Math.round(p.arms)));
  for (let i = 0; i < arms; i += 1) {
    const left = i === 0 ? pick(p.seed, 1, 0, 1) === 0 : !(pick(p.seed, 1, 0, 1) === 0);
    const join = Math.round(h * (0.45 + 0.15 * i)) + pick(p.seed, i + 4, -1, 1);
    const top = join - pick(p.seed, i + 8, 3, 5);
    const x = left ? 1 : 6;
    b.rect(x, top, 1, join - top + 1).hline(Math.min(x, left ? 2 : 5), left ? 2 : 6, join);
  }
  return { describe: 'saguaro cactus', rows: b.rows(), colours: 'avocado', rowH: 2 };
}

export function seaweed(p: { height: number; seed: number }): SpriteSpec {
  const h = Math.max(6, Math.min(30, Math.round(p.height)));
  const frames = [0, 1].map((f) => {
    const b = new Bits(8, h);
    for (let y = 0; y < h; y += 1) {
      const sway = Math.round(Math.sin(y * 0.7 + f * 2.2 + p.seed) * (1 - y / h) * 1.6);
      b.set(3 + sway, y);
      if (y % 3 === (p.seed + f) % 3 && y < h - 2) b.set(3 + sway + (y % 2 === 0 ? 1 : -1), y);
    }
    return b.rows();
  });
  return {
    describe: 'seaweed',
    frames,
    colours: stops(h, [0, 'avocado'], [Math.floor(h / 2), 'oliveDark']),
    fps: 3,
    rowH: 2,
  };
}

export function rock(p: { width: number; seed: number }): SpriteSpec {
  const w = Math.max(3, Math.min(8, Math.round(p.width)));
  const b = new Bits(8, 3);
  b.hline(1, w - 2, 0)
    .hline(0, w - 1, 1)
    .hline(0, w - 1, 2);
  if (chance(p.seed, 5, 0.5)) b.set(w - 2, 0, false);
  return { describe: 'rock', rows: b.rows(), colours: ['grey', 'greyDark', 'greyDark'], rowH: 2 };
}
