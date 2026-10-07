/**
 * `art.animal` (PLAN.md#13.15a): four-legged animals from one parametric body (barrel body, four
 * two-segment legs with a gait, neck, head with a snout, ears, tail and the one feature that
 * names the species: antlers, a mane, a hump, wool, spots, horns). Species presets are knob
 * bundles; every knob can be overridden, so a film can make the animal it needs.
 */
import { z } from 'zod';
import type { ComicPen, PaintArg } from '../page/pen.js';
import { artKey, colorSchema, placeShape, timeOf } from './common.js';
import {
  ANIMAL_POSES,
  BODIES,
  EARS,
  FEATURES,
  SPECIES,
  TAILS,
  type Body,
} from './animal-bodies.js';
import { sketchFor, type Sketch } from './sketch.js';

export const animalSchema = z.strictObject({
  ...placeShape,
  species: z.enum(SPECIES).default('dog'),
  size: z.number().min(0).max(800).default(60).describe('Height to the top of the head'),
  pose: z.enum(ANIMAL_POSES).default('stand'),
  fill: colorSchema.optional(),
  belly: colorSchema.optional(),
  ears: z.enum(EARS).optional(),
  tail: z.enum(TAILS).optional(),
  feature: z.enum(FEATURES).optional(),
  speed: z.number().min(0).max(4).default(1),
});
type AnimalOptions = z.output<typeof animalSchema>;

type Leg = readonly [x: number, phase: number, near: boolean];

function legsOf(b: Body): Leg[] {
  return [
    [-b.rx * 0.62, Math.PI, false],
    [b.rx * 0.6, 0, false],
    [-b.rx * 0.55, 0, true],
    [b.rx * 0.66, Math.PI, true],
  ];
}

/** How a pose holds the body: centre, tilt (negative = front up), head drop. */
interface Stance {
  readonly cx: number;
  readonly cy: number;
  readonly tilt: number;
  readonly headDrop: number;
}

function stanceOf(o: AnimalOptions, b: Body, t: number): Stance {
  const run = o.pose === 'run' ? -Math.abs(Math.sin(t * o.speed * Math.PI * 2)) * 4 : 0;
  switch (o.pose) {
    case 'sit':
      return { cx: -b.rx * 0.2, cy: -b.y * 0.78, tilt: -0.55, headDrop: -4 };
    case 'graze':
      return { cx: 0, cy: -b.y, tilt: 0.08, headDrop: b.y * 0.55 };
    case 'alert':
      return { cx: 0, cy: -b.y, tilt: -0.06, headDrop: -6 };
    case 'leap':
      return { cx: 0, cy: -b.y * 1.3, tilt: -0.2, headDrop: -3 };
    default:
      return { cx: 0, cy: -b.y + run, tilt: 0, headDrop: 0 };
  }
}

/** A body-frame point in the animal's frame. */
function onBody(s: Stance, x: number, y: number): [number, number] {
  const c = Math.cos(s.tilt);
  const n = Math.sin(s.tilt);
  return [s.cx + x * c - y * n, s.cy + x * n + y * c];
}

function drawLeg(
  sk: Sketch,
  b: Body,
  s: Stance,
  leg: Leg,
  o: AnimalOptions,
  t: number,
  fill: PaintArg,
): void {
  const [lx, phase, near] = leg;
  const front = lx > 0;
  const top = onBody(s, lx, b.ry * 0.35);
  if (o.pose === 'sit' && !front) {
    const [hx, hy] = onBody(s, -b.rx * 0.45, b.ry * 0.25);
    sk.blob(
      [
        { e: [hx, hy, b.ry * 0.9, b.ry * 0.8] },
        { c: [hx, -b.leg, hx + b.rx * 0.55, -b.leg, b.leg] },
      ],
      fill,
    );
    return;
  }
  const p = t * o.speed * Math.PI * 2 + phase;
  let foot: [number, number] = [top[0] + (near ? 2 : -2), 0];
  let bend = front ? -3 : 4;
  if (o.pose === 'walk') {
    foot = [top[0] + Math.sin(p) * b.rx * 0.28, -Math.max(0, Math.cos(p)) * b.y * 0.12];
  } else if (o.pose === 'run') {
    foot = [
      top[0] + (front ? 1 : -1) * Math.abs(Math.sin(p)) * b.rx * 0.6,
      -b.y * (0.05 + 0.18 * Math.max(0, Math.cos(p))),
    ];
    bend = front ? -6 : 7;
  } else if (o.pose === 'leap') {
    foot = [top[0] + (front ? 1 : -1) * b.rx * 0.6, top[1] + b.y * 0.5];
    bend = front ? -4 : 5;
  }
  const knee: [number, number] = [(top[0] + foot[0]) / 2 + bend * 0.6, (top[1] + foot[1]) / 2];
  sk.blob(
    [
      { c: [top[0], top[1], knee[0], knee[1], b.leg * 1.25] },
      { c: [knee[0], knee[1], foot[0], foot[1] - b.leg * 0.6, b.leg] },
    ],
    fill,
  );
  if (b.leg > 3.2)
    sk.oval(foot[0] + 1, foot[1] - b.leg * 0.5, b.leg * 1.15, b.leg * 0.6, 'ink', {
      outline: false,
    });
  else
    sk.line(
      foot[0] - b.leg,
      foot[1] - 0.5,
      foot[0] + b.leg,
      foot[1] - 0.5,
      'ink',
      sk.widthOf('outer'),
    );
}

