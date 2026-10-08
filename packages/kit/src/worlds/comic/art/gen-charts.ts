/**
 * Charts, maps and signs in the comic grammar (PLAN.md#13.15a; icons: gen-symbols.ts):
 * `art.chart` (bar, line, pie; hand-ruled, drawn on by `progress`, one highlighted value),
 * `art.map` (a seeded island, coast or continent with pins and a dashed route) and `art.sign`
 * (post, board, arrow, banner, plaque, billboard with lettering). Numbers and words come from the
 * narration only (QUALITY.md §5).
 */
import { z } from 'zod';
import { clamp01, noise2, rnd } from '../draw/math.js';
import type { ComicPen } from '../page/pen.js';
import { artKey, colorSchema, placeShape, pointSchema, seedSchema } from './common.js';
import { boxSchema } from './gen-terrain.js';
import { Sketch, sketchFor } from './sketch.js';

export const chartSchema = z.strictObject({
  box: boxSchema.describe('[x, y, w, h] of the plot area'),
  kind: z.enum(['bar', 'line', 'pie']).default('bar'),
  values: z.array(z.number().min(0)).min(1).max(12),
  max: z.number().positive().optional(),
  labels: z.array(z.string().max(14)).max(12).optional().describe('Words from the narration only'),
  fill: colorSchema.default('cyan'),
  highlight: z.int().min(0).max(11).optional().describe('The one value in red'),
  progress: z.number().min(0).max(1).default(1).describe('Draw-on progress'),
  seed: seedSchema,
});

export function drawChart(g: ComicPen, o: z.output<typeof chartSchema>): void {
  const [x, y, w, h] = o.box;
  const key = artKey(`chart-${o.kind}`, o.seed);
  const sk = new Sketch(g, { x: 0, y: 0, k: 1, flip: false, angle: 0, key });
  const max = o.max ?? Math.max(...o.values, 1e-9);
  const n = o.values.length;
  const ink = (i: number) => (i === o.highlight ? 'red' : o.fill);
  if (o.kind === 'pie') {
    const total = o.values.reduce((a, b) => a + b, 0) || 1;
    const [cx, cy, r] = [x + w / 2, y + h / 2, Math.min(w, h) * 0.45];
    let a0 = -Math.PI / 2;
    o.values.forEach((value, i) => {
      const a1 = a0 + (value / total) * Math.PI * 2 * o.progress;
      const pts = [cx, cy];
      for (let s = 0; s <= 12; s += 1)
        pts.push(
          cx + Math.cos(a0 + ((a1 - a0) * s) / 12) * r,
          cy + Math.sin(a0 + ((a1 - a0) * s) / 12) * r,
        );
      sk.shape(pts, i === o.highlight ? 'red' : i % 2 === 0 ? o.fill : 'paper', {
        shade: 0.3,
        outline: 'inner',
      });
      a0 = a1;
    });
    return;
  }
  sk.stroke([x, y - 6, x - 1, y + h, x + w + 6, y + h + 1], { w: 'outer' });
  for (let i = 1; i <= 4; i += 1)
    sk.line(x - 4, y + h - (h * i) / 4 + rnd(key, i) * 2, x + 2, y + h - (h * i) / 4, 'ink', 1);
  const step = w / n;
  const tops: number[] = [];
  o.values.forEach((value, i) => {
    const vx = x + step * (i + 0.5);
    const vy = y + h - h * clamp01(value / max);
    tops.push(vx, vy);
    if (o.kind === 'bar') {
      const grow = clamp01(o.progress * n - i);
      if (grow <= 0) return;
      const top = y + h - (y + h - vy) * grow;
      sk.shape(
        [
          vx - step * 0.32,
          y + h,
          vx - step * 0.3 + rnd(key, i) * 2,
          top,
          vx + step * 0.3,
          top + rnd(key, i + 9) * 2,
          vx + step * 0.32,
          y + h,
        ],
        ink(i),
        { shade: 0.3 },
      );
    }
    const label = o.labels?.[i];
    if (label !== undefined) g.text(label, vx - g.textWidth(label) / 2 / g.s, y + h + 4);
  });
  if (o.kind === 'line') {
    g.strokeOn(tops, o.progress, 'ink', g.w(2));
    for (let i = 0; i < n; i += 1)
      if ((i + 1) / n <= o.progress + 1e-6)
        sk.dot(tops[i * 2] ?? 0, tops[i * 2 + 1] ?? 0, 3.5, ink(i));
  }
}

export const mapSchema = z.strictObject({
  box: boxSchema,
  kind: z.enum(['island', 'coast', 'continent']).default('island'),
  land: colorSchema.default('yellowPale'),
  sea: colorSchema.default('cyan'),
  pins: z.array(pointSchema).max(8).default([]).describe('[u, v] in 0..1 of the box'),
  route: z.array(pointSchema).max(16).default([]).describe('[u, v] points of a dashed route'),
  progress: z.number().min(0).max(1).default(1),
  grid: z.boolean().default(true),
  seed: seedSchema,
});

function landmass(cx: number, cy: number, rx: number, ry: number, key: string): number[] {
  const pts: number[] = [];
  for (let i = 0; i < 40; i += 1) {
    const a = (i / 40) * Math.PI * 2;
    const k = 0.7 + noise2(key, Math.cos(a) * 40, Math.sin(a) * 40, 22) * 0.5;
    pts.push(cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k);
  }
  return pts;
}

