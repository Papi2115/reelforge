/**
 * `art.person` and `art.crowd` (PLAN.md#13.15a): crude, hand-inked comic figures (the showcase's
 * bowler-hat diggers and the Bales profile are the bar: deliberately rough, never slick) built from
 * knobs: pose, expression, build, skin, hair, hat, outfit, colours, the tool in hand. Readability
 * at thumbnail size: one heavy silhouette outline, the far limbs a halftone step darker, the face
 * reduced to eyes and mouth below 40 px.
 */
import { z } from 'zod';
import { rnd } from '../draw/math.js';
import type { ComicPen } from '../page/pen.js';
import { artKey, colorSchema, parseArt, pick, placeShape, timeOf } from './common.js';
import { drawFace, drawHair, drawHat, EXPRESSIONS, HAIRS, HATS } from './people-head.js';
import { BUILDS, POSES, poseSkeleton, PROPORTIONS, type Limb, type Pt } from './people-pose.js';
import { drawTool, TOOLS } from './people-tools.js';
import { Sketch, sketchFor } from './sketch.js';

export const OUTFITS = ['shirt', 'coat', 'dress', 'robe', 'suit', 'spacesuit', 'overalls'] as const;
export const SKINS = ['pale', 'light', 'tan', 'brown', 'dark'] as const;
const SKIN_INK: Readonly<Record<(typeof SKINS)[number], string>> = {
  pale: 'paper',
  light: 'shade',
  tan: 'aged',
  brown: 'sepiaTan',
  dark: 'sepiaMid',
};
const TOPS = ['cyanDeep', 'greyMid', 'aged', 'phosphor', 'cyan', 'sepiaTan', 'greyLight', 'night'];
const BOTTOMS = ['night', 'greyDark', 'sepiaMid', 'cyanDeep', 'greyMid'];
const HAIR_INKS = ['ink', 'greyDark', 'sepiaMid', 'sepiaInk', 'aged'];

export const personSchema = z.strictObject({
  ...placeShape,
  size: z.number().min(0).max(800).default(100).describe('Height of a standing adult'),
  pose: z.enum(POSES).default('stand'),
  expression: z.enum(EXPRESSIONS).default('neutral'),
  build: z.enum(BUILDS).default('average'),
  skin: z.enum(SKINS).optional(),
  hair: z.enum(HAIRS).optional(),
  hairColor: colorSchema.optional(),
  hat: z.enum(HATS).default('none'),
  hatColor: colorSchema.optional(),
  outfit: z.enum(OUTFITS).default('shirt'),
  top: colorSchema.optional(),
  bottom: colorSchema.optional(),
  tool: z.enum(TOOLS).default('none'),
  toolColor: colorSchema.optional(),
  beard: z.boolean().default(false),
  glasses: z.boolean().default(false),
  speed: z.number().min(0).max(4).default(1).describe('Walk/run cycles per second'),
  silhouette: colorSchema.optional().describe('Flat one-ink figure (crowds, far away)'),
});
export type PersonOptions = z.output<typeof personSchema>;

/** Everything a figure is drawn with, after the seeded defaults. */
interface Dress {
  readonly skin: string;
  readonly top: string;
  readonly bottom: string;
  readonly hair: string;
  readonly hairColor: string;
  readonly flat: string | undefined;
}

function dressOf(o: PersonOptions, key: string): Dress {
  const skin = SKIN_INK[o.skin ?? pick(SKINS, key, 1)];
  const top = o.top ?? pick(TOPS, key, 2);
  return {
    skin,
    top,
    bottom:
      o.bottom ??
      pick(
        BOTTOMS.filter((ink) => ink !== top),
        key,
        3,
      ),
    hair: o.hair ?? pick(['short', 'short', 'long', 'curly', 'bun', 'bald'], key, 4),
    hairColor: o.hairColor ?? pick(HAIR_INKS, key, 5),
    flat: o.silhouette,
  };
}