export function drawAnimal(g: ComicPen, o: AnimalOptions): void {
  const base = BODIES[o.species];
  const b: Body = {
    ...base,
    fill: o.fill ?? base.fill,
    belly: o.belly ?? base.belly,
    ears: o.ears ?? base.ears,
    tail: o.tail ?? base.tail,
    feature: o.feature ?? base.feature,
  };
  const key = artKey(`animal-${o.species}`, o.seed);
  const top = b.y + b.ry + Math.max(0, -b.neck[1] + b.head[1]);
  const sk = sketchFor(g, o, top * 1.05, key);
  const t = timeOf(g, o.t);
  const stance = stanceOf(o, b, t);
  const legs = legsOf(b);
  const far = sk.toned(b.fill, 0.5);
  for (const leg of legs.filter((l) => !l[2])) drawLeg(sk, b, stance, leg, o, t, far);
  const body = sk.sub(stance.cx, stance.cy, 1, stance.tilt);
  drawTail(body, b, t);
  if (b.feature === 'hump')
    body.oval(-b.rx * 0.1, -b.ry * 0.9, b.rx * 0.45, b.ry * 0.9, b.fill, { shade: 0.3 });
  const wool = b.feature === 'wool';
  body.shape(body.g.ellipsePts(0, 0, b.rx, b.ry, 22), b.fill, { shade: 0.4 });
  if (wool)
    for (let i = 0; i < 9; i += 1)
      body.oval(-b.rx * 0.8 + i * b.rx * 0.2, -b.ry * 0.85 + (i % 2) * 3, 5, 4.5, 'paper', {
        outline: 'inner',
      });
  if (b.feature === 'spots') {
    for (const [sx, sy, r] of [
      [-12, -4, 7],
      [8, 3, 6],
      [20, -6, 4],
    ] as const)
      body.solid(body.g.ellipsePts(sx, sy, r, r * 0.8, 12), 'ink');
  }
  if (b.feature === 'stripes')
    for (let i = -2; i <= 2; i += 1)
      body.stroke([i * 9 - 2, -b.ry * 0.9, i * 9 + 3, b.ry * 0.4], { w: 'outer' });
  if (!wool && b.belly !== b.fill)
    body.flat(
      [
        -b.rx * 0.6,
        b.ry * 0.55,
        b.rx * 0.6,
        b.ry * 0.55,
        b.rx * 0.3,
        b.ry * 0.88,
        -b.rx * 0.3,
        b.ry * 0.88,
      ],
      b.belly,
    );
  for (const leg of legs.filter((l) => l[2])) drawLeg(sk, b, stance, leg, o, t, b.fill);
  drawHead(body, b, o, stance.headDrop);
}

function drawTail(sk: Sketch, b: Body, t: number): void {
  const [x, y] = [-b.rx * 0.95, -b.ry * 0.3];
  const wag = Math.sin(t * 5) * 2;
  switch (b.tail) {
    case 'short':
      sk.oval(x - 2, y, 4, 3, b.belly, { outline: 'inner' });
      return;
    case 'long':
      sk.blob(
        [{ c: [x, y, x - 8, y + 18, 4] }, { c: [x - 8, y + 18, x - 6 + wag, y + 34, 3] }],
        b.feature === 'mane' ? 'ink' : b.fill,
      );
      return;
    case 'bushy':
      sk.blob(
        [{ c: [x, y, x - 14, y + 12 + wag, 5.5] }, { e: [x - 16, y + 14 + wag, 7, 5] }],
        b.fill,
      );
      sk.oval(x - 21, y + 16 + wag, 3.5, 3, 'paper', { outline: 'inner' });
      return;
    case 'curl':
      sk.stroke([x, y, x - 7, y - 8 + wag, x - 4, y - 15, x + 1, y - 13], {
        w: 'outer',
        color: 'ink',
      });
      return;
    case 'tuft':
      sk.stroke([x, y, x - 6, y + 14, x - 7, y + 26], { w: 'inner' });
      sk.oval(x - 7, y + 28, 2.4, 4, 'ink', { outline: false });
      return;
  }
}

