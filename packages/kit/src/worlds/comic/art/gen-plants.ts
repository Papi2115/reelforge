/**
 * `art.tree` (PLAN.md#13.15a): pine, oak, birch, palm, dead, willow; seasons. One merged
 * silhouette per crown (blob outline), halftone shade from the left light, seeded so two trees of
 * one kind still differ; crowns sway on the panel clock. Small plants: gen-undergrowth.ts.
 */
import { z } from 'zod';
import { rnd } from '../draw/math.js';
import type { ComicPen } from '../page/pen.js';
import { artKey, colorSchema, placeShape, timeOf } from './common.js';
import { sketchFor, type Sketch } from './sketch.js';

export const TREES = ['pine', 'oak', 'birch', 'palm', 'dead', 'willow'] as const;
const SEASON_FILL = {
  green: 'phosphor',
  autumn: 'yellow',
  snow: 'phosphor',
  bare: 'none',
} as const;

export const treeSchema = z.strictObject({
  ...placeShape,
  kind: z.enum(TREES).default('oak'),
  size: z.number().min(0).max(1200).default(140).describe('Height'),
  season: z.enum(['green', 'autumn', 'snow', 'bare']).default('green'),
  fill: colorSchema.optional().describe('Crown colour'),
  trunk: colorSchema.optional(),
  lean: z.number().min(-0.5).max(0.5).default(0),
  sway: z.number().min(0).max(1).default(0.25),
});

/** Zigzag sides of a pine tier: from (0, top) down to half width w at y = bottom. */
function tier(top: number, bottom: number, w: number, key: string, i: number): number[] {
  const left: number[] = [];
  const right: number[] = [];
  const n = 4;
  for (let j = 1; j <= n; j += 1) {
    const y = top + ((bottom - top) * j) / n;
    const ww = (w * j) / n;
    const nub = (j === n ? 1 : 0.72) + rnd(key, i * 10 + j) * 0.12;
    right.push(ww * nub, y, ww * 0.72, y - 1.5);
    left.unshift(-ww * 0.72, y - 1.5, -ww * nub, y);
  }
  return [0, top, ...right, ...left];
}

export function drawTree(g: ComicPen, o: z.output<typeof treeSchema>): void {
  const key = artKey(`tree-${o.kind}`, o.seed);
  const sk = sketchFor(g, { ...o, angle: o.lean * 0.3 }, 100, key);
  const t = timeOf(g, o.t);
  const sway = Math.sin(t * 1.3 + rnd(key, 1) * 6) * o.sway * 2;
  const crown = o.fill ?? (o.season === 'bare' ? 'none' : SEASON_FILL[o.season]);
  const shadeInk = crown === 'yellow' ? 'magenta' : crown === 'phosphor' ? 'cyanDeep' : undefined;
  const trunk = o.trunk ?? (o.kind === 'birch' ? 'paper' : 'sepiaMid');
  const top = sk.sub(sway, 0);
  switch (o.kind) {
    case 'pine': {
      sk.shape([-3, 0, -2.5, -22, 2.5, -22, 3, 0], trunk, { shade: 0.4 });
      const fill = crown === 'none' ? 'sepiaMid' : crown;
      for (let i = 0; i < 4; i += 1) {
        const y0 = -100 + i * 17;
        top.shape(tier(y0, y0 + 30 + i * 3, 12 + i * 6, key, i), fill, { shade: 0.55, shadeInk });
        if (o.season === 'snow') top.flat(tier(y0, y0 + 9, 4 + i * 2, key, i + 7), 'paper');
      }
      return;
    }
    case 'palm': {
      const bend = 18 + o.lean * 30;
      const trunkPts = [
        -3,
        0,
        bend * 0.2 - 2.5,
        -40,
        bend * 0.7 - 2,
        -75,
        bend + 2,
        -88,
        bend + 0.5,
        -75,
        bend * 0.2 + 3,
        -40,
        3,
        0,
      ];
      sk.shape(trunkPts, 'aged', { shade: 0.45 });
      for (let i = 1; i < 8; i += 1)
        sk.line(bend * 0.1 * i - 3, -i * 11, bend * 0.1 * i + 3, -i * 11 - 1);
      const crownTop = sk.sub(bend + sway, -88);
      for (let i = 0; i < 6; i += 1) {
        const a = -Math.PI + (i / 5) * Math.PI + (rnd(key, i) - 0.5) * 0.3;
        const [dx, dy] = [Math.cos(a) * 34, Math.sin(a) * 18 + 12];
        crownTop.shape(
          [0, 0, dx * 0.5, dy * 0.5 - 8, dx, dy, dx * 0.5, dy * 0.5 - 1],
          crown === 'none' ? 'sepiaTan' : crown,
          { shade: 0.4, shadeInk },
        );
      }
      for (const cx of [-3, 3]) crownTop.oval(cx, 4, 3.4, 3.4, 'sepiaMid');
      return;
    }
    case 'dead':
      sk.shape([-5, 0, -3, -50, 3, -50, 5, 0], o.trunk ?? 'greyDark', { shade: 0.4 });
      branches(top, 0, -50, -Math.PI / 2, 44, 3, key, o.trunk ?? 'greyDark');
      return;
    default:
      broadleaf(sk, top, o, { crown, shadeInk, trunk, key });
  }
}