function limbParts(
  l: Limb,
  r: number,
  taper: number,
): { c: [number, number, number, number, number] }[] {
  return [
    { c: [l.root[0], l.root[1], l.mid[0], l.mid[1], r] },
    { c: [l.mid[0], l.mid[1], l.end[0], l.end[1], r * taper] },
  ];
}

function shoe(sk: Sketch, foot: Pt, color: string): void {
  sk.oval(foot[0] + 2.5, foot[1] - 1.6, 5, 2.4, color, { outline: 'inner' });
}

/** The torso (and skirt/coat/robe) polygon of an outfit, model units. */
function torsoPts(o: PersonOptions, neck: Pt, hip: Pt, shoulder: number, hipW: number): number[] {
  const [nx, ny] = neck;
  const [hx, hy] = hip;
  const top = [nx - shoulder, ny + 3, nx - shoulder * 0.4, ny - 1, nx + shoulder * 0.4, ny - 1];
  const right = [nx + shoulder, ny + 3];
  switch (o.outfit) {
    case 'coat':
      return [...top, ...right, hx + hipW + 3, hy + 21, hx - hipW - 2, hy + 22];
    case 'dress':
      return [...top, ...right, hx + hipW + 9, hy + 25, hx - hipW - 8, hy + 26];
    case 'robe':
      return [...top, ...right, hx + hipW + 7, hy + 45, hx - hipW - 6, hy + 46];
    case 'spacesuit':
      return [
        nx - shoulder - 4,
        ny + 4,
        nx,
        ny - 2,
        nx + shoulder + 4,
        ny + 4,
        hx + hipW + 4,
        hy + 4,
        hx - hipW - 4,
        hy + 4,
      ];
    default:
      return [...top, ...right, hx + hipW, hy + 3, hx - hipW, hy + 3];
  }
}

function drawOutfitDetail(sk: Sketch, o: PersonOptions, neck: Pt, hip: Pt, d: Dress): void {
  const [nx, ny] = neck;
  if (d.flat !== undefined) return;
  if (o.outfit === 'suit') {
    sk.shape([nx - 1, ny, nx + 2.4, ny, nx + 1.8, ny + 16, nx + 0.3, ny + 18], 'red', {
      outline: 'inner',
    });
    sk.stroke([nx - 6, ny + 1, nx - 1, ny + 12]);
    sk.stroke([nx + 6, ny + 1, nx + 3, ny + 12]);
  } else if (o.outfit === 'overalls') {
    sk.shape(
      [hip[0] - 7, ny + 12, hip[0] + 7, ny + 12, hip[0] + 8, hip[1] + 3, hip[0] - 8, hip[1] + 3],
      d.bottom,
      { outline: 'inner', shade: 0.3 },
    );
    sk.stroke([nx - 6, ny + 1, hip[0] - 5, ny + 13]);
    sk.stroke([nx + 6, ny + 1, hip[0] + 5, ny + 13]);
  } else if (o.outfit === 'spacesuit') {
    sk.shape([nx - 7, ny + 9, nx + 7, ny + 9, nx + 7, ny + 18, nx - 7, ny + 18], 'greyMid', {
      outline: 'inner',
    });
    sk.dot(nx - 3, ny + 13, 1.3, 'red');
    sk.dot(nx + 2, ny + 13, 1.3, 'phosphor');
  } else if (o.outfit === 'coat' || o.outfit === 'robe') {
    sk.stroke([nx + 1, ny + 2, hip[0] + 2, hip[1] + (o.outfit === 'robe' ? 40 : 18)]);
    sk.line(hip[0] - 8, hip[1] - 2, hip[0] + 9, hip[1] - 2, 'ink');
  } else if (o.outfit === 'shirt') {
    sk.line(hip[0] - 8, hip[1] + 1, hip[0] + 8, hip[1] + 1, 'ink');
  }
}

