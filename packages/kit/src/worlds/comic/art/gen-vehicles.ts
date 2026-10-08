/**
 * `art.vehicle` (PLAN.md#13.15a): car, truck, bus, bike, boat, sailboat, ship, cart, wagon,
 * train, rocket, plane, helicopter, submarine, satellite; on its wheels or waterline (flying ones
 * by their centre), `size` = length; wheels turn, propellers spin, flames burn when `moving`.
 */
import { z } from 'zod';
import type { ComicPen } from '../page/pen.js';
import { artKey, colorSchema, placeShape, timeOf } from './common.js';
import { windows } from './gen-buildings.js';
import { sketchFor, type Sketch } from './sketch.js';

export const VEHICLES = [
  'car',
  'truck',
  'bus',
  'bike',
  'boat',
  'sailboat',
  'ship',
  'cart',
  'wagon',
  'train',
  'rocket',
  'plane',
  'helicopter',
  'submarine',
  'satellite',
] as const;

export const vehicleSchema = z.strictObject({
  ...placeShape,
  kind: z.enum(VEHICLES).default('car'),
  size: z.number().min(0).max(1500).default(100).describe('Length (rocket: height)'),
  fill: colorSchema.optional(),
  moving: z.boolean().default(false).describe('Wheels turn, propellers spin, flames burn'),
});

function wheel(
  sk: Sketch,
  x: number,
  r: number,
  t: number,
  moving: boolean,
  rim = 'greyLight',
): void {
  sk.oval(x, -r, r, r, 'ink', { outline: false });
  sk.oval(x, -r, r * 0.5, r * 0.5, rim, { outline: 'inner' });
  const a = moving ? t * 8 : 0.4;
  sk.line(
    x + Math.cos(a) * r * 0.45,
    -r + Math.sin(a) * r * 0.45,
    x - Math.cos(a) * r * 0.45,
    -r - Math.sin(a) * r * 0.45,
    'ink',
  );
}

