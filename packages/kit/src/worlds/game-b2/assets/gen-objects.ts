/**
 * Object generator of the Game B2 open layer: furniture and things that stand in a level (`{ gen:
 * 'object', kind, seed, size, ramp, accent }`). Torches and campfires flicker (3 frames) and
 * glow; screens and lamps glow. Default sizes are real-world-ish in cells (walls are 1 tall).
 */
import { z } from 'zod';
import { Bmp } from '../core/bitmap.js';
import { hash3 } from '../core/rand.js';
import { C } from '../palette.js';
import { blob, finish, gradientPoly, slab, speckle, stroke } from './draw.js';
import { px, rampParam, seedParam, type MadeSprite } from './made.js';
import { colourRef, rampAt, rampOf, type Ramp, type RampName } from './ramps.js';

export const OBJECT_KINDS = [
  'table',
  'chair',
  'bed',
  'barrel',
  'crate',
  'chest',
  'sack',
  'pot',
  'lamp',
  'torch',
  'campfire',
  'rock',
  'signpost',
  'fence',
  'console',
  'bookshelf',
  'anvil',
  'cauldron',
  'statue',
  'column',
  'tombstone',
  'bench',
  'streetlamp',
  'hydrant',
  'pile',
  'flag',
  'log',
] as const;
export type ObjectKind = (typeof OBJECT_KINDS)[number];

export const objectSchema = z.strictObject({
  gen: z.literal('object'),
  kind: z.enum(OBJECT_KINDS),
  seed: seedParam,
  size: z.number().min(0.05).max(4).optional().describe('World height (default per kind)'),
  ramp: rampParam.optional().describe('Main material ramp (default per kind)'),
  accent: z.string().optional().describe('Second colour: cloth, flag, flame, pile contents'),
});
export type ObjectSpec = z.output<typeof objectSchema>;

/** [height, width/height, ramp, frames]. */
const BASE: Readonly<Record<ObjectKind, readonly [number, number, RampName, number]>> = {
  table: [0.42, 1.8, 'warm', 1],
  chair: [0.55, 0.7, 'warm', 1],
  bed: [0.4, 2.4, 'warm', 1],
  barrel: [0.5, 0.75, 'warm', 1],
  crate: [0.4, 1.1, 'warm', 1],
  chest: [0.32, 1.4, 'warm', 1],
  sack: [0.35, 0.9, 'earth', 1],
  pot: [0.3, 0.9, 'rust', 1],
  lamp: [0.6, 0.5, 'stone', 1],
  torch: [0.5, 0.3, 'warm', 3],
  campfire: [0.35, 1.3, 'warm', 3],
  rock: [0.4, 1.4, 'stone', 1],
  signpost: [0.9, 0.7, 'warm', 1],
  fence: [0.4, 2.5, 'warm', 1],
  console: [0.6, 1.2, 'stone', 1],
  bookshelf: [0.95, 0.8, 'warm', 1],
  anvil: [0.3, 1.3, 'stone', 1],
  cauldron: [0.4, 1.1, 'stone', 3],
  statue: [1.3, 0.5, 'stone', 1],
  column: [1.0, 0.3, 'stone', 1],
  tombstone: [0.45, 0.7, 'stone', 1],
  bench: [0.35, 2.2, 'warm', 1],
  streetlamp: [1.5, 0.25, 'stone', 1],
  hydrant: [0.3, 0.6, 'rust', 1],
  pile: [0.3, 1.8, 'rust', 1],
  flag: [1.2, 0.6, 'warm', 2],
  log: [0.3, 3.4, 'warm', 1],
};

interface Obj {
  readonly b: Bmp;
  readonly w: number;
  readonly h: number;
  readonly ramp: Ramp;
  readonly accent: number;
  readonly frame: number;
  readonly seed: number;
}

const at = (ramp: Ramp, k: number): number =>
  ramp[Math.max(0, Math.min(ramp.length - 1, k))] ?? C.SLATE;

function flame(b: Bmp, cx: number, base: number, size: number, frame: number, seed: number): void {
  const lean = [0, 1, -1][frame] ?? 0;
  b.poly(
    [
      cx - size * 0.5,
      base,
      cx + lean * size * 0.4,
      base - size * (1.2 + (frame % 2) * 0.2),
      cx + size * 0.5,
      base,
    ],
    C.CLAY,
  );
  b.poly(
    [cx - size * 0.3, base, cx + lean * size * 0.2, base - size * 0.8, cx + size * 0.3, base],
    C.TUNGSTEN,
  );
  b.poly([cx - size * 0.12, base, cx, base - size * 0.4, cx + size * 0.12, base], C.BULB);
  if (hash3(frame, 1, seed) < 0.6) b.px(cx + lean * 2, base - size * 1.5, C.TUNGSTEN);
}

