import { describe, expect, it } from 'vitest';
import {
  characterSchema,
  neckBase,
  neckHead,
  neckSpecSchema,
  rigDimsSchema,
  tonesSchema,
  type Character,
  type HeadDraw,
  type RigDims,
  type TorsoDraw,
} from './character.js';
import { bodyDimsSchema } from './poses.js';
import { COMMANDER, CROWD, SUIT_ARM, SUIT_LEG, YOU } from './rig-test-support.js';

const torso: TorsoDraw = () => undefined;
const head: HeadDraw = () => undefined;

const CHAR: Character = {
  id: 'test-pilot',
  name: 'The Test Pilot',
  D: COMMANDER,
  neck: [
    [0, -570, 0, -612],
    [8, -568, 14, -610],
    [14, -564, 30, -604],
    [0, -570],
  ],
  headScale: 1.1,
  seed: 310,
  tones: { skin: '#c98f6e', skinD: '#9a6650', suit: '#aba58f' },
  arm: SUIT_ARM,
  leg: SUIT_LEG,
  torso,
  head,
};

describe('rigDimsSchema', () => {
  it('accepts the film dimension records and extends bodyDimsSchema', () => {
    for (const D of [COMMANDER, YOU, CROWD]) expect(rigDimsSchema.parse(D)).toEqual(D);
    const body = bodyDimsSchema.parse(COMMANDER);
    const { sw, sy, sz, hw, waist, l1a, l2a, l1l, l2l }: RigDims = COMMANDER;
    expect(body).toEqual({ sw, sy, sz, hw, waist, l1a, l2a, l1l, l2l });
  });

  it('rejects missing rig fields and malformed head boxes', () => {
    const noHip = Object.fromEntries(Object.entries(COMMANDER).filter(([k]) => k !== 'hy'));
    expect(rigDimsSchema.safeParse(noHip).success).toBe(false);
    expect(rigDimsSchema.safeParse({ ...COMMANDER, hsz: 0 }).success).toBe(false);
    const box = { x: [0, 18, 36], top: -800, bottom: -598, hw: 78 };
    expect(rigDimsSchema.safeParse({ ...COMMANDER, head: box }).success).toBe(false);
    expect(
      rigDimsSchema.safeParse({ ...COMMANDER, head: { ...box, x: [0, 1, 2, 3], hw: -1 } }).success,
    ).toBe(false);
  });
});

describe('neck specs', () => {
  it('accepts both forms and resolves base and head points', () => {
    expect(neckSpecSchema.safeParse([1, 2]).success).toBe(true);
    expect(neckSpecSchema.safeParse([1, 2, 3, 4]).success).toBe(true);
    expect(neckSpecSchema.safeParse([1, 2, 3]).success).toBe(false);
    expect(neckBase([8, -568, 14, -610])).toEqual([8, -568]);
    expect(neckHead([8, -568, 14, -610])).toEqual([14, -610]);
    expect(neckBase([0, -570])).toEqual([0, -570]);
    expect(neckHead([0, -570])).toEqual([0, -570]);
  });
});

describe('characterSchema', () => {
  it('accepts a full character and keeps the drawing functions', () => {
    const parsed = characterSchema.parse(CHAR);
    expect(parsed).toEqual(CHAR);
    expect(parsed.torso).toBe(torso);
    expect(parsed.head).toBe(head);
    const withNeck = characterSchema.parse({
      ...CHAR,
      drawNeck: () => undefined,
      defaultExpr: 'scared',
    });
    expect(typeof withNeck.drawNeck).toBe('function');
    expect(withNeck.defaultExpr).toBe('scared');
  });

  it('rejects bad data and non-function drawings', () => {
    const bad: unknown[] = [
      { ...CHAR, id: 'Test Pilot' },
      { ...CHAR, name: '' },
      { ...CHAR, neck: CHAR.neck.slice(0, 3) },
      { ...CHAR, headScale: 0 },
      { ...CHAR, tones: { skin: '#fff' } },
      { ...CHAR, torso: 'not a function' },
      { ...CHAR, head: undefined },
      { ...CHAR, drawNeck: 3 },
      { ...CHAR, arm: { ...SUIT_ARM, w: [1] } },
      { ...CHAR, D: { ...COMMANDER, l1a: -1 } },
    ];
    for (const value of bad) expect(characterSchema.safeParse(value).success).toBe(false);
  });

  it('tones require skin and skinD and allow any other named colour', () => {
    expect(tonesSchema.parse({ skin: 'a', skinD: 'b', hair: 'c' })).toEqual({
      skin: 'a',
      skinD: 'b',
      hair: 'c',
    });
    expect(tonesSchema.safeParse({ skin: 'a', skinD: 'b', hair: 3 }).success).toBe(false);
  });
});
