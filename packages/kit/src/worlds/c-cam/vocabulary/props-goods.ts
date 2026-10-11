/**
 * Grim Ink props (PLAN.md#14.20): containers (barrel, crate, sack, straw bale, basket, clay jar,
 * tub; open, spilled, broken) and coins (round, oval, bars; fan, stack, scatter). Ported from
 * `01-samurai-edo/js/props.js` (bale, koban) and `sets-b.js` (rain barrel); docs in props.ts.
 */
import { z } from 'zod';
import { C, rnd } from '../core.js';
import { brushStroke, type BrushEnv } from '../draw/brushes.js';
import type { Paint2D } from '../draw/paint.js';
import { beam, rough } from '../draw/scenery.js';
import { blob, ellipseRing } from '../draw/shapes.js';
import {
  boxOf,
  coord,
  local,
  seedSchema,
  sizeSchema,
  toneOf,
  toneSchema,
  wearMarks,
  wearSchema,
  type Drawn,
  spot,
} from './common.js';

// ---------- container ----------

export const containerSchema = z.strictObject({
  x: coord.default(960),
  y: coord.default(900),
  kind: z.enum(['barrel', 'crate', 'sack', 'bale', 'basket', 'jar', 'tub']).default('barrel'),
  size: sizeSchema,
  state: z.enum(['shut', 'open', 'spilled', 'broken']).default('shut'),
  contents: toneSchema.default('straw'),
  tone: toneSchema.optional(),
  wear: wearSchema,
  seed: seedSchema.default(540),
});

const CONTAINER_TONE = {
  barrel: 'wood',
  crate: 'paleWood',
  sack: 'cloth',
  bale: 'straw',
  basket: 'straw',
  jar: 'clay',
  tub: 'wood',
} as const;

/** Width x height of each container at size 1 (world px). */
const DIMS = {
  barrel: [150, 190],
  crate: [180, 160],
  sack: [140, 170],
  bale: [180, 124],
  basket: [150, 110],
  jar: [120, 190],
  tub: [170, 90],
} as const;