function draw(o: Obj, kind: ObjectKind): void {
  const { b, w, h, ramp } = o;
  switch (kind) {
    case 'table':
      slab(b, 0, 0, w, h * 0.18, ramp, 3);
      b.rect(w * 0.06, h * 0.18, w * 0.08, h * 0.82, at(ramp, 1));
      b.rect(w * 0.86, h * 0.18, w * 0.08, h * 0.82, at(ramp, 1));
      return;
    case 'chair':
      slab(b, w * 0.1, 0, w * 0.8, h * 0.5, ramp, 2);
      slab(b, 0, h * 0.5, w, h * 0.12, ramp, 3);
      b.rect(w * 0.05, h * 0.62, w * 0.12, h * 0.38, at(ramp, 1));
      b.rect(w * 0.83, h * 0.62, w * 0.12, h * 0.38, at(ramp, 1));
      return;
    case 'bed':
      slab(b, 0, h * 0.3, w, h * 0.5, ramp, 2);
      slab(b, w * 0.03, h * 0.12, w * 0.94, h * 0.3, [C.SLATE, C.GREY, o.accent, C.PAPER], 2);
      blob(b, w * 0.15, h * 0.18, w * 0.1, h * 0.1, [C.PUTTY, C.PAPER], o.seed);
      b.rect(0, 0, w * 0.05, h, at(ramp, 1));
      return;
    case 'barrel':
      blob(b, w * 0.5, h * 0.5, w * 0.5, h * 0.52, ramp, o.seed, 0, 1, 3);
      for (const y of [0.22, 0.78]) b.rect(0, h * y, w, 2, C.CHAR);
      for (let x = 2; x < w; x += 5) b.rect(x, h * 0.25, 1, h * 0.5, at(ramp, 1));
      return;
    case 'crate':
      slab(b, 0, 0, w, h, ramp, 3);
      stroke(b, 1, 1, w - 2, h - 2, 1, at(ramp, 1));
      stroke(b, w - 2, 1, 1, h - 2, 1, at(ramp, 1));
      b.frame(0, 0, w, h, at(ramp, 1));
      return;
    case 'chest':
      slab(b, 0, h * 0.35, w, h * 0.65, ramp, 2);
      blob(b, w * 0.5, h * 0.38, w * 0.5, h * 0.36, ramp, o.seed, 0, 1, 3);
      b.rect(0, h * 0.36, w, h, 255);
      slab(b, 0, h * 0.35, w, h * 0.65, ramp, 2);
      b.rect(w * 0.45, h * 0.35, w * 0.1, h * 0.25, C.TUNGSTEN);
      return;
    case 'sack':
      blob(b, w * 0.5, h * 0.62, w * 0.48, h * 0.4, ramp, o.seed, 0.1, 1, 3);
      b.poly(
        [w * 0.38, h * 0.3, w * 0.62, h * 0.3, w * 0.55, h * 0.05, w * 0.45, h * 0.05],
        at(ramp, 2),
      );
      b.rect(w * 0.36, h * 0.28, w * 0.28, 2, C.UMBER);
      return;
    case 'pot':
      blob(b, w * 0.5, h * 0.58, w * 0.48, h * 0.42, ramp, o.seed, 0, 1, 3);
      b.rect(w * 0.3, 0, w * 0.4, h * 0.2, at(ramp, 2));
      b.rect(w * 0.25, 0, w * 0.5, 2, at(ramp, 3));
      return;
    case 'lamp':
      stroke(b, w * 0.5, h * 0.4, w * 0.5, h, 2, C.CHAR);
      gradientPoly(
        b,
        [w * 0.15, h * 0.42, w * 0.3, 0, w * 0.7, 0, w * 0.85, h * 0.42],
        [C.TUNGSTEN, C.BULB],
        0,
        1,
      );
      b.rect(w * 0.2, h - 2, w * 0.6, 2, C.CHAR);
      return;
    case 'torch':
      stroke(b, w * 0.5, h * 0.4, w * 0.5, h, Math.max(2, w * 0.25), C.BROWN);
      flame(b, w * 0.5, h * 0.42, w * 0.6, o.frame, o.seed);
      return;
    case 'campfire':
      for (let k = 0; k < 5; k += 1)
        stroke(
          b,
          w * (0.15 + k * 0.17),
          h,
          w * (0.5 + (k - 2) * 0.05),
          h * 0.72,
          2,
          k % 2 ? C.BROWN : C.UMBER,
        );
      for (let x = 0; x < w; x += 4) blob(b, x + 2, h - 2, 2.5, 2, [C.SLATE, C.GREY], o.seed + x);
      flame(b, w * 0.5, h * 0.8, w * 0.35, o.frame, o.seed);
      return;
    case 'rock':
      blob(b, w * 0.5, h * 0.6, w * 0.5, h * 0.55, ramp, o.seed, 0.25, 1, 4);
      b.rect(0, h - 1, w, 1, 255);
      return;
    case 'signpost':
      stroke(b, w * 0.5, h * 0.1, w * 0.5, h, 3, at(ramp, 1));
      b.poly(
        [0, h * 0.12, w * 0.85, h * 0.1, w, h * 0.22, w * 0.85, h * 0.34, 0, h * 0.32],
        at(ramp, 3),
      );
      b.poly(
        [w * 0.1, h * 0.42, w, h * 0.4, w, h * 0.58, w * 0.1, h * 0.6, 0, h * 0.5],
        at(ramp, 2),
      );
      return;
    case 'fence':
      for (let x = 1; x < w; x += Math.max(4, Math.round(w / 6)))
        slab(b, x, h * hash3(x, 2, o.seed) * 0.1, 3, h, ramp, 2);
      b.rect(0, h * 0.25, w, 2, at(ramp, 2));
      b.rect(0, h * 0.62, w, 2, at(ramp, 1));
      return;
    case 'console':
      slab(b, 0, h * 0.35, w, h * 0.65, ramp, 2);
      gradientPoly(
        b,
        [w * 0.08, h * 0.35, w * 0.16, 0, w * 0.84, 0, w * 0.92, h * 0.35],
        ramp,
        2,
        4,
      );
      b.rect(w * 0.22, h * 0.06, w * 0.56, h * 0.22, C.MOSS);
      for (let k = 0; k < 3; k += 1)
        b.rect(w * 0.26, h * (0.09 + k * 0.06), w * (0.2 + hash3(k, 4, o.seed) * 0.25), 1, C.FLUO);
      for (let k = 0; k < 5; k += 1)
        b.rect(w * (0.12 + k * 0.16), h * 0.5, 2, 2, k % 2 ? C.TUNGSTEN : C.ACCENT_D);
      return;
    case 'bookshelf':
      slab(b, 0, 0, w, h, ramp, 1);
      for (let row = 0; row < 4; row += 1) {
        const y0 = 2 + row * ((h - 4) / 4);
        let x = 2;
        while (x < w - 3) {
          const bw = 2 + Math.floor(hash3(x, row, o.seed) * 3);
          const tall = (h - 4) / 4 - 2 - Math.floor(hash3(x, row + 9, o.seed) * 3);
          b.rect(
            x,
            y0 + ((h - 4) / 4 - 1 - tall),
            bw,
            tall,
            [C.CLAY, C.DUSK, C.GREEN, C.SAND_L, C.PLUM][
              Math.floor(hash3(x, row + 3, o.seed) * 5)
            ] ?? C.CLAY,
          );
          x += bw + 1;
        }
        b.rect(0, y0 + (h - 4) / 4 - 1, w, 2, at(ramp, 2));
      }
      return;
    case 'anvil':
      b.poly([0, 0, w, 0, w * 0.75, h * 0.35, w * 0.25, h * 0.35], at(ramp, 3));
      b.rect(w * 0.35, h * 0.35, w * 0.3, h * 0.4, at(ramp, 2));
      slab(b, w * 0.2, h * 0.75, w * 0.6, h * 0.25, ramp, 2);
      return;
    case 'cauldron':
      blob(b, w * 0.5, h * 0.6, w * 0.48, h * 0.4, [C.VOID, C.CHAR, C.SLATE], o.seed, 0, 0, 2);
      b.rect(w * 0.1, h * 0.25, w * 0.8, h * 0.08, C.SLATE);
      for (let k = 0; k < 3; k += 1)
        b.px(w * (0.3 + k * 0.2), h * (0.2 - ((k + o.frame) % 3) * 0.06), o.accent);
      return;
    case 'statue':
      slab(b, 0, h * 0.82, w, h * 0.18, ramp, 2);
      gradientPoly(
        b,
        [w * 0.25, h * 0.82, w * 0.3, h * 0.3, w * 0.7, h * 0.3, w * 0.75, h * 0.82],
        ramp,
        2,
        4,
      );
      blob(b, w * 0.5, h * 0.2, w * 0.18, h * 0.1, ramp, o.seed, 0, 2, 4);
      stroke(b, w * 0.7, h * 0.35, w * 0.9, h * 0.12, 3, at(ramp, 3));
      return;
    case 'column':
      slab(b, 0, 0, w, h * 0.08, ramp, 3);
      slab(b, w * 0.12, h * 0.08, w * 0.76, h * 0.84, ramp, 3);
      for (let x = Math.round(w * 0.2); x < w * 0.8; x += 3)
        b.rect(x, h * 0.1, 1, h * 0.8, at(ramp, 2));
      slab(b, 0, h * 0.92, w, h * 0.08, ramp, 2);
      return;
    case 'tombstone':
      gradientPoly(b, [0, h, 0, h * 0.3, w * 0.5, 0, w, h * 0.3, w, h], ramp, 2, 3);
      b.rect(w * 0.45, h * 0.25, w * 0.1, h * 0.35, at(ramp, 1));
      b.rect(w * 0.3, h * 0.33, w * 0.4, h * 0.08, at(ramp, 1));
      speckle(b, 0.05, C.MOSS, o.seed);
      return;
    case 'bench':
      slab(b, 0, h * 0.4, w, h * 0.15, ramp, 3);
      slab(b, 0, 0, w, h * 0.15, ramp, 2);
      for (const x of [0.08, 0.88]) b.rect(w * x, 0, w * 0.04, h, C.CHAR);
      return;
    case 'streetlamp':
      stroke(b, w * 0.5, h * 0.08, w * 0.5, h, 2, C.CHAR);
      gradientPoly(
        b,
        [w * 0.1, h * 0.14, w * 0.25, 0, w * 0.75, 0, w * 0.9, h * 0.14],
        [C.TUNGSTEN, C.BULB],
        0,
        1,
      );
      b.rect(w * 0.1, h * 0.14, w * 0.8, 1, C.CHAR);
      return;
    case 'hydrant':
      slab(b, w * 0.2, h * 0.2, w * 0.6, h * 0.8, ramp, 2);
      blob(b, w * 0.5, h * 0.2, w * 0.32, h * 0.18, ramp, o.seed, 0, 1, 3);
      b.rect(0, h * 0.42, w, h * 0.14, at(ramp, 2));
      return;
    case 'pile':
      for (let k = 0; k < 14; k += 1) {
        const x = w * (0.1 + hash3(k, 5, o.seed) * 0.8);
        const y = h * (0.35 + hash3(k, 6, o.seed) * 0.6) + Math.abs(x - w / 2) * 0.3;
        slab(
          b,
          x - w * 0.08,
          Math.min(h - h * 0.2, y),
          w * 0.16,
          h * 0.2,
          k % 3 ? ramp : [C.UMBER, o.accent, o.accent],
          2,
        );
      }
      return;
    case 'log': {
      const r = h / 2;
      for (let y = 0; y < h; y += 1)
        for (let x = Math.round(r * 0.6); x < w - r; x += 1) {
          const v = Math.sin(((y + 0.5) / h) * Math.PI);
          const grain = (x * 7 + y * 3) % 11 === 0 ? -0.25 : 0;
          b.px(x, y, rampAt(ramp, v * 0.75 + grain - (y > h * 0.6 ? 0.2 : 0), x, y, 0, 3));
        }
      blob(b, w - r, r, r * 0.55, r, [at(ramp, 3), at(ramp, 4)], o.seed, 0);
      b.ellipse(w - r, r, r * 0.3, r * 0.55, at(ramp, 2));
      b.px(w - r, r, at(ramp, 1));
      stroke(b, w * 0.3, 1, w * 0.36, -2, 1, at(ramp, 1));
      speckle(b, 0.05, C.MOSS, o.seed + 1);
      return;
    }
    case 'flag':
      stroke(b, w * 0.1, 0, w * 0.1, h, 2, C.CHAR);
      for (let x = Math.round(w * 0.12); x < w; x += 1) {
        const wave = Math.sin(x * 0.4 + o.frame * 2) * 2;
        b.rect(x, h * 0.05 + wave, 1, h * 0.36, x < w * 0.5 ? o.accent : at(ramp, 3));
      }
      return;
  }
}

