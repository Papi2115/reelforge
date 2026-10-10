/**
 * Grim Ink instruments (PLAN.md#14.20), part 3: displays — a small screen (bars, plot, scope,
 * radar), a flip board with up / down arrows and a bead counter. Ported from
 * `03-apollo-11/js/sets/sets-c.js` (console screens), `01-samurai-edo/js/sets/sets-c.js` (price
 * board) and `props.js` (abacus); registry and docs in instruments.ts.
 */
import { z } from 'zod';
import { C, hash, rnd, twos } from '../core.js';
import { brushStroke, type BrushEnv } from '../draw/brushes.js';
import type { Paint2D } from '../draw/paint.js';
import { rect } from '../draw/scenery.js';
import { blob, ellipseRing } from '../draw/shapes.js';
import {
  coord,
  local,
  seedSchema,
  timeSchema,
  toneOf,
  toneSchema,
  unit,
  type Drawn,
  spot,
} from './common.js';

export const screenSchema = z.strictObject({
  x: coord.default(800),
  y: coord.default(300),
  w: z.number().min(20).max(3000).default(240),
  h: z.number().min(20).max(3000).default(160),
  kind: z.enum(['bars', 'plot', 'radar', 'scope', 'blank']).default('bars'),
  value: unit.default(0.5),
  t: timeSchema,
  seed: seedSchema.default(880),
});

export function drawScreen(g: Paint2D, e: BrushEnv, o: z.output<typeof screenSchema>): Drawn {
  const { x, y, w, h } = o;
  const ink = 'rgba(150,180,120,0.75)';
  rect(g, e, x - 10, y - 10, w + 20, h + 20, C.BLACK, { seed: o.seed, lw: 6 });
  rect(g, e, x, y, w, h, '#1c2420', { seed: o.seed + 1, lw: 3 });
  g.save();
  g.beginPath();
  g.rect(x, y, w, h);
  g.clip();
  const tt = twos(o.t);
  if (o.kind === 'bars') {
    g.fillStyle = ink;
    for (let r = 0; r < 5; r += 1)
      g.fillRect(
        x + 10,
        y + 14 + r * (h / 5.5),
        (w - 20) * Math.min(1, rnd(0.2, 0.9, o.seed, r) * (r === 0 ? o.value / 0.55 : 1)),
        5,
      );
  }
  if (o.kind === 'plot' || o.kind === 'scope') {
    const pts: number[] = [];
    for (let i = 0; i <= 16; i += 1) {
      const u = i / 16;
      const v =
        o.kind === 'scope'
          ? 0.5 + 0.35 * Math.sin(u * 12 + tt * 6) * o.value
          : 1 - (u * o.value + 0.3 * hash(o.seed, i) * 0.4);
      pts.push(x + u * w, y + h * Math.min(0.95, Math.max(0.05, v)));
    }
    brushStroke(g, e, pts, { w: 4, color: '#c6b56c', seed: o.seed + 2, taper: false });
  }
  if (o.kind === 'radar') {
    const cx = x + w / 2;
    const cy = y + h / 2;
    const rr = Math.min(w, h) * 0.45;
    for (const k of [0.33, 0.66, 1])
      blob(g, e, ellipseRing(cx, cy, rr * k, rr * k, 16), 'rgba(0,0,0,0)', {
        lw: 2,
        lineColor: ink,
        seed: o.seed + 3,
      });
    const a = tt * 2.4;
    brushStroke(g, e, [cx, cy, cx + Math.cos(a) * rr, cy + Math.sin(a) * rr], {
      w: 3,
      color: '#c6b56c',
      seed: o.seed + 4,
      taper: false,
    });
    blob(g, e, ellipseRing(cx + rr * 0.5 * o.value, cy - rr * 0.3, 6, 6, 6), '#c6b56c', {
      lw: 0,
      seed: o.seed + 5,
    });
  }
  g.restore();
  return {
    box: [x - 10, y - 10, x + w + 10, y + h + 10],
    points: { centre: [x + w / 2, y + h / 2] },
    label: spot(x + w / 2, y + h / 2, h * 0.3, w * 0.8),
  };
}

