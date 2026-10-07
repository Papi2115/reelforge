/**
 * Vehicle generator of the Game B2 open layer: side-view billboards (`{ gen: 'vehicle', kind,
 * seed, size, body, facing }`), facing right unless `facing: 'left'`. Headlamps glow. Split from
 * the structure generator (gen-structures.ts), which shares its drawing helpers.
 */
import { z } from 'zod';
import { Bmp } from '../core/bitmap.js';
import { C } from '../palette.js';
import { finish, gradientPoly, mirror, slab, stroke } from './draw.js';
import { px, rampParam, seedParam, type MadeSprite } from './made.js';
import { rampOf, type Ramp, type RampName } from './ramps.js';

export const VEHICLE_KINDS = [
  'car',
  'truck',
  'bus',
  'cart',
  'bicycle',
  'rowboat',
  'sailboat',
  'rocket',
  'satellite',
  'train',
] as const;

export const vehicleSchema = z.strictObject({
  gen: z.literal('vehicle'),
  kind: z.enum(VEHICLE_KINDS),
  seed: seedParam,
  size: z.number().min(0.2).max(6).optional().describe('World length (default per kind)'),
  body: rampParam.optional(),
  facing: z.enum(['right', 'left']).default('right'),
});
export type VehicleSpec = z.output<typeof vehicleSchema>;

const at = (ramp: Ramp, k: number): number =>
  ramp[Math.max(0, Math.min(ramp.length - 1, k))] ?? C.SLATE;

const V_BASE: Readonly<Record<VehicleSpec['kind'], readonly [number, number, RampName]>> = {
  car: [1.2, 0.42, 'rust'],
  truck: [1.9, 0.5, 'sky'],
  bus: [2.4, 0.46, 'rust'],
  cart: [1.3, 0.55, 'warm'],
  bicycle: [0.8, 0.55, 'stone'],
  rowboat: [1.2, 0.3, 'warm'],
  sailboat: [1.4, 1.1, 'warm'],
  rocket: [0.6, 3.2, 'stone'],
  satellite: [1.4, 0.6, 'stone'],
  train: [2.6, 0.45, 'leaf'],
};

function wheel(b: Bmp, x: number, y: number, r: number): void {
  b.ellipse(x, y, r, r, C.VOID);
  b.ellipse(x, y, r * 0.45, r * 0.45, C.GREY);
}