/** Draws one object (torches, campfires, cauldrons and flags animate). */
export function makeObject(spec: ObjectSpec): MadeSprite {
  const [height0, ratio, ramp0, frameCount] = BASE[spec.kind];
  const height = spec.size ?? height0;
  const width = height * ratio;
  const w = px(width, 6);
  const h = px(height, 6);
  const accent = spec.accent === undefined ? C.CLAY : (colourRef(spec.accent) ?? C.CLAY);
  const glowing =
    spec.kind === 'torch' ||
    spec.kind === 'campfire' ||
    spec.kind === 'lamp' ||
    spec.kind === 'streetlamp';
  const frames = Array.from({ length: frameCount }, (_, frame) => {
    const o: Obj = {
      b: new Bmp(w, h),
      w,
      h,
      ramp: rampOf(spec.ramp ?? ramp0),
      accent,
      frame,
      seed: spec.seed,
    };
    draw(o, spec.kind);
    const glow = glowing
      ? [C.BULB, C.TUNGSTEN, C.CLAY]
      : spec.kind === 'console'
        ? [C.FLUO, C.MOSS]
        : [];
    return finish(o.b, C.VOID, glow);
  });
  return { frames, size: [width, height], z: 0, fps: frameCount > 1 ? 6 : 0 };
}
