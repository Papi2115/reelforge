/**
 * Structure generator of the Game B2 open layer: billboards seen from the front (`{ gen:
 * 'structure', kind, seed, height, width, wall, roof, lit }`; vehicles: gen-vehicles.ts). For set
 * dressing at a distance and landmarks; a building you walk along is better as walls with a
 * generated facade texture. Windows glow when `lit` > 0 (night streets, a lighthouse).
 */
import { z } from 'zod';
import { Bmp } from '../core/bitmap.js';
import { bayer, hash3, vnoise } from '../core/rand.js';
import { C } from '../palette.js';
import { blob, finish, gradientPoly, slab, stroke } from './draw.js';
import { px, rampParam, seedParam, type MadeSprite } from './made.js';
import { rampOf, type Ramp, type RampName } from './ramps.js';

export const STRUCTURE_KINDS = [
  'hut',
  'house',
  'tower',
  'castle-wall',
  'ship',
  'bridge',
  'tent',
  'ruins',
  'pipe',
  'well',
  'windmill',
  'lighthouse',
  'skyscraper',
  'dome',
  'antenna',
  'planet',
] as const;

export const structureSchema = z.strictObject({
  gen: z.literal('structure'),
  kind: z.enum(STRUCTURE_KINDS),
  seed: seedParam,
  height: z.number().min(0.3).max(6).optional().describe('World height (default per kind)'),
  width: z.number().min(0.4).max(2).default(1).describe('Width factor'),
  wall: rampParam.optional(),
  roof: rampParam.optional(),
  lit: z.number().min(0).max(1).default(0).describe('Share of lit (glowing) windows'),
});
export type StructureSpec = z.output<typeof structureSchema>;

const at = (ramp: Ramp, k: number): number =>
  ramp[Math.max(0, Math.min(ramp.length - 1, k))] ?? C.SLATE;

/** [height, width/height, wall ramp, roof ramp]. */
const S_BASE: Readonly<
  Record<StructureSpec['kind'], readonly [number, number, RampName, RampName]>
> = {
  hut: [1.3, 1.2, 'earth', 'earth'],
  house: [1.8, 1.0, 'earth', 'rust'],
  tower: [3.2, 0.42, 'stone', 'rust'],
  'castle-wall': [1.6, 1.6, 'stone', 'stone'],
  ship: [2.4, 1.3, 'warm', 'earth'],
  bridge: [1.0, 3.0, 'stone', 'stone'],
  tent: [1.0, 1.4, 'earth', 'rust'],
  ruins: [1.4, 1.3, 'stone', 'stone'],
  pipe: [1.0, 1.2, 'stone', 'stone'],
  well: [0.9, 0.9, 'stone', 'warm'],
  windmill: [2.8, 0.8, 'earth', 'warm'],
  lighthouse: [3.6, 0.36, 'stone', 'rust'],
  skyscraper: [5.5, 0.34, 'sky', 'stone'],
  dome: [1.4, 1.5, 'stone', 'stone'],
  antenna: [2.6, 0.5, 'stone', 'stone'],
  planet: [3, 1, 'sky', 'leaf'],
};

interface Plan {
  readonly b: Bmp;
  readonly w: number;
  readonly h: number;
  readonly wall: Ramp;
  readonly roof: Ramp;
  readonly lit: number;
  readonly seed: number;
}

function windows(
  p: Plan,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  size: number,
  gap: number,
): void {
  let k = 0;
  for (let y = y0; y + size <= y1; y += size + gap)
    for (let x = x0; x + size <= x1; x += size + gap, k += 1) {
      const on = hash3(k, 3, p.seed) < p.lit;
      p.b.rect(x, y, size, size, on ? C.BULB : C.NIGHT);
      p.b.rect(x, y + size - 1, size, 1, at(p.wall, 1));
    }
}

