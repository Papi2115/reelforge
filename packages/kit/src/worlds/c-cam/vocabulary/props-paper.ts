/**
 * Grim Ink props (PLAN.md#14.20): paper in every period — sheet / slip, lop-sided stack, book
 * (shut, open, a page mid-flip, pages unfolding down), scroll, tablet, fanned cards, name tags on a
 * rail. Ported from `01-samurai-edo/js/edo.js` (papers), `shots-d.js` (the ledger),
 * `02-papal-conclave/js/acting.js` (ballot slip), `cast/stubborn.js` (notebook). Words are the
 * scene's `drawText` at the returned `label` spot; this only draws scribble lines. Docs in props.ts.
 */
import { z } from 'zod';
import { C, hash, rnd } from '../core.js';
import { brushStroke, type BrushEnv } from '../draw/brushes.js';
import type { Paint2D } from '../draw/paint.js';
import { beam, rect, rough } from '../draw/scenery.js';
import { blob, tube } from '../draw/shapes.js';
import {
  boxOf,
  coord,
  local,
  place,
  rotSchema,
  seedSchema,
  toneOf,
  toneSchema,
  unit,
  type Drawn,
  type LabelSpot,
  spot,
} from './common.js';

// ---------- paper ----------

export const paperSchema = z.strictObject({
  x: coord.default(960),
  y: coord.default(540),
  kind: z.enum(['sheet', 'stack', 'book', 'scroll', 'tablet', 'cards', 'tags']).default('sheet'),
  state: z.enum(['shut', 'open', 'torn', 'crumpled']).default('shut'),
  w: z.number().min(10).max(2000).default(120),
  n: z.number().int().min(1).max(60).optional(),
  page: unit.default(0),
  rot: rotSchema,
  lines: z.boolean().default(true),
  tie: z.boolean().default(false),
  tone: toneSchema.optional(),
  seed: seedSchema.default(580),
});

function scribble(
  g: Paint2D,
  e: BrushEnv,
  x0: number,
  x1: number,
  y0: number,
  rows: number,
  gap: number,
  seed: number,
): void {
  for (let i = 0; i < rows; i += 1) {
    const len = (x1 - x0) * rnd(0.55, 0.95, seed, i);
    const y = y0 + i * gap;
    brushStroke(g, e, [x0, y, x0 + len * 0.5, y - 2 + rnd(-1, 1, seed, i, 1), x0 + len, y + 1], {
      w: 2,
      color: 'rgba(22,18,14,0.7)',
      seed: seed + i,
      taper: false,
    });
  }
}

const PAPER_COUNT = {
  sheet: 1,
  stack: 4,
  book: 1,
  scroll: 1,
  tablet: 1,
  cards: 5,
  tags: 6,
} as const;

