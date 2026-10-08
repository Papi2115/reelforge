/**
 * `art.bird` (PLAN.md#13.15a): parametric birds by species (songbird, crow, gull, eagle, vulture,
 * owl, duck, chicken, woodpecker, parrot, penguin), flapping, gliding, perched, pecking or
 * swimming. A flying bird is placed by its centre, a perched one by its feet. Sea life: gen-fish.ts.
 */
import { z } from 'zod';
import type { ComicPen } from '../page/pen.js';
import { artKey, colorSchema, placeShape, timeOf } from './common.js';
import { sketchFor, type Sketch } from './sketch.js';

export const BIRDS = [
  'songbird',
  'crow',
  'gull',
  'eagle',
  'vulture',
  'owl',
  'duck',
  'chicken',
  'woodpecker',
  'parrot',
  'penguin',
] as const;

interface BirdLook {
  readonly body: string;
  readonly wing: string;
  readonly head: string;
  readonly beak: 'short' | 'long' | 'hook' | 'flat';
  readonly beakInk: string;
  readonly tail: number;
  readonly span: number;
  readonly crest?: string;
}

const BIRD_LOOKS: Readonly<Record<(typeof BIRDS)[number], BirdLook>> = {
  songbird: {
    body: 'cyan',
    wing: 'cyanDeep',
    head: 'cyan',
    beak: 'short',
    beakInk: 'yellow',
    tail: 10,
    span: 18,
  },
  crow: {
    body: 'night',
    wing: 'ink',
    head: 'night',
    beak: 'long',
    beakInk: 'ink',
    tail: 12,
    span: 26,
  },
  gull: {
    body: 'paper',
    wing: 'greyLight',
    head: 'paper',
    beak: 'long',
    beakInk: 'yellow',
    tail: 9,
    span: 34,
  },
  eagle: {
    body: 'sepiaMid',
    wing: 'sepiaInk',
    head: 'paper',
    beak: 'hook',
    beakInk: 'yellow',
    tail: 12,
    span: 40,
  },
  vulture: {
    body: 'greyDark',
    wing: 'ink',
    head: 'shade',
    beak: 'hook',
    beakInk: 'greyLight',
    tail: 10,
    span: 44,
  },
  owl: {
    body: 'aged',
    wing: 'sepiaMid',
    head: 'aged',
    beak: 'hook',
    beakInk: 'yellow',
    tail: 6,
    span: 30,
  },
  duck: {
    body: 'aged',
    wing: 'sepiaMid',
    head: 'phosphor',
    beak: 'flat',
    beakInk: 'yellow',
    tail: 6,
    span: 24,
  },
  chicken: {
    body: 'paper',
    wing: 'shade',
    head: 'paper',
    beak: 'short',
    beakInk: 'yellow',
    tail: 10,
    span: 16,
    crest: 'red',
  },
  woodpecker: {
    body: 'paper',
    wing: 'ink',
    head: 'ink',
    beak: 'long',
    beakInk: 'greyDark',
    tail: 10,
    span: 22,
    crest: 'red',
  },
  parrot: {
    body: 'phosphor',
    wing: 'cyan',
    head: 'red',
    beak: 'hook',
    beakInk: 'paper',
    tail: 18,
    span: 26,
  },
  penguin: {
    body: 'paper',
    wing: 'ink',
    head: 'ink',
    beak: 'long',
    beakInk: 'yellow',
    tail: 4,
    span: 0,
  },
};

export const birdSchema = z.strictObject({
  ...placeShape,
  species: z.enum(BIRDS).default('songbird'),
  size: z.number().min(0).max(600).default(30).describe('Beak to tail'),
  pose: z.enum(['fly', 'glide', 'perch', 'peck', 'swim']).default('fly'),
  body: colorSchema.optional(),
  wing: colorSchema.optional(),
  head: colorSchema.optional(),
  speed: z.number().min(0).max(8).default(2.5).describe('Wing beats per second'),
});

