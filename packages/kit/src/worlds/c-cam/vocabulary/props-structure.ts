/**
 * Grim Ink props (PLAN.md#14.20): structure pieces — arch, column, ladder, board / tile / beam,
 * riveted panel, a hanging bell. Ported from `02-papal-conclave/js/sets/sets-a.js` (loggia,
 * bell tower), `shots-b.js` (ladder), `cast/mayor.js` (plank), `cast/roofer.js` (roof tile),
 * `03-apollo-11/js/lunar.js` (metal panel); docs in props.ts.
 */
import { z } from 'zod';
import { C, rnd } from '../core.js';
import { brushStroke, type BrushEnv } from '../draw/brushes.js';
import type { Paint2D } from '../draw/paint.js';
import { beam, rect, rough } from '../draw/scenery.js';
import { blob, ellipseRing, tube } from '../draw/shapes.js';
import {
  boxOf,
  coord,
  local,
  place,
  rotSchema,
  seedSchema,
  sizeSchema,
  toneOf,
  toneSchema,
  wearMarks,
  wearSchema,
  type Drawn,
  spot,
} from './common.js';

// ---------- arch, column ----------

export const archSchema = z.strictObject({
  x: coord.default(960),
  y: coord.default(900),
  w: z.number().min(60).max(3000).default(420),
  h: z.number().min(60).max(3000).default(520),
  thick: z.number().min(10).max(400).default(60),
  tone: toneSchema.default('stone'),
  state: z.enum(['whole', 'cracked']).default('whole'),
  wear: wearSchema,
  seed: seedSchema.default(350),
});

export function drawArch(g: Paint2D, e: BrushEnv, o: z.output<typeof archSchema>): Drawn {
  const { x, y, w, h, thick: t } = o;
  const [fill, shade] = toneOf(o.tone);
  const spring = y - h + w * 0.5;
  const arc = (r: number, i: number): readonly [number, number] => {
    const a = Math.PI + (i / 8) * Math.PI;
    return [x + Math.cos(a) * r, spring + Math.sin(a) * r * 0.9];
  };
  // The ring: up the outer edge of the left jamb, over the outer arc, down the right jamb, back
  // under the inner arc (the opening stays unpainted).
  const outer: number[] = [x - w / 2 - t, y];
  for (let i = 0; i <= 8; i += 1) outer.push(...arc(w / 2 + t, i));
  outer.push(x + w / 2 + t, y, x + w / 2, y);
  for (let i = 8; i >= 0; i -= 1) outer.push(...arc(w / 2, i));
  outer.push(x - w / 2, y);
  rough(g, e, outer, fill, {
    seed: o.seed,
    lw: 6,
    amp: 2,
    shade: [shade, -t * 0.3, 0],
    mottle: ['rgba(60,56,40,0.25)', 5, 30],
    hatch: { c: 'rgba(25,24,18,0.35)', n: 6, len: 40, gap: 8, k: 3, ang: 80 },
  });
  for (let i = 1; i < 8; i += 1) {
    const a = Math.PI + (i / 8) * Math.PI;
    const c = Math.cos(a);
    const s = Math.sin(a) * 0.9;
    brushStroke(
      g,
      e,
      [x + c * w * 0.5, spring + s * w * 0.5, x + c * (w / 2 + t), spring + s * (w / 2 + t)],
      { w: 3, color: 'rgba(22,18,14,0.6)', seed: o.seed + i, taper: false },
    );
  }
  if (o.state === 'cracked')
    brushStroke(
      g,
      e,
      [x - 8, spring - w * 0.45 - t, x + 10, spring - w * 0.3, x - 4, spring - w * 0.18],
      { w: 4, seed: o.seed + 20 },
    );
  wearMarks(g, e, [x - w / 2 - t, y - h * 0.4, x + w / 2 + t, y], o.wear, o.seed + 30);
  return {
    box: [x - w / 2 - t, y - h - t, x + w / 2 + t, y],
    points: { top: [x, y - h], left: [x - w / 2, spring], right: [x + w / 2, spring] },
  };
}

export const columnSchema = z.strictObject({
  x: coord.default(960),
  y: coord.default(900),
  h: z.number().min(40).max(3000).default(600),
  w: z.number().min(10).max(600).default(90),
  kind: z.enum(['round', 'square', 'timber', 'iron']).default('round'),
  tone: toneSchema.optional(),
  state: z.enum(['whole', 'broken']).default('whole'),
  wear: wearSchema,
  seed: seedSchema.default(370),
});

