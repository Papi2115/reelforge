/**
 * Person generator of the Game B2 open layer: a humanoid base in the clerk's crude front-on style
 * with knobs for who it is (`build`, `skin`, `hair`, `beard`, `hat`, `outfit`, `clothes` ramp,
 * `trim` colour, `tool`), so a prime minister, an MP and a Londoner are different people. Four
 * frames like the clerk: rest, talking, head-shake left / right (`view.act` drives them). Never a
 * real person's likeness: dot eyes, a line mouth.
 */
import { z } from 'zod';
import { Bmp } from '../core/bitmap.js';
import { C } from '../palette.js';
import { blob, finish, stroke } from './draw.js';
import { rampParam, seedParam, type MadeSprite } from './made.js';
import { colourRef, rampOf, type Ramp, type RampName } from './ramps.js';

export const HATS = [
  'none',
  'top',
  'cap',
  'bowler',
  'hood',
  'helmet',
  'crown',
  'bonnet',
  'straw',
  'hardhat',
  'wizard',
  'turban',
  'space',
] as const;
export const OUTFITS = [
  'suit',
  'coat',
  'robe',
  'dress',
  'tunic',
  'overalls',
  'uniform',
  'spacesuit',
  'apron',
  'rags',
] as const;
export const TOOLS = [
  'none',
  'staff',
  'sword',
  'spade',
  'book',
  'lantern',
  'basket',
  'cane',
  'umbrella',
  'clipboard',
  'torch',
  'pickaxe',
  'bucket',
] as const;

export const personSchema = z.strictObject({
  gen: z.literal('person'),
  seed: seedParam,
  height: z.number().min(0.3).max(1.4).default(0.84).describe('World height (walls are 1)'),
  build: z.enum(['slim', 'average', 'stout', 'child']).default('average'),
  skin: z.int().min(0).max(3).default(1).describe('0 light .. 3 deep'),
  hair: z.enum(['none', 'short', 'long', 'bun']).default('short'),
  hairColour: z.string().default('brown').describe('Swatch or ramp step'),
  beard: z.boolean().default(false),
  glasses: z.boolean().default(false),
  hat: z.enum(HATS).default('none'),
  outfit: z.enum(OUTFITS).default('coat'),
  clothes: rampParam.optional().describe('Ramp of the outfit (default per outfit)'),
  trim: z.string().optional().describe('Tie / sash / belt colour (swatch or ramp step)'),
  tool: z.enum(TOOLS).default('none'),
});
export type PersonSpec = z.output<typeof personSchema>;

/** [base, shade] skin colours per tone. */
const SKIN: readonly (readonly [number, number])[] = [
  [C.SAND_L, C.TAN],
  [C.TAN, C.WOOD],
  [C.WOOD, C.BROWN],
  [C.BROWN, C.UMBER],
];
const OUTFIT_RAMP: Readonly<Record<PersonSpec['outfit'], RampName>> = {
  suit: 'stone',
  coat: 'sky',
  robe: 'plum',
  dress: 'rust',
  tunic: 'earth',
  overalls: 'sky',
  uniform: 'leaf',
  spacesuit: 'stone',
  apron: 'earth',
  rags: 'earth',
};
const PPU_PEOPLE = 80;

interface Body {
  readonly b: Bmp;
  readonly w: number;
  readonly h: number;
  readonly cx: number;
  readonly cloth: Ramp;
  readonly skin: readonly [number, number];
  readonly trim: number;
  readonly hairC: number;
}

const at = (ramp: Ramp, k: number): number =>
  ramp[Math.max(0, Math.min(ramp.length - 1, k))] ?? C.SLATE;

