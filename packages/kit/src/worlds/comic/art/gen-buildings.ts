/**
 * `art.building` (PLAN.md#13.15a): house, cottage, tower, castle, skyscraper, shop, hut, church,
 * lighthouse, tent, barn, factory, station; it stands on (x, y), `size` = height. Vehicles:
 * gen-vehicles.ts.
 */
import { z } from 'zod';
import { rnd } from '../draw/math.js';
import type { ComicPen } from '../page/pen.js';
import { artKey, colorSchema, pick, placeShape, timeOf } from './common.js';
import { sketchFor, type Sketch } from './sketch.js';

export const BUILDINGS = [
  'house',
  'cottage',
  'tower',
  'castle',
  'skyscraper',
  'shop',
  'hut',
  'church',
  'lighthouse',
  'tent',
  'barn',
  'factory',
  'station',
] as const;

export const buildingSchema = z.strictObject({
  ...placeShape,
  kind: z.enum(BUILDINGS).default('house'),
  size: z.number().min(0).max(1200).default(120).describe('Height'),
  fill: colorSchema.optional().describe('Walls'),
  roof: colorSchema.optional(),
  lit: z.boolean().default(false).describe('Lit windows (night)'),
});

export function windows(
  sk: Sketch,
  x0: number,
  y0: number,
  cols: number,
  rows: number,
  w: number,
  h: number,
  gap: number,
  lit: boolean,
  key: string,
): void {
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const [x, y] = [x0 + c * (w + gap), y0 + r * (h + gap)];
      const on = lit && rnd(key, r * 31 + c) < 0.6;
      sk.shape([x, y, x + w, y, x + w, y + h, x, y + h], on ? 'yellowPale' : 'cyanDeep', {
        outline: 'inner',
      });
    }
  }
}

