/**
 * Grim Ink props (PLAN.md#14.20), part 4: small things on a table or in a hand — writing tools,
 * cups / bottles / jugs / bowls / plates, food. Ported from `02-papal-conclave/js/cast/baker.js`
 * (loaf, jug), `sets-b.js` (the goblet), `cast/stubborn.js` (the stylus), `03-apollo-11/js/props.js`
 * (mug steam, the sandwich's bite) and generalised by `kind` / `state`. Steam curls on twos.
 */
import { z } from 'zod';
import { C, rnd, twos } from '../core.js';
import { brushStroke, type BrushEnv } from '../draw/brushes.js';
import type { Paint2D } from '../draw/paint.js';
import { rough } from '../draw/scenery.js';
import { blob, ellipseRing, tube } from '../draw/shapes.js';
import {
  coord,
  local,
  place,
  rotSchema,
  seedSchema,
  sizeSchema,
  timeSchema,
  toneOf,
  toneSchema,
  unit,
  type Drawn,
} from './common.js';

// ---------- pen ----------

const penSchema = z.strictObject({
  x: coord.default(960),
  y: coord.default(540),
  kind: z.enum(['quill', 'brush', 'stylus', 'pencil', 'pen', 'chalk']).default('pencil'),
  rot: rotSchema,
  size: sizeSchema,
  seed: seedSchema.default(600),
});

/** Local frame: grip at (0, 0), tip at (0, 40), tail toward -y; rot 0 = tip straight down. */
function drawPen(g: Paint2D, e: BrushEnv, o: z.output<typeof penSchema>): Drawn {
  local(g, o.x, o.y, o.rot, o.size, () => {
    if (o.kind === 'quill') {
      tube(g, e, [0, 40, 0, -60], [5, 7], C.LINEN_D, { lw: 3, seed: o.seed });
      // prettier-ignore
      blob(g, e, [0, -10, -16, -40, -14, -90, -4, -120, 6, -80, 6, -20], C.LINEN, { lw: 4, seed: o.seed + 1, hatch: { c: 'rgba(40,34,20,0.5)', n: 3, len: 14, gap: 4, k: 3, ang: 60 } });
    } else if (o.kind === 'brush') {
      tube(g, e, [0, 20, 0, -80], [9, 9], C.TIMBER, { lw: 4, seed: o.seed });
      blob(g, e, [-5, 18, 5, 18, 2, 46, 0, 50, -2, 46], C.INK, { lw: 3, seed: o.seed + 1 });
    } else if (o.kind === 'chalk') {
      rough(g, e, [-7, -20, 7, -20, 6, 30, -6, 30], C.LINEN, { seed: o.seed, lw: 4, amp: 1 });
    } else {
      const col = o.kind === 'pencil' ? C.MUSTARD : o.kind === 'stylus' ? C.TIMBER : C.BLACK;
      tube(g, e, [0, 30, 0, -70], [o.kind === 'stylus' ? 8 : 10, 10], col, { lw: 4, seed: o.seed });
      blob(g, e, [-5, 28, 5, 28, 0, 44], o.kind === 'pencil' ? '#c2b48a' : C.STONE, {
        sharp: true,
        lw: 3,
        seed: o.seed + 1,
      });
      if (o.kind === 'pen')
        brushStroke(g, e, [5, -60, 6, -30], {
          w: 3,
          color: C.STONE,
          seed: o.seed + 2,
          taper: false,
        });
    }
  });
  const tip = place(o.x, o.y, o.rot, 0, 44 * o.size);
  const tail = place(o.x, o.y, o.rot, 0, -90 * o.size);
  return {
    box: [
      Math.min(tip[0], tail[0]) - 16,
      Math.min(tip[1], tail[1]) - 16,
      Math.max(tip[0], tail[0]) + 16,
      Math.max(tip[1], tail[1]) + 16,
    ],
    points: { grip: [o.x, o.y], tip, tail },
  };
}

// ---------- vessel ----------

const vesselSchema = z.strictObject({
  x: coord.default(960),
  y: coord.default(600),
  kind: z.enum(['cup', 'mug', 'goblet', 'bottle', 'jug', 'bowl', 'plate', 'pot']).default('cup'),
  size: sizeSchema,
  tilt: rotSchema,
  level: unit.default(0.7),
  drink: toneSchema.default('BROWN'),
  state: z.enum(['whole', 'broken']).default('whole'),
  steam: z.boolean().default(false),
  t: timeSchema,
  tone: toneSchema.optional(),
  seed: seedSchema.default(620),
});

const VESSEL_TONE = {
  cup: 'clay',
  mug: 'MUSTARD',
  goblet: 'brass',
  bottle: 'glass',
  jug: 'stone',
  bowl: 'wood',
  plate: 'cloth',
  pot: 'iron',
} as const;

/** Body outline (local: bottom centre at 0, 0) and mouth height of each vessel. */
const VESSELS: Readonly<
  Record<keyof typeof VESSEL_TONE, readonly [readonly number[], number, number]>
