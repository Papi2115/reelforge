/**
 * Grim Ink props (PLAN.md#14.20): doors and window frames. A doorway with its leaf (planks,
 * panels, iron bands, a cloth) that swings, is barred, planked or broken; a window with the sky or
 * a lit room behind, mullions, bars, a porthole bezel, a paper screen or shutters. Ported from
 * `02-papal-conclave/js/sets/sets-a.js` (palaceDoor), `sets-c.js` (grille),
 * `03-apollo-11/js/sets/sets-b.js` (windowAt), `01-samurai-edo/js/edo.js` (shoji); docs in
 * props.ts.
 */
import { z } from 'zod';
import { C, rnd } from '../core.js';
import { brushStroke, type BrushEnv } from '../draw/brushes.js';
import type { Paint2D } from '../draw/paint.js';
import { bands, beam, rect, rough } from '../draw/scenery.js';
import { blob, ellipseRing, tube } from '../draw/shapes.js';
import {
  coord,
  seedSchema,
  toneOf,
  toneSchema,
  unit,
  wearMarks,
  wearSchema,
  type Drawn,
  spot,
} from './common.js';
import { drawBoard } from './props-structure.js';

const DARK = '#1c1915';

// ---------- door ----------

export const doorSchema = z.strictObject({
  x: coord.default(960),
  y: coord.default(900),
  w: z.number().min(40).max(2000).default(220),
  h: z.number().min(60).max(3000).default(340),
  kind: z.enum(['plank', 'arch', 'panel', 'iron', 'curtain']).default('plank'),
  state: z.enum(['shut', 'open', 'ajar', 'barred', 'planked', 'broken']).default('shut'),
  swing: unit.optional(),
  shake: z.number().min(-60).max(60).default(0),
  tone: toneSchema.default('wood'),
  frame: toneSchema.default('wood'),
  wear: wearSchema,
  seed: seedSchema.default(310),
});

function doorway(o: z.output<typeof doorSchema>): number[] {
  const { x, y, w, h } = o;
  const top = y - h;
  if (o.kind !== 'arch') return [x - w / 2, y, x - w / 2, top, x + w / 2, top, x + w / 2, y];
  // prettier-ignore
  return [x - w / 2, y, x - w / 2, top + w * 0.4, x - w * 0.3, top + w * 0.1, x, top, x + w * 0.3, top + w * 0.1, x + w / 2, top + w * 0.4, x + w / 2, y];
}

