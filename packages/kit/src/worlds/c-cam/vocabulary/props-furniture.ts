/**
 * Grim Ink props (PLAN.md#14.20): furniture — tables and desks (plank, long with a cloth, low,
 * desk with drawers, counter, trestle; broken drops one end) and seats (stool, bench, chair,
 * high-backed chair, cushion). Ported from `01-samurai-edo/js/edo.js` (lowDesk) and
 * `02-papal-conclave/js/sets/sets-b.js` (hallTable, chair); docs in props.ts.
 */
import { z } from 'zod';
import { C, rnd } from '../core.js';
import { brushStroke, type BrushEnv } from '../draw/brushes.js';
import type { Paint2D } from '../draw/paint.js';
import { rect, rough } from '../draw/scenery.js';
import { blob, ellipseRing } from '../draw/shapes.js';
import {
  coord,
  local,
  seedSchema,
  sizeSchema,
  toneOf,
  toneSchema,
  wearMarks,
  wearSchema,
  type Drawn,
} from './common.js';

// ---------- table ----------

export const tableSchema = z.strictObject({
  x: coord.default(960),
  y: coord.default(900),
  w: z.number().min(60).max(4000).default(460),
  h: z.number().min(30).max(800).default(170),
  kind: z.enum(['plank', 'long', 'low', 'desk', 'counter', 'trestle']).default('plank'),
  cloth: z.boolean().default(false),
  state: z.enum(['whole', 'broken']).default('whole'),
  tone: toneSchema.default('wood'),
  wear: wearSchema,
  seed: seedSchema.default(460),
});

export function drawTable(g: Paint2D, e: BrushEnv, o: z.output<typeof tableSchema>): Drawn {
  const { x, y, w, h } = o;
  const [fill, shade] = toneOf(o.tone);
  const x0 = x - w / 2;
  const x1 = x + w / 2;
  const top = y - h;
  const d = Math.max(16, h * 0.16);
  const drop = o.state === 'broken' ? h * 0.35 : 0;
  const legs = (): void => {
    const legW = Math.max(14, w * 0.05);
    if (o.kind === 'trestle') {
      [x0 + w * 0.15, x1 - w * 0.15].forEach((lx, i) => {
        brushStroke(g, e, [lx - h * 0.35, y, lx + h * 0.35, top + d], {
          w: legW * 0.7,
          color: shade,
          seed: o.seed + 10 + i,
          taper: false,
        });
        brushStroke(g, e, [lx + h * 0.35, y, lx - h * 0.35, top + d], {
          w: legW * 0.7,
          color: shade,
          seed: o.seed + 12 + i,
          taper: false,
        });
      });
      return;
    }
    [x0 + 24, x1 - 24].forEach((lx, i) => {
      const bottom = i === 1 ? y - drop * 0.9 : y;
      rect(g, e, lx - legW / 2, top + d, legW, bottom - top - d, shade, {
        seed: o.seed + 10 + i,
        lw: 5,
      });
    });
  };
  const front = o.kind === 'low' || o.kind === 'desk' || o.kind === 'counter';
  if (!front && !o.cloth) legs();
  // the top, seen a little from above (tilted down at the right when a leg broke)
  // prettier-ignore
  rough(g, e, [x0 + 20, top, x1 - 20, top + drop, x1, top + d + drop, x0, top + d], fill, { seed: o.seed, lw: 6, light: ['rgba(255,240,200,0.12)', 0, -6], hatch: { c: 'rgba(15,8,2,0.45)', n: Math.max(2, Math.round(w / 220)), len: Math.min(120, w * 0.3), gap: 7, k: 2, ang: 0, bend: 0 } });
  if (front) {
    const fh = o.kind === 'counter' ? h - d : (h - d) * 0.8;
    rough(
      g,
      e,
      [x0 + 10, top + d, x1 - 10, top + d + drop, x1 - 12, top + d + fh, x0 + 12, top + d + fh],
      shade,
      {
        seed: o.seed + 1,
        lw: 6,
        hatch: {
          c: 'rgba(10,6,2,0.5)',
          n: Math.max(2, Math.round(w / 150)),
          len: fh * 0.5,
          gap: 8,
          k: 2,
          ang: o.kind === 'counter' ? 90 : 0,
          bend: 0.02,
        },
      },
    );
    if (o.kind === 'desk') {
      for (const u of [0.25, 0.75]) {
        rect(g, e, x0 + w * u - w * 0.14, top + d + fh * 0.2, w * 0.28, fh * 0.32, fill, {
          seed: o.seed + 2,
          lw: 4,
        });
        blob(g, e, ellipseRing(x0 + w * u, top + d + fh * 0.36, 6, 6, 6), C.BLACK, {
          lw: 2,
          seed: o.seed + 3,
        });
      }
    }
    if (o.kind === 'low') legs();
  }
  if (o.cloth) {
    const cloth = [x0 - 6, top + d - 4, x1 + 6, top + d - 4 + drop, x1 + 12, top + d + h * 0.6];
    for (let i = 12; i >= 0; i -= 1)
      cloth.push(
        x0 + (w * i) / 12 + 6,
        top + d + h * 0.6 + (i % 2 ? 14 : 0) + rnd(-4, 4, o.seed, i),
      );
    cloth.push(x0 - 12, top + d + h * 0.6);
    blob(g, e, cloth, C.LINEN_D, {
      sharp: true,
      lw: 6,
      seed: o.seed + 4,
      shade: ['#6c6450', -20, 6],
      mottle: ['rgba(90,70,40,0.35)', 6, 24],
      hatch: {
        c: 'rgba(40,34,20,0.45)',
        n: Math.max(3, Math.round(w / 180)),
        len: h * 0.35,
        gap: 8,
        k: 3,
        ang: 88,
        bend: 0.05,
      },
    });
    rough(
      g,
      e,
      [x0 + 4, top + d + h * 0.6, x1 - 4, top + d + h * 0.6, x1 - 10, y, x0 + 10, y],
      shade,
      { seed: o.seed + 5, lw: 6 },
    );
  }
  wearMarks(g, e, [x0, top, x1, top + d], o.wear, o.seed + 20);
  return {
    box: [x0, top, x1, y],
    points: {
      top: [x, top + d * 0.4],
      left: [x0 + 40, top + d * 0.4],
      right: [x1 - 40, top + d * 0.4 + drop],
    },
  };
}