> = {
  // prettier-ignore
  cup: [[-26, -60, 26, -60, 22, 0, -22, 0], 60, 26],
  // prettier-ignore
  mug: [[-30, -74, 32, -74, 30, 0, -28, 0], 74, 31],
  // prettier-ignore
  goblet: [[-40, -110, 40, -110, 30, -70, 8, -56, 10, -42, 30, -34, -30, -34, -10, -42, -8, -56, -30, -70], 110, 40],
  // prettier-ignore
  bottle: [[-10, -150, 10, -150, 12, -110, 30, -84, 30, 0, -30, 0, -30, -84, -12, -110], 150, 10],
  // prettier-ignore
  jug: [[-20, -100, 20, -100, 22, -84, 40, -50, 36, 0, -36, 0, -40, -50, -22, -84], 100, 20],
  // prettier-ignore
  bowl: [[-60, -46, 60, -46, 40, -8, 20, 0, -20, 0, -40, -8], 46, 60],
  // prettier-ignore
  plate: [[-80, -14, 80, -14, 66, 0, -66, 0], 14, 80],
  // prettier-ignore
  pot: [[-56, -80, 56, -80, 60, -40, 48, 0, -48, 0, -60, -40], 80, 56],
};

function drawVessel(g: Paint2D, e: BrushEnv, o: z.output<typeof vesselSchema>): Drawn {
  const [fill, shade] = toneOf(o.tone ?? VESSEL_TONE[o.kind]);
  const [drink, drinkD] = toneOf(o.drink);
  const [body, mouthH, mouthR] = VESSELS[o.kind];
  local(g, o.x, o.y, o.tilt, o.size, () => {
    if (o.kind === 'mug' || o.kind === 'jug' || o.kind === 'cup') {
      const hx = o.kind === 'jug' ? 38 : 28;
      tube(
        g,
        e,
        [hx, -mouthH * 0.8, hx + 22, -mouthH * 0.55, hx, -mouthH * 0.25],
        [11, 11, 11],
        shade,
        { lw: 5, seed: o.seed + 1 },
      );
    }
    const broken =
      o.state === 'broken'
        ? [mouthR * 0.6, -mouthH, mouthR * 0.3, -mouthH * 0.7, -mouthR * 0.1, -mouthH]
        : [];
    const outline =
      o.state === 'broken' ? [...body.slice(0, 2), ...broken, ...body.slice(2)] : [...body];
    blob(g, e, outline, fill, {
      sharp: o.kind !== 'bowl' && o.kind !== 'pot',
      lw: 6,
      seed: o.seed,
      shade: [shade, -8, 4],
      light: ['rgba(240,230,200,0.18)', 5, -5],
      ...(o.kind === 'bottle' ? { patch: ['rgba(200,210,190,0.25)', -8, -10, 0.3] as const } : {}),
    });
    if (o.kind === 'plate') return;
    const liquid = o.level > 0.05 && o.kind !== 'bottle';
    blob(
      g,
      e,
      ellipseRing(0, -mouthH, mouthR, Math.max(4, mouthR * 0.24), 10),
      liquid ? drink : '#2e2014',
      { lw: 4, seed: o.seed + 2, ...(liquid ? { shade: [drinkD, 0, 3] as const } : {}) },
    );
  });
  const mouth = place(o.x, o.y, o.tilt, 0, -mouthH * o.size);
  if (o.steam) {
    const w = Math.floor(twos(o.t) * 3) % 3;
    for (const i of [0, 1]) {
      // prettier-ignore
      brushStroke(g, e, [mouth[0] - 8 + i * 16, mouth[1] - 14, mouth[0] + 4 + i * 16 + w * 6, mouth[1] - 46, mouth[0] - 6 + i * 16, mouth[1] - 80], { w: 3, color: 'rgba(200,195,170,0.6)', seed: o.seed + 3 + i + w });
    }
  }
  const half = Math.max(mouthR, 60) * o.size;
  return {
    box: [
      o.x - half - 30 * o.size,
      o.y - mouthH * o.size - (o.steam ? 90 : 10),
      o.x + half + 30 * o.size,
      o.y + 10,
    ],
    points: { mouth, grip: place(o.x, o.y, o.tilt, 0, -mouthH * 0.5 * o.size), bottom: [o.x, o.y] },
  };
}

// ---------- food ----------

const foodSchema = z.strictObject({
  x: coord.default(960),
  y: coord.default(600),
  kind: z.enum(['loaf', 'fruit', 'fish', 'meat', 'cheese', 'pie', 'pile']).default('loaf'),
  state: z.enum(['whole', 'bitten', 'rotten']).default('whole'),
  size: sizeSchema,
  rot: rotSchema,
  tone: toneSchema.optional(),
  seed: seedSchema.default(640),
});

const FOOD_TONE = {
  loaf: 'BROWN',
  fruit: 'RED',
  fish: 'STONE',
  meat: 'CLAY',
  cheese: 'MUSTARD',
  pie: 'MUSTARD',
  pile: 'straw',
} as const;