function doorLeaf(g: Paint2D, e: BrushEnv, o: z.output<typeof doorSchema>, open: number): void {
  const [fill, shade] = toneOf(o.tone);
  const hinge = o.x - o.w / 2;
  const k = 1 - 0.84 * open;
  // The leaf narrows toward the hinge as it swings; its far edge drops a little (perspective).
  const leaf = doorway(o).map((v, i, all) => {
    if (i % 2 === 0) return hinge + (v - hinge) * k + o.shake;
    const u = ((all[i - 1] ?? hinge) - hinge) / o.w;
    return v + (v < o.y ? 1 : -1) * u * open * o.h * 0.05;
  });
  if (o.kind === 'curtain') {
    const sway = open * o.w * 0.3;
    // prettier-ignore
    blob(g, e, [leaf[0] ?? 0, o.y - o.h, o.x + o.w / 2 - sway, o.y - o.h, o.x + o.w / 2 - sway * 1.4, o.y, leaf[0] ?? 0, o.y], fill, { sharp: true, lw: 6, seed: o.seed + 2, shade: [shade, -8, 0], hatch: { c: 'rgba(10,10,10,0.35)', n: 4, len: o.h * 0.4, gap: 7, k: 2, ang: 90, bend: 0.02 } });
    return;
  }
  const hatch = { c: 'rgba(10,6,2,0.5)', n: 6, len: o.h * 0.45, gap: 10, k: 2, ang: 90, bend: 0 };
  blob(g, e, leaf, open > 0.5 ? shade : fill, { sharp: true, lw: 7, seed: o.seed + 2, hatch });
  if (open > 0.5) return;
  const lx = (u: number): number => hinge + o.w * u * k + o.shake;
  if (o.kind === 'plank' || o.kind === 'arch') {
    for (const u of [0.25, 0.5, 0.75]) {
      brushStroke(g, e, [lx(u), o.y - o.h + 8, lx(u) + 2, o.y], {
        w: 4,
        color: shade,
        seed: o.seed + 3,
        taper: false,
      });
    }
  }
  if (o.kind === 'panel') {
    for (const v of [0.12, 0.55]) {
      rect(g, e, lx(0.18), o.y - o.h * (1 - v), o.w * 0.64 * k, o.h * 0.33, fill, {
        seed: o.seed + 4,
        lw: 4,
        shade: [shade, 6, 6],
      });
    }
  }
  if (o.kind !== 'panel') {
    [0.3, 0.72].forEach((v, i) => {
      const yy = o.y - o.h * (1 - v);
      brushStroke(g, e, [lx(0.02), yy, lx(0.98), yy + 3], {
        w: o.kind === 'iron' ? 16 : 10,
        color: '#2a2622',
        seed: o.seed + 5 + i,
        taper: false,
      });
      for (let s = 0; s < 5; s += 1)
        blob(g, e, ellipseRing(lx(0.1 + s * 0.2), yy + 1, 5, 5, 6), '#55524b', {
          lw: 2,
          seed: o.seed + 8 + s,
        });
    });
  }
  // keyhole and ring handle
  const hx = lx(0.82);
  const hy = o.y - o.h * 0.48;
  blob(g, e, ellipseRing(hx, hy, 12, 14, 8), 'rgba(0,0,0,0)', { lw: 4, seed: o.seed + 14 });
  blob(g, e, [hx - 5, hy + 24, hx + 5, hy + 24, hx + 4, hy + 44, hx - 4, hy + 44], C.INK, {
    lw: 0,
    seed: o.seed + 15,
  });
}

export function drawDoor(g: Paint2D, e: BrushEnv, o: z.output<typeof doorSchema>): Drawn {
  const { x, y, w, h } = o;
  const open = o.swing ?? (o.state === 'open' ? 1 : o.state === 'ajar' ? 0.35 : 0);
  const [frame, frameD] = toneOf(o.kind === 'arch' && o.frame === 'wood' ? 'stone' : o.frame);
  const way = doorway(o);
  const surround = way.map((v, i) => (i % 2 ? v - (v < y ? 26 : 0) : v + (v - x) * 0.22));
  blob(g, e, surround, frameD, {
    sharp: o.kind !== 'arch',
    lw: 6,
    seed: o.seed,
    hatch: { c: 'rgba(20,18,12,0.5)', n: 5, len: 30, gap: 7, k: 3, ang: 60 },
  });
  if (o.kind !== 'arch') {
    beam(g, e, x - w / 2 - 14, y, x - w / 2 - 14, y - h - 20, 30, o.seed + 30, frame);
    beam(g, e, x + w / 2 + 14, y, x + w / 2 + 14, y - h - 20, 30, o.seed + 31, frame);
    beam(g, e, x - w / 2 - 40, y - h - 14, x + w / 2 + 40, y - h - 18, 32, o.seed + 32, frame);
  }
  blob(g, e, way, DARK, { sharp: o.kind !== 'arch', lw: 7, seed: o.seed + 1 });
  doorLeaf(g, e, o, open);
  if (o.state === 'broken') {
    // prettier-ignore
    blob(g, e, [x - w * 0.1, y - h * 0.62, x + w * 0.22, y - h * 0.7, x + w * 0.3, y - h * 0.45, x + w * 0.05, y - h * 0.32, x - w * 0.18, y - h * 0.44], DARK, { sharp: true, lw: 5, seed: o.seed + 16 });
    brushStroke(g, e, [x - w * 0.3, y - h * 0.8, x - w * 0.12, y - h * 0.62], {
      w: 4,
      seed: o.seed + 17,
    });
  }
  if (o.state === 'barred')
    beam(g, e, x - w * 0.62, y - h * 0.5, x + w * 0.62, y - h * 0.5, 34, o.seed + 18, C.TIMBER);
  if (o.state === 'planked') {
    [-6, 7].forEach((r, i) =>
      drawBoard(g, e, {
        x: x + i * 14,
        y: y - h * (0.62 - i * 0.3),
        len: w * 1.3,
        w: 40,
        rot: r,
        kind: 'board',
        nails: true,
        tone: 'paleWood',
        state: 'whole',
        wear: o.wear,
        seed: o.seed + 20 + i * 3,
      }),
    );
  }
  wearMarks(g, e, [x - w / 2, y - h, x + w / 2, y], o.wear, o.seed + 40);
  return {
    box: [x - w / 2 - 50, y - h - 40, x + w / 2 + 50, y],
    points: {
      handle: [x - w / 2 + w * 0.82 * (1 - 0.84 * open), y - h * 0.48],
      opening: [x, y - h * 0.5],
      top: [x, y - h],
      threshold: [x, y],
    },
    label: spot(x, y - h - 70, Math.min(60, w * 0.22), w * 0.9),
  };
}