function vehicle(b: Bmp, w: number, h: number, kind: VehicleSpec['kind'], body: Ramp): void {
  const r = h * 0.16;
  switch (kind) {
    case 'car':
      gradientPoly(
        b,
        [
          w * 0.04,
          h * 0.5,
          w * 0.24,
          h * 0.48,
          w * 0.36,
          h * 0.12,
          w * 0.7,
          h * 0.12,
          w * 0.82,
          h * 0.46,
          w * 0.98,
          h * 0.52,
          w * 0.98,
          h * 0.82,
          w * 0.02,
          h * 0.82,
        ],
        body,
        1,
        3,
      );
      b.poly(
        [w * 0.4, h * 0.18, w * 0.52, h * 0.18, w * 0.52, h * 0.44, w * 0.32, h * 0.44],
        C.HAZE,
      );
      b.poly(
        [w * 0.56, h * 0.18, w * 0.68, h * 0.18, w * 0.76, h * 0.44, w * 0.56, h * 0.44],
        C.HAZE,
      );
      b.rect(w * 0.92, h * 0.55, w * 0.05, h * 0.08, C.BULB);
      wheel(b, w * 0.24, h * 0.8, h * 0.18);
      wheel(b, w * 0.78, h * 0.8, h * 0.18);
      return;
    case 'truck':
    case 'bus':
    case 'train': {
      const cab = kind === 'truck';
      slab(b, 0, h * 0.06, cab ? w * 0.68 : w * 0.98, h * 0.72, body, 2);
      if (cab) slab(b, w * 0.7, h * 0.3, w * 0.28, h * 0.48, [C.CHAR, C.SLATE, C.GREY, C.PUTTY], 2);
      const span = cab ? w * 0.95 : w * 0.92;
      for (let x = cab ? w * 0.76 : w * 0.06; x + h * 0.18 < span; x += h * 0.26)
        b.rect(x, h * (cab ? 0.36 : 0.16), h * 0.18, h * 0.2, C.HAZE);
      for (const x of kind === 'train' ? [0.12, 0.3, 0.7, 0.88] : [0.18, 0.82])
        wheel(b, w * x, h * 0.8, r);
      return;
    }
    case 'cart':
      slab(b, w * 0.08, h * 0.3, w * 0.7, h * 0.36, body, 2);
      stroke(b, w * 0.78, h * 0.6, w, h * 0.5, 2, C.BROWN);
      b.ellipse(w * 0.4, h * 0.72, h * 0.27, h * 0.27, C.UMBER);
      b.ellipse(w * 0.4, h * 0.72, h * 0.2, h * 0.2, 255);
      stroke(b, w * 0.4 - h * 0.2, h * 0.72, w * 0.4 + h * 0.2, h * 0.72, 1, C.UMBER);
      stroke(b, w * 0.4, h * 0.52, w * 0.4, h * 0.92, 1, C.UMBER);
      return;
    case 'bicycle':
      for (const x of [0.22, 0.78]) {
        b.ellipse(w * x, h * 0.7, h * 0.28, h * 0.28, C.VOID);
        b.ellipse(w * x, h * 0.7, h * 0.24, h * 0.24, 255);
      }
      stroke(b, w * 0.22, h * 0.7, w * 0.48, h * 0.7, 1, at(body, 2));
      stroke(b, w * 0.48, h * 0.7, w * 0.36, h * 0.35, 1, at(body, 2));
      stroke(b, w * 0.36, h * 0.4, w * 0.7, h * 0.4, 1, at(body, 2));
      stroke(b, w * 0.7, h * 0.3, w * 0.78, h * 0.7, 1, at(body, 2));
      b.rect(w * 0.3, h * 0.3, w * 0.12, 2, C.VOID);
      return;
    case 'rowboat':
      gradientPoly(b, [0, h * 0.25, w, h * 0.25, w * 0.85, h, w * 0.12, h], body, 0, 3);
      b.rect(0, h * 0.25, w, 2, at(body, 4));
      stroke(b, w * 0.3, h * 0.2, w * 0.7, 0, 1, C.UMBER);
      return;
    case 'sailboat':
      gradientPoly(b, [0, h * 0.72, w, h * 0.72, w * 0.85, h, w * 0.12, h], body, 0, 3);
      stroke(b, w * 0.48, h * 0.72, w * 0.48, 0, 1, C.UMBER);
      b.poly([w * 0.5, h * 0.04, w * 0.95, h * 0.66, w * 0.5, h * 0.66], C.PAPER);
      b.poly([w * 0.46, h * 0.12, w * 0.46, h * 0.66, w * 0.1, h * 0.66], C.SAND_L);
      return;
    case 'rocket':
      gradientPoly(
        b,
        [w * 0.3, h * 0.2, w * 0.5, 0, w * 0.7, h * 0.2, w * 0.7, h * 0.85, w * 0.3, h * 0.85],
        body,
        2,
        5,
      );
      b.poly([w * 0.3, h * 0.6, w * 0.02, h * 0.95, w * 0.3, h * 0.85], C.CLAY);
      b.poly([w * 0.7, h * 0.6, w * 0.98, h * 0.95, w * 0.7, h * 0.85], C.CLAY);
      b.ellipse(w * 0.5, h * 0.3, w * 0.1, w * 0.1, C.DUSK);
      b.rect(w * 0.36, h * 0.85, w * 0.28, h * 0.05, C.CHAR);
      return;
    case 'satellite':
      slab(b, w * 0.38, h * 0.2, w * 0.24, h * 0.6, [C.UMBER, C.TAN, C.TUNGSTEN, C.BULB], 2);
      for (const x0 of [0, w * 0.66])
        for (let x = 0; x < w * 0.34; x += 1)
          for (let y = Math.round(h * 0.3); y < h * 0.7; y += 1)
            b.px(x0 + x, y, x % 6 === 0 || y % 5 === 0 ? C.SLATE : C.DUSK);
      stroke(b, w * 0.5, h * 0.2, w * 0.5, 0, 1, C.GREY);
      return;
  }
}

/** Draws one vehicle (side view, facing right unless `facing: 'left'`). */
export function makeVehicle(spec: VehicleSpec): MadeSprite {
  const [length, ratio, body0] = V_BASE[spec.kind];
  const size = spec.size ?? length;
  const width = size;
  const height = size * ratio;
  const w = px(width, 10);
  const h = px(height, 8);
  const b = new Bmp(w, h);
  vehicle(b, w, h, spec.kind, rampOf(spec.body ?? body0));
  return {
    frames: [finish(spec.facing === 'left' ? mirror(b) : b, C.VOID, [C.BULB])],
    size: [width, height],
    z: 0,
    fps: 0,
  };
}
