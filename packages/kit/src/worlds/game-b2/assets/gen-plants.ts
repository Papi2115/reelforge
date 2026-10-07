/**
 * Plant generator of the Game B2 open layer: `{ gen: 'plant', kind, seed, height, width, leaf,
 * trunk, bloom, lean }`. Every kind is drawn from rough shaded blobs and strokes in the world's
 * ramps (leaf greens, warm bark; `leaf: 'rust'` = autumn, `'earth'` = dry), seeded so a forest
 * of the same kind is never one stamp repeated. Seaweed, grass and reeds sway (2-3 frames).
 */
import { z } from 'zod';
import { Bmp } from '../core/bitmap.js';
import { C } from '../palette.js';
import { blob, finish, jitter, speckle, stream, stroke } from './draw.js';
import { px, rampParam, seedParam, type MadeSprite } from './made.js';
import { colourRef, rampOf, type Ramp } from './ramps.js';

export const PLANT_KINDS = [
  'deciduous',
  'conifer',
  'palm',
  'bush',
  'grass',
  'flowers',
  'mushrooms',
  'cactus',
  'seaweed',
  'reeds',
] as const;
export type PlantKind = (typeof PLANT_KINDS)[number];

export const plantSchema = z.strictObject({
  gen: z.literal('plant'),
  kind: z.enum(PLANT_KINDS),
  seed: seedParam,
  height: z.number().min(0.15).max(4).optional().describe('World height (default per kind)'),
  width: z.number().min(0.4).max(2).default(1).describe('Crown / clump width factor'),
  leaf: rampParam.default('leaf').describe('leaf (green), rust (autumn), earth (dry), sky (frost)'),
  trunk: rampParam.default('warm'),
  bloom: z.string().optional().describe('Flower / fruit / cap colour (swatch or ramp step)'),
  lean: z.number().min(-1).max(1).default(0),
});
export type PlantSpec = z.output<typeof plantSchema>;

/** Default height and width/height ratio per kind. */
const SHAPE: Readonly<Record<PlantKind, readonly [number, number]>> = {
  deciduous: [2.4, 0.8],
  conifer: [2.6, 0.48],
  palm: [2.6, 0.75],
  bush: [0.6, 1.7],
  grass: [0.3, 2],
  flowers: [0.36, 1.4],
  mushrooms: [0.26, 1.6],
  cactus: [1.7, 0.6],
  seaweed: [1.2, 0.45],
  reeds: [0.8, 0.7],
};

interface Canvas {
  readonly b: Bmp;
  readonly w: number;
  readonly h: number;
  readonly random: () => number;
  readonly leaf: Ramp;
  readonly trunk: Ramp;
  readonly bloom: number;
  readonly lean: number;
  readonly seed: number;
}

function trunkOf(c: Canvas, topY: number, width: number): void {
  const cx = c.w / 2;
  const tx = cx + c.lean * c.w * 0.18;
  for (let y = Math.round(topY); y < c.h; y += 1) {
    const u = (y - topY) / Math.max(1, c.h - topY);
    const x = tx + (cx - tx) * u;
    const half = Math.max(1, (width * (0.6 + 0.4 * u)) / 2 + (y > c.h - 4 ? 1 : 0));
    for (let k = -half; k <= half; k += 1) {
      const side = k / half;
      c.b.px(
        x + k,
        y,
        side < -0.3
          ? (c.trunk[3] ?? C.TAN)
          : side > 0.35
            ? (c.trunk[1] ?? C.BROWN)
            : (c.trunk[2] ?? C.WOOD),
      );
    }
  }
}