// ---------- window frame ----------

export const windowSchema = z.strictObject({
  x: coord.default(960),
  y: coord.default(400),
  w: z.number().min(30).max(2400).default(260),
  h: z.number().min(30).max(2400).default(300),
  kind: z.enum(['square', 'arched', 'barred', 'porthole', 'screen', 'shuttered']).default('square'),
  state: z.enum(['day', 'dusk', 'night', 'lit', 'broken']).default('day'),
  view: z.custom<(box: Drawn['box']) => void>((v) => typeof v === 'function').optional(),
  tone: toneSchema.default('wood'),
  wear: wearSchema,
  seed: seedSchema.default(330),
});

const SKIES = {
  day: ['#76847f', '#8c9384', '#a39c7e'],
  dusk: ['#3c2f36', '#5c3a30', '#83472c', '#9b6232'],
  night: ['#121419', '#1c2025', '#22262a'],
  lit: ['#c9a463', '#d6b06a'],
  broken: ['#1d1e20', '#26282b'],
} as const;

function glassShape(o: z.output<typeof windowSchema>): number[] {
  const { x, y, w, h } = o;
  if (o.kind === 'porthole') return ellipseRing(x, y, w / 2, h / 2, 16);
  if (o.kind === 'arched') {
    // prettier-ignore
    return [x - w / 2, y + h / 2, x - w / 2, y - h / 2 + w * 0.4, x, y - h / 2, x + w / 2, y - h / 2 + w * 0.4, x + w / 2, y + h / 2];
  }
  return [x - w / 2, y - h / 2, x + w / 2, y - h / 2, x + w / 2, y + h / 2, x - w / 2, y + h / 2];
}