export const flipSchema = z.strictObject({
  x: coord.default(960),
  y: coord.default(400),
  w: z.number().min(40).max(2000).default(260),
  h: z.number().min(40).max(2000).default(180),
  side: z.enum(['up', 'down', 'blank']).default('up'),
  flip: unit.default(0),
  tone: toneSchema.default('wood'),
  seed: seedSchema.default(890),
});

export function drawFlipBoard(g: Paint2D, e: BrushEnv, o: z.output<typeof flipSchema>): Drawn {
  const [fill, shade] = toneOf(o.tone);
  const { x, y, w, h } = o;
  rect(g, e, x - w * 0.73, y - h * 0.95, w * 1.46, h * 1.85, fill, {
    seed: o.seed,
    lw: 7,
    hatch: { c: 'rgba(14,10,6,0.4)', n: 4, len: 60, gap: 8, k: 2, ang: 90, bend: 0 },
  });
  rect(g, e, x - w * 0.65, y - h * 0.86, w * 1.3, h * 0.44, toneOf('paper')[0], {
    seed: o.seed + 1,
    lw: 5,
  });
  const k = Math.abs(Math.cos(o.flip * Math.PI));
  const ph = h * Math.max(0.08, k);
  rect(g, e, x - w / 2, y + h * 0.3 - ph / 2, w, ph, toneOf('paper')[0], {
    seed: o.seed + 4,
    lw: 5,
    shade: [shade, 0, 4],
  });
  if (k > 0.3 && o.side !== 'blank') {
    const d = o.side === 'up' ? -1 : 1;
    const cy = y + h * 0.3;
    const hh = (ph / 2) * 0.7;
    // prettier-ignore
    blob(g, e, [x - w * 0.27, cy - d * hh * 0.1, x, cy + d * hh, x + w * 0.27, cy - d * hh * 0.1, x + w * 0.12, cy - d * hh * 0.1, x + w * 0.12, cy - d * hh, x - w * 0.12, cy - d * hh, x - w * 0.12, cy - d * hh * 0.1], o.side === 'up' ? C.OLIVE : C.RUST, { sharp: true, lw: 5, seed: o.seed + 5 });
  }
  return {
    box: [x - w * 0.73, y - h * 0.95, x + w * 0.73, y + h * 0.9],
    points: { panel: [x, y + h * 0.3] },
    label: spot(x, y - h * 0.64, h * 0.3, w * 1.2),
  };
}

export const counterSchema = z.strictObject({
  x: coord.default(960),
  y: coord.default(540),
  w: z.number().min(40).max(2000).default(220),
  rods: z.number().int().min(2).max(20).default(7),
  tick: z.number().int().min(0).max(1e6).default(0),
  rot: z.number().min(-180).max(180).default(0),
  seed: seedSchema.default(900),
});

export function drawCounter(g: Paint2D, e: BrushEnv, o: z.output<typeof counterSchema>): Drawn {
  const w = o.w;
  const h = w * 0.36;
  local(g, o.x, o.y, o.rot, 1, () => {
    rect(g, e, -w / 2, -h / 2, w, h, '#2e241b', { seed: o.seed, lw: 5, amp: 1 });
    rect(g, e, -w / 2 + 8, -h / 2 + 8, w - 16, h - 16, '#6b5a40', {
      seed: o.seed + 1,
      lw: 2,
      amp: 0.5,
    });
    brushStroke(g, e, [-w / 2 + 8, -h * 0.18, w / 2 - 8, -h * 0.18], {
      w: 5,
      color: '#2e241b',
      seed: o.seed + 2,
      taper: false,
    });
    for (let r = 0; r < o.rods; r += 1) {
      const rx = -w / 2 + 16 + ((w - 32) * (r + 0.5)) / o.rods;
      const up = hash(o.seed, r, o.tick) < 0.5;
      [-h * 0.32 + (up ? 0 : 6), -h * 0.02 + (up ? 0 : 10), h * 0.14, h * 0.28].forEach((by, b) =>
        blob(g, e, ellipseRing(rx, by, 7, 5, 6), b === 0 ? '#3b2c1f' : '#5a4430', {
          lw: 2.5,
          seed: o.seed + 10 + r * 4 + b,
        }),
      );
    }
  });
  return {
    box: [o.x - w / 2 - 10, o.y - h / 2 - 10, o.x + w / 2 + 10, o.y + h / 2 + 10],
    points: { centre: [o.x, o.y] },
  };
}