/** One figure: far leg and arm, torso, near leg, head, near arm, tool. */
export function drawPerson(g: ComicPen, o: PersonOptions): void {
  const key = artKey('person', o.seed);
  const p = PROPORTIONS[o.build];
  const sk = sketchFor(g, { ...o, size: o.size * p.scale }, 100, key);
  const sp = poseSkeleton(o.pose, timeOf(g, o.t), o.speed);
  const d = dressOf(o, key);
  const fill = (ink: string) => d.flat ?? ink;
  const suit = o.outfit === 'spacesuit';
  const r = p.limbR + (suit ? 2.2 : 0);
  const long = o.outfit === 'robe';
  const legInk = fill(o.outfit === 'dress' ? d.skin : suit ? d.top : d.bottom);
  const [farArm, nearArm] = sp.arms;
  const [farLeg, nearLeg] = sp.legs;
  const shift = (l: Limb, dx: number): Limb => ({
    root: [l.root[0] + dx, l.root[1]],
    mid: l.mid,
    end: l.end,
  });
  // Far side: a halftone step darker (depth at thumbnail size).
  const far = (ink: string) => (d.flat === undefined ? sk.toned(ink, 0.5) : ink);
  if (suit)
    sk.shape(
      [
        sp.neck[0] - 16,
        sp.neck[1] + 2,
        sp.neck[0] - 7,
        sp.neck[1],
        sp.neck[0] - 7,
        sp.hip[1],
        sp.neck[0] - 17,
        sp.hip[1] - 2,
      ],
      fill('greyLight'),
      { shade: 0.4 },
    );
  sk.blob(limbParts(shift(farArm, -p.shoulder * 0.6), r * 0.92, 0.9), far(fill(d.top)));
  if (!long) {
    sk.blob(limbParts(shift(farLeg, -p.hipW * 0.4), r * 1.05, 0.85), far(legInk));
    shoe(sk, farLeg.end, fill(suit ? 'greyLight' : 'ink'));
  }
  sk.shape(torsoPts(o, sp.neck, sp.hip, p.shoulder, p.hipW), fill(d.top), {
    shade: d.flat === undefined ? 0.45 : 0,
  });
  drawOutfitDetail(sk, o, sp.neck, sp.hip, d);
  if (!long) {
    sk.blob(limbParts(shift(nearLeg, p.hipW * 0.4), r * 1.05, 0.85), legInk);
    shoe(sk, nearLeg.end, fill(suit ? 'greyLight' : 'ink'));
  } else {
    shoe(sk, nearLeg.end, fill('ink'));
  }
  drawHeadOf(sk, o, sp.head, sp.chin, p.headR, d);
  sk.blob(limbParts(shift(nearArm, p.shoulder * 0.5), r * 0.92, 0.9), fill(d.top));
  const hand = nearArm.end;
  if (o.tool !== 'none' && d.flat === undefined) drawTool(sk, o.tool, hand, o.toolColor, o.pose);
  sk.oval(hand[0] + 1, hand[1], r * 0.72, r * 0.72, fill(suit ? 'greyLight' : d.skin), {
    outline: 'inner',
  });
  if (o.pose === 'point' && d.flat === undefined)
    sk.cap(hand[0] + 2, hand[1], hand[0] + 7, hand[1] - 1, 1, d.skin, { outline: 'inner' });
}