export function drawWindow(g: Paint2D, e: BrushEnv, o: z.output<typeof windowSchema>): Drawn {
  const { x, y, w, h } = o;
  const [fill, shade] = toneOf(o.tone);
  const glass = glassShape(o);
  const smooth = o.kind === 'porthole' || o.kind === 'arched';
  const box: Drawn['box'] = [x - w / 2, y - h / 2, x + w / 2, y + h / 2];
  const frameW = o.kind === 'porthole' ? 30 : 16;
  blob(g, e, glass, SKIES[o.state][0], { sharp: !smooth, lw: 0, seed: o.seed });
  g.save();
  blob(g, e, glass, 'rgba(0,0,0,0)', { sharp: !smooth, lw: 0, seed: o.seed });
  g.clip();
  bands(
    g,
    x - w / 2 - 10,
    y - h / 2 - 10,
    x + w / 2 + 10,
    y + h / 2 + 10,
    SKIES[o.state],
    o.seed % 7,
  );
  if (o.view) o.view(box);
  if (o.kind === 'screen') {
    rect(g, e, x - w / 2, y - h / 2, w, h, o.state === 'lit' ? '#c9a463' : '#a69c7e', {
      seed: o.seed + 1,
      lw: 0,
      mottle: ['rgba(90,70,40,0.18)', 4, 30],
    });
  }
  g.restore();
  if (o.state === 'broken') {
    // prettier-ignore
    blob(g, e, [x - w * 0.2, y - h * 0.3, x + w * 0.1, y - h * 0.4, x + w * 0.3, y, x, y + h * 0.2, x - w * 0.3, y + h * 0.05], '#0d0f12', { sharp: true, lw: 3, seed: o.seed + 2 });
    for (let i = 0; i < 4; i += 1)
      brushStroke(
        g,
        e,
        [x, y, x + rnd(-0.5, 0.5, o.seed, i) * w, y + rnd(-0.5, 0.5, o.seed, i, 1) * h],
        { w: 2.5, seed: o.seed + 3 + i, taper: false },
      );
  }
  const bar = (x0: number, y0: number, x1: number, y1: number, k: number, i: number): void => {
    brushStroke(g, e, [x0, y0, x1, y1], {
      w: k,
      color: shade,
      seed: o.seed + 10 + i,
      taper: false,
    });
  };
  if (o.kind === 'square' || o.kind === 'shuttered') {
    bar(x, y - h / 2, x + 1, y + h / 2, 10, 0);
    bar(x - w / 2, y, x + w / 2, y + 2, 10, 1);
  }
  if (o.kind === 'arched') bar(x, y - h / 2 + 6, x, y + h / 2, 8, 2);
  if (o.kind === 'barred') {
    for (let i = 1; i < 5; i += 1) {
      const bx = x - w / 2 + (w * i) / 5;
      tube(
        g,
        e,
        [bx, y - h / 2 - 6, bx + 2, y + h / 2 + 6],
        [w * 0.05 + 8, w * 0.05 + 8],
        C.BLACK,
        { lw: 5, seed: o.seed + 12 + i, light: ['#5d5a52', 4, 0] },
      );
    }
  }
  if (o.kind === 'screen') {
    const cols = Math.max(2, Math.round(w / 52));
    const rows = Math.max(3, Math.round(h / 70));
    for (let c = 1; c < cols; c += 1)
      bar(x - w / 2 + (w * c) / cols, y - h / 2, x - w / 2 + (w * c) / cols, y + h / 2, 6, 20 + c);
    for (let r = 1; r < rows; r += 1)
      bar(x - w / 2, y - h / 2 + (h * r) / rows, x + w / 2, y - h / 2 + (h * r) / rows, 6, 40 + r);
  }
  blob(g, e, glass, 'rgba(0,0,0,0)', {
    sharp: !smooth,
    lw: frameW,
    seed: o.seed + 5,
    lineColor: o.kind === 'porthole' ? C.BLACK : shade,
  });
  if (o.kind === 'shuttered') {
    [-1, 1].forEach((s, i) => {
      const sx = x + s * (w / 2 + w * 0.2);
      rough(
        g,
        e,
        [
          sx - w * 0.2,
          y - h / 2,
          sx + w * 0.2,
          y - h / 2 - 6,
          sx + w * 0.2,
          y + h / 2,
          sx - w * 0.2,
          y + h / 2 + 6,
        ],
        fill,
        {
          seed: o.seed + 50 + i,
          lw: 6,
          shade: [shade, s * 8, 0],
          hatch: { c: 'rgba(10,6,2,0.45)', n: 3, len: h * 0.4, gap: 8, k: 2, ang: 90, bend: 0 },
        },
      );
    });
  }
  if (o.kind !== 'porthole')
    rect(g, e, x - w / 2 - 20, y + h / 2, w + 40, 22, fill, {
      seed: o.seed + 6,
      lw: 5,
      shade: [shade, 0, 6],
    });
  else
    for (let i = 0; i < 10; i += 1)
      blob(
        g,
        e,
        ellipseRing(
          x + Math.cos((i / 10) * 6.283) * (w / 2 + 2),
          y + Math.sin((i / 10) * 6.283) * (h / 2 + 2),
          4,
          4,
          6,
        ),
        '#55524b',
        { lw: 2, seed: o.seed + 60 + i },
      );
  wearMarks(g, e, [x - w / 2, y + h / 2 - h * 0.2, x + w / 2, y + h / 2 + 20], o.wear, o.seed + 70);
  const lit = o.state === 'lit';
  return {
    box,
    points: { centre: [x, y], sill: [x, y + h / 2] },
    ...(lit
      ? { light: { x, y: y + h * 0.4, rx: w * 1.4, ry: h * 0.9, color: C.FIRE, alpha: 0.1 } }
      : {}),
  };
}