function building(p: Plan, kind: StructureSpec['kind']): void {
  const { b, w, h, wall, roof } = p;
  switch (kind) {
    case 'hut':
      slab(b, w * 0.12, h * 0.5, w * 0.76, h * 0.5, wall, 3);
      gradientPoly(b, [w * 0.02, h * 0.56, w * 0.5, h * 0.02, w * 0.98, h * 0.56], roof, 1, 3);
      b.rect(w * 0.42, h * 0.66, w * 0.16, h * 0.34, C.VOID);
      return;
    case 'house':
      slab(b, w * 0.08, h * 0.42, w * 0.84, h * 0.58, wall, 3);
      gradientPoly(b, [0, h * 0.46, w * 0.5, h * 0.04, w, h * 0.46], roof, 1, 3);
      b.rect(w * 0.7, h * 0.08, w * 0.1, h * 0.2, at(wall, 1));
      windows(
        p,
        Math.round(w * 0.16),
        Math.round(h * 0.52),
        Math.round(w * 0.4),
        Math.round(h * 0.75),
        Math.max(3, Math.round(w * 0.1)),
        3,
      );
      windows(
        p,
        Math.round(w * 0.62),
        Math.round(h * 0.52),
        Math.round(w * 0.86),
        Math.round(h * 0.75),
        Math.max(3, Math.round(w * 0.1)),
        3,
      );
      b.rect(w * 0.43, h * 0.7, w * 0.14, h * 0.3, at(roof, 1));
      return;
    case 'tower':
    case 'lighthouse': {
      const light = kind === 'lighthouse';
      gradientPoly(
        b,
        [w * 0.18, h, w * 0.26, h * 0.14, w * 0.74, h * 0.14, w * 0.82, h],
        wall,
        1,
        4,
      );
      if (light)
        for (let y = Math.round(h * 0.3); y < h; y += Math.round(h * 0.16))
          b.rect(w * 0.2, y, w * 0.6, h * 0.06, C.CLAY);
      for (let k = 0; k < 4; k += 1)
        b.rect(w * (0.2 + k * 0.17), h * 0.06, w * 0.1, h * 0.08, at(wall, 3));
      b.rect(w * 0.16, h * 0.13, w * 0.68, h * 0.02, at(wall, 1));
      if (light) blob(b, w * 0.5, h * 0.06, w * 0.18, h * 0.05, [C.TUNGSTEN, C.BULB], p.seed);
      windows(
        p,
        Math.round(w * 0.44),
        Math.round(h * 0.3),
        Math.round(w * 0.58),
        Math.round(h * 0.8),
        Math.max(3, Math.round(w * 0.12)),
        Math.round(h * 0.12),
      );
      return;
    }
    case 'castle-wall':
      slab(b, 0, h * 0.15, w, h * 0.85, wall, 2);
      for (let x = 0; x < w; x += Math.round(w / 7))
        b.rect(x, 0, Math.round(w / 14), h * 0.16, at(wall, 2));
      for (let y = Math.round(h * 0.28); y < h; y += 6)
        for (let x = y % 12 ? 0 : 5; x < w; x += 10) b.rect(x, y, 1, 6, at(wall, 1));
      b.rect(w * 0.42, h * 0.55, w * 0.16, h * 0.45, C.VOID);
      blob(b, w * 0.5, h * 0.55, w * 0.08, h * 0.08, [C.VOID], 1);
      return;
    case 'ship':
      gradientPoly(b, [0, h * 0.62, w, h * 0.62, w * 0.86, h, w * 0.1, h], wall, 0, 3);
      b.rect(0, h * 0.62, w, 2, at(wall, 4));
      stroke(b, w * 0.4, h * 0.62, w * 0.4, h * 0.02, 2, C.UMBER);
      stroke(b, w * 0.7, h * 0.62, w * 0.7, h * 0.12, 2, C.UMBER);
      gradientPoly(
        b,
        [w * 0.12, h * 0.08, w * 0.4, h * 0.05, w * 0.4, h * 0.52, w * 0.16, h * 0.5],
        roof,
        2,
        4,
      );
      gradientPoly(
        b,
        [w * 0.46, h * 0.15, w * 0.7, h * 0.12, w * 0.7, h * 0.52, w * 0.5, h * 0.55],
        roof,
        2,
        4,
      );
      for (let x = Math.round(w * 0.2); x < w * 0.8; x += 6) b.rect(x, h * 0.72, 2, 2, C.VOID);
      return;
    case 'bridge':
      gradientPoly(b, [0, h * 0.3, w, h * 0.3, w, h, 0, h], wall, 1, 3);
      slab(b, 0, h * 0.1, w, h * 0.25, wall, 3);
      for (let k = 0; k < 3; k += 1) b.ellipse(((k + 0.5) * w) / 3, h, w * 0.13, h * 0.5, 255);
      for (let x = 0; x < w; x += 5) b.rect(x, h * 0.02, 2, h * 0.08, at(wall, 2));
      return;
    case 'tent':
      gradientPoly(b, [0, h, w * 0.5, 0, w, h], wall, 1, 4);
      b.poly([w * 0.42, h, w * 0.5, h * 0.4, w * 0.58, h], C.VOID);
      stroke(b, w * 0.5, 0, w * 0.5, -2, 1, C.UMBER);
      b.rect(w * 0.47, 0, w * 0.06, h * 0.06, at(roof, 2));
      return;
    case 'ruins':
      for (let k = 0; k < 4; k += 1) {
        const x = w * (0.08 + k * 0.24);
        const top = h * (0.1 + hash3(k, 1, p.seed) * 0.6);
        slab(b, x, top, w * 0.14, h - top, wall, 3);
        b.poly([x, top, x + w * 0.14, top + h * 0.06, x + w * 0.07, top - h * 0.05], at(wall, 2));
      }
      slab(b, w * 0.05, h * 0.82, w * 0.9, h * 0.18, wall, 2);
      return;
    case 'pipe':
      slab(b, 0, 0, w, h, wall, 2);
      blob(b, w * 0.5, h * 0.55, w * 0.36, h * 0.36, wall, p.seed, 0, 2, 4);
      b.ellipse(w * 0.5, h * 0.57, w * 0.28, h * 0.28, C.VOID);
      b.rect(w * 0.26, h * 0.8, w * 0.48, h * 0.06, C.UMBER);
      return;
    case 'well':
      slab(b, w * 0.1, h * 0.55, w * 0.8, h * 0.45, wall, 3);
      stroke(b, w * 0.15, h * 0.55, w * 0.15, h * 0.12, 2, C.BROWN);
      stroke(b, w * 0.85, h * 0.55, w * 0.85, h * 0.12, 2, C.BROWN);
      gradientPoly(b, [0, h * 0.18, w * 0.5, 0, w, h * 0.18], roof, 1, 3);
      stroke(b, w * 0.5, h * 0.15, w * 0.5, h * 0.42, 1, C.CHAR);
      b.rect(w * 0.44, h * 0.42, w * 0.12, h * 0.1, C.GREY);
      return;
    case 'windmill':
      gradientPoly(b, [w * 0.25, h, w * 0.36, h * 0.3, w * 0.64, h * 0.3, w * 0.75, h], wall, 1, 4);
      gradientPoly(b, [w * 0.32, h * 0.32, w * 0.5, h * 0.2, w * 0.68, h * 0.32], roof, 1, 3);
      for (const [dx, dy] of [
        [1, 1],
        [-1, 1],
        [1, -1],
        [-1, -1],
      ] as const)
        stroke(b, w * 0.5, h * 0.3, w * (0.5 + dx * 0.48), h * (0.3 + dy * 0.26), 3, at(roof, 3));
      b.rect(w * 0.45, h * 0.82, w * 0.1, h * 0.18, C.VOID);
      return;
    case 'skyscraper':
      slab(b, w * 0.05, h * 0.04, w * 0.9, h * 0.96, wall, 2);
      windows(
        p,
        Math.round(w * 0.12),
        Math.round(h * 0.07),
        Math.round(w * 0.88),
        Math.round(h * 0.98),
        Math.max(2, Math.round(w * 0.08)),
        2,
      );
      stroke(b, w * 0.5, h * 0.04, w * 0.5, 0, 1, C.GREY);
      return;
    case 'dome':
      slab(b, w * 0.05, h * 0.62, w * 0.9, h * 0.38, wall, 3);
      blob(b, w * 0.5, h * 0.62, w * 0.42, h * 0.58, roof, p.seed, 0, 2, 5);
      b.rect(0, h * 0.62, w, h, 255);
      slab(b, w * 0.05, h * 0.62, w * 0.9, h * 0.38, wall, 3);
      b.rect(w * 0.44, h * 0.08, w * 0.12, h * 0.5, C.VOID);
      return;
    case 'antenna':
      stroke(b, w * 0.5, h, w * 0.5, h * 0.3, 2, C.GREY);
      for (let y = Math.round(h * 0.4); y < h; y += 6)
        stroke(b, w * 0.3, y, w * 0.7, y + 5, 1, C.SLATE);
      blob(
        b,
        w * 0.5,
        h * 0.22,
        w * 0.42,
        h * 0.16,
        [C.SLATE, C.GREY, C.PUTTY, C.PAPER],
        p.seed,
        0,
      );
      stroke(b, w * 0.5, h * 0.22, w * 0.62, h * 0.06, 1, C.CHAR);
      b.rect(w * 0.6, h * 0.04, 3, 3, C.ACCENT_D);
      return;
    case 'planet':
      planet(p);
      return;
  }
}

