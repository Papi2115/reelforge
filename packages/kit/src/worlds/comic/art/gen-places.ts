/**
 * Places (PLAN.md#13.15a): `art.interior` (a room, a space-station module, a stone hall, a
 * wooden cabin; a window view, a door) and `art.space` (stars and a planet: Earth, Moon, Mars,
 * ringed). The backdrop presets composing them: gen-backdrop.ts.
 */
import { z } from 'zod';
import { noise2, rnd } from '../draw/math.js';
import type { ComicPen } from '../page/pen.js';
import { artKey, colorSchema, parseArt, seedSchema } from './common.js';
import { boxSchema, drawLand, drawSky, landSchema, skySchema, type Box } from './gen-terrain.js';
import { Sketch } from './sketch.js';

export const interiorSchema = z.strictObject({
  box: boxSchema,
  kind: z.enum(['room', 'module', 'stone', 'wood']).default('room'),
  wall: colorSchema.optional(),
  floor: colorSchema.optional(),
  horizon: z.number().min(0.3).max(0.95).default(0.72).describe('Where the wall meets the floor'),
  window: z.enum(['none', 'day', 'dusk', 'night', 'earth']).default('day'),
  door: z.boolean().default(false),
  seed: seedSchema,
  t: z.number().optional(),
});

function windowView(g: ComicPen, pts: number[], view: string, t: number, key: string): void {
  g.clip(pts, () => {
    const xs = pts.filter((_, i) => i % 2 === 0);
    const ys = pts.filter((_, i) => i % 2 === 1);
    const box: [number, number, number, number] = [
      Math.min(...xs),
      Math.min(...ys),
      Math.max(...xs) - Math.min(...xs),
      Math.max(...ys) - Math.min(...ys),
    ];
    if (view === 'earth')
      drawSpace(
        g,
        parseArt(spaceSchema, { box, planet: 'earth', seed: key, t }, 'art.interior window'),
      );
    else
      drawSky(
        g,
        parseArt(
          skySchema,
          { box, kind: view, horizon: 0.85, seed: key, t, clouds: 1, moon: view === 'night' },
          'art.interior window',
        ),
      );
  });
  g.ink(pts, { boil: 0.4, key: `${key}frame`, w: g.w(2) });
}