// ---------- seat ----------

export const seatSchema = z.strictObject({
  x: coord.default(960),
  y: coord.default(900),
  kind: z.enum(['stool', 'bench', 'chair', 'highBack', 'cushion']).default('chair'),
  w: z.number().min(30).max(3000).default(150),
  size: sizeSchema,
  state: z.enum(['whole', 'broken']).default('whole'),
  tone: toneSchema.default('wood'),
  wear: wearSchema,
  seed: seedSchema.default(480),
});

export function drawSeat(g: Paint2D, e: BrushEnv, o: z.output<typeof seatSchema>): Drawn {
  const k = o.size;
  const [fill, shade] = toneOf(o.tone);
  const hw = o.w / 2;
  const seatY = o.kind === 'cushion' ? -40 : -200;
  local(g, o.x, o.y, 0, k, () => {
    if (o.kind === 'cushion') {
      blob(g, e, ellipseRing(0, -20, hw, 26, 12), fill, {
        lw: 6,
        seed: o.seed,
        shade: [shade, 0, 8],
        hatch: { c: 'rgba(20,12,6,0.4)', n: 3, len: 30, gap: 6, k: 3, ang: 0 },
      });
      return;
    }
    if (o.kind === 'chair' || o.kind === 'highBack') {
      const backTop = o.kind === 'highBack' ? -660 : -440;
      // prettier-ignore
      rough(g, e, [-hw * 0.9, seatY, -hw * 0.8, backTop + 40, -hw * 0.4, backTop, hw * 0.4, backTop, hw * 0.8, backTop + 40, hw * 0.9, seatY], fill, { seed: o.seed, lw: 6, shade: [shade, -14, 0], hatch: { c: 'rgba(15,8,2,0.5)', n: 4, len: 70, gap: 8, k: 2, ang: 88, bend: 0 } });
      brushStroke(g, e, [-hw * 0.6, backTop + 60, 0, backTop + 30, hw * 0.6, backTop + 60], {
        w: 5,
        seed: o.seed + 1,
        taper: false,
      });
    }
    const legs = o.kind === 'bench' ? [-hw + 20, hw - 20] : [-hw * 0.75, hw * 0.75];
    legs.forEach((lx, i) => {
      const broken = o.state === 'broken' && i === 1;
      rect(g, e, lx - 9, seatY, 18, broken ? -seatY * 0.55 : -seatY, shade, {
        seed: o.seed + 2 + i,
        lw: 5,
      });
    });
    rough(g, e, [-hw, seatY - 18, hw, seatY - 18, hw + 6, seatY + 10, -hw - 6, seatY + 10], fill, {
      seed: o.seed + 4,
      lw: 6,
      light: ['rgba(255,240,200,0.12)', 0, -4],
    });
    wearMarks(g, e, [-hw, seatY - 18, hw, seatY + 10], 0.4 * (o.wear + 0.2), o.seed + 10);
  });
  const backTop = o.kind === 'highBack' ? -660 : o.kind === 'chair' ? -440 : seatY;
  return {
    box: [o.x - (hw + 6) * k, o.y + backTop * k, o.x + (hw + 6) * k, o.y],
    points: { seat: [o.x, o.y + (seatY - 18) * k], back: [o.x, o.y + backTop * k] },
  };
}