export function drawPaper(g: Paint2D, e: BrushEnv, opts: z.output<typeof paperSchema>): Drawn {
  const o = { ...opts, n: opts.n ?? PAPER_COUNT[opts.kind] };
  const w = o.w;
  const h =
    o.kind === 'tags'
      ? w * 0.3
      : w * (o.kind === 'scroll' ? 1.25 : o.kind === 'cards' ? 1.4 : 0.72);
  const [fill, shade] = toneOf(
    o.tone ?? (o.kind === 'tablet' ? 'stone' : o.kind === 'tags' ? 'paleWood' : 'paper'),
  );
  const at = (dy: number, size: number, fit: number): LabelSpot => {
    const [lx, ly] = place(o.x, o.y, o.rot, 0, dy);
    return spot(lx, ly, size, fit, o.rot);
  };
  let label: LabelSpot = at(-h * 0.25, w * 0.16, w * 0.8);
  local(g, o.x, o.y, o.rot, 1, () => {
    const sheet = { seed: o.seed, lw: 4, amp: 1.2, shade: [shade, -3, 3] as const };
    if (o.state === 'crumpled') {
      const ring: number[] = [];
      for (let i = 0; i < 11; i += 1) {
        const a = (i / 11) * 6.283;
        const r = w * 0.32 * (0.7 + 0.4 * hash(o.seed, i));
        ring.push(Math.cos(a) * r, Math.sin(a) * r * 0.85);
      }
      blob(g, e, ring, fill, {
        sharp: true,
        lw: 4,
        seed: o.seed,
        shade: [shade, -6, 6],
        hatch: { c: 'rgba(40,34,20,0.5)', n: 3, len: w * 0.2, gap: 5, k: 2, ang: 30 },
      });
      return;
    }
    if (o.kind === 'sheet' || o.kind === 'tablet') {
      // prettier-ignore
      const edge = o.state === 'torn' ? [w / 2, h * 0.1, w * 0.3, h * 0.2, w * 0.42, h * 0.34, w / 2, h / 2] : [w / 2, h / 2];
      rough(g, e, [-w / 2, -h / 2, w / 2, -h / 2 - 2, ...edge, -w / 2, h / 2], fill, {
        ...sheet,
        lw: o.kind === 'tablet' ? 6 : 4,
      });
      if (o.lines)
        scribble(
          g,
          e,
          -w * 0.36,
          w * 0.36,
          -h * 0.2,
          Math.max(2, Math.round(h / 22)),
          h * 0.18,
          o.seed + 5,
        );
    }
    if (o.kind === 'stack') {
      for (let i = 0; i < o.n; i += 1) {
        const dx = rnd(-w * 0.08, w * 0.08, o.seed, i);
        const yy = h * 0.4 - i * 9;
        rough(
          g,
          e,
          [
            -w / 2 + dx,
            yy,
            w / 2 + dx,
            yy - rnd(-3, 3, o.seed, i, 1),
            w / 2 + dx + 3,
            yy - 9,
            -w / 2 + dx + 2,
            yy - 10,
          ],
          i % 3 === 1 ? shade : fill,
          { seed: o.seed + i, lw: 3, amp: 0.8 },
        );
      }
      if (o.tie)
        brushStroke(g, e, [-w * 0.3, h * 0.4 - o.n * 9 + 2, w * 0.2, h * 0.4 - o.n * 9 + 4], {
          w: 7,
          color: C.RUST_D,
          seed: o.seed + 50,
          taper: false,
        });
      label = at(h * 0.4 - o.n * 9 - 20, w * 0.16, w * 0.8);
    }
    if (o.kind === 'book') {
      if (o.state !== 'open') {
        rough(
          g,
          e,
          [-w * 0.36, -h * 0.6, w * 0.36, -h * 0.62, w * 0.38, h * 0.6, -w * 0.36, h * 0.62],
          C.BROWN,
          {
            ...sheet,
            lw: 6,
            shade: [C.BROWN_D, -6, 0],
            hatch: { c: 'rgba(20,12,6,0.5)', n: 3, len: w * 0.3, gap: 6, k: 2, ang: 80 },
          },
        );
        rect(g, e, -w * 0.12, -h * 0.4, w * 0.24, h * 0.5, fill, { seed: o.seed + 1, lw: 3 });
        label = at(-h * 0.15, w * 0.08, w * 0.2);
      } else {
        for (let i = 0; i < o.n; i += 1) {
          const yy = h * 0.5 + i * h * 0.9;
          if (i === 0) continue;
          rough(
            g,
            e,
            [-w / 2, yy, w / 2, yy, w / 2 - 6, yy + h * 0.9, -w / 2 + 6, yy + h * 0.9],
            i % 2 ? shade : fill,
            { seed: o.seed + 10 + i, lw: 4, amp: 1.5 },
          );
          if (o.lines)
            scribble(g, e, -w * 0.4, w * 0.4, yy + h * 0.15, 4, h * 0.16, o.seed + 20 + i);
        }
        rough(
          g,
          e,
          [-w / 2, -h / 2, 0, -h * 0.44, w / 2, -h / 2, w / 2, h / 2, 0, h * 0.56, -w / 2, h / 2],
          fill,
          { ...sheet, lw: 5 },
        );
        brushStroke(g, e, [0, -h * 0.44, 0, h * 0.56], { w: 3, seed: o.seed + 2, taper: false });
        if (o.lines)
          for (const s of [-1, 1])
            scribble(
              g,
              e,
              s < 0 ? -w * 0.44 : w * 0.06,
              s < 0 ? -w * 0.06 : w * 0.44,
              -h * 0.15,
              4,
              h * 0.16,
              o.seed + 3 + s,
            );
        if (o.page > 0.02) {
          const ex = (w / 2) * Math.cos(o.page * Math.PI);
          const lift = Math.sin(o.page * Math.PI) * h * 0.18;
          blob(g, e, [0, -h * 0.44, ex, -h / 2 - lift, ex, h / 2 - lift, 0, h * 0.56], fill, {
            sharp: true,
            lw: 4,
            seed: o.seed + 4,
            shade: ['rgba(80,70,40,0.4)', o.page < 0.5 ? -10 : 10, 0],
          });
        }
        label = at(-h * 0.32, w * 0.1, w * 0.8);
      }
    }
    if (o.kind === 'scroll') {
      const open = o.state === 'open';
      const sh = open ? h : h * 0.12;
      if (open)
        rough(
          g,
          e,
          [-w * 0.42, -sh / 2, w * 0.42, -sh / 2, w * 0.42, sh / 2, -w * 0.42, sh / 2],
          fill,
          sheet,
        );
      if (open && o.lines) scribble(g, e, -w * 0.32, w * 0.32, -sh * 0.3, 6, sh * 0.1, o.seed + 5);
      for (const s of open ? [-1, 1] : [0])
        tube(g, e, [-w / 2, (s * sh) / 2, w / 2, (s * sh) / 2], [w * 0.12, w * 0.12], shade, {
          lw: 5,
          seed: o.seed + 6 + s,
        });
      if (o.tie && !open)
        brushStroke(g, e, [0, -w * 0.07, 2, w * 0.07], {
          w: 6,
          color: C.RUST_D,
          seed: o.seed + 9,
          taper: false,
        });
    }
    if (o.kind === 'cards') {
      for (let i = 0; i < o.n; i += 1) {
        const a = (i - (o.n - 1) / 2) * 9;
        local(g, 0, h * 0.4, a, 1, () =>
          rough(g, e, [-w / 2, -h, w / 2, -h, w / 2, 0, -w / 2, 0], i % 2 ? fill : shade, {
            seed: o.seed + i,
            lw: 4,
            amp: 1,
          }),
        );
      }
    }
    if (o.kind === 'tags') {
      beam(g, e, -10, 0, w + 10, 0, 12, o.seed);
      for (let i = 0; i < o.n; i += 1) {
        const tx = (i + 0.5) * (w / o.n);
        const th = (w / o.n) * 0.7 * 2.6 * (0.85 + 0.3 * hash(o.seed, i));
        rect(g, e, tx - (w / o.n) * 0.35, 10, (w / o.n) * 0.7, th, i % 3 === 0 ? shade : fill, {
          seed: o.seed + 1 + i,
          lw: 4,
          amp: 1,
        });
        if (o.lines)
          brushStroke(g, e, [tx, 24, tx - 1, 10 + th * 0.6, tx + 1, th - 4], {
            w: 4,
            seed: o.seed + 30 + i,
          });
      }
      label = spot(o.x + w / 2, o.y - 30, 30, w, o.rot);
    }
  });
  const corners = [
    place(o.x, o.y, o.rot, -w / 2, -h / 2),
    place(o.x, o.y, o.rot, w / 2, h / 2),
    place(o.x, o.y, o.rot, -w / 2, h / 2),
    place(o.x, o.y, o.rot, w / 2, -h / 2),
  ];
  return {
    box: boxOf(corners),
    points: { centre: [o.x, o.y], top: place(o.x, o.y, o.rot, 0, -h / 2) },
    label,
  };
}