export function drawInterior(g: ComicPen, o: z.output<typeof interiorSchema>): void {
  const [bx, by, bw, bh] = o.box;
  const key = artKey(`interior-${o.kind}`, o.seed);
  const t = o.t ?? g.t;
  const sk = new Sketch(g, { x: 0, y: 0, k: 1, flip: false, angle: 0, key });
  if (o.kind === 'module') {
    moduleTunnel(g, sk, o.box, key);
    if (o.window !== 'none') {
      const [cx, cy, r] = [bx + bw * 0.78, by + bh * 0.42, Math.min(bw, bh) * 0.16];
      windowView(
        g,
        g.ellipsePts(cx, cy, r, r, 24),
        o.window === 'day' ? 'earth' : o.window,
        t,
        key,
      );
      sk.oval(cx, cy, r + 5, r + 5, 'none', { outline: 'outer' });
    }
    return;
  }
  const hy = by + bh * o.horizon;
  const wall = o.wall ?? { room: 'yellowPale', stone: 'greyLight', wood: 'sepiaTan' }[o.kind];
  g.plate.rect(
    bx - 4,
    by - 4,
    bw + 8,
    hy - by + 4,
    g.tone(o.kind === 'room' ? 'aged' : 'greyMid', 0.18, { cell: 4, angle: 0.5, on: wall }),
  );
  if (o.kind === 'stone') {
    for (let y = by + 6, row = 0; y < hy; y += 16, row += 1) {
      sk.line(bx, y, bx + bw, y, 'greyMid', 1);
      for (let x = bx + (row % 2) * 18; x < bx + bw; x += 36)
        sk.line(x, y, x, y + 16, 'greyMid', 1);
    }
  } else if (o.kind === 'wood') {
    for (let x = bx + 10; x < bx + bw; x += 22)
      sk.line(x, by, x + (rnd(key, x) - 0.5) * 3, hy, 'sepiaMid', 1);
  } else {
    for (let x = bx + 14; x < bx + bw; x += 28) sk.line(x, by, x, hy, 'shade', 1);
  }
  drawLand(
    g,
    parseArt(
      landSchema,
      {
        box: o.box,
        kind: o.kind === 'stone' ? 'cobbles' : 'floor',
        horizon: o.horizon,
        fill: o.floor,
        seed: key,
      },
      'art.interior floor',
    ),
  );
  g.plate.rect(bx - 4, hy - 5, bw + 8, 5, o.kind === 'stone' ? 'greyMid' : 'sepiaMid');
  if (o.window !== 'none') {
    const [wx, wy, ww, wh] = [bx + bw * 0.58, by + bh * 0.14, bw * 0.24, bh * 0.36];
    const arch = o.kind === 'stone';
    const pts = arch
      ? [
          wx,
          wy + wh,
          wx,
          wy + ww * 0.5,
          wx + ww * 0.5,
          wy,
          wx + ww,
          wy + ww * 0.5,
          wx + ww,
          wy + wh,
        ]
      : [wx, wy, wx + ww, wy, wx + ww, wy + wh, wx, wy + wh];
    windowView(g, pts, o.window, t, key);
    if (!arch) {
      sk.line(wx + ww / 2, wy, wx + ww / 2, wy + wh, 'ink', g.w(1.5));
      sk.line(wx, wy + wh / 2, wx + ww, wy + wh / 2, 'ink', g.w(1.5));
    }
  }
  if (o.door) {
    const [dx, dw] = [bx + bw * 0.12, bw * 0.15];
    sk.shape(
      [dx, hy, dx, hy - bh * 0.5, dx + dw, hy - bh * 0.5, dx + dw, hy],
      o.kind === 'stone' ? 'sepiaMid' : 'sepiaTan',
      { shade: 0.4 },
    );
    sk.dot(dx + dw * 0.8, hy - bh * 0.25, 2, 'yellow');
  }
}

/** A space-station module seen down its length: panelled walls to a far hatch, handrails. */
function moduleTunnel(g: ComicPen, sk: Sketch, box: Box, key: string): void {
  const [bx, by, bw, bh] = box;
  const [fx, fy, fw, fh] = [bx + bw * 0.36, by + bh * 0.34, bw * 0.24, bh * 0.3];
  const near = [bx - 4, by - 4, bx + bw + 4, by - 4, bx + bw + 4, by + bh + 4, bx - 4, by + bh + 4];
  const far = [fx, fy, fx + fw, fy, fx + fw, fy + fh, fx, fy + fh];
  const walls: readonly (readonly [number, number, string, number])[] = [
    [0, 1, 'greyLight', 0.15],
    [1, 2, 'greyLight', 0.35],
    [2, 3, 'greyMid', 0.3],
    [3, 0, 'greyLight', 0.25],
  ];
  for (const [a, b, fill, level] of walls) {
    const quad = [
      near[a * 2] ?? 0,
      near[a * 2 + 1] ?? 0,
      near[b * 2] ?? 0,
      near[b * 2 + 1] ?? 0,
      far[b * 2] ?? 0,
      far[b * 2 + 1] ?? 0,
      far[a * 2] ?? 0,
      far[a * 2 + 1] ?? 0,
    ];
    g.plate.poly(quad, g.tone('greyDark', level, { cell: 3, angle: 0.78, on: fill }));
    for (let i = 1; i < 4; i += 1) {
      const u = i / 4;
      const lerp = (p: number, q: number) => p + (q - p) * u;
      sk.line(
        lerp(quad[0] ?? 0, quad[6] ?? 0),
        lerp(quad[1] ?? 0, quad[7] ?? 0),
        lerp(quad[2] ?? 0, quad[4] ?? 0),
        lerp(quad[3] ?? 0, quad[5] ?? 0),
        'greyDark',
        1,
      );
    }
    g.ink([quad[4] ?? 0, quad[5] ?? 0, quad[6] ?? 0, quad[7] ?? 0], {
      closed: false,
      boil: 0.3,
      key: `${key}e${String(a)}`,
    });
  }
  g.plate.poly(far, 'greyMid');
  sk.oval(fx + fw / 2, fy + fh / 2, fw * 0.3, fh * 0.32, 'greyDark', { outline: 'inner' });
  for (let i = 0; i < 6; i += 1) {
    const x = bx + bw * (0.08 + rnd(key, i) * 0.84);
    sk.shape(
      [x, by + bh * 0.04, x + 18, by + bh * 0.06, x + 17, by + bh * 0.1, x - 1, by + bh * 0.08],
      i % 3 === 0 ? 'yellowPale' : 'greyMid',
      { outline: 'inner' },
    );
  }
  sk.stroke([bx + bw * 0.04, by + bh * 0.62, fx - 4, fy + fh * 0.8], {
    w: 'outer',
    color: 'yellow',
  });
  sk.stroke([bx + bw * 0.96, by + bh * 0.66, fx + fw + 4, fy + fh * 0.82], {
    w: 'outer',
    color: 'yellow',
  });
  g.ink(far, { boil: 0.4, key: `${key}far` });
}