function torso(p: Body, spec: PersonSpec): void {
  const { b, h, cx, cloth } = p;
  const wide = { slim: 0.34, average: 0.4, stout: 0.5, child: 0.4 }[spec.build] * p.w;
  const top = h * 0.24;
  const waist = h * 0.6;
  const long =
    spec.outfit === 'robe' ||
    spec.outfit === 'dress' ||
    spec.outfit === 'coat' ||
    spec.outfit === 'rags';
  const hem = long ? h * (spec.outfit === 'coat' ? 0.78 : 0.92) : waist;
  b.poly(
    [
      cx - wide / 2,
      top,
      cx + wide / 2,
      top,
      cx + wide / 2 + (long ? 3 : 0),
      hem,
      cx - wide / 2 - (long ? 3 : 0),
      hem,
    ],
    at(cloth, 2),
  );
  b.poly(
    [
      cx + wide * 0.15,
      top,
      cx + wide / 2,
      top,
      cx + wide / 2 + (long ? 3 : 0),
      hem,
      cx + wide * 0.2,
      hem,
    ],
    at(cloth, 1),
  );
  b.rect(cx - wide / 2, top, wide, 1, at(cloth, 3));
  const legC =
    spec.outfit === 'overalls' ? at(cloth, 1) : spec.outfit === 'spacesuit' ? at(cloth, 3) : C.CHAR;
  for (const side of [-1, 1]) {
    const x = cx + side * wide * 0.22;
    b.rect(x - wide * 0.15, Math.min(hem, waist), wide * 0.3, h - 3 - Math.min(hem, waist), legC);
    b.rect(x - wide * 0.14, h - 3, wide * 0.3, 3, spec.outfit === 'spacesuit' ? C.GREY : C.VOID);
  }
  if (spec.outfit === 'suit') {
    b.poly([cx - 3, top, cx + 3, top, cx, top + h * 0.12], C.PAPER);
    b.rect(cx - 1, top + 1, 2, h * 0.16, p.trim);
  }
  if (spec.outfit === 'apron')
    b.rect(cx - wide * 0.3, top + h * 0.1, wide * 0.6, h * 0.36, C.PAPER);
  if (spec.outfit === 'uniform' || spec.outfit === 'tunic')
    b.rect(cx - wide / 2, waist - 2, wide, 2, p.trim);
  if (spec.outfit === 'robe') b.rect(cx - 1, top, 2, hem - top, p.trim);
  if (spec.outfit === 'rags')
    for (let x = Math.round(cx - wide / 2); x < cx + wide / 2; x += 3) b.px(x, hem, 255);
  if (spec.outfit === 'spacesuit') b.rect(cx - 4, top + h * 0.08, 8, 5, C.FLUO);
  for (const side of [-1, 1]) {
    const sx = cx + side * (wide / 2 + 1);
    stroke(
      b,
      sx,
      top + 2,
      sx + side * 2,
      h * 0.52,
      Math.max(3, p.w * 0.1),
      at(cloth, side < 0 ? 2 : 1),
    );
    b.rect(sx + side * 2 - 2, h * 0.52, 4, 3, p.skin[side < 0 ? 0 : 1]);
  }
}

function head(p: Body, spec: PersonSpec, frame: number): void {
  const { b, h } = p;
  const tilt = frame === 2 ? -1 : frame === 3 ? 1 : 0;
  const cx = p.cx + tilt;
  const cy = h * 0.13;
  const r = h * 0.075;
  b.rect(cx - 2, cy + r - 1, 4, h * 0.05, p.skin[1]);
  if (spec.hair === 'long') b.rect(cx - r - 1, cy - r * 0.4, r * 2 + 2, r * 2.4, p.hairC);
  blob(b, cx, cy, r, r * 1.1, [p.skin[1], p.skin[0], p.skin[0]], spec.seed, 0, 0, 2);
  if (spec.hair !== 'none') b.rect(cx - r, cy - r * 1.1, r * 2, r * 0.6, p.hairC);
  if (spec.hair === 'bun') blob(b, cx, cy - r * 1.3, r * 0.5, r * 0.4, [p.hairC], spec.seed);
  b.px(cx - r * 0.4, cy, C.VOID);
  b.px(cx + r * 0.4, cy, C.VOID);
  if (spec.glasses) {
    b.rect(cx - r * 0.7, cy - 1, r * 1.4, 1, C.CHAR);
    b.px(cx - r * 0.4, cy, C.MOON);
  }
  if (spec.beard) b.rect(cx - r * 0.7, cy + r * 0.4, r * 1.4, r * 0.8, p.hairC);
  b.rect(cx - 1, cy + r * 0.55, 3, frame === 1 ? 2 : 1, C.UMBER);
  hat(p, spec, cx, cy, r);
}

function hat(p: Body, spec: PersonSpec, cx: number, cy: number, r: number): void {
  const { b } = p;
  const top = cy - r * 1.1;
  switch (spec.hat) {
    case 'top':
      b.rect(cx - r * 1.3, top, r * 2.6, 2, C.VOID);
      b.rect(cx - r * 0.85, top - r * 1.6, r * 1.7, r * 1.6, C.CHAR);
      b.rect(cx - r * 0.85, top - 3, r * 1.7, 1, p.trim);
      break;
    case 'bowler':
      b.rect(cx - r * 1.2, top, r * 2.4, 2, C.VOID);
      blob(b, cx, top - 1, r * 0.9, r * 0.7, [C.VOID, C.CHAR, C.SLATE], 3);
      break;
    case 'cap':
      b.rect(cx - r, top - 2, r * 2, r * 0.6, p.trim);
      b.rect(cx, top + 1, r * 1.3, 2, p.trim);
      break;
    case 'hood':
      b.poly(
        [
          cx - r * 1.4,
          cy + r,
          cx,
          top - r * 0.9,
          cx + r * 1.4,
          cy + r,
          cx + r * 0.9,
          cy - r * 0.2,
          cx - r * 0.9,
          cy - r * 0.2,
        ],
        at(p.cloth, 1),
      );
      break;
    case 'helmet':
      blob(b, cx, top + 1, r * 1.15, r * 0.8, [C.SLATE, C.GREY, C.PUTTY], 4);
      b.rect(cx - 1, top - r * 0.6, 2, r, C.CHAR);
      break;
    case 'crown':
      b.poly(
        [
          cx - r,
          top + 1,
          cx - r,
          top - r * 0.8,
          cx - r * 0.4,
          top - r * 0.3,
          cx,
          top - r,
          cx + r * 0.4,
          top - r * 0.3,
          cx + r,
          top - r * 0.8,
          cx + r,
          top + 1,
        ],
        C.TUNGSTEN,
      );
      b.px(cx, top - r * 0.4, C.ACCENT_D);
      break;
    case 'bonnet':
      blob(b, cx, top + r * 0.2, r * 1.3, r * 0.9, [C.SAND, C.SAND_L, C.PAPER], 5);
      break;
    case 'straw':
      b.rect(cx - r * 1.8, top + 1, r * 3.6, 2, C.TUNGSTEN);
      blob(b, cx, top, r * 0.9, r * 0.6, [C.TAN, C.TUNGSTEN], 6);
      break;
    case 'hardhat':
      blob(b, cx, top + 1, r * 1.1, r * 0.75, [C.TAN, C.TUNGSTEN, C.BULB], 7);
      b.rect(cx - r * 1.4, top + 1, r * 2.8, 1, C.TUNGSTEN);
      break;
    case 'wizard':
      b.poly(
        [cx - r * 1.3, top + 2, cx + r * 0.2, top - r * 3, cx + r * 1.3, top + 2],
        at(p.cloth, 2),
      );
      break;
    case 'turban':
      blob(b, cx, top, r * 1.2, r * 0.8, [p.trim, C.PAPER], 8);
      break;
    case 'space':
      b.ellipse(cx, cy, r * 1.6, r * 1.6, C.HAZE);
      blob(b, cx, cy, r * 1.4, r * 1.4, [C.NIGHT, C.DUSK, C.HAZE], 9);
      b.px(cx - r * 0.5, cy - r * 0.6, C.PAPER);
      break;
    case 'none':
      break;
  }
}

