/**
 * Grim Ink props (PLAN.md#14.20): two minimal vehicles — a cart (handcart, wagon, wheelbarrow;
 * wheels roll with distance, a load, a wheel off) and a boat (rowboat, raft, barge rocking on
 * twos, sinking). New in the kit (the films had none); docs in props.ts.
 */
import { z } from 'zod';
import { C, hash, rnd, twos } from '../core.js';
import { brushStroke, type BrushEnv } from '../draw/brushes.js';
import type { Paint2D } from '../draw/paint.js';
import { rect, rough } from '../draw/scenery.js';
import { blob, ellipseRing, tube } from '../draw/shapes.js';
import {
  coord,
  local,
  place,
  seedSchema,
  sizeSchema,
  timeSchema,
  toneOf,
  toneSchema,
  wearMarks,
  wearSchema,
  type Drawn,
} from './common.js';

// ---------- vehicles ----------

export const cartSchema = z.strictObject({
  x: coord.default(960),
  y: coord.default(900),
  kind: z.enum(['handcart', 'wagon', 'barrow']).default('handcart'),
  size: sizeSchema,
  roll: z.number().min(-1e5).max(1e5).default(0),
  load: toneSchema.optional(),
  state: z.enum(['whole', 'broken']).default('whole'),
  tone: toneSchema.default('paleWood'),
  wear: wearSchema,
  seed: seedSchema.default(740),
});

function wheel(
  g: Paint2D,
  e: BrushEnv,
  x: number,
  y: number,
  r: number,
  spin: number,
  seed: number,
): void {
  blob(g, e, ellipseRing(x, y, r, r, 14), 'rgba(0,0,0,0)', { lw: 12, lineColor: '#2a2622', seed });
  for (let i = 0; i < 4; i += 1) {
    const a = spin + (i * Math.PI) / 4;
    brushStroke(
      g,
      e,
      [x - Math.cos(a) * r, y - Math.sin(a) * r, x + Math.cos(a) * r, y + Math.sin(a) * r],
      { w: 6, color: '#3d2e22', seed: seed + i, taper: false },
    );
  }
  blob(g, e, ellipseRing(x, y, r * 0.18, r * 0.18, 8), C.BLACK, { lw: 3, seed: seed + 5 });
}

export function drawCart(g: Paint2D, e: BrushEnv, o: z.output<typeof cartSchema>): Drawn {
  const [fill, shade] = toneOf(o.tone);
  const r = o.kind === 'wagon' ? 90 : 70;
  const w = o.kind === 'wagon' ? 520 : o.kind === 'barrow' ? 240 : 360;
  const bedY = -r - 40;
  local(g, o.x, o.y, o.state === 'broken' ? -8 : 0, o.size, () => {
    const spin = o.roll / r;
    const wheels =
      o.kind === 'barrow' ? [w * 0.35] : o.kind === 'wagon' ? [-w * 0.32, w * 0.32] : [0];
    const handleX = o.kind === 'barrow' ? -w * 0.5 : w * 0.5;
    brushStroke(
      g,
      e,
      [
        o.kind === 'barrow' ? w * 0.2 : 0,
        bedY + 20,
        handleX * 1.4,
        bedY + (o.kind === 'barrow' ? 40 : -30),
      ],
      { w: 12, color: shade, seed: o.seed, taper: false },
    );
    if (o.load) {
      const [lf, ld] = toneOf(o.load);
      blob(
        g,
        e,
        [
          -w * 0.42,
          bedY - 40,
          -w * 0.2,
          bedY - 110,
          w * 0.15,
          bedY - 120,
          w * 0.42,
          bedY - 50,
          w * 0.4,
          bedY,
        ],
        lf,
        { lw: 5, seed: o.seed + 1, shade: [ld, -8, 6], mottle: [ld, 5, 10] },
      );
    }
    rough(
      g,
      e,
      [-w / 2, bedY - 50, w / 2, bedY - 50, w / 2 - 20, bedY + 30, -w / 2 + 20, bedY + 30],
      fill,
      {
        seed: o.seed + 2,
        lw: 6,
        shade: [shade, -10, 0],
        hatch: { c: 'rgba(14,10,6,0.45)', n: 3, len: w * 0.3, gap: 8, k: 2, ang: 0, bend: 0 },
      },
    );
    wheels.forEach((wx, i) => {
      if (o.state === 'broken' && i === wheels.length - 1)
        wheel(g, e, wx + r * 1.6, -r * 0.3, r, 1.2, o.seed + 10 + i);
      else wheel(g, e, wx, -r, r, spin, o.seed + 10 + i);
    });
    wearMarks(g, e, [-w / 2, bedY - 50, w / 2, bedY + 30], o.wear, o.seed + 20);
  });
  const k = o.size;
  const handleX = o.kind === 'barrow' ? -w * 0.7 : w * 0.7;
  return {
    box: [o.x - (w * 0.7 + r) * k, o.y + (bedY - 130) * k, o.x + (w * 0.7 + r) * k, o.y],
    points: {
      handle: [o.x + handleX * k, o.y + (bedY + (o.kind === 'barrow' ? 40 : -30)) * k],
      bed: [o.x, o.y + (bedY - 50) * k],
    },
  };
}