export function drawBird(g: ComicPen, o: z.output<typeof birdSchema>): void {
  const base = BIRD_LOOKS[o.species];
  const look = {
    ...base,
    body: o.body ?? base.body,
    wing: o.wing ?? base.wing,
    head: o.head ?? base.head,
  };
  const flying = o.pose === 'fly' || o.pose === 'glide';
  const upright = o.species === 'penguin' || o.species === 'owl';
  const sk0 = sketchFor(g, o, 40, artKey(`bird-${o.species}`, o.seed));
  const sk = flying ? sk0.sub(0, 14) : sk0;
  const t = timeOf(g, o.t);
  const flap = o.pose === 'fly' ? Math.sin(t * o.speed * Math.PI * 2) : 0.15;
  const tilt = upright && !flying ? -1.1 : o.pose === 'peck' ? 0.5 : 0;
  const body = sk.sub(0, -14, 1, tilt);
  if (!flying && o.pose !== 'swim') {
    for (const dx of [-2, 3])
      sk.stroke([dx, -8, dx + 1, 0, dx + 4, 0], { color: 'ink', w: 'outer' });
  }
  body.shape([-11, -2, -11 - look.tail, -6, -11 - look.tail, 3, -10, 3], look.wing, {
    outline: 'inner',
  });
  body.oval(0, 0, 13, 7.5, look.body, { shade: 0.35 });
  if (upright)
    body.flat(body.g.ellipsePts(2, 2, 9, 5.5, 14), o.species === 'penguin' ? 'paper' : 'shade');
  const head = upright && !flying ? body.sub(11, -3) : body.sub(11, o.pose === 'peck' ? 0 : -6);
  if (look.crest !== undefined)
    head.shape([-5, -4, -3, -11, 0, -5, 3, -10, 3, -4], look.crest, { outline: 'inner' });
  head.oval(0, 0, 6, 5.6, look.head, { shade: 0.2 });
  drawBeak(head, look);
  head.dot(2, -1.5, o.species === 'owl' ? 2.2 : 1.1, 'ink');
  if (o.species === 'owl') head.oval(2, -1.5, 3.2, 3.2, 'none', { outline: 'inner' });
  if (look.span > 0) drawWing(body, look, flap, flying);
}

function drawBeak(head: Sketch, look: BirdLook): void {
  const ink = look.beakInk;
  if (look.beak === 'short') head.shape([5, -2, 10, 0, 5, 2], ink, { outline: 'inner' });
  if (look.beak === 'long') head.shape([5, -2, 15, 0.5, 5, 2], ink, { outline: 'inner' });
  if (look.beak === 'hook')
    head.shape([4, -3, 9, -2, 10, 2, 8, 1, 4, 2], ink, { outline: 'inner' });
  if (look.beak === 'flat') head.shape([4, -1, 12, -1, 13, 2, 4, 2.5], ink, { outline: 'inner' });
}

function drawWing(body: Sketch, look: BirdLook, flap: number, flying: boolean): void {
  if (!flying) {
    body.shape([6, -3, -6, -5, -14, 0, -2, 4], look.wing, { outline: 'inner', shade: 0.3 });
    return;
  }
  const lift = -(0.55 + 0.6 * flap) * look.span;
  const tip: [number, number] = [-12, -5 + lift];
  body.shape([8, -4, 1, -5 + lift * 0.62, tip[0], tip[1], -4, -5 + lift * 0.4, -8, -3], look.wing, {
    outline: 'outer',
    shade: 0.3,
  });
  if (look.span > 24) {
    for (let i = 1; i < 4; i += 1)
      body.line(
        tip[0] + i * 2.6,
        tip[1] + i * 1.5,
        tip[0] + i * 2.6 - 4,
        tip[1] + i * 1.5 - 2,
        'ink',
      );
  }
}
