/**
 * Grim Ink instruments (PLAN.md#14.20), part 1: the controls a hand works in a climax close-up —
 * lever (pull), joystick (deflection), dial or valve wheel (turn), push button (press, guard).
 * Ported from `03-apollo-11/js/props.js` (control stick) and `lunar.js`; registry and docs in
 * instruments.ts.
 */
import { z } from 'zod';
import { C } from '../core.js';
import { brushStroke, type BrushEnv } from '../draw/brushes.js';
import type { Paint2D } from '../draw/paint.js';
import { rect, rough } from '../draw/scenery.js';
import { blob, ellipseRing, tube } from '../draw/shapes.js';
import {
  coord,
  local,
  seedSchema,
  sizeSchema,
  toneOf,
  toneSchema,
  unit,
  type Drawn,
  spot,
  type LabelSpot,
} from './common.js';

const PANEL = '#45463f';
const below = (x: number, y: number, size: number, fit: number): LabelSpot => spot(x, y, size, fit);

export const leverSchema = z.strictObject({
  x: coord.default(960),
  y: coord.default(700),
  pull: unit.default(0),
  size: sizeSchema,
  tone: toneSchema.default('RED'),
  seed: seedSchema.default(800),
});

export function drawLever(g: Paint2D, e: BrushEnv, o: z.output<typeof leverSchema>): Drawn {
  const ang = -35 + 70 * o.pull;
  const [knob, knobD] = toneOf(o.tone);
  local(g, o.x, o.y, 0, o.size, () => {
    rough(g, e, [-30, -80, 30, -80, 34, 40, -34, 40], PANEL, { seed: o.seed, lw: 5, amp: 1 });
    rect(g, e, -6, -70, 12, 100, C.INK, { seed: o.seed + 1, lw: 0 });
    local(g, 0, 20, ang, 1, () => {
      tube(g, e, [0, 0, 0, -170], [16, 12], C.STONE_D, { lw: 5, seed: o.seed + 2 });
      blob(g, e, ellipseRing(0, -184, 22, 22, 10), knob, {
        lw: 5,
        seed: o.seed + 3,
        shade: [knobD, -4, 4],
        light: ['rgba(240,220,200,0.3)', 4, -4],
      });
    });
  });
  const a = (ang * Math.PI) / 180;
  const grip = [o.x + Math.sin(a) * 184 * o.size, o.y + (20 - Math.cos(a) * 184) * o.size] as const;
  return {
    box: [o.x - 80 * o.size, o.y - 230 * o.size, o.x + 80 * o.size, o.y + 40 * o.size],
    points: { grip, pivot: [o.x, o.y + 20 * o.size] },
    label: below(o.x, o.y + 70 * o.size, 26 * o.size, 120 * o.size),
  };
}

export const joystickSchema = z.strictObject({
  x: coord.default(960),
  y: coord.default(800),
  dx: z.number().min(-1).max(1).default(0),
  dy: z.number().min(-1).max(1).default(0),
  press: unit.default(0),
  size: sizeSchema,
  seed: seedSchema.default(810),
});

export function drawJoystick(g: Paint2D, e: BrushEnv, o: z.output<typeof joystickSchema>): Drawn {
  const gx = o.dx * 46;
  const gy = -150 + o.dy * 18;
  local(g, o.x, o.y, 0, o.size, () => {
    blob(g, e, ellipseRing(0, 0, 56, 18, 10), C.BLACK_D, { lw: 5, seed: o.seed });
    blob(g, e, ellipseRing(0, -6, 26, 10, 8), C.BLACK, { lw: 4, seed: o.seed + 1 });
    tube(g, e, [0, -6, gx * 0.6, gy + 40], [22, 16], C.STONE_D, { lw: 5, seed: o.seed + 2 });
    // prettier-ignore
    blob(g, e, [gx - 18, gy - 34, gx + 18, gy - 34, gx + 22, gy + 34, gx - 22, gy + 34], C.BLACK, { lw: 5, seed: o.seed + 3, hatch: { c: 'rgba(120,110,90,0.4)', n: 2, len: 20, gap: 6, k: 3, ang: 0, bend: 0 } });
    blob(g, e, ellipseRing(gx, gy - 34 + o.press * 5, 9, 6, 8), C.RED, { lw: 3, seed: o.seed + 4 });
  });
  const k = o.size;
  return {
    box: [o.x - 60 * k, o.y + (gy - 50) * k, o.x + 60 * k, o.y + 20 * k],
    points: {
      grip: [o.x + gx * k, o.y + gy * k],
      base: [o.x, o.y],
      button: [o.x + gx * k, o.y + (gy - 34) * k],
    },
  };
}

export const dialSchema = z.strictObject({
  x: coord.default(960),
  y: coord.default(540),
  r: z.number().min(6).max(800).default(40),
  turn: unit.default(0),
  kind: z.enum(['knob', 'wheel']).default('knob'),
  ticks: z.number().int().min(0).max(24).default(8),
  tone: toneSchema.default('BLACK'),
  seed: seedSchema.default(820),
});

