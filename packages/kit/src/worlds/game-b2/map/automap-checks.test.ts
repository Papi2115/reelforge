/**
 * Automap readability (real run Game B2 2: a small map on a ~85 % black frame, the film ending on
 * it): the rooms span half the frame or the plan fails with the scale to use; a map held to the
 * shot's end over black fails unless it freezes the level behind it or folds; `backdrop: 'freeze'`
 * paints the level dimmed behind the map, purely in t.
 */
import { describe, expect, it } from 'vitest';
import { compileLevel } from '../level/compile.js';
import { checkLevel, type LevelInput } from '../level/schema.js';
import { C } from '../palette.js';
import { createPath, type PathKey } from '../ray/camera.js';
import { SCREEN_H, SCREEN_W } from '../view/output.js';
import { B2World } from '../view/world.js';
import { Automap } from './automap.js';
import { checkMapEnding, mapSpan } from './automap-checks.js';
import { planAutomap } from './automap-plan.js';
import { automapSchema, type AutomapInput } from './automap-spec.js';

/** A small outdoor-sized level: four glades around one clearing (15 x 11 cells). */
const GLADES: LevelInput = {
  name: 'glades',
  mood: 'shop',
  grid: [
    '###############',
    '#....#...#....#',
    '#....D...D....#',
    '#....#...#....#',
    '######...######',
    '######...######',
    '######...######',
    '#....#...#....#',
    '#....D...D....#',
    '#....#...#....#',
    '###############',
  ],
  legend: { '#': { wall: 'concrete' }, D: { door: true } },
};

const KEYS: PathKey[] = [{ at: 0, x: 7.5, y: 5.5, yaw: -90, pitch: 0, eye: 0.5, ease: 'inOut' }];

const fail = (message: string): never => {
  throw new Error(message);
};

const SPEC: AutomapInput = {
  intent: 'four glades walked, all of them around the one clearing',
  at: 0.2,
  until: 4,
  enter: 'cut',
  exit: 'cut',
  scale: 20,
  rooms: [{ cell: [2, 2], label: 'DAWN' }, { cell: [12, 2], label: 'NOON' }, { cell: [7, 5] }],
};

function setup(spec: AutomapInput) {
  const checked = checkLevel(GLADES);
  if (!checked.ok) throw new Error(checked.errors.join('\n'));
  const level = compileLevel(checked.level);
  const path = createPath(KEYS, 5);
  const time = (when: number | string): number => (typeof when === 'number' ? when : 0);
  const plan = planAutomap(automapSchema.parse(spec), level, path, time, fail);
  return { level, path, plan };
}

describe('automap span and ending', () => {
  it('fails a map that covers less than half the frame with the scale that fixes it', () => {
    expect(() => setup({ ...SPEC, scale: 14 })).toThrow(
      /span only 182 x 126 px .* raise scale to 20 \(max 24\)/,
    );
    const { plan } = setup(SPEC);
    expect(mapSpan(plan)).toEqual({ w: 260, h: 180 });
  });

  it("fails a map held to the shot's end over black, not a frozen or folding one", () => {
    const { plan } = setup(SPEC);
    expect(() => {
      checkMapEnding(plan, 4, fail);
    }).toThrow(/backdrop: 'freeze'/);
    expect(() => {
      checkMapEnding(plan, 6, fail);
    }).not.toThrow();
    expect(() => {
      checkMapEnding(plan, undefined, fail);
    }).not.toThrow();
    const frozen = setup({ ...SPEC, backdrop: 'freeze' }).plan;
    expect(() => {
      checkMapEnding(frozen, 4, fail);
    }).not.toThrow();
    const folding = setup({ ...SPEC, exit: 'fold' }).plan;
    expect(() => {
      checkMapEnding(folding, 4, fail);
    }).not.toThrow();
  });

  it("paints the level dimmed behind a 'freeze' map, the same in any order", () => {
    const frame = (backdrop: 'void' | 'freeze', t: number): Uint8Array => {
      const { level, path, plan } = setup({ ...SPEC, backdrop });
      const world = new B2World(level, path, 5, 1);
      world.addAutomap(new Automap(plan, path, 5, () => world.frozenView(plan.at)));
      const screen = new Uint8Array(SCREEN_W * SCREEN_H);
      world.render(t, screen);
      return screen;
    };
    const black = frame('void', 3);
    const frozen = frame('freeze', 3);
    const voidShare = (screen: Uint8Array): number =>
      screen.filter((c) => c === C.VOID).length / screen.length;
    expect(voidShare(black)).toBeGreaterThan(0.6);
    expect(voidShare(frozen)).toBeLessThan(voidShare(black));
    // Outside the map the frozen level shows through (dimmed), never a flat black frame.
    const behind = frozen.filter((c, i) => c !== black[i]).length / frozen.length;
    expect(behind).toBeGreaterThan(0.15);
    frame('freeze', 1);
    expect(frame('freeze', 3)).toEqual(frozen);
  });
});