function deciduous(c: Canvas): void {
  const cx = c.w / 2 + c.lean * c.w * 0.18;
  trunkOf(c, c.h * 0.42, Math.max(3, c.w * 0.09));
  stroke(c.b, cx, c.h * 0.55, cx - c.w * 0.2, c.h * 0.36, 2, c.trunk[1] ?? C.BROWN);
  stroke(c.b, cx, c.h * 0.5, cx + c.w * 0.22, c.h * 0.3, 2, c.trunk[1] ?? C.BROWN);
  const n = 6 + Math.floor(c.random() * 3);
  for (let i = 0; i < n; i += 1) {
    const back = i < n / 2;
    const a = (i / n) * Math.PI * 2 + c.random();
    const r = c.w * (0.14 + c.random() * 0.1);
    blob(
      c.b,
      cx + Math.cos(a) * c.w * 0.22 + jitter(c.random, 2),
      c.h * 0.33 + Math.sin(a) * c.h * 0.12 + jitter(c.random, 2),
      r,
      r * 0.9,
      c.leaf,
      c.seed + i,
      0.35,
      0,
      back ? 2 : 3,
    );
  }
  blob(c.b, cx, c.h * 0.3, c.w * 0.3, c.h * 0.2, c.leaf, c.seed + 20, 0.3, 0, 3);
  blob(c.b, cx - c.w * 0.1, c.h * 0.22, c.w * 0.16, c.h * 0.1, c.leaf, c.seed + 21, 0.3, 1, 4);
  if (c.bloom >= 0) speckle(c.b, 0.02, c.bloom, c.seed + 30);
}

function conifer(c: Canvas): void {
  const cx = c.w / 2 + c.lean * c.w * 0.1;
  trunkOf(c, c.h * 0.8, Math.max(3, c.w * 0.12));
  const tiers = 4 + Math.floor(c.random() * 2);
  for (let k = 0; k < tiers; k += 1) {
    const top = c.h * (0.02 + k * 0.17);
    const bottom = Math.min(c.h * 0.9, top + c.h * 0.3);
    const half = c.w * (0.18 + (k / tiers) * 0.32);
    for (let y = Math.floor(top); y < bottom; y += 1) {
      const u = (y - top) / (bottom - top);
      const reach = half * u + (y === Math.floor(bottom) - 1 ? 0 : jitter(c.random, 1.2));
      for (let x = Math.floor(cx - reach); x <= cx + reach; x += 1) {
        const side = (x - cx) / Math.max(1, reach);
        const lit = 0.55 - side * 0.35 - u * 0.25 + (c.random() - 0.5) * 0.2;
        const step = lit > 0.62 ? 3 : lit > 0.4 ? 2 : lit > 0.22 ? 1 : 0;
        c.b.px(x, y, c.leaf[step] ?? C.MOSS);
      }
    }
  }
  if (c.bloom >= 0) speckle(c.b, 0.03, c.bloom, c.seed + 31);
}

function palm(c: Canvas): void {
  const baseX = c.w * 0.5;
  const topX = c.w * (0.5 + 0.18 * (c.lean === 0 ? 0.6 : c.lean));
  const topY = c.h * 0.24;
  for (let y = Math.round(topY); y < c.h; y += 1) {
    const u = (y - topY) / (c.h - topY);
    const x = topX + (baseX - topX) * (u * u);
    const ring = y % 5 === 0;
    for (let k = -2; k <= 2; k += 1)
      c.b.px(
        x + k,
        y,
        ring ? (c.trunk[1] ?? C.BROWN) : k < 0 ? (c.trunk[3] ?? C.TAN) : (c.trunk[2] ?? C.WOOD),
      );
  }
  const fronds = 6 + Math.floor(c.random() * 2);
  for (let f = 0; f < fronds; f += 1) {
    const dir = f < fronds / 2 ? -1 : 1;
    const spread = 0.25 + ((f % Math.ceil(fronds / 2)) / Math.ceil(fronds / 2)) * 0.75;
    const len = c.w * (0.36 + c.random() * 0.12);
    for (let s = 0; s < len; s += 1) {
      const u = s / len;
      const x = topX + dir * s * (0.6 + spread * 0.4);
      const y =
        topY - (1 - spread) * len * 0.5 * Math.sin(Math.PI * u * 0.8) + u * u * len * 0.55 * spread;
      const leaflet = Math.max(1, Math.round((1 - u * 0.7) * 7));
      for (let k = 0; k <= leaflet; k += 1) c.b.px(x, y + k, c.leaf[k < 2 ? 3 : 2] ?? C.GREEN);
      c.b.px(x, y - 1, c.leaf[1] ?? C.MOSS);
    }
  }
  for (let i = 0; i < 3; i += 1)
    blob(c.b, topX - 3 + i * 3, topY + 4, 2, 2, c.trunk, c.seed + 40 + i, 0, 0, 2);
}