export const spaceSchema = z.strictObject({
  box: boxSchema,
  planet: z.enum(['earth', 'moon', 'mars', 'ringed', 'none']).default('earth'),
  at: z
    .tuple([z.number(), z.number(), z.number()])
    .optional()
    .describe('[x, y, radius] of the planet'),
  stars: z.int().min(0).max(300).default(50),
  seed: seedSchema,
  t: z.number().optional(),
});

export function drawSpace(g: ComicPen, o: z.output<typeof spaceSchema>): void {
  const [bx, by, bw, bh] = o.box;
  const key = artKey(`space-${o.planet}`, o.seed);
  drawSky(
    g,
    parseArt(
      skySchema,
      { box: o.box, kind: 'space', stars: o.stars, seed: o.seed, t: o.t },
      'art.space',
    ),
  );
  if (o.planet === 'none') return;
  const [cx, cy, r] = o.at ?? [bx + bw * 0.5, by + bh * 1.25, Math.max(bw, bh) * 0.7];
  const fills = {
    earth: ['cyan', 'cyanDeep'],
    moon: ['greyLight', 'greyMid'],
    mars: ['red', 'sepiaMid'],
    ringed: ['yellowPale', 'aged'],
  } as const;
  const [fill, dark] = fills[o.planet];
  const disk = g.ellipsePts(cx, cy, r, r, 48);
  g.plate.poly(disk, fill);
  g.clip(disk, () => {
    const land = o.planet === 'earth' ? 'phosphor' : dark;
    const step = Math.max(1, Math.round(r / 110));
    for (let y = Math.max(by, cy - r); y < Math.min(by + bh, cy + r); y += step) {
      for (let x = Math.max(bx, cx - r); x < Math.min(bx + bw, cx + r); x += step) {
        const n = noise2(key, x, y, r * 0.35);
        if (n > 0.62) g.rect(x, y, step, step, land);
        else if (o.planet === 'earth' && n < 0.2) g.rect(x, y, step, step, 'paper');
      }
    }
    g.plate.poly(
      g.ellipsePts(cx + r * 0.35, cy + r * 0.25, r, r, 48),
      g.tone('night', 0.55, { cell: 4, angle: 0.4 }),
    );
  });
  g.ink(disk, { boil: 0.4, key: `${key}rim`, w: g.w(1.6) });
  if (o.planet === 'ringed') {
    const ring = g.ellipsePts(cx, cy, r * 1.8, r * 0.35, 40);
    g.ink(ring, { boil: 0.3, key: `${key}ring`, color: 'aged', w: g.w(3) });
  }
}