function drawHead(sk: Sketch, b: Body, o: AnimalOptions, drop: number): void {
  const [nx, ny, nr] = b.neck;
  const [hrx, hry, snout] = b.head;
  const base: [number, number] = [b.rx * 0.72, -b.ry * 0.45];
  const head: [number, number] = [base[0] + nx, base[1] + ny + drop];
  sk.cap(base[0], base[1], head[0] - 2, head[1] + 2, nr, b.fill, { shade: 0.25 });
  if (b.feature === 'mane') {
    const lion = o.species === 'lion';
    if (lion) sk.oval(head[0] - 3, head[1], hrx * 1.75, hry * 1.7, 'sepiaMid', { shade: 0.3 });
    else
      sk.shape(
        [
          base[0] - 4,
          base[1] - nr,
          head[0] - 4,
          head[1] - hry,
          head[0] - 1,
          head[1] - hry * 0.6,
          base[0] + 2,
          base[1] - nr * 0.3,
        ],
        'ink',
        { outline: 'inner' },
      );
  }
  if (b.feature === 'antlers') {
    const [ax, ay] = [head[0] - 2, head[1] - hry];
    sk.stroke([ax, ay, ax - 6, ay - 12, ax - 13, ay - 18], { w: 'outer', color: 'sepiaMid' });
    sk.stroke([ax - 6, ay - 12, ax - 3, ay - 20], { w: 'outer', color: 'sepiaMid' });
    sk.stroke([ax + 3, ay, ax + 4, ay - 13, ax + 9, ay - 19], { w: 'outer', color: 'sepiaMid' });
    sk.stroke([ax + 4, ay - 10, ax + 9, ay - 11], { w: 'outer', color: 'sepiaMid' });
  }
  if (b.feature === 'horns')
    sk.stroke(
      [head[0] - 3, head[1] - hry, head[0] - 9, head[1] - hry - 6, head[0] - 6, head[1] - hry - 10],
      { w: 'outer', color: 'paper' },
    );
  drawEars(sk, b, head, 'back');
  const dark = b.feature === 'wool' ? 'ink' : b.fill;
  sk.oval(head[0], head[1], hrx, hry, dark, { shade: 0.2 });
  if (snout > 0)
    sk.cap(
      head[0] + hrx * 0.4,
      head[1] + hry * 0.25,
      head[0] + hrx * 0.4 + snout,
      head[1] + hry * 0.45,
      hry * 0.5,
      dark,
    );
  const tip: [number, number] = [head[0] + hrx * 0.4 + snout + hry * 0.4, head[1] + hry * 0.4];
  sk.dot(tip[0], tip[1] - 0.5, Math.max(1, hry * 0.18), o.species === 'pig' ? 'magenta' : 'ink');
  const eyeInk = b.feature === 'wool' ? 'paper' : 'ink';
  sk.dot(head[0] + hrx * 0.35, head[1] - hry * 0.25, Math.max(0.9, hry * 0.14), eyeInk);
  drawEars(sk, b, head, 'front');
}

function drawEars(
  sk: Sketch,
  b: Body,
  head: readonly [number, number],
  layer: 'back' | 'front',
): void {
  const [hx, hy] = head;
  const [, hry] = b.head;
  const fill = b.feature === 'wool' ? 'ink' : b.fill;
  if (layer === 'back') {
    if (b.ears === 'long')
      sk.shape(
        [
          hx - 3,
          hy - hry * 0.6,
          hx - 8,
          hy - hry * 3.4,
          hx - 2,
          hy - hry * 3.2,
          hx + 1,
          hy - hry * 0.7,
        ],
        fill,
        { outline: 'inner' },
      );
    return;
  }
  if (b.ears === 'point')
    sk.shape([hx - 4, hy - hry * 0.55, hx - 2, hy - hry * 1.75, hx + 2, hy - hry * 0.75], fill, {
      outline: 'inner',
    });
  if (b.ears === 'round')
    sk.oval(hx - 3, hy - hry * 0.85, hry * 0.38, hry * 0.38, fill, { outline: 'inner' });
  if (b.ears === 'long')
    sk.shape(
      [hx, hy - hry * 0.6, hx + 1, hy - hry * 3.3, hx + 5, hy - hry * 3, hx + 3, hy - hry * 0.6],
      fill,
      { outline: 'inner' },
    );
  if (b.ears === 'floppy')
    sk.shape(
      [
        hx - 4,
        hy - hry * 0.6,
        hx + 1,
        hy - hry * 0.8,
        hx - 1,
        hy + hry * 0.8,
        hx - 6,
        hy + hry * 0.5,
      ],
      'sepiaMid',
      { outline: 'inner' },
    );
  if (b.ears === 'side')
    sk.shape([hx - 3, hy - hry * 0.4, hx - 11, hy - hry * 0.6, hx - 10, hy - hry * 0.1], fill, {
      outline: 'inner',
    });
}