function drawFood(g: Paint2D, e: BrushEnv, o: z.output<typeof foodSchema>): Drawn {
  const [fill, shade] = toneOf(o.tone ?? FOOD_TONE[o.kind]);
  const bite = o.state === 'bitten';
  local(g, o.x, o.y, o.rot, o.size, () => {
    const opts = {
      lw: 6,
      seed: o.seed,
      shade: [shade, -8, 8] as const,
      light: ['rgba(240,220,170,0.25)', 6, -8] as const,
    };
    if (o.kind === 'loaf' || o.kind === 'fruit') {
      const [rx, ry] = o.kind === 'loaf' ? [56, 36] : [26, 24];
      const ring = ellipseRing(0, 0, rx, ry, 10);
      if (bite) ring.splice(0, 2, rx * 0.6, -ry * 0.1, rx * 0.75, ry * 0.25);
      blob(g, e, ring, fill, { ...opts, mottle: ['rgba(220,200,150,0.3)', 4, 8] });
      if (o.kind === 'loaf')
        for (const dx of [-18, 6, 28])
          brushStroke(g, e, [dx - 12, -22, dx + 2, -10, dx + 8, 2], { w: 3.5, seed: o.seed + 1 });
      else
        brushStroke(g, e, [0, -ry, 3, -ry - 14], {
          w: 4,
          color: C.TIMBER,
          seed: o.seed + 2,
          taper: false,
        });
    }
    if (o.kind === 'fish') {
      // prettier-ignore
      blob(g, e, [-70, 0, -40, -22, 20, -20, 50, 0, 20, 18, -40, 20], fill, { ...opts, hatch: { c: 'rgba(30,30,24,0.4)', n: 3, len: 18, gap: 5, k: 3, ang: 60 } });
      blob(g, e, [50, 0, 78, -22, 72, 0, 78, 22], fill, { sharp: true, lw: 5, seed: o.seed + 1 });
      blob(g, e, ellipseRing(-48, -4, 4, 4, 6), C.INK, { lw: 0, seed: o.seed + 2 });
    }
    if (o.kind === 'meat') {
      blob(g, e, [-50, -20, 30, -34, 56, 0, 30, 30, -40, 26], fill, opts);
      tube(g, e, [40, -6, 90, -14], [16, 14], C.LINEN, { lw: 5, seed: o.seed + 1 });
    }
    if (o.kind === 'cheese')
      blob(g, e, [-50, 20, 50, 20, 40, -20, -30, -30], fill, {
        ...opts,
        sharp: true,
        inner: () => blob(g, e, ellipseRing(0, 0, 8, 6, 6), shade, { lw: 0, seed: o.seed + 1 }),
      });
    if (o.kind === 'pie') {
      blob(g, e, [-70, 0, -60, -26, 60, -26, 70, 0, 50, 14, -50, 14], fill, opts);
      for (const dx of [-30, 0, 30])
        brushStroke(g, e, [dx - 10, -18, dx + 10, -8], { w: 3, seed: o.seed + 1, taper: false });
    }
    if (o.kind === 'pile')
      blob(g, e, [-80, 10, -40, -30, 0, -46, 40, -30, 80, 10], fill, {
        ...opts,
        mottle: [shade, 8, 6],
      });
    if (o.state === 'rotten')
      for (let i = 0; i < 3; i += 1)
        blob(
          g,
          e,
          ellipseRing(rnd(-30, 30, o.seed, i), rnd(-14, 10, o.seed, i, 1), 8, 6, 6),
          'rgba(70,80,40,0.55)',
          { lw: 0, seed: o.seed + 10 + i },
        );
  });
  return {
    box: [o.x - 90 * o.size, o.y - 50 * o.size, o.x + 90 * o.size, o.y + 30 * o.size],
    points: { centre: [o.x, o.y], top: place(o.x, o.y, o.rot, 0, -36 * o.size) },
  };
}

export const PROPS_TABLE = {
  pen: {
    doc: 'a writing tool for the hand: quill, ink brush, stylus, pencil, pen, chalk (draw it at the palm; the tip touches the paper)',
    params:
      'x, y = grip (a palm); kind quill|brush|stylus|pencil|pen|chalk; rot deg (0 = tip down); size; seed',
    returns: 'points grip, tip, tail',
    schema: penSchema,
    draw: drawPen,
  },
  vessel: {
    doc: 'a drink or dish container: cup, mug, goblet, bottle, jug, bowl, plate, cooking pot; tilts to the lips, shows its level, steams on twos, breaks',
    params:
      'x, y = bottom centre; kind cup|mug|goblet|bottle|jug|bowl|plate|pot; size; tilt deg; level 0-1; drink (tone) = BROWN; state whole|broken; steam; t; tone; seed',
    returns: 'points mouth, grip, bottom',
    schema: vesselSchema,
    draw: drawVessel,
  },
  food: {
    doc: 'food that a beat is about: a loaf, a fruit, a fish, a joint of meat, cheese, a pie, a pile of grain; bitten or rotten',
    params:
      'x, y = centre; kind loaf|fruit|fish|meat|cheese|pie|pile; state whole|bitten|rotten; size; rot; tone; seed',
    returns: 'points centre, top',
    schema: foodSchema,
    draw: drawFood,
  },
} as const;