export function drawContainer(g: Paint2D, e: BrushEnv, o: z.output<typeof containerSchema>): Drawn {
  const [fill, shade] = toneOf(o.tone ?? CONTAINER_TONE[o.kind]);
  const [cf, cd] = toneOf(o.contents);
  const [W0, H0] = DIMS[o.kind];
  const w = W0;
  const h = H0;
  const open = o.state === 'open' || o.state === 'spilled';
  local(g, o.x, o.y, 0, o.size, () => {
    const hatchV = {
      c: 'rgba(14,10,6,0.45)',
      n: 3,
      len: h * 0.5,
      gap: 7,
      k: 2,
      ang: 90,
      bend: 0.05,
    };
    if (o.kind === 'barrel' || o.kind === 'tub') {
      // prettier-ignore
      blob(g, e, [-w / 2, 0, -w * 0.56, -h * 0.5, -w / 2, -h, w / 2, -h, w * 0.56, -h * 0.5, w / 2, 0], fill, { lw: 6, seed: o.seed, shade: [shade, -12, 0], hatch: hatchV });
      for (const u of [-0.25, 0, 0.25])
        brushStroke(g, e, [u * w, -h + 4, u * w * 1.08, -h * 0.5, u * w, -4], {
          w: 3,
          color: shade,
          seed: o.seed + 1,
          taper: false,
        });
      for (const v of o.kind === 'tub' ? [0.25] : [0.18, 0.82])
        brushStroke(g, e, [-w * 0.54, -h * v, 0, -h * v + 6, w * 0.54, -h * v], {
          w: 8,
          color: C.BLACK,
          seed: o.seed + 2,
          taper: false,
        });
      blob(g, e, ellipseRing(0, -h, w / 2, w * 0.12, 12), open ? cf : fill, {
        lw: 5,
        seed: o.seed + 3,
        shade: [open ? cd : shade, 0, 4],
      });
    }
    if (o.kind === 'crate') {
      rough(g, e, [-w / 2, 0, -w / 2, -h, w / 2, -h, w / 2, 0], fill, {
        seed: o.seed,
        lw: 6,
        shade: [shade, -10, 0],
        hatch: { ...hatchV, ang: 0 },
      });
      for (const v of [0.33, 0.66])
        brushStroke(g, e, [-w / 2, -h * v, w / 2, -h * v], {
          w: 4,
          color: shade,
          seed: o.seed + 1,
          taper: false,
        });
      beam(g, e, -w / 2 + 10, -10, w / 2 - 10, -h + 10, 16, o.seed + 2, shade);
      if (open)
        rough(
          g,
          e,
          [-w / 2 + 6, -h, w / 2 - 6, -h, w / 2 - 14, -h - 18, -w / 2 + 14, -h - 18],
          cf,
          { seed: o.seed + 3, lw: 4, mottle: [cd, 4, 6] },
        );
    }
    if (o.kind === 'sack') {
      const lying = o.state === 'spilled';
      // prettier-ignore
      const body = lying ? [-w * 0.7, 0, -w * 0.75, -h * 0.4, -w * 0.2, -h * 0.55, w * 0.5, -h * 0.45, w * 0.6, -h * 0.1, w * 0.4, 0] : [-w / 2, 0, -w * 0.58, -h * 0.5, -w * 0.3, -h * 0.85, -w * 0.12, -h, w * 0.12, -h, w * 0.32, -h * 0.84, w * 0.58, -h * 0.45, w / 2, 0];
      blob(g, e, body, fill, {
        lw: 6,
        seed: o.seed,
        shade: [shade, -10, 6],
        hatch: { c: 'rgba(40,34,20,0.45)', n: 4, len: 30, gap: 7, k: 3, ang: 70 },
      });
      if (!lying)
        brushStroke(g, e, [-w * 0.16, -h * 0.86, 0, -h * 0.82, w * 0.16, -h * 0.86], {
          w: 6,
          color: C.RUST_D,
          seed: o.seed + 1,
          taper: false,
        });
      if (o.state === 'open')
        blob(g, e, ellipseRing(0, -h, w * 0.18, 10, 8), cf, {
          lw: 4,
          seed: o.seed + 2,
          mottle: [cd, 3, 4],
        });
    }
    if (o.kind === 'bale') {
      // prettier-ignore
      blob(g, e, [-w / 2, -h * 0.08, 0, 0, w / 2, -h * 0.08, w * 0.54, -h / 2, w / 2, -h * 0.92, 0, -h, -w / 2, -h * 0.92, -w * 0.54, -h / 2], fill, { lw: 6, seed: o.seed, shade: [shade, -12, 8], hatch: { c: 'rgba(70,52,20,0.55)', n: 7, len: 28, gap: 5, k: 3, ang: 0, bend: 0.08 } });
      for (const s of [-1, 1])
        blob(g, e, ellipseRing(s * w * 0.47, -h / 2, w * 0.08, h * 0.44, 10), shade, {
          lw: 5,
          seed: o.seed + 2 + s,
        });
      for (const u of [-0.24, 0, 0.24])
        brushStroke(g, e, [u * w - 4, -h, u * w + 3, -h / 2, u * w - 4, 0], {
          w: 7,
          color: '#4e3c22',
          seed: o.seed + 5,
          taper: false,
        });
    }
    if (o.kind === 'basket') {
      brushStroke(g, e, [-w * 0.4, -h, -w * 0.2, -h * 1.7, w * 0.2, -h * 1.7, w * 0.4, -h], {
        w: 8,
        color: shade,
        seed: o.seed + 1,
        taper: false,
      });
      // prettier-ignore
      blob(g, e, [-w / 2, -h, w / 2, -h, w * 0.4, 0, -w * 0.4, 0], fill, { sharp: true, lw: 6, seed: o.seed, shade: [shade, -8, 0], hatch: { c: 'rgba(60,40,14,0.6)', n: 6, len: 26, gap: 5, k: 3, ang: 45 } });
      if (open)
        blob(g, e, [-w * 0.46, -h, -w * 0.2, -h - 22, w * 0.22, -h - 24, w * 0.46, -h], cf, {
          lw: 4,
          seed: o.seed + 2,
          mottle: [cd, 3, 6],
        });
    }
    if (o.kind === 'jar') {
      // prettier-ignore
      blob(g, e, [-w * 0.2, 0, -w / 2, -h * 0.35, -w * 0.42, -h * 0.75, -w * 0.18, -h * 0.88, -w * 0.2, -h, w * 0.2, -h, w * 0.18, -h * 0.88, w * 0.42, -h * 0.75, w / 2, -h * 0.35, w * 0.2, 0], fill, { lw: 6, seed: o.seed, shade: [shade, -10, 6], light: ['rgba(220,150,110,0.25)', 6, -6] });
      blob(g, e, ellipseRing(0, -h, w * 0.2, 7, 8), open ? cf : C.INK, { lw: 4, seed: o.seed + 1 });
    }
    if (o.state === 'broken') {
      // prettier-ignore
      blob(g, e, [-w * 0.2, -h * 0.25, w * 0.1, -h * 0.4, w * 0.3, -h * 0.2, w * 0.05, -h * 0.05, -w * 0.25, -h * 0.08], '#1c1915', { sharp: true, lw: 4, seed: o.seed + 7 });
      for (let i = 0; i < 3; i += 1)
        brushStroke(
          g,
          e,
          [
            rnd(-0.2, 0.2, o.seed, i) * w,
            -h * 0.25,
            rnd(-0.4, 0.4, o.seed, i, 1) * w,
            -h * rnd(0.3, 0.6, o.seed, i, 2),
          ],
          { w: 3, seed: o.seed + 8 + i, taper: false },
        );
    }
    if (o.state === 'spilled') {
      // prettier-ignore
      blob(g, e, [w * 0.35, 0, w * 0.6, -h * 0.12, w * 1.0, -h * 0.08, w * 1.2, 0], cf, { lw: 4, seed: o.seed + 9, mottle: [cd, 5, 6] });
    }
    wearMarks(g, e, [-w / 2, -h, w / 2, 0], o.wear, o.seed + 20);
  });
  const k = o.size;
  return {
    box: [o.x - w * 0.6 * k, o.y - h * k, o.x + w * (o.state === 'spilled' ? 1.2 : 0.6) * k, o.y],
    points: {
      top: [o.x, o.y - h * k],
      gripL: [o.x - w * 0.5 * k, o.y - h * 0.5 * k],
      gripR: [o.x + w * 0.5 * k, o.y - h * 0.5 * k],
      centre: [o.x, o.y - h * 0.5 * k],
    },
    label: spot(o.x, o.y - h * 0.5 * k, 34 * k, w * 0.7 * k),
  };
}