function branches(
  sk: Sketch,
  x: number,
  y: number,
  a: number,
  len: number,
  depth: number,
  key: string,
  ink: string,
): void {
  if (depth === 0 || len < 4) return;
  for (let i = 0; i < 2; i += 1) {
    const turn = (i === 0 ? -1 : 1) * (0.35 + rnd(key, depth * 7 + i) * 0.4);
    const [ex, ey] = [x + Math.cos(a + turn) * len, y + Math.sin(a + turn) * len];
    sk.stroke([x, y, ex, ey], { w: depth > 1 ? 'outer' : 'inner', color: ink });
    branches(sk, ex, ey, a + turn, len * 0.62, depth - 1, `${key}${String(i)}`, ink);
  }
}

function broadleaf(
  sk: Sketch,
  top: Sketch,
  o: z.output<typeof treeSchema>,
  c: { crown: string; shadeInk: string | undefined; trunk: string; key: string },
): void {
  const birch = o.kind === 'birch';
  const w = birch ? 3 : 7;
  sk.shape(
    [
      -w,
      0,
      -w * 0.7,
      -55,
      -w * 0.3 - 10,
      -70,
      -w * 0.3 - 8,
      -72,
      0,
      -62,
      w * 0.5 + 9,
      -74,
      w * 0.5 + 11,
      -72,
      w * 0.7,
      -55,
      w,
      0,
    ],
    c.trunk,
    { shade: 0.45 },
  );
  if (birch)
    for (let i = 0; i < 6; i += 1)
      sk.line(-2, -8 - i * 9 - rnd(c.key, i) * 4, 1, -9 - i * 9 - rnd(c.key, i) * 4, 'ink');
  if (c.crown === 'none') {
    branches(top, 0, -62, -Math.PI / 2, 26, 3, c.key, c.trunk === 'paper' ? 'greyDark' : c.trunk);
    return;
  }
  const blobs: { e: [number, number, number, number] }[] = [];
  const count = birch ? 5 : 7;
  for (let i = 0; i < count; i += 1) {
    const a = (i / count) * Math.PI * 2 + rnd(c.key, i + 20);
    const r = (birch ? 13 : 20) + rnd(c.key, i + 30) * 8;
    blobs.push({ e: [Math.cos(a) * (birch ? 12 : 22), -74 + Math.sin(a) * 14, r, r * 0.82] });
  }
  if (o.kind === 'willow') {
    top.blob([{ e: [0, -76, 34, 22] }], c.crown);
    for (let i = 0; i < 9; i += 1) {
      const x = -30 + i * 7.5;
      top.stroke([x, -70, x - 2, -40, x + 1, -24 - rnd(c.key, i) * 10], {
        color: 'cyanDeep',
        w: 'inner',
      });
    }
    return;
  }
  top.blob(blobs, top.shadePaint(c.crown, 0.5, c.shadeInk, top.map([-40, -100, 40, -50])));
  if (o.season === 'snow')
    for (const b of blobs.slice(0, 4))
      top.flat(
        top.g.ellipsePts(b.e[0], b.e[1] - b.e[3] * 0.55, b.e[2] * 0.7, b.e[3] * 0.32, 10),
        'paper',
      );
  for (let i = 0; i < 6; i += 1) {
    const [x, y] = [-24 + rnd(c.key, i + 60) * 48, -88 + rnd(c.key, i + 70) * 30];
    top.line(x, y, x + 3, y + 3, 'ink');
  }
}
