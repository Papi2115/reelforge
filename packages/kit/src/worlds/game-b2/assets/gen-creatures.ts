/**
 * Creature generator of the Game B2 open layer: `{ gen: 'creature', kind: bird | quadruped |
 * fish | insect | reptile, form, seed, size, coat, belly, pattern, ... }`, seen from the side,
 * two frames (flap, stride, tail wag) at a few fps. Knobs make the species: a quadruped with a
 * long neck and spots is a giraffe, with antlers a deer, with a hump a camel; `facing: 'left'`
 * mirrors it. Shaded blobs and strokes in the world's ramps, outlined, crude on purpose.
 */
import { z } from 'zod';
import { Bmp } from '../core/bitmap.js';
import { C } from '../palette.js';
import { blob, finish, mirror, speckle, stroke } from './draw.js';
import { px, rampParam, seedParam, type MadeSprite } from './made.js';
import { colourRef, rampOf, type Ramp } from './ramps.js';

export const CREATURE_KINDS = ['bird', 'quadruped', 'fish', 'insect', 'reptile'] as const;
export const CREATURE_FORMS = {
  bird: ['perch', 'fly'],
  quadruped: ['grazer', 'dog', 'cat', 'bear', 'horse'],
  fish: ['slim', 'round', 'eel'],
  insect: ['bee', 'butterfly', 'beetle', 'ant'],
  reptile: ['lizard', 'snake', 'croc', 'turtle'],
} as const;

export const creatureSchema = z.strictObject({
  gen: z.literal('creature'),
  kind: z.enum(CREATURE_KINDS),
  form: z
    .string()
    .optional()
    .describe(
      'bird: perch|fly; quadruped: grazer|dog|cat|bear|horse; fish: slim|round|eel; insect: bee|butterfly|beetle|ant; reptile: lizard|snake|croc|turtle',
    ),
  seed: seedParam,
  size: z.number().min(0.05).max(3).optional().describe('World length (default per kind)'),
  coat: rampParam.optional().describe('Body ramp (default per kind)'),
  belly: z.string().optional().describe('Belly / wing / spot colour (swatch or ramp step)'),
  pattern: z.enum(['plain', 'spots', 'stripes']).default('plain'),
  neck: z.number().min(0).max(1).default(0.3).describe('quadruped: 0 short .. 1 giraffe'),
  legs: z.number().min(0).max(1).default(0.5).describe('quadruped: leg length'),
  horns: z.enum(['none', 'antlers', 'horns', 'tusks']).default('none'),
  hump: z.boolean().default(false),
  ears: z.enum(['none', 'pointy', 'long', 'round']).default('pointy'),
  facing: z.enum(['right', 'left']).default('right'),
});
export type CreatureSpec = z.output<typeof creatureSchema>;
type Kind = CreatureSpec['kind'];

/** Default [length, height/length, ramp, foot z]. */
const BASE: Readonly<Record<Kind, readonly [number, number, keyof typeof DEFAULT_COAT, number]>> = {
  bird: [0.32, 0.8, 'bird', 0],
  quadruped: [1.0, 0.8, 'quadruped', 0],
  fish: [0.45, 0.5, 'fish', 0.35],
  insect: [0.12, 0.8, 'insect', 0.45],
  reptile: [0.7, 0.35, 'reptile', 0],
};
const DEFAULT_COAT = {
  bird: 'stone',
  quadruped: 'warm',
  fish: 'sky',
  insect: 'rust',
  reptile: 'leaf',
} as const;

interface Draw {
  readonly b: Bmp;
  readonly w: number;
  readonly h: number;
  readonly coat: Ramp;
  readonly belly: number;
  readonly spec: CreatureSpec;
  readonly frame: number;
}

const RAMP_SKIN: Ramp = [C.MOSS, C.GREEN, C.SAGE, C.FLUO];

const step = (ramp: Ramp, k: number): number =>
  ramp[Math.max(0, Math.min(ramp.length - 1, k))] ?? C.VOID;