export function drawColumn(g: Paint2D, e: BrushEnv, o: z.output<typeof columnSchema>): Drawn {
  const { x, y, h, w } = o;
  const tone = o.tone ?? (o.kind === 'timber' ? 'wood' : o.kind === 'iron' ? 'iron' : 'stone');
  const [fill, shade] = toneOf(tone);
  const top = o.state === 'broken' ? y - h * 0.62 : y - h;
  if (o.kind === 'timber') beam(g, e, x, y, x, top, w, o.seed, fill);
  else {
    // prettier-ignore
    const shaft = o.state === 'broken' ? [x - w / 2, y, x - w / 2, top + 10, x - w * 0.1, top - 16, x + w * 0.15, top + 6, x + w / 2, top - 8, x + w / 2, y] : [x - w / 2, y, x - w * 0.46, top, x + w * 0.46, top, x + w / 2, y];
    rough(g, e, shaft, fill, {
      seed: o.seed,
      lw: 6,
      amp: 1.5,
      shade: [shade, -w * 0.25, 0],
      hatch: { c: 'rgba(22,18,14,0.35)', n: 4, len: h * 0.18, gap: 8, k: 2, ang: 90, bend: 0.02 },
    });
    if (o.kind === 'round')
      for (const u of [-0.2, 0.15])
        brushStroke(g, e, [x + u * w, y - 30, x + u * w + 1, top + 30], {
          w: 3,
          color: shade,
          seed: o.seed + 3,
          taper: false,
        });
    if (o.kind === 'iron')
      for (let k = 1; k < h / 60; k += 1)
        blob(g, e, ellipseRing(x, y - k * 60, 4, 4, 6), '#55524b', { lw: 2, seed: o.seed + k });
  }
  if (o.kind === 'round' || o.kind === 'square') {
    rect(g, e, x - w * 0.75, y - 30, w * 1.5, 30, shade, { seed: o.seed + 5, lw: 5 });
    if (o.state === 'whole')
      rect(g, e, x - w * 0.8, top - 30, w * 1.6, 34, fill, {
        seed: o.seed + 6,
        lw: 5,
        shade: [shade, 0, 8],
      });
  }
  wearMarks(g, e, [x - w / 2, top, x + w / 2, y], o.wear, o.seed + 20);
  return { box: [x - w * 0.8, top - 30, x + w * 0.8, y], points: { top: [x, top], base: [x, y] } };
}

// ---------- ladder, board, panel, bell ----------

export const ladderSchema = z.strictObject({
  x0: coord.default(900),
  y0: coord.default(1000),
  x1: coord.default(800),
  y1: coord.default(300),
  width: z.number().min(20).max(300).default(68),
  tone: toneSchema.default('paleWood'),
  wear: wearSchema,
  seed: seedSchema.default(390),
});

export function drawLadder(g: Paint2D, e: BrushEnv, o: z.output<typeof ladderSchema>): Drawn {
  const { x0, y0, x1, y1 } = o;
  const [fill, shade] = toneOf(o.tone);
  const dx = x1 - x0;
  const dy = y1 - y0;
  const L = Math.max(1, Math.hypot(dx, dy));
  const nx = (-dy / L) * (o.width / 2);
  const ny = (dx / L) * (o.width / 2);
  [-1, 1].forEach((s, i) => {
    tube(g, e, [x0 + nx * s, y0 + ny * s, x1 + nx * s, y1 + ny * s], [14, 12], fill, {
      lw: 5,
      seed: o.seed + i,
      shade: [shade, -3, 0],
    });
  });
  for (let k = 1; k * 70 < L; k += 1) {
    const u = (k * 70) / L;
    brushStroke(g, e, [x0 + dx * u - nx, y0 + dy * u - ny, x0 + dx * u + nx, y0 + dy * u + ny], {
      w: 9,
      color: shade,
      seed: o.seed + 2 + k,
      taper: false,
    });
  }
  const rung = (u: number): readonly [number, number] => [x0 + dx * u, y0 + dy * u];
  return {
    box: boxOf([
      [x0 - o.width, y0],
      [x1 + o.width, y1],
    ]),
    points: { foot: [x0, y0], top: [x1, y1], mid: rung(0.5) },
  };
}

export const boardSchema = z.strictObject({
  x: coord.default(960),
  y: coord.default(540),
  len: z.number().min(20).max(3000).default(520),
  w: z.number().min(6).max(300).default(44),
  rot: rotSchema,
  kind: z.enum(['board', 'tile', 'beam']).default('board'),
  nails: z.boolean().default(true),
  tone: toneSchema.optional(),
  state: z.enum(['whole', 'broken']).default('whole'),
  wear: wearSchema,
  seed: seedSchema.default(400),
});