/** A planet seen from orbit: oceans (wall ramp), land (roof ramp), clouds, a night side, the rim. */
function planet(p: Plan): void {
  const { b, w, h, wall, roof, seed } = p;
  const r = Math.min(w, h) / 2 - 1;
  for (let y = 0; y < h; y += 1)
    for (let x = 0; x < w; x += 1) {
      const nx = (x + 0.5 - w / 2) / r;
      const ny = (y + 0.5 - h / 2) / r;
      const d = nx * nx + ny * ny;
      if (d > 1) continue;
      const land = vnoise(x * 1.3, y, 14, seed) * 0.7 + vnoise(x, y, 5, seed + 1) * 0.3;
      const cloud = vnoise(x * 0.6, y * 1.8, 9, seed + 2);
      const light = 0.75 - nx * 0.6 - ny * 0.3;
      const night = light < 0.15 || (light < 0.3 && bayer(x, y) > (light - 0.15) / 0.15);
      let c = land > 0.58 ? at(roof, land > 0.7 ? 3 : 2) : at(wall, light > 0.5 ? 3 : 2);
      if (cloud > 0.66) c = C.PAPER;
      if (night) c = land > 0.58 ? C.SHADOW : C.NIGHT_D;
      if (d > 0.9 && !night) c = C.MOON;
      b.px(x, y, c);
    }
}

/** Draws one structure. */
export function makeStructure(spec: StructureSpec): MadeSprite {
  const [height0, ratio, wall0, roof0] = S_BASE[spec.kind];
  const height = spec.height ?? height0;
  const width = height * ratio * spec.width;
  const w = px(width, 12);
  const h = px(height, 12);
  const plan: Plan = {
    b: new Bmp(w, h),
    w,
    h,
    wall: rampOf(spec.wall ?? wall0),
    roof: rampOf(spec.roof ?? roof0),
    lit: spec.lit,
    seed: spec.seed,
  };
  building(plan, spec.kind);
  const glow = spec.lit > 0 || spec.kind === 'lighthouse' ? [C.BULB, C.TUNGSTEN] : [];
  return { frames: [finish(plan.b, C.VOID, glow)], size: [width, height], z: 0, fps: 0 };
}