function bird(d: Draw): void {
  const { b, w, h, coat, frame } = d;
  const fly = d.spec.form === 'fly';
  const by = fly ? h * 0.5 : h * 0.55;
  stroke(b, w * 0.18, by, w * 0.02, by + h * (fly ? 0 : 0.18), 3, step(coat, 1));
  blob(b, w * 0.45, by, w * 0.27, h * 0.17, coat, d.spec.seed, 0, 1, 4);
  blob(b, w * 0.72, by - h * 0.15, w * 0.13, h * 0.13, coat, d.spec.seed + 1, 0, 1, 4);
  b.poly([w * 0.83, by - h * 0.17, w * 0.98, by - h * 0.12, w * 0.83, by - h * 0.09], C.TUNGSTEN);
  b.px(w * 0.75, by - h * 0.18, C.VOID);
  if (fly) {
    const up = frame === 0;
    b.poly(
      up
        ? [w * 0.35, by - 2, w * 0.58, by - 2, w * 0.3, by - h * 0.48]
        : [w * 0.35, by + 1, w * 0.58, by + 1, w * 0.28, by + h * 0.4],
      d.belly,
    );
  } else {
    blob(b, w * 0.4, by + 1, w * 0.18, h * 0.1, coat, d.spec.seed + 2, 0, 0, 2);
    const hop = frame === 1 ? 1 : 0;
    stroke(b, w * 0.42, by + h * 0.15, w * 0.4, h - 1 - hop, 1, C.TUNGSTEN);
    stroke(b, w * 0.5, by + h * 0.15, w * 0.52, h - 1 - hop, 1, C.TUNGSTEN);
  }
}

function legPair(d: Draw, x: number, top: number, swing: number, near: boolean): void {
  const { b, h, coat } = d;
  const c = step(coat, near ? 2 : 1);
  const thick = Math.max(2, Math.round(d.w * 0.045));
  stroke(b, x, top, x + swing, h - 3, thick, c);
  b.rect(x + swing - thick / 2, h - 3, thick + 1, 3, C.UMBER);
}

function quadruped(d: Draw): void {
  const { b, w, h, coat, frame, spec } = d;
  const form = spec.form ?? 'grazer';
  const legLen = 0.25 + spec.legs * 0.25;
  const bodyY = h * (1 - legLen - 0.16);
  const bodyRy = h * (form === 'bear' ? 0.22 : 0.15);
  const s = frame === 0 ? 1 : -1;
  const stride = w * 0.05;
  legPair(d, w * 0.33, bodyY, -stride * s, false);
  legPair(d, w * 0.66, bodyY, stride * s, false);
  const tailLong = form === 'cat' || form === 'horse' || form === 'dog';
  stroke(
    b,
    w * 0.18,
    bodyY - h * 0.04,
    w * 0.05,
    bodyY + h * (tailLong ? 0.12 : 0.02),
    form === 'horse' ? 4 : 2,
    step(coat, 1),
  );
  blob(b, w * 0.45, bodyY, w * 0.3, bodyRy, coat, spec.seed, form === 'bear' ? 0.2 : 0, 1, 4);
  if (spec.hump)
    blob(b, w * 0.45, bodyY - bodyRy * 0.9, w * 0.12, bodyRy * 0.7, coat, spec.seed + 3, 0, 1, 4);
  legPair(d, w * 0.28, bodyY, stride * s, true);
  legPair(d, w * 0.7, bodyY, -stride * s, true);
  const neckTop = bodyY - h * (0.12 + spec.neck * 0.45);
  const headX = w * (0.8 + spec.neck * 0.04);
  stroke(
    b,
    w * 0.7,
    bodyY - bodyRy * 0.3,
    headX - w * 0.02,
    neckTop,
    Math.max(3, Math.round(h * 0.11)),
    step(coat, 2),
  );
  if (form === 'horse')
    stroke(b, w * 0.68, bodyY - bodyRy, headX - w * 0.05, neckTop - 2, 2, step(coat, 0));
  blob(b, headX, neckTop, w * 0.08, h * 0.07, coat, spec.seed + 4, 0, 1, 4);
  const snout = form === 'cat' || form === 'bear' ? 0.06 : 0.1;
  blob(b, headX + w * snout, neckTop + h * 0.03, w * 0.05, h * 0.045, coat, spec.seed + 5, 0, 1, 3);
  b.px(headX + w * 0.02, neckTop - h * 0.02, C.VOID);
  if (spec.ears === 'pointy')
    b.poly(
      [
        headX - w * 0.04,
        neckTop - h * 0.04,
        headX - w * 0.01,
        neckTop - h * 0.13,
        headX + w * 0.01,
        neckTop - h * 0.05,
      ],
      step(coat, 1),
    );
  if (spec.ears === 'long')
    stroke(
      b,
      headX - w * 0.03,
      neckTop - h * 0.04,
      headX - w * 0.07,
      neckTop - h * 0.18,
      2,
      step(coat, 2),
    );
  if (spec.ears === 'round')
    blob(b, headX - w * 0.03, neckTop - h * 0.07, 2.5, 2.5, coat, spec.seed + 6, 0, 0, 2);
  if (spec.horns === 'antlers') {
    const ax = headX - w * 0.01;
    const ay = neckTop - h * 0.06;
    stroke(b, ax, ay, ax - w * 0.06, ay - h * 0.2, 1, C.SAND_L);
    stroke(b, ax - w * 0.03, ay - h * 0.1, ax + w * 0.03, ay - h * 0.17, 1, C.SAND_L);
    stroke(b, ax - w * 0.05, ay - h * 0.16, ax - w * 0.11, ay - h * 0.2, 1, C.SAND_L);
  }
  if (spec.horns === 'horns')
    stroke(b, headX, neckTop - h * 0.05, headX - w * 0.04, neckTop - h * 0.12, 2, C.PUTTY);
  if (spec.horns === 'tusks')
    stroke(
      b,
      headX + w * 0.1,
      neckTop + h * 0.07,
      headX + w * 0.14,
      neckTop + h * 0.02,
      2,
      C.PAPER,
    );
}