function bush(c: Canvas): void {
  const n = 4 + Math.floor(c.random() * 3);
  for (let i = 0; i < n; i += 1) {
    const r = c.h * (0.32 + c.random() * 0.14);
    blob(
      c.b,
      c.w * (0.18 + (i / (n - 1)) * 0.64) + jitter(c.random, 2),
      c.h - r * 0.95,
      r * 1.1,
      r,
      c.leaf,
      c.seed + i,
      0.4,
      0,
      i % 2 ? 2 : 3,
    );
  }
  if (c.bloom >= 0) speckle(c.b, 0.05, c.bloom, c.seed + 32);
}

function blades(c: Canvas, sway: number, count: number, heads: boolean): void {
  for (let i = 0; i < count; i += 1) {
    const x0 = c.w * (0.08 + c.random() * 0.84);
    const tall = c.h * (0.45 + c.random() * 0.55);
    const bend = jitter(c.random, c.w * 0.08) + sway * (1 + c.random());
    const colour = c.leaf[1 + Math.floor(c.random() * 3)] ?? C.GREEN;
    for (let s = 0; s < tall; s += 1) {
      const u = s / tall;
      c.b.px(x0 + bend * u * u, c.h - 1 - s, colour);
    }
    if (heads) {
      const hx = x0 + bend;
      const hy = c.h - tall;
      c.b.rect(hx - 1, hy, 3, Math.max(3, Math.round(c.h * 0.12)), c.trunk[1] ?? C.BROWN);
      c.b.px(hx - 1, hy, c.trunk[2] ?? C.WOOD);
    }
  }
}

function flowers(c: Canvas): void {
  blades(c, 0, 9, false);
  const heads = 4 + Math.floor(c.random() * 3);
  for (let i = 0; i < heads; i += 1) {
    const x = c.w * (0.12 + c.random() * 0.76);
    const y = c.h * (0.15 + c.random() * 0.35);
    stroke(c.b, x, y, x + jitter(c.random, 2), c.h, 1, c.leaf[2] ?? C.GREEN);
    const petal = c.bloom >= 0 ? c.bloom : C.PAPER;
    c.b.rect(x - 1, y - 1, 3, 3, petal);
    c.b.px(x, y, C.TUNGSTEN);
  }
}

function mushrooms(c: Canvas): void {
  const n = 2 + Math.floor(c.random() * 3);
  const cap = c.bloom >= 0 ? c.bloom : C.CLAY;
  for (let i = 0; i < n; i += 1) {
    const x = c.w * (0.18 + (i / Math.max(1, n - 1)) * 0.64) + jitter(c.random, 2);
    const s = c.h * (0.4 + c.random() * 0.5);
    c.b.rect(x - s * 0.12, c.h - s * 0.6, Math.max(2, s * 0.24), s * 0.6, C.PUTTY);
    c.b.rect(x + s * 0.04, c.h - s * 0.6, Math.max(1, s * 0.08), s * 0.6, C.GREY);
    blob(
      c.b,
      x,
      c.h - s * 0.62,
      s * 0.42,
      s * 0.26,
      [C.UMBER, C.BROWN, cap, cap],
      c.seed + i,
      0,
      0,
      3,
    );
    c.b.px(x - s * 0.15, c.h - s * 0.72, C.PAPER);
    c.b.px(x + s * 0.12, c.h - s * 0.66, C.PAPER);
  }
}

