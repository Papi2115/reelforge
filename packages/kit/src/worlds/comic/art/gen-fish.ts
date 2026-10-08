/**
 * `art.fish` (PLAN.md#13.15a): sea life by its centre - fish of several body plans, tropical,
 * shark, eel, whale, ray, anglerfish (mouth full of teeth, a lit lure), jellyfish, crab, octopus.
 */
import { z } from 'zod';
import type { ComicPen } from '../page/pen.js';
import { artKey, colorSchema, placeShape, timeOf } from './common.js';
import { sketchFor, type Sketch } from './sketch.js';

export const SEA_LIFE = [
  'fish',
  'tropical',
  'shark',
  'eel',
  'whale',
  'ray',
  'anglerfish',
  'jellyfish',
  'crab',
  'octopus',
] as const;

export const fishSchema = z.strictObject({
  ...placeShape,
  kind: z.enum(SEA_LIFE).default('fish'),
  size: z
    .number()
    .min(0)
    .max(1200)
    .default(40)
    .describe('Length (jellyfish, crab, octopus: width)'),
  fill: colorSchema.optional(),
  pattern: z.enum(['none', 'stripes', 'spots']).optional(),
  speed: z.number().min(0).max(6).default(1),
});

const FISH_FILL: Readonly<Record<(typeof SEA_LIFE)[number], string>> = {
  fish: 'greyLight',
  tropical: 'yellow',
  shark: 'greyMid',
  eel: 'phosphor',
  whale: 'cyanDeep',
  ray: 'greyDark',
  anglerfish: 'sepiaMid',
  jellyfish: 'magenta',
  crab: 'red',
  octopus: 'magenta',
};

/** A fish body as a lens from the tail root to the nose, `h` = half height at its fattest. */
function lens(len: number, h: number, nose = 1): number[] {
  const top: number[] = [];
  const bottom: number[] = [];
  for (let i = 0; i <= 12; i += 1) {
    const u = i / 12;
    const x = -len / 2 + u * len;
    const k = Math.sin(Math.PI * (0.12 + 0.88 * u ** nose)) ** 0.8;
    top.push(x, -h * k);
    bottom.unshift(x, h * k * 0.9);
  }
  return [...top, ...bottom];
}

export function drawFish(g: ComicPen, o: z.output<typeof fishSchema>): void {
  const sk = sketchFor(g, o, 100, artKey(`fish-${o.kind}`, o.seed));
  const t = timeOf(g, o.t);
  const fill = o.fill ?? FISH_FILL[o.kind];
  const wig = Math.sin(t * o.speed * 6);
  switch (o.kind) {
    case 'jellyfish': {
      const pulse = 1 + Math.sin(t * o.speed * 3) * 0.08;
      for (let i = 0; i < 5; i += 1) {
        const x = -24 + i * 12;
        sk.stroke(
          [x, 0, x + Math.sin(t * 2 + i) * 6, 30, x - 3, 60, x + Math.sin(t * 2 + i + 2) * 5, 90],
          { color: 'magenta' },
        );
      }
      const bell: number[] = [];
      for (let i = 0; i <= 12; i += 1) {
        const a = Math.PI + (i / 12) * Math.PI;
        bell.push(Math.cos(a) * 38 * pulse, Math.sin(a) * 36 + 2);
      }
      for (let i = 0; i < 6; i += 1)
        bell.push(38 * pulse - (i + 0.5) * 12.6 * pulse, 2 + (i % 2) * 5);
      sk.shape(bell, fill, { shade: 0.35 });
      return;
    }
    case 'crab':
      drawCrab(sk, fill, t * o.speed);
      return;
    case 'octopus':
      drawOctopus(sk, fill, t * o.speed);
      return;
    case 'ray': {
      sk.stroke([-30, 0, -70, 4 + wig * 4, -95, 2], { w: 'outer' });
      sk.shape([-36, 0, 0, -30 - wig * 6, 44, 0, 0, 30 + wig * 6], fill, { shade: 0.45 });
      sk.dot(20, -6, 2.4, 'paper');
      sk.dot(20, 6, 2.4, 'paper');
      return;
    }
    default:
      drawFishBody(sk, o.kind, fill, o.pattern, wig);
  }
}