// ---------- coins ----------

export const coinsSchema = z.strictObject({
  x: coord.default(960),
  y: coord.default(540),
  n: z.number().int().min(1).max(40).default(3),
  kind: z.enum(['round', 'oval', 'bar']).default('round'),
  spread: z.enum(['fan', 'stack', 'scatter']).default('fan'),
  size: sizeSchema,
  tone: toneSchema.default('brass'),
  seed: seedSchema.default(560),
});

export function drawCoins(g: Paint2D, e: BrushEnv, o: z.output<typeof coinsSchema>): Drawn {
  const [fill, shade] = toneOf(o.tone);
  const pts: [number, number][] = [];
  local(g, o.x, o.y, 0, o.size, () => {
    for (let i = 0; i < o.n; i += 1) {
      const cx =
        o.spread === 'stack'
          ? rnd(-3, 3, o.seed, i)
          : o.spread === 'fan'
            ? (i - (o.n - 1) / 2) * 12
            : rnd(-60, 60, o.seed, i);
      const cy =
        o.spread === 'stack' ? -i * 7 : o.spread === 'fan' ? -i * 4 : rnd(-20, 20, o.seed, i, 1);
      pts.push([cx, cy]);
      const opts = { lw: 4, seed: o.seed + i, shade: [shade, -3, 3] as const };
      if (o.kind === 'bar')
        rough(g, e, [cx - 22, cy - 6, cx + 22, cy - 6, cx + 26, cy + 8, cx - 26, cy + 8], fill, {
          ...opts,
          amp: 1,
        });
      else if (o.spread === 'stack') blob(g, e, ellipseRing(cx, cy, 18, 6, 10), fill, opts);
      else {
        const ring =
          o.kind === 'oval'
            ? ellipseRing(cx, cy, 13, 20, 10, (i - 1) * 0.2)
            : ellipseRing(cx, cy, 16, 16, 10);
        blob(g, e, ring, fill, {
          ...opts,
          inner: () => {
            brushStroke(g, e, [cx - 6, cy - 6, cx - 6, cy + 6], {
              w: 2,
              color: shade,
              seed: o.seed + 30,
              taper: false,
            });
          },
        });
      }
    }
  });
  const world = pts.map(([px, py]) => [o.x + px * o.size, o.y + py * o.size] as const);
  const [x0, y0, x1, y1] = boxOf(world);
  return {
    box: [x0 - 26 * o.size, y0 - 20 * o.size, x1 + 26 * o.size, y1 + 20 * o.size],
    points: { centre: [o.x, o.y], top: [o.x, y0] },
  };
}