function tool(p: Body, spec: PersonSpec): void {
  const { b, h, cx, w } = p;
  const hx = cx - w * 0.3;
  const hy = h * 0.53;
  switch (spec.tool) {
    case 'staff':
    case 'cane':
      stroke(b, hx, hy - (spec.tool === 'staff' ? h * 0.35 : 0), hx - 1, h - 1, 2, C.BROWN);
      break;
    case 'sword':
      stroke(b, hx, hy, hx - 2, hy - h * 0.3, 2, C.PUTTY);
      b.rect(hx - 3, hy - 1, 6, 1, C.TUNGSTEN);
      break;
    case 'spade':
    case 'pickaxe':
      stroke(b, hx, hy - h * 0.2, hx, h - 4, 1, C.WOOD);
      if (spec.tool === 'spade') b.rect(hx - 2, h - 6, 5, 5, C.GREY);
      else stroke(b, hx - 5, hy - h * 0.2, hx + 5, hy - h * 0.22, 2, C.GREY);
      break;
    case 'book':
    case 'clipboard':
      b.rect(hx - 4, hy - 4, 8, 9, spec.tool === 'book' ? C.ACCENT_D : C.WOOD);
      b.rect(hx - 3, hy - 3, 6, 7, C.PAPER);
      break;
    case 'lantern':
    case 'torch':
      stroke(b, hx, hy, hx, hy + 6, 1, C.CHAR);
      blob(b, hx, spec.tool === 'torch' ? hy - 4 : hy + 8, 2.5, 3, [C.TUNGSTEN, C.BULB], 11);
      break;
    case 'basket':
    case 'bucket':
      b.rect(hx - 4, hy + 2, 9, 6, spec.tool === 'basket' ? C.TAN : C.GREY);
      stroke(b, hx - 3, hy + 2, hx, hy - 2, 1, C.CHAR);
      break;
    case 'umbrella':
      stroke(b, hx, hy, hx, hy - h * 0.3, 1, C.CHAR);
      b.poly([hx - 9, hy - h * 0.3, hx, hy - h * 0.42, hx + 9, hy - h * 0.3], C.VOID);
      break;
    case 'none':
      break;
  }
}

/** Draws one person: frames rest, talking, head-shake left / right. */
export function makePerson(spec: PersonSpec): MadeSprite {
  const scale = spec.build === 'child' ? 0.68 : 1;
  const height = spec.height * scale;
  const ratio = spec.build === 'stout' ? 0.66 : 0.56;
  const h = Math.max(24, Math.round(height * PPU_PEOPLE));
  const w = Math.max(14, Math.round(h * ratio));
  const cloth = rampOf(spec.clothes ?? OUTFIT_RAMP[spec.outfit]);
  const trim = spec.trim === undefined ? C.CLAY : (colourRef(spec.trim) ?? C.CLAY);
  const hairC = colourRef(spec.hairColour) ?? C.BROWN;
  const glow = spec.tool === 'lantern' || spec.tool === 'torch' ? [C.BULB, C.TUNGSTEN] : [];
  const frames = [0, 1, 2, 3].map((frame) => {
    const body: Body = {
      b: new Bmp(w, h),
      w,
      h,
      cx: w / 2,
      cloth,
      skin: SKIN[spec.skin] ?? [C.TAN, C.WOOD],
      trim,
      hairC,
    };
    torso(body, spec);
    head(body, spec, frame);
    tool(body, spec);
    return finish(body.b, C.VOID, glow);
  });
  return { frames, size: [(height * w) / h, height], z: 0, fps: 0 };
}