function drawFishBody(
  sk: Sketch,
  kind: string,
  fill: string,
  pattern: string | undefined,
  wig: number,
): void {
  const plan: Readonly<Record<string, readonly [number, number, number]>> = {
    fish: [88, 18, 1],
    tropical: [70, 30, 0.9],
    shark: [90, 15, 1.4],
    eel: [96, 6, 1],
    whale: [92, 19, 0.75],
    anglerfish: [76, 26, 0.7],
  };
  const [len, h, nose] = plan[kind] ?? [88, 18, 1];
  const tail = sk.sub(-len / 2 + 3, 0, 1, wig * 0.25);
  const flukes = kind === 'whale';
  tail.shape(
    flukes ? [0, 0, -16, -14, -10, 0, -16, 13] : [2, 0, -14, -h * 0.9, -9, 0, -14, h * 0.9],
    fill,
    { shade: 0.3 },
  );
  if (kind === 'shark' || kind === 'fish' || kind === 'tropical') {
    const fh = kind === 'shark' ? h * 1.6 : h * 0.8;
    sk.shape([-6, -h * 0.8, 4, -h * 0.9 - fh, 14, -h * 0.85], fill, { shade: 0.3 });
  }
  if (kind === 'eel') {
    const pts: number[] = [];
    for (let i = 0; i <= 14; i += 1)
      pts.push(-len / 2 + (i * len) / 14, Math.sin(i * 0.8 + wig * 2) * 8);
    for (let i = 0; i + 3 < pts.length; i += 2)
      sk.cap(pts[i] ?? 0, pts[i + 1] ?? 0, pts[i + 2] ?? 0, pts[i + 3] ?? 0, h, fill, {
        outline: false,
      });
    sk.stroke(pts, { w: 'outer', color: 'ink' });
    sk.dot(len / 2 - 4, (pts[pts.length - 1] ?? 0) - 2, 1.6, 'ink');
    return;
  }
  const body = lens(len, h, nose);
  sk.shape(body, fill, { shade: 0.45 });
  if (kind === 'whale')
    sk.flat(
      lens(len * 0.7, h * 0.35).map((v, i) => (i % 2 === 0 ? v + 8 : v * 0.6 + h * 0.62)),
      'greyLight',
    );
  if (pattern === 'stripes' || (pattern === undefined && kind === 'tropical')) {
    sk.g.clip(sk.map(body), () => {
      for (const x of [-18, 0, 18])
        sk.shape([x - 4, -40, x + 4, -40, x + 4, 40, x - 4, 40], 'ink', { outline: false });
    });
  }
  if (pattern === 'spots')
    for (let i = 0; i < 6; i += 1) sk.dot(-20 + i * 8, -h * 0.3 + (i % 2) * 6, 2.2, 'paper');
  sk.stroke([len * 0.18, -h * 0.55, len * 0.12, 0, len * 0.18, h * 0.5], {});
  if (kind === 'shark')
    for (let i = 0; i < 3; i += 1)
      sk.line(len * 0.12 - i * 3, -h * 0.4, len * 0.1 - i * 3, h * 0.3);
  const eye: [number, number] = [len * 0.34, -h * 0.25];
  sk.oval(eye[0], eye[1], kind === 'whale' ? 1.5 : 3.2, kind === 'whale' ? 1.5 : 3.2, 'paper', {
    outline: 'inner',
  });
  sk.dot(eye[0] + 0.6, eye[1], kind === 'whale' ? 1 : 1.6, 'ink');
  if (kind === 'anglerfish') {
    // The defining features: a wide toothy mouth and a lit lure on a stalk (pale, it is dark).
    sk.shape([len * 0.5, -h * 0.05, len * 0.18, h * 0.2, len * 0.5, h * 0.55], 'ink', {
      outline: false,
    });
    for (let i = 0; i < 5; i += 1) {
      const x = len * 0.24 + i * len * 0.055;
      sk.shape([x, h * 0.18 + i * 0.6, x + 2, h * 0.02, x + 4, h * 0.2 + i * 0.6], 'paper', {
        outline: false,
      });
    }
    sk.stroke([len * 0.3, -h * 0.9, len * 0.45, -h * 1.9, len * 0.62, -h * 1.5], {
      color: 'aged',
      w: 'outer',
    });
    sk.oval(len * 0.62, -h * 1.45, 3.4, 3.4, 'yellowPale', { outline: 'inner' });
  }
}

function drawCrab(sk: Sketch, fill: string, t: number): void {
  for (const side of [-1, 1]) {
    for (let i = 0; i < 3; i += 1) {
      const sx = side * (22 + i * 6);
      sk.stroke(
        [side * 14, -10 + i * 4, sx, -18 + i * 6, sx + side * 6, 0 + Math.sin(t * 8 + i) * 2],
        { w: 'outer', color: 'ink' },
      );
    }
    const claw = sk.sub(side * 30, -36 + Math.sin(t * 4 + side) * 3);
    sk.stroke([side * 14, -18, side * 26, -30], { w: 'outer' });
    claw.shape([side * -6, 4, side * -4, -8, side * 8, -10, side * 2, -2, side * 8, 2], fill, {
      shade: 0.3,
    });
  }
  sk.oval(0, -14, 26, 13, fill, { shade: 0.45 });
  for (const ex of [-6, 6]) {
    sk.line(ex, -24, ex, -32);
    sk.dot(ex, -33, 2.4, 'ink');
  }
}

function drawOctopus(sk: Sketch, fill: string, t: number): void {
  for (let i = 0; i < 6; i += 1) {
    const x = -30 + i * 12;
    const pts: number[] = [];
    for (let j = 0; j <= 6; j += 1)
      pts.push(x + Math.sin(t * 2 + i + j * 0.7) * 6 + (x * j) / 14, j * 9);
    sk.stroke(pts, { w: 'outer', color: fill });
  }
  sk.shape([-26, 4, -30, -26, -12, -50, 12, -50, 30, -26, 26, 4], fill, { shade: 0.45 });
  for (const ex of [-9, 9]) {
    sk.oval(ex, -12, 5, 6, 'paper', { outline: 'inner' });
    sk.dot(ex + 1, -11, 2.4, 'ink');
  }
}