export function drawMap(g: ComicPen, o: z.output<typeof mapSchema>): void {
  const [x, y, w, h] = o.box;
  const key = artKey(`map-${o.kind}`, o.seed);
  const sk = new Sketch(g, { x: 0, y: 0, k: 1, flip: false, angle: 0, key });
  g.plate.rect(x, y, w, h, g.tone('cyanDeep', 0.18, { cell: 4, on: o.sea }));
  if (o.grid)
    for (let i = 1; i < 4; i += 1) {
      sk.line(x + (w * i) / 4, y, x + (w * i) / 4, y + h, 'cyanDeep', 1);
      sk.line(x, y + (h * i) / 4, x + w, y + (h * i) / 4, 'cyanDeep', 1);
    }
  const masses =
    o.kind === 'island'
      ? [[0.5, 0.5, 0.32, 0.36]]
      : o.kind === 'coast'
        ? [[0.05, 0.5, 0.55, 0.75]]
        : [
            [0.45, 0.48, 0.42, 0.4],
            [0.85, 0.2, 0.08, 0.08],
            [0.82, 0.8, 0.1, 0.07],
          ];
  masses.forEach(([u, v, ru, rv], i) => {
    sk.shape(
      landmass(
        x + w * (u ?? 0),
        y + h * (v ?? 0),
        w * (ru ?? 0),
        h * (rv ?? 0),
        `${key}${String(i)}`,
      ),
      o.land,
      { shade: 0.25 },
    );
  });
  const route = o.route.flatMap(([u, v]) => [x + w * u, y + h * v]);
  if (route.length >= 4) {
    const dash: number[] = [];
    for (let i = 0; i + 3 < route.length; i += 2) {
      const [ax, ay, bx, by] = [
        route[i] ?? 0,
        route[i + 1] ?? 0,
        route[i + 2] ?? 0,
        route[i + 3] ?? 0,
      ];
      const len = Math.hypot(bx - ax, by - ay);
      for (let d = 0; d < len; d += 9)
        dash.push(ax + ((bx - ax) * d) / len, ay + ((by - ay) * d) / len);
    }
    const shown = Math.floor((dash.length / 2) * o.progress);
    for (let i = 0; i + 1 < shown; i += 2)
      sk.line(
        dash[i * 2] ?? 0,
        dash[i * 2 + 1] ?? 0,
        dash[i * 2 + 2] ?? 0,
        dash[i * 2 + 3] ?? 0,
        'red',
        g.w(2),
      );
  }
  for (const [u, v] of o.pins) {
    const pin = sketchFor(
      g,
      { x: x + w * u, y: y + h * v, size: Math.min(w, h) * 0.12 },
      100,
      `${key}pin${String(u)}`,
    );
    pin.shape([0, 0, -26, -50, -24, -76, 0, -96, 24, -76, 26, -50], 'red', { shade: 0.3 });
    pin.oval(0, -68, 10, 10, 'paper', { outline: 'inner' });
  }
  g.ink([x, y, x + w, y, x + w, y + h, x, y + h], { boil: 0.4, key: `${key}frame`, w: g.w(1.5) });
}

export const signSchema = z.strictObject({
  ...placeShape,
  kind: z.enum(['post', 'board', 'arrow', 'banner', 'plaque', 'billboard']).default('post'),
  text: z.string().max(40).default(''),
  size: z.number().min(0).max(800).default(80).describe('Height (a post stands on x, y)'),
  fill: colorSchema.optional(),
  color: colorSchema.default('ink').describe('Lettering'),
});

export function drawSign(g: ComicPen, o: z.output<typeof signSchema>): void {
  const sk = sketchFor(g, o, 100, artKey(`sign-${o.kind}`, o.seed));
  const fill =
    o.fill ?? (o.kind === 'banner' ? 'red' : o.kind === 'plaque' ? 'yellow' : 'sepiaTan');
  const board: Readonly<Record<string, number[]>> = {
    post: [-46, -96, 46, -98, 48, -60, -44, -58],
    arrow: [-46, -96, 34, -98, 54, -78, 34, -58, -46, -60],
    board: [-60, -100, 60, -100, 60, -40, -60, -40],
    banner: [-70, -96, 70, -96, 60, -78, 70, -60, -70, -60, -60, -78],
    plaque: [-50, -86, 50, -86, 50, -54, -50, -54],
    billboard: [-80, -100, 80, -100, 80, -46, -80, -46],
  };
  if (o.kind === 'post' || o.kind === 'arrow')
    sk.shape([-4, 0, -4, -60, 4, -60, 4, 0], 'sepiaMid', { shade: 0.4 });
  if (o.kind === 'board' || o.kind === 'billboard')
    for (const x of [-40, 40])
      sk.shape([x - 3, 0, x - 3, -42, x + 3, -42, x + 3, 0], 'greyDark', { outline: 'inner' });
  const pts = board[o.kind] ?? [];
  sk.shape(pts, fill, { shade: 0.25 });
  if (o.text === '') return;
  const xs = pts.filter((_, i) => i % 2 === 0);
  const ys = pts.filter((_, i) => i % 2 === 1);
  const [cx, cy] = sk.pt(
    (Math.min(...xs) + Math.max(...xs)) / 2 - (o.kind === 'arrow' ? 6 : 0),
    (Math.min(...ys) + Math.max(...ys)) / 2,
  );
  const room = (Math.max(...xs) - Math.min(...xs)) * sk.px * 0.85;
  const scale = Math.max(
    1,
    Math.min(4, Math.floor(room / Math.max(1, g.textWidth(o.text, 1, true)))),
  );
  g.text(o.text, cx - g.textWidth(o.text, scale, true) / 2 / g.s, cy - (3.5 * scale) / g.s, {
    scale,
    bold: true,
    color: o.color,
  });
}