export function drawBoard(g: Paint2D, e: BrushEnv, o: z.output<typeof boardSchema>): Drawn {
  const [fill, shade] = toneOf(o.tone ?? (o.kind === 'tile' ? 'clay' : 'paleWood'));
  const hl = o.len / 2;
  const hw = o.w / 2;
  local(g, o.x, o.y, o.rot, 1, () => {
    if (o.kind === 'tile') {
      // prettier-ignore
      blob(g, e, [-hl, -hw * 0.3, -hl * 0.55, -hw, hl * 0.55, -hw, hl, -hw * 0.3, hl * 0.92, hw * 0.7, -hl * 0.92, hw * 0.7], fill, { lw: 6, seed: o.seed, shade: [shade, -8, 6], light: ['rgba(200,120,90,0.35)', 4, -5], hatch: { c: 'rgba(40,16,8,0.5)', n: 3, len: o.len * 0.25, gap: 6, k: 2, ang: 0 } });
      return;
    }
    const end =
      o.state === 'broken'
        ? [hl * 0.7, -hw, hl * 0.82, -hw * 0.2, hl * 0.62, hw * 0.3, hl * 0.76, hw]
        : [hl, -hw, hl, hw];
    rough(g, e, [-hl, -hw, ...end, -hl, hw], fill, {
      seed: o.seed,
      lw: o.kind === 'beam' ? 7 : 6,
      shade: [shade, 0, hw * 0.35],
      hatch: {
        c: 'rgba(20,12,4,0.5)',
        n: Math.max(2, Math.round(o.len / 90)),
        len: Math.min(90, o.len * 0.3),
        gap: 6,
        k: 2,
        ang: 0,
        bend: 0.02,
      },
    });
    if (o.nails)
      [-hl + 30, hl - 30].forEach((nx, i) =>
        blob(g, e, ellipseRing(nx, 0, 5, 5, 6), C.INK, { lw: 0, seed: o.seed + 1 + i }),
      );
    wearMarks(g, e, [-hl, -hw, hl, hw], o.wear, o.seed + 10);
  });
  const ends = [place(o.x, o.y, o.rot, -hl, 0), place(o.x, o.y, o.rot, hl, 0)] as const;
  return {
    box: boxOf([
      place(o.x, o.y, o.rot, -hl, -hw),
      place(o.x, o.y, o.rot, hl, hw),
      place(o.x, o.y, o.rot, -hl, hw),
      place(o.x, o.y, o.rot, hl, -hw),
    ]),
    points: { a: ends[0], b: ends[1], centre: [o.x, o.y] },
  };
}

export const panelSchema = z.strictObject({
  x: coord.default(600),
  y: coord.default(200),
  w: z.number().min(20).max(4000).default(300),
  h: z.number().min(20).max(4000).default(500),
  tone: toneSchema.default('steel'),
  rivets: z.boolean().default(true),
  tape: z.boolean().default(false),
  wear: wearSchema,
  seed: seedSchema.default(420),
});

export function drawPanel(g: Paint2D, e: BrushEnv, o: z.output<typeof panelSchema>): Drawn {
  const { x, y, w, h } = o;
  const [fill] = toneOf(o.tone);
  rect(g, e, x, y, w, h, fill, {
    seed: o.seed,
    lw: 6,
    amp: 1.5,
    shade: ['rgba(0,0,0,0.18)', -18, 0],
    mottle: ['rgba(40,38,30,0.2)', 4, 40],
    hatch: { c: 'rgba(20,20,16,0.35)', n: 5, len: 40, gap: 8, k: 3, ang: 80 },
  });
  if (o.rivets) {
    g.fillStyle = 'rgba(25,24,20,0.6)';
    for (let i = 8; i < w - 8; i += 34) {
      g.fillRect(x + i, y + 8, 5, 5);
      g.fillRect(x + i, y + h - 13, 5, 5);
    }
  }
  if (o.tape)
    rect(
      g,
      e,
      x + w * rnd(0.1, 0.5, o.seed, 3),
      y + h * rnd(0.2, 0.7, o.seed, 4),
      Math.min(80, w * 0.4),
      16,
      'rgba(170,160,120,0.7)',
      { seed: o.seed + 5, lw: 2, amp: 1 },
    );
  wearMarks(g, e, [x, y, x + w, y + h], o.wear, o.seed + 10);
  return {
    box: [x, y, x + w, y + h],
    points: { centre: [x + w / 2, y + h / 2] },
    label: spot(x + w / 2, y + h * 0.2, Math.min(48, w * 0.12), w * 0.8),
  };
}

export const bellSchema = z.strictObject({
  x: coord.default(960),
  y: coord.default(200),
  size: sizeSchema,
  swing: z.number().min(-80).max(80).default(0),
  tone: toneSchema.default('brass'),
  seed: seedSchema.default(440),
});

export function drawBell(g: Paint2D, e: BrushEnv, o: z.output<typeof bellSchema>): Drawn {
  const [fill, shade] = toneOf(o.tone);
  beam(g, e, o.x - 70 * o.size, o.y, o.x + 70 * o.size, o.y, 12 * o.size, o.seed + 3);
  local(g, o.x, o.y, o.swing, o.size, () => {
    // prettier-ignore
    blob(g, e, [-12, 4, -16, 30, -32, 70, -44, 96, 44, 96, 32, 70, 16, 30, 12, 4], fill, { lw: 6, seed: o.seed, shade: [shade, -8, 6], light: ['rgba(217,180,90,0.8)', 6, -4] });
    blob(g, e, ellipseRing(0, 100, 9, 9, 6), C.INK, { lw: 0, seed: o.seed + 1 });
  });
  const mouth = place(o.x, o.y, o.swing, 0, 96 * o.size);
  return {
    box: [o.x - 60 * o.size, o.y, o.x + 60 * o.size, o.y + 110 * o.size],
    points: { mouth, pivot: [o.x, o.y] },
  };
}