export function drawBuilding(g: ComicPen, o: z.output<typeof buildingSchema>): void {
  const key = artKey(`building-${o.kind}`, o.seed);
  const sk = sketchFor(g, o, 100, key);
  const wall =
    o.fill ??
    {
      house: 'paper',
      cottage: 'shade',
      tower: 'greyLight',
      castle: 'greyLight',
      skyscraper: 'greyMid',
      shop: 'yellowPale',
      hut: 'aged',
      church: 'paper',
      lighthouse: 'paper',
      tent: 'aged',
      barn: 'red',
      factory: 'sepiaTan',
      station: 'greyLight',
    }[o.kind];
  const roof = o.roof ?? pick(['red', 'sepiaMid', 'greyDark', 'cyanDeep'], key, 1);
  const look = { shade: 0.4 };
  switch (o.kind) {
    case 'house':
    case 'shop':
    case 'barn': {
      const w = o.kind === 'barn' ? 62 : 46;
      sk.shape([-w, 0, -w, -58, w, -58, w, 0], wall, look);
      sk.shape([-w - 8, -56, 0, -100, w + 8, -56], o.kind === 'barn' ? 'greyDark' : roof, look);
      if (o.kind === 'house')
        sk.shape([w * 0.4, -80, w * 0.4, -98, w * 0.65, -98, w * 0.65, -66], 'sepiaMid', look);
      if (o.kind === 'barn') {
        sk.shape([-18, 0, -18, -40, 18, -40, 18, 0], 'paper', { outline: 'outer' });
        sk.stroke([-18, 0, 18, -40]);
        sk.stroke([-18, -40, 18, 0]);
        return;
      }
      sk.shape([-10, 0, -10, -34, 10, -34, 10, 0], 'sepiaMid', look);
      windows(sk, -w + 8, -48, 1, 1, 18, 16, 0, o.lit, key);
      windows(sk, w - 26, -48, 1, 1, 18, 16, 0, o.lit, key);
      if (o.kind === 'shop') {
        for (let i = 0; i < 6; i += 1)
          sk.shape(
            [
              -w + (i * 2 * w) / 6,
              -58,
              -w + ((i + 1) * 2 * w) / 6,
              -58,
              -w + ((i + 1) * 2 * w) / 6 + 4,
              -46,
              -w + (i * 2 * w) / 6 + 4,
              -46,
            ],
            i % 2 === 0 ? 'red' : 'paper',
            { outline: 'inner' },
          );
      }
      return;
    }
    case 'cottage':
      sk.shape([-40, 0, -40, -50, 40, -50, 40, 0], wall, look);
      for (const [a, b, c, d] of [
        [-40, -50, -14, 0],
        [-14, -50, -40, 0],
        [14, -50, 40, 0],
        [40, -50, 14, 0],
      ] as const)
        sk.line(a, b, c, d, 'sepiaMid', sk.widthOf('outer'));
      sk.shape([-52, -46, -36, -100, 36, -100, 52, -46], o.roof ?? 'aged', {
        shade: 0.3,
        hatch: { gap: 5, angle: 1.3, color: 'sepiaMid' },
      });
      sk.shape([-8, 0, -8, -30, 8, -30, 8, 0], 'sepiaMid', look);
      windows(sk, 18, -40, 1, 1, 12, 12, 0, o.lit, key);
      return;
    case 'tower':
    case 'lighthouse': {
      const light = o.kind === 'lighthouse';
      sk.shape([-16, 0, -11, -80, 11, -80, 16, 0], wall, look);
      if (light)
        for (const y of [-14, -44])
          sk.shape([-15.5, y, -12, y - 15, 12, y - 15, 15.5, y], 'red', { outline: 'inner' });
      sk.shape([-14, -80, 14, -80, 14, -88, -14, -88], 'greyDark', { outline: 'inner' });
      if (light) {
        sk.shape([-8, -88, 8, -88, 8, -96, -8, -96], 'yellow', { outline: 'inner' });
        const a = Math.sin(timeOf(g, o.t) * 1.2);
        sk.flat([8, -94, 70, -102 + a * 14, 70, -86 + a * 14], g.tone('yellow', 0.5, { cell: 3 }));
      }
      sk.shape([-12, -96, 0, light ? -106 : -120, 12, -96], roof, look);
      if (!light)
        for (const y of [-30, -55])
          sk.shape([-1.5, y, 1.5, y, 1.5, y + 10, -1.5, y + 10], 'ink', { outline: false });
      return;
    }
    case 'castle': {
      const crenel = (x0: number, x1: number, y: number) => {
        for (let x = x0; x < x1 - 4; x += 10)
          sk.shape([x, y, x + 6, y, x + 6, y - 7, x, y - 7], wall, { outline: 'inner' });
      };
      sk.shape([-60, 0, -60, -50, 60, -50, 60, 0], wall, look);
      crenel(-60, 60, -50);
      for (const x of [-70, 50]) {
        sk.shape([x, 0, x, -82, x + 20, -82, x + 20, 0], wall, look);
        crenel(x, x + 20, -82);
        sk.shape([x + 8, -60, x + 12, -60, x + 12, -50, x + 8, -50], 'ink', { outline: false });
      }
      sk.shape([-14, 0, -14, -26, 0, -36, 14, -26, 14, 0], 'sepiaMid', look);
      for (let x = -11; x < 12; x += 5) sk.line(x, 0, x, -30, 'ink');
      sk.stroke([-60, -82, -60, -100], {});
      sk.shape([-60, -100, -44, -96, -60, -91], o.roof ?? 'red', { outline: 'inner' });
      return;
    }
    case 'skyscraper':
      sk.shape([-26, 0, -26, -100, 26, -100, 26, 0], wall, look);
      windows(sk, -21, -94, 5, 14, 5.5, 4.5, 2.2, o.lit, key);
      return;
    case 'hut':
      sk.shape([-30, 0, -30, -36, 30, -36, 30, 0], wall, {
        hatch: { gap: 4, angle: 1.57, color: 'sepiaMid' },
      });
      sk.shape([-44, -32, 0, -86, 44, -32], o.roof ?? 'aged', {
        hatch: { gap: 4, angle: 1.0, color: 'sepiaMid' },
      });
      sk.shape([-8, 0, -8, -24, 8, -24, 8, 0], 'ink', { outline: false });
      return;
    case 'church':
      sk.shape([-50, 0, -50, -44, 10, -44, 10, 0], wall, look);
      sk.shape([-56, -42, -20, -72, 16, -42], roof, look);
      sk.shape([10, 0, 10, -70, 34, -70, 34, 0], wall, look);
      sk.shape([8, -68, 22, -100, 36, -68], roof, look);
      sk.shape([18, -60, 26, -60, 26, -48, 18, -48], 'ink', { outline: false });
      windows(sk, -42, -34, 3, 1, 8, 16, 8, o.lit, key);
      return;
    case 'tent':
      sk.shape([-50, 0, 0, -70, 50, 0], wall, { shade: 0.5 });
      sk.shape([-10, 0, 0, -40, 10, 0], 'ink', { outline: false });
      sk.stroke([0, -70, 0, -80], {});
      return;
    case 'factory':
      sk.shape([-60, 0, -60, -50, 60, -50, 60, 0], wall, look);
      for (let i = 0; i < 4; i += 1)
        sk.shape([-60 + i * 30, -50, -60 + i * 30, -66, -30 + i * 30, -50], roof, look);
      for (const x of [30, 46])
        sk.shape([x, -50, x, -100, x + 9, -100, x + 9, -50], 'greyDark', look);
      windows(sk, -52, -38, 6, 1, 12, 10, 6, o.lit, key);
      return;
    case 'station':
      for (const x of [-90, 60]) {
        sk.shape([x, -60, x + 30, -60, x + 30, -10, x, -10], 'cyanDeep', { outline: 'outer' });
        for (let i = 1; i < 4; i += 1) sk.line(x + i * 7.5, -60, x + i * 7.5, -10, 'cyan', 1);
        sk.line(x, -35, x + 30, -35, 'cyan', 1);
      }
      sk.shape([-60, -38, 60, -38, 60, -32, -60, -32], 'greyMid', { outline: 'inner' });
      sk.cap(-34, -35, 34, -35, 13, wall, look);
      sk.cap(-6, -60, -6, -10, 10, wall, look);
      for (const x of [-24, 0, 24]) sk.line(x, -47, x, -23, 'greyMid');
      return;
  }
}