function fish(d: Draw): void {
  const { b, w, h, coat, frame, spec } = d;
  const form = spec.form ?? 'slim';
  const wag = frame === 0 ? -1 : 1;
  if (form === 'eel') {
    for (let x = 0; x < w * 0.95; x += 1) {
      const y = h * 0.5 + Math.sin(x * 0.25 + frame * 1.6) * h * 0.18;
      stroke(b, x, y - 2, x, y + 2, 1, step(coat, x < w * 0.3 ? 2 : 3));
    }
    b.px(w * 0.9, h * 0.45, C.VOID);
    return;
  }
  const ry = h * (form === 'round' ? 0.34 : 0.22);
  b.poly(
    [
      w * 0.22,
      h * 0.5,
      w * 0.02,
      h * 0.5 - ry + wag * 2,
      w * 0.06,
      h * 0.5,
      w * 0.02,
      h * 0.5 + ry + wag * 2,
    ],
    step(coat, 1),
  );
  b.poly(
    [w * 0.4, h * 0.5 - ry * 0.8, w * 0.55, h * 0.5 - ry * 1.5, w * 0.62, h * 0.5 - ry * 0.7],
    step(coat, 1),
  );
  blob(b, w * 0.55, h * 0.5, w * 0.38, ry, coat, spec.seed, 0, 1, 4);
  for (let x = Math.floor(w * 0.3); x < w * 0.85; x += 1) b.px(x, h * 0.5 + ry * 0.5, d.belly);
  b.px(w * 0.82, h * 0.45, C.VOID);
  b.px(w * 0.81, h * 0.45, C.PAPER);
}

function insect(d: Draw): void {
  const { b, w, h, coat, frame, spec } = d;
  const form = spec.form ?? 'bee';
  if (form === 'butterfly') {
    const open = frame === 0 ? 1 : 0.45;
    blob(
      b,
      w * 0.5 - w * 0.22 * open,
      h * 0.4,
      w * 0.22 * open + 1,
      h * 0.28,
      coat,
      spec.seed,
      0,
      1,
      4,
    );
    blob(
      b,
      w * 0.5 + w * 0.22 * open,
      h * 0.4,
      w * 0.22 * open + 1,
      h * 0.28,
      coat,
      spec.seed + 1,
      0,
      1,
      4,
    );
    b.rect(w * 0.5 - 1, h * 0.25, 2, h * 0.5, C.VOID);
    speckle(b, 0.05, d.belly, spec.seed + 2);
    return;
  }
  const legsY = h * 0.75;
  for (let k = 0; k < 3; k += 1)
    stroke(
      b,
      w * (0.35 + k * 0.15),
      h * 0.6,
      w * (0.3 + k * 0.17) + (frame ? 1 : -1),
      legsY + 2,
      1,
      C.VOID,
    );
  if (form === 'ant') {
    for (const [x, r] of [
      [0.25, 0.14],
      [0.5, 0.1],
      [0.72, 0.12],
    ] as const)
      blob(b, w * x, h * 0.55, w * r, h * 0.16, coat, spec.seed, 0, 0, 2);
    return;
  }
  blob(b, w * 0.5, h * 0.55, w * 0.3, h * 0.24, coat, spec.seed, 0, 1, 4);
  blob(b, w * 0.82, h * 0.5, w * 0.11, h * 0.14, coat, spec.seed + 1, 0, 0, 2);
  if (form === 'bee') {
    for (let x = Math.floor(w * 0.3); x < w * 0.72; x += 4)
      b.rect(x, h * 0.36, 2, h * 0.38, C.VOID);
    const flap = frame === 0 ? h * 0.32 : h * 0.12;
    blob(b, w * 0.45, h * 0.3 - flap * 0.4, w * 0.16, flap, [C.MOON, C.PAPER], spec.seed + 2, 0);
  }
}