export function drawDial(g: Paint2D, e: BrushEnv, o: z.output<typeof dialSchema>): Drawn {
  const a = ((-135 + 270 * o.turn) * Math.PI) / 180;
  const [fill, shade] = toneOf(o.tone);
  const { x, y, r } = o;
  if (o.kind === 'wheel') {
    blob(g, e, ellipseRing(x, y, r, r, 16), 'rgba(0,0,0,0)', {
      lw: Math.max(6, r * 0.22),
      lineColor: fill === C.BLACK ? C.RUST_D : fill,
      seed: o.seed,
    });
    for (let i = 0; i < 4; i += 1) {
      const s = a + (i * Math.PI) / 2;
      brushStroke(g, e, [x, y, x + Math.sin(s) * r, y - Math.cos(s) * r], {
        w: Math.max(4, r * 0.12),
        color: shade,
        seed: o.seed + 1 + i,
        taper: false,
      });
    }
    blob(g, e, ellipseRing(x, y, r * 0.18, r * 0.18, 8), C.STONE, { lw: 3, seed: o.seed + 5 });
  } else {
    for (let i = 0; i < o.ticks; i += 1) {
      const t = ((-135 + (270 * i) / Math.max(1, o.ticks - 1)) * Math.PI) / 180;
      brushStroke(
        g,
        e,
        [
          x + Math.sin(t) * r * 1.15,
          y - Math.cos(t) * r * 1.15,
          x + Math.sin(t) * r * 1.4,
          y - Math.cos(t) * r * 1.4,
        ],
        { w: 3, seed: o.seed + 10 + i, taper: false },
      );
    }
    blob(g, e, ellipseRing(x, y, r, r, 14), fill, {
      lw: 5,
      seed: o.seed,
      shade: [shade, -r * 0.1, r * 0.1],
      light: ['rgba(220,215,190,0.25)', r * 0.1, -r * 0.1],
    });
    brushStroke(g, e, [x, y, x + Math.sin(a) * r * 0.85, y - Math.cos(a) * r * 0.85], {
      w: Math.max(3, r * 0.14),
      color: C.LINEN,
      seed: o.seed + 1,
      taper: false,
    });
  }
  return {
    box: [x - r * 1.5, y - r * 1.5, x + r * 1.5, y + r * 1.5],
    points: { centre: [x, y], grip: [x + Math.sin(a) * r, y - Math.cos(a) * r] },
    label: below(x, y + r * 1.8, Math.max(12, r * 0.4), r * 3),
  };
}

export const buttonSchema = z.strictObject({
  x: coord.default(960),
  y: coord.default(540),
  r: z.number().min(6).max(400).default(28),
  kind: z.enum(['round', 'square', 'mushroom']).default('round'),
  press: unit.default(0),
  lit: z.boolean().default(false),
  guard: unit.optional(),
  tone: toneSchema.default('RED'),
  seed: seedSchema.default(830),
});

export function drawButton(g: Paint2D, e: BrushEnv, o: z.output<typeof buttonSchema>): Drawn {
  const [fill, shade] = toneOf(o.tone);
  const { x, y, r } = o;
  const down = o.press * r * 0.3;
  const top = o.lit ? '#e8b25a' : fill;
  rect(g, e, x - r * 1.5, y - r * 1.2, r * 3, r * 2.6, PANEL, { seed: o.seed, lw: 5, amp: 1 });
  if (o.kind === 'square')
    rect(g, e, x - r, y - r + down, r * 2, r * 1.8, top, {
      seed: o.seed + 1,
      lw: 5,
      shade: [shade, 0, r * 0.2 - down * 0.5],
    });
  else {
    blob(g, e, ellipseRing(x, y + r * 0.3, r * 1.05, r * 0.5, 12), C.BLACK, {
      lw: 4,
      seed: o.seed + 2,
    });
    const rr = o.kind === 'mushroom' ? r * 1.25 : r;
    blob(g, e, ellipseRing(x, y - r * 0.2 + down, rr, rr * 0.62, 12), top, {
      lw: 5,
      seed: o.seed + 3,
      shade: [shade, 0, rr * 0.25 - down * 0.4],
      ...(o.press < 0.5
        ? { light: ['rgba(240,220,200,0.35)', rr * 0.2, -rr * 0.15] as const }
        : {}),
    });
  }
  if (o.guard !== undefined) {
    const lift = o.guard * r * 1.6;
    rough(
      g,
      e,
      [
        x - r * 1.3,
        y - r * 0.9 - lift,
        x + r * 1.3,
        y - r * 0.9 - lift,
        x + r * 1.3,
        y + r - lift * 0.2,
        x - r * 1.3,
        y + r - lift * 0.2,
      ],
      'rgba(200,190,150,0.35)',
      { seed: o.seed + 4, lw: 4, amp: 0.5 },
    );
  }
  return {
    box: [x - r * 1.5, y - r * 1.2 - (o.guard ?? 0) * r * 1.6, x + r * 1.5, y + r * 1.4],
    points: { top: [x, y - r * 0.2 + down] },
    label: below(x, y + r * 1.9, Math.max(12, r * 0.45), r * 3),
  };
}