function cactus(c: Canvas): void {
  const cx = c.w / 2;
  const colW = Math.max(5, c.w * 0.26);
  const column = (x: number, top: number, bottom: number, w: number): void => {
    for (let y = Math.floor(top); y < bottom; y += 1)
      for (let k = 0; k < w; k += 1) {
        const round =
          y - top < w / 2
            ? Math.abs(k - w / 2) > Math.sqrt(Math.max(0, (w / 2) ** 2 - (w / 2 - (y - top)) ** 2))
            : false;
        if (round) continue;
        const rib = Math.floor((k / w) * 4);
        c.b.px(x - w / 2 + k, y, c.leaf[k < w * 0.35 ? 3 : rib % 2 ? 1 : 2] ?? C.GREEN);
      }
  };
  column(cx, c.h * 0.02, c.h, colW);
  const armW = Math.max(4, colW * 0.7);
  const armY = c.h * (0.35 + c.random() * 0.15);
  c.b.rect(cx - colW / 2 - armW * 1.4, armY, armW * 1.6, armW, c.leaf[2] ?? C.GREEN);
  column(cx - colW / 2 - armW * 0.9, armY - c.h * 0.22, armY + armW, armW);
  const armY2 = c.h * (0.5 + c.random() * 0.1);
  c.b.rect(cx + colW / 2 - 1, armY2, armW * 1.4, armW, c.leaf[1] ?? C.MOSS);
  column(cx + colW / 2 + armW * 0.8, armY2 - c.h * 0.16, armY2 + armW, armW);
  speckle(c.b, 0.03, C.PAPER, c.seed + 33);
}

function seaweed(c: Canvas, frame: number): void {
  const strands = 3 + Math.floor(c.random() * 2);
  for (let i = 0; i < strands; i += 1) {
    const x0 = c.w * (0.2 + (i / strands) * 0.6) + jitter(c.random, 2);
    const tall = c.h * (0.6 + c.random() * 0.4);
    const phase = c.random() * 6;
    for (let s = 0; s < tall; s += 1) {
      const u = s / tall;
      const x = x0 + Math.sin(s * 0.12 + phase + frame * 2.1) * (2 + u * c.w * 0.12);
      const w = Math.max(1, Math.round(4 - u * 3));
      for (let k = 0; k < w; k += 1)
        c.b.px(x + k, c.h - 1 - s, c.leaf[k === 0 ? 3 : 2 - (s % 7 === 0 ? 1 : 0)] ?? C.GREEN);
    }
  }
}

const DRAW: Readonly<Record<PlantKind, (c: Canvas, frame: number) => void>> = {
  deciduous,
  conifer,
  palm,
  bush,
  grass: (c, f) => {
    blades(c, f === 0 ? 0 : c.w * 0.05, 26, false);
  },
  flowers,
  mushrooms,
  cactus,
  seaweed,
  reeds: (c, f) => {
    blades(c, f === 0 ? 0 : c.w * 0.04, 14, true);
  },
};

const FRAMES: Readonly<Partial<Record<PlantKind, readonly [number, number]>>> = {
  grass: [2, 1.5],
  reeds: [2, 1.2],
  seaweed: [3, 2.5],
};

/** Draws one plant (all its frames) from a parsed spec. */
export function makePlant(spec: PlantSpec): MadeSprite {
  const [defaultHeight, ratio] = SHAPE[spec.kind];
  const height = spec.height ?? defaultHeight;
  const width = height * ratio * spec.width;
  const [frameCount, fps] = FRAMES[spec.kind] ?? [1, 0];
  const bloom = spec.bloom === undefined ? -1 : (colourRef(spec.bloom) ?? -1);
  const frames = Array.from({ length: frameCount }, (_, frame) => {
    const canvas: Canvas = {
      b: new Bmp(px(width, 6), px(height, 6)),
      w: px(width, 6),
      h: px(height, 6),
      random: stream(spec.seed, 101),
      leaf: rampOf(spec.leaf),
      trunk: rampOf(spec.trunk),
      bloom,
      lean: spec.lean,
      seed: spec.seed * 7 + 3,
    };
    DRAW[spec.kind](canvas, frame);
    return finish(canvas.b, C.VOID);
  });
  return { frames, size: [width, height], z: 0, fps };
}