function reptile(d: Draw): void {
  const { b, w, h, coat, frame, spec } = d;
  const form = spec.form ?? 'lizard';
  if (form === 'snake') {
    for (let x = 0; x < w * 0.9; x += 1) {
      const y = h * 0.62 + Math.sin(x * 0.18 + frame * 2) * h * 0.18;
      const t = Math.max(1, Math.round(3 - (x < w * 0.2 ? (w * 0.2 - x) / (w * 0.07) : 0)));
      stroke(b, x, y - t, x, y + t, 1, step(coat, (x >> 2) % 2 ? 2 : 3));
    }
    blob(
      b,
      w * 0.92,
      h * 0.6 + Math.sin(w * 0.9 * 0.18 + frame * 2) * h * 0.18,
      4,
      3,
      coat,
      spec.seed,
      0,
      1,
      3,
    );
    return;
  }
  if (form === 'turtle') {
    blob(b, w * 0.82, h * 0.6, w * 0.08, h * 0.12, RAMP_SKIN, spec.seed, 0, 0, 3);
    stroke(b, w * 0.3, h * 0.75, w * 0.26 + frame, h - 1, 3, C.SAGE);
    stroke(b, w * 0.66, h * 0.75, w * 0.7 - frame, h - 1, 3, C.SAGE);
    blob(b, w * 0.48, h * 0.62, w * 0.32, h * 0.38, coat, spec.seed + 1, 0, 0, 3);
    speckle(b, 0.06, step(coat, 0), spec.seed + 2);
    return;
  }
  const croc = form === 'croc';
  const body = h * 0.62;
  for (let k = 0; k < 4; k += 1) {
    const x = w * (k < 2 ? 0.32 + k * 0.06 : 0.6 + (k - 2) * 0.06);
    stroke(b, x, body, x + ((k + frame) % 2 ? 3 : -3), h - 1, 2, step(coat, 1));
  }
  b.poly([0, body, w * 0.3, body - h * 0.1, w * 0.3, body + h * 0.12], step(coat, 2));
  blob(b, w * 0.5, body, w * 0.24, h * 0.17, coat, spec.seed, 0, 1, 4);
  b.poly(
    [w * 0.7, body - h * 0.1, w * (croc ? 1 : 0.92), body + h * 0.02, w * 0.7, body + h * 0.12],
    step(coat, 2),
  );
  b.px(w * 0.76, body - h * 0.05, C.VOID);
  if (croc)
    for (let x = Math.floor(w * 0.3); x < w * 0.7; x += 3) b.px(x, body - h * 0.17, step(coat, 0));
}

const DRAW: Readonly<Record<Kind, (d: Draw) => void>> = { bird, quadruped, fish, insect, reptile };

export function creatureProblems(spec: CreatureSpec): string[] {
  const forms: readonly string[] = CREATURE_FORMS[spec.kind];
  return spec.form === undefined || forms.includes(spec.form)
    ? []
    : [`form "${spec.form}" is not a ${spec.kind} form (known: ${forms.join(', ')})`];
}

/** Draws one creature (two frames). */
export function makeCreature(spec: CreatureSpec): MadeSprite {
  const [length, ratio, coatKey, z] = BASE[spec.kind];
  const size = spec.size ?? length;
  const height =
    size * ratio * (spec.kind === 'quadruped' ? 0.7 + spec.neck * 0.5 + spec.legs * 0.3 : 1);
  const coat = rampOf(spec.coat ?? DEFAULT_COAT[coatKey]);
  const belly =
    spec.belly === undefined ? step(coat, coat.length - 1) : (colourRef(spec.belly) ?? C.PAPER);
  const floating =
    spec.kind === 'fish' ||
    (spec.kind === 'bird' && spec.form === 'fly') ||
    (spec.kind === 'insect' && spec.form !== 'ant' && spec.form !== 'beetle');
  const frames = [0, 1].map((frame) => {
    const w = px(size, 8);
    const h = px(height, 6);
    const draw: Draw = {
      b: new Bmp(w, h),
      w,
      h,
      coat,
      belly,
      spec,
      frame,
    };
    DRAW[spec.kind](draw);
    if (spec.pattern === 'spots') speckle(draw.b, 0.06, step(coat, 0), spec.seed + 9);
    if (spec.pattern === 'stripes')
      for (let y = 0; y < h; y += 1)
        for (let x = 0; x < w; x += 1)
          if ((x + (y >> 1)) % 6 === 0 && draw.b.d[y * w + x] !== 255)
            draw.b.d[y * w + x] = step(coat, 0);
    return finish(spec.facing === 'left' ? mirror(draw.b) : draw.b, C.VOID);
  });
  const fps = spec.kind === 'insect' || (spec.kind === 'bird' && spec.form === 'fly') ? 8 : 3;
  return {
    frames,
    size: [size, height],
    z: floating ? z + (spec.kind === 'bird' ? 0.9 : 0) : 0,
    fps,
  };
}