export function drawVehicle(g: ComicPen, o: z.output<typeof vehicleSchema>): void {
  const key = artKey(`vehicle-${o.kind}`, o.seed);
  const sk = sketchFor(g, o, 100, key);
  const t = timeOf(g, o.t);
  const fill =
    o.fill ??
    {
      car: 'cyan',
      truck: 'red',
      bus: 'yellow',
      bike: 'red',
      boat: 'sepiaTan',
      sailboat: 'paper',
      ship: 'greyDark',
      cart: 'sepiaTan',
      wagon: 'sepiaTan',
      train: 'night',
      rocket: 'paper',
      plane: 'greyLight',
      helicopter: 'yellow',
      submarine: 'yellow',
      satellite: 'greyLight',
    }[o.kind];
  const look = { shade: 0.4 };
  const bob = o.moving ? Math.sin(t * 2) * 1.5 : 0;
  switch (o.kind) {
    case 'car':
    case 'truck':
    case 'bus': {
      const body: Readonly<Record<string, number[]>> = {
        car: [-48, -8, -48, -24, -30, -28, -18, -44, 18, -44, 30, -28, 48, -24, 48, -8],
        truck: [-50, -8, -50, -50, 14, -50, 14, -36, 30, -36, 48, -24, 48, -8],
        bus: [-50, -8, -50, -46, 46, -46, 50, -34, 50, -8],
      };
      sk.shape(body[o.kind] ?? [], fill, look);
      if (o.kind === 'car')
        sk.shape([-14, -40, 14, -40, 24, -28, -26, -28], 'cyanDeep', { outline: 'inner' });
      if (o.kind === 'truck')
        sk.shape([18, -33, 28, -33, 40, -24, 18, -24], 'cyanDeep', { outline: 'inner' });
      if (o.kind === 'bus') windows(sk, -44, -40, 7, 1, 9, 10, 3, false, key);
      sk.dot(46, -18, 2.2, 'yellowPale');
      for (const x of o.kind === 'car' ? [-30, 30] : [-34, 30]) wheel(sk, x, 9, t, o.moving);
      if (o.moving)
        for (let i = 0; i < 3; i += 1)
          sk.line(-62 - i * 6, -14 - i * 6, -76 - i * 10, -14 - i * 6, 'ink');
      return;
    }
    case 'bike':
      for (const x of [-30, 30]) {
        sk.oval(x, -16, 16, 16, 'none', { outline: 'outer' });
        sk.dot(x, -16, 1.5, 'ink');
      }
      sk.stroke([-30, -16, -8, -16, 4, -38, 30, -16], { w: 'outer', color: fill });
      sk.stroke([-8, -16, -14, -40, 4, -38], { w: 'outer', color: fill });
      sk.stroke([4, -38, 6, -46, 14, -46], { w: 'outer' });
      sk.stroke([-20, -42, -10, -42], { w: 'outer' });
      return;
    case 'boat':
    case 'sailboat':
    case 'ship': {
      const b = sk.sub(0, bob);
      if (o.kind === 'ship') {
        b.shape(
          [-50, -20, 50, -20, 42, -40, 10, -40, 10, -52, -26, -52, -26, -40, -46, -40],
          'paper',
          look,
        );
        b.shape([-4, -52, 6, -52, 6, -70, -4, -70], 'red', look);
        windows(b, -22, -48, 3, 1, 6, 5, 4, false, key);
      }
      b.shape([-50, -20, 50, -22, 40, 0, -42, 0], fill, look);
      if (o.kind === 'sailboat') {
        b.stroke([0, -20, 0, -96], { w: 'outer' });
        b.shape([2, -94, 42, -26, 2, -26], 'paper', look);
        b.shape([-2, -80, -34, -26, -2, -26], 'paper', look);
      }
      b.line(-46, -12, 44, -13, 'ink');
      return;
    }
    case 'cart':
    case 'wagon': {
      const cover = o.kind === 'wagon';
      sk.shape([-44, -14, 44, -14, 48, -36, -48, -36], fill, {
        shade: 0.3,
        hatch: { gap: 7, angle: 1.57, color: 'sepiaMid' },
      });
      if (cover) sk.shape([-44, -36, -40, -70, 40, -70, 44, -36], 'paper', { shade: 0.35 });
      sk.stroke([44, -24, 76, -20], { w: 'outer', color: 'sepiaMid' });
      for (const x of cover ? [-30, 30] : [0]) {
        sk.oval(x, -16, 16, 16, 'none', { outline: 'outer' });
        for (let i = 0; i < 4; i += 1) {
          const a = (o.moving ? t * 4 : 0) + (i * Math.PI) / 4;
          sk.line(
            x + Math.cos(a) * 15,
            -16 + Math.sin(a) * 15,
            x - Math.cos(a) * 15,
            -16 - Math.sin(a) * 15,
            'sepiaMid',
          );
        }
      }
      return;
    }
    case 'train':
      sk.shape([-50, -10, -50, -56, -10, -56, -10, -40, 44, -40, 50, -10], fill, look);
      sk.shape([20, -40, 20, -58, 30, -58, 30, -40], fill, look);
      sk.shape([-46, -52, -16, -52, -16, -36, -46, -36], 'yellowPale', { outline: 'inner' });
      sk.shape([46, -10, 56, 0, 46, 0], 'red', { outline: 'inner' });
      for (const x of [-36, -14, 10, 32]) wheel(sk, x, 9, t, o.moving, 'red');
      return;
    case 'rocket': {
      const flame = o.moving ? 1 + Math.sin(t * 30) * 0.15 : 0;
      if (flame > 0) sk.shape([-8, -4, 0, 30 * flame, 8, -4], 'yellow', { outline: 'inner' });
      for (const side of [-1, 1])
        sk.shape([side * 9, -30, side * 20, -4, side * 9, -10], 'red', look);
      sk.shape([-10, -6, -10, -70, 0, -100, 10, -70, 10, -6], fill, look);
      sk.oval(0, -58, 5, 5, 'cyan', { outline: 'outer' });
      return;
    }
    case 'plane': {
      const b = sk.sub(0, -20 + bob);
      b.shape([-50, -6, -44, -26, -36, -8, 40, -8, 50, 0, 40, 6, -46, 4], fill, look);
      b.shape([-6, 0, 18, 0, -16, 22], 'greyMid', look);
      windows(b, -26, -5, 6, 1, 4, 4, 4, false, key);
      return;
    }
    case 'helicopter': {
      const b = sk.sub(0, -20 + bob);
      b.cap(-46, -2, 0, -2, 4, fill, look);
      b.oval(10, 0, 24, 16, fill, look);
      b.shape([14, -12, 30, -6, 32, 4, 16, 4], 'cyan', { outline: 'inner' });
      b.line(10, -16, 10, -24, 'ink', b.widthOf('outer'));
      const spin = o.moving ? Math.cos(t * 40) : 1;
      b.stroke([10 - 48 * spin, -24, 10 + 48 * spin, -24], { w: 'outer' });
      b.stroke([0, 18, 28, 18], { w: 'outer' });
      return;
    }
    case 'submarine': {
      const b = sk.sub(0, -20 + bob);
      b.cap(-40, 0, 40, 0, 16, fill, look);
      b.shape([-6, -14, 14, -14, 12, -28, -4, -28], fill, look);
      b.stroke([6, -28, 6, -36, 14, -36], { w: 'outer' });
      for (const x of [-18, 0, 18]) b.oval(x, 0, 4.5, 4.5, 'cyan', { outline: 'outer' });
      b.shape([-40, 0, -52, -10, -52, 10], fill, look);
      return;
    }
    case 'satellite': {
      const b = sk.sub(0, -20);
      for (const side of [-1, 1]) {
        b.shape([side * 14, -8, side * 50, -8, side * 50, 8, side * 14, 8], 'cyanDeep', {
          outline: 'outer',
        });
        for (let i = 1; i < 4; i += 1)
          b.line(side * (14 + i * 9), -8, side * (14 + i * 9), 8, 'cyan', 1);
      }
      b.shape([-12, -12, 12, -12, 12, 12, -12, 12], 'yellow', { shade: 0.5 });
      b.stroke([0, -12, 4, -26], { w: 'outer' });
      b.oval(6, -28, 7, 3, 'paper', { outline: 'inner' });
      return;
    }
  }
}