export const boatSchema = z.strictObject({
  x: coord.default(960),
  y: coord.default(800),
  kind: z.enum(['rowboat', 'raft', 'barge']).default('rowboat'),
  size: sizeSchema,
  t: timeSchema,
  rock: z.number().min(0).max(30).default(3),
  state: z.enum(['whole', 'sinking']).default('whole'),
  water: z.boolean().default(true),
  tone: toneSchema.default('wood'),
  wear: wearSchema,
  seed: seedSchema.default(760),
});

export function drawBoat(g: Paint2D, e: BrushEnv, o: z.output<typeof boatSchema>): Drawn {
  const [fill, shade] = toneOf(o.tone);
  const w = o.kind === 'barge' ? 700 : o.kind === 'raft' ? 380 : 440;
  const tt = twos(o.t);
  const tilt = Math.sin(tt * 2.4 + o.seed) * o.rock + (o.state === 'sinking' ? 14 : 0);
  const sink = o.state === 'sinking' ? 40 : 0;
  local(g, o.x, o.y + sink, tilt, o.size, () => {
    if (o.kind === 'raft') {
      for (let i = 0; i < 6; i += 1)
        tube(
          g,
          e,
          [-w / 2, -20 + i * 6 - 30, w / 2, -18 + i * 6 - 30],
          [26, 26],
          i % 2 ? fill : shade,
          { lw: 5, seed: o.seed + i },
        );
    } else {
      const deep = o.kind === 'barge' ? 110 : 80;
      // prettier-ignore
      blob(g, e, [-w / 2, -deep, -w * 0.36, 10, w * 0.36, 10, w / 2, -deep, w * 0.3, -deep + 18, -w * 0.3, -deep + 18], fill, { sharp: true, lw: 7, seed: o.seed, shade: [shade, 0, 10], hatch: { c: 'rgba(14,10,6,0.45)', n: 4, len: w * 0.25, gap: 8, k: 2, ang: 0, bend: 0.04 } });
      brushStroke(g, e, [-w * 0.45, -deep * 0.55, 0, -deep * 0.3, w * 0.45, -deep * 0.55], {
        w: 4,
        color: shade,
        seed: o.seed + 1,
        taper: false,
      });
      if (o.kind === 'rowboat')
        rect(g, e, -w * 0.1, -deep + 4, w * 0.2, 16, shade, { seed: o.seed + 2, lw: 4 });
    }
    wearMarks(g, e, [-w * 0.4, -60, w * 0.4, 0], o.wear, o.seed + 20);
  });
  if (o.water) {
    for (let i = 0; i < 5; i += 1) {
      const wx = o.x + (i - 2) * w * 0.3 * o.size + rnd(-20, 20, o.seed, i);
      const wy = o.y + 8 + hash(o.seed, i, 1) * 20;
      brushStroke(g, e, [wx - 40, wy, wx, wy - 6 + Math.sin(tt * 3 + i) * 3, wx + 40, wy], {
        w: 4,
        color: 'rgba(200,205,190,0.6)',
        seed: o.seed + 30 + i,
        taper: false,
      });
    }
  }
  const k = o.size;
  return {
    box: [o.x - (w / 2 + 40) * k, o.y - 140 * k, o.x + (w / 2 + 40) * k, o.y + 40 * k],
    points: {
      bow: place(o.x, o.y + sink, tilt, (w / 2) * k, -90 * k),
      stern: place(o.x, o.y + sink, tilt, (-w / 2) * k, -90 * k),
      seat: place(o.x, o.y + sink, tilt, 0, -70 * k),
    },
  };
}
