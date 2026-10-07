/**
 * Terrain rows in the comic grammar (PLAN.md#13.15a): `art.dunes` (desert dunes with shaded lee
 * sides), `art.forest` (rows of tree silhouettes on a horizon, back rows flat) and `art.skyline`
 * (a city, lit windows at night). Each fills a `box` [x, y, w, h] like the other terrain.
 */
import { z } from 'zod';
import { rnd } from '../draw/math.js';
import type { ComicPen } from '../page/pen.js';
import { artKey, colorSchema, seedSchema } from './common.js';
import { drawTree } from './gen-plants.js';
import { boxSchema, horizonSchema, sketchAt, timeSchema } from './gen-terrain.js';

export const dunesSchema = z.strictObject({
  box: boxSchema,
  horizon: horizonSchema,
  fill: colorSchema.default('yellow'),
  count: z.int().min(1).max(6).default(3),
  seed: seedSchema,
});

export function drawDunes(g: ComicPen, o: z.output<typeof dunesSchema>): void {
  const [bx, by, bw, bh] = o.box;
  const key = artKey('dunes', o.seed);
  const hy = by + bh * o.horizon;
  const sk = sketchAt(g, key);
  const bottom = by + bh + 4;
  for (let i = 0; i < o.count; i += 1) {
    const d = (i + 1) / o.count;
    const base = hy + (bottom - hy) * (d * 0.55);
    const crestX = bx + bw * (0.2 + rnd(key, i) * 0.6);
    const h = (bottom - hy) * (0.16 + d * 0.12) + 6;
    const crest: number[] = [];
    for (let s = 0; s <= 20; s += 1) {
      const x = bx - 6 + ((bw + 12) * s) / 20;
      const u = (x - crestX) / (bw * (0.35 + d * 0.2));
      // Gentle windward slope on the left, a steeper lee drop to the right of the crest.
      const lift = u < 0 ? Math.exp(-u * u * 1.4) : Math.exp(-u * u * 4);
      crest.push(x, base - h * lift);
    }
    const body = [...crest, bx + bw + 6, bottom, bx - 6, bottom];
    g.plate.poly(body, g.tone('magenta', 0.1 + d * 0.08, { cell: 4, angle: 0.78, on: o.fill }));
    const lee = (lx: number) => (lx > crestX ? 0.5 * Math.min(1, (lx - crestX) / (bw * 0.12)) : 0);
    g.plate.poly(
      body,
      g.tone('magenta', (lx) => lee(lx), { cell: 3, angle: 0.78 }),
    );
    g.ink(crest, { closed: false, boil: 0.5, key: `${key}${String(i)}` });
    for (let r = 0; r < 3; r += 1) {
      const y = base + h * 0.25 + r * 7;
      sk.stroke(
        [
          crestX - bw * 0.3 + r * 10,
          y,
          crestX - bw * 0.2 + r * 10,
          y - 2,
          crestX - bw * 0.1 + r * 10,
          y,
        ],
        { color: 'aged' },
      );
    }
  }
}

export const forestSchema = z.strictObject({
  box: boxSchema,
  horizon: horizonSchema,
  rows: z.int().min(1).max(3).default(2),
  kind: z.enum(['pine', 'oak', 'mixed', 'palm', 'dead']).default('pine'),
  season: z.enum(['green', 'autumn', 'snow', 'bare']).default('green'),
  density: z.number().min(0.2).max(3).default(1),
  seed: seedSchema,
  t: timeSchema,
});

export function drawForest(g: ComicPen, o: z.output<typeof forestSchema>): void {
  const [bx, by, bw, bh] = o.box;
  const key = artKey('forest', o.seed);
  const hy = by + bh * o.horizon;
  for (let row = o.rows - 1; row >= 0; row -= 1) {
    const size = bh * (0.26 + (o.rows - 1 - row) * 0.12) * (row === 0 ? 1.15 : 1);
    const count = Math.max(2, Math.round((bw / (size * 0.42)) * o.density * (row === 0 ? 0.7 : 1)));
    const flat = row === 0 ? undefined : row === 1 ? 'cyanDeep' : 'cyan';
    for (let i = 0; i < count; i += 1) {
      const x = bx + (bw * (i + 0.5 + (rnd(key, row * 100 + i) - 0.5) * 0.8)) / count;
      const kind = o.kind === 'mixed' ? (rnd(key, i + 300) < 0.5 ? 'pine' : 'oak') : o.kind;
      drawTree(g, {
        x,
        y: hy + row * -size * 0.08 + rnd(key, i + 500) * 4,
        kind,
        size: size * (0.8 + rnd(key, i + 200) * 0.4),
        season: o.season,
        fill: flat,
        trunk: flat,
        seed: `${String(o.seed)}r${String(row)}i${String(i)}`,
        t: o.t,
        flip: rnd(key, i + 600) < 0.5,
        lean: 0,
        angle: 0,
        sway: row === 0 ? 0.2 : 0,
      });
    }
  }
}

export const skylineSchema = z.strictObject({
  box: boxSchema,
  horizon: horizonSchema,
  count: z.int().min(2).max(40).default(12),
  height: z.number().min(0.05).max(0.95).default(0.45),
  lit: z.boolean().default(false).describe('Lit windows (night)'),
  fill: colorSchema.default('greyMid'),
  layers: z.int().min(1).max(2).default(2),
  seed: seedSchema,
});

export function drawSkyline(g: ComicPen, o: z.output<typeof skylineSchema>): void {
  const [bx, by, bw, bh] = o.box;
  const key = artKey('skyline', o.seed);
  const hy = by + bh * o.horizon;
  const sk = sketchAt(g, key);
  for (let layer = o.layers - 1; layer >= 0; layer -= 1) {
    const n = o.count + layer * 4;
    const far = layer > 0;
    let x = bx - 10;
    for (let i = 0; i < n && x < bx + bw; i += 1) {
      const id = layer * 100 + i;
      const w = (bw / n) * (0.7 + rnd(key, id) * 0.8);
      const h = bh * o.height * (0.35 + rnd(key, id + 50) * 0.65) * (far ? 1.15 : 1);
      const top = hy - h;
      const fill = far ? (o.lit ? 'night' : 'greyLight') : o.fill;
      const body = [x, hy + 2, x, top, x + w, top, x + w, hy + 2];
      g.plate.poly(body, far ? fill : g.tone('ink', 0.25, { cell: 3, angle: 0.78, on: fill }));
      const roof = rnd(key, id + 90);
      if (roof < 0.2) sk.line(x + w * 0.5, top, x + w * 0.5, top - h * 0.2, 'ink', 1);
      else if (roof < 0.32)
        g.plate.poly([x + w * 0.2, top, x + w * 0.5, top - h * 0.18, x + w * 0.8, top], fill);
      if (!far) {
        for (let wy = top + 6; wy < hy - 6; wy += 9) {
          for (let wx = x + 4; wx < x + w - 6; wx += 8) {
            const on = o.lit ? rnd(key, Math.floor(wx * 7 + wy * 13)) < 0.45 : true;
            g.rect(wx, wy, 4, 5, on ? (o.lit ? 'yellowPale' : 'greyDark') : 'night');
          }
        }
        g.ink([x, hy, x, top, x + w, top, x + w, hy], {
          closed: false,
          boil: 0.4,
          key: `${key}${String(id)}`,
        });
      }
      x += w + (far ? -w * 0.2 : 2);
    }
  }
}