function drawHeadOf(
  sk: Sketch,
  o: PersonOptions,
  head: Pt,
  chin: number,
  headR: number,
  d: Dress,
): void {
  const [hx, hy] = head;
  const suit = o.outfit === 'spacesuit';
  sk.cap(hx - 1, hy + headR * 0.6, hx - 1.5, hy + headR + 3, headR * 0.38, d.flat ?? d.skin, {
    outline: 'inner',
  });
  if (d.flat !== undefined) {
    sk.oval(hx, hy, headR, headR * 1.08, d.flat);
    drawHat(sk, o.hat, head, headR, d.flat, true);
    return;
  }
  if (o.hat !== 'helmet' && !suit) drawHair(sk, d.hair, head, headR, d.hairColor, 'back');
  sk.oval(hx, hy, headR, headR * 1.08, d.skin);
  // Nose on the facing side: the one shape that tells which way the head looks.
  sk.shape(
    [
      hx + headR * 0.8,
      hy - 1.5,
      hx + headR + 2.6,
      hy + 2.2 - chin * 0.4,
      hx + headR * 0.85,
      hy + 3.4,
    ],
    d.skin,
    { outline: 'inner' },
  );
  if (o.hat !== 'helmet' && !suit) drawHair(sk, d.hair, head, headR, d.hairColor, 'front');
  const tiny = sk.px * headR < 4;
  drawFace(sk, {
    expression: o.expression,
    head,
    r: headR,
    chin,
    beard: o.beard,
    glasses: o.glasses,
    skin: d.skin,
    beardColor: d.hairColor,
    tiny,
  });
  drawHat(
    sk,
    suit && o.hat === 'none' ? 'helmet' : o.hat,
    head,
    headR,
    o.hatColor ?? pick(['greyDark', 'aged', 'cyanDeep', 'sepiaMid'], `${sk.f.key}hat`, 1),
    false,
  );
}

export const crowdSchema = z.strictObject({
  x0: z.number(),
  x1: z.number(),
  y: z.number().describe('Ground line of the front row'),
  count: z.int().min(1).max(40).default(9),
  rows: z.int().min(1).max(3).default(2),
  size: z.number().min(0).max(400).default(80),
  seed: placeShape.seed,
  t: placeShape.t,
  poses: z
    .array(z.enum(POSES))
    .min(1)
    .max(9)
    .default(['stand', 'stand', 'look-up', 'point', 'walk']),
  facing: z.enum(['mixed', 'left', 'right']).default('mixed'),
  outfits: z.array(z.enum(OUTFITS)).min(1).max(7).default(['shirt', 'coat', 'dress', 'shirt']),
  hats: z.array(z.enum(HATS)).min(1).max(10).default(['none', 'none', 'cap', 'none']),
  expression: z.enum(EXPRESSIONS).optional(),
  back: z.enum(['silhouette', 'grey', 'colour']).default('silhouette'),
});

/** A crowd: back rows smaller, higher and flatter (one grey ink), the front row in colour. */
export function drawCrowd(g: ComicPen, o: z.output<typeof crowdSchema>): void {
  const key = artKey('crowd', o.seed);
  for (let row = o.rows - 1; row >= 0; row -= 1) {
    const inRow = Math.max(1, Math.round((o.count * (row === 0 ? 1.2 : 1)) / o.rows));
    const k = 0.84 ** row;
    const y = o.y - row * o.size * 0.24;
    const stagger = row % 2 === 1 ? 0.5 : 0;
    for (let i = 0; i < inRow; i += 1) {
      const id = row * 100 + i;
      const u = (i + 0.5 + stagger + (rnd(key, id) - 0.5) * 0.7) / (inRow + stagger);
      const flip = o.facing === 'left' || (o.facing === 'mixed' && rnd(key, id + 7) < 0.45);
      const flat =
        row === 0 || o.back === 'colour'
          ? undefined
          : o.back === 'grey'
            ? 'greyMid'
            : row === 1
              ? 'greyDark'
              : 'greyMid';
      drawPerson(
        g,
        parseArt(
          personSchema,
          {
            x: o.x0 + (o.x1 - o.x0) * u,
            y: y + (rnd(key, id + 3) - 0.5) * o.size * 0.04,
            size: o.size * k * (0.9 + rnd(key, id + 5) * 0.18),
            flip,
            seed: `${String(o.seed)}-${String(id)}`,
            t: o.t === undefined ? undefined : o.t + rnd(key, id + 9),
            pose: pick(o.poses, key, id + 11),
            outfit: pick(o.outfits, key, id + 13),
            hat: pick(o.hats, key, id + 15),
            expression: o.expression ?? 'neutral',
            build: pick(['average', 'average', 'slim', 'broad', 'elder'], key, id + 17),
            silhouette: flat,
          },
          'art.crowd',
        ),
      );
    }
  }
}
