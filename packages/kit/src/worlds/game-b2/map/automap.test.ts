/**
 * The automap (PLAN.md#13.4 part b): geometry generated from the level grid (rooms, doors, shell
 * vs interior lines), the plan's readable errors (cells in walls, labels off screen, under the
 * narration box or colliding, a second accent item, a replay that ends elsewhere), the continuity
 * with the minimap (it opens on the minimap's rect around the arrow and folds back onto it) and
 * determinism of the frames in any seek order.
 */
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { HudModel } from '../hud/model.js';
import { compileLevel } from '../level/compile.js';
import { checkLevel, type LevelInput } from '../level/schema.js';
import { C } from '../palette.js';
import { createPath, type PathKey } from '../ray/camera.js';
import { SCREEN_H, SCREEN_W } from '../view/output.js';
import { B2World } from '../view/world.js';
import { Automap, MINI } from './automap.js';
import { planAutomap } from './automap-plan.js';
import { automapSchema, type AutomapInput } from './automap-spec.js';
import { mapGeometry, roomOfPoint } from './rooms.js';

const ROUTE: LevelInput = {
  name: 'route',
  grid: [
    '###############################',
    '########wwwwwwww###############',
    '#oooooo#wwwwwwww#pppppp########',
    '#oooooo#wwsssssw#pppppp#rrrrrr#',
    '#ouuooo#wwwwwwww#ppkkpp#rrcccr#',
    '#ooooooDwwwwwwwwDppkkppDrrrrrr#',
    '#oooooo#wwwwwwww#ppkkpp#rrrrrr#',
    '#oooooo#wwsssssw#pppppp#rrrrrr#',
    '########wwwwwwww#pppppp########',
    '###############################',
  ],
  legend: {
    '#': { wall: 'concrete' },
    u: { wall: 'cubicle' },
    s: { wall: 'shelf' },
    k: { wall: 'store-shelf' },
    c: { wall: 'counter' },
    D: { door: true },
    o: { floor: 'carpet', mood: 'tungsten' },
    w: { floor: 'warehouse', mood: 'fluorescent' },
    p: { floor: 'tile', mood: 'shop' },
    r: { floor: 'tile-big', mood: 'backroom' },
  },
};

const KEYS: PathKey[] = [
  [-4, 2, 5.5, 0],
  [-2.5, 7, 5.5, 0],
  [-0.5, 15.3, 5.5, 0],
  [0, 15.3, 5.5, 0],
].map(([at = 0, x = 0, y = 0, yaw = 0]) => ({ at, x, y, yaw, pitch: 0, eye: 0.5, ease: 'inOut' }));

function compiled() {
  const checked = checkLevel(ROUTE);
  if (!checked.ok) throw new Error(checked.errors.join('\n'));
  return compileLevel(checked.level);
}

const fail = (message: string): never => {
  throw new Error(message);
};

const SPEC: AutomapInput = {
  intent: 'the office and the warehouse are done, the store is next',
  at: 0.5,
  until: 7,
  scale: 14,
  replay: { from: -4, to: 0, dur: 2 },
  rooms: [
    { cell: [3, 3], label: 'THE OFFICE', sub: '1982' },
    { cell: [12, 5], label: 'THE WAREHOUSE', sub: '1982' },
    { cell: [18, 3], label: 'TOY STORE', state: 'next', at: 3.2 },
    { cell: [25, 5], label: 'RETURNS', state: 'ahead', at: 3.5 },
  ],
  marks: [{ kind: 'objective', pos: [18, 5.5], at: 4 }],
  camera: [{ at: 3, x: 20, y: 6.5 }],
};

function plan(spec: AutomapInput = SPEC) {
  const level = compiled();
  const path = createPath(KEYS, 3);
  const time = (when: number | string): number => (typeof when === 'number' ? when : 0);
  return { level, path, plan: planAutomap(automapSchema.parse(spec), level, path, time, fail) };
}

describe('automap geometry', () => {
  it('finds rooms, doors and shell vs interior lines from the grid', () => {
    const level = compiled();
    const geometry = mapGeometry(level);
    const room = (x: number, y: number): number => roomOfPoint(geometry, level, x, y);
    const [office, warehouse, store, returns] = [room(3, 3), room(12, 5), room(18, 3), room(25, 5)];
    expect(new Set([office, warehouse, store, returns]).size).toBe(4);
    expect(geometry.rooms).toHaveLength(4);
    expect(geometry.doors.map((door) => [...door.rooms].sort())).toEqual(
      [
        [office, warehouse],
        [warehouse, store],
        [store, returns],
      ].map((pair) => pair.sort()),
    );
    const lines = geometry.lines[warehouse] ?? [];
    expect(lines.some((line) => line.cls === 0)).toBe(true);
    // The two racks are islands: four sides each.
    expect(lines.filter((line) => line.cls === 1)).toHaveLength(8);
  });
});

describe('automap plan', () => {
  it('draws walked rooms as the replay enters them and the rest at their times', () => {
    const { plan: p } = plan();
    expect(p.rooms.map((room) => room.state)).toEqual(['done', 'done', 'next', 'ahead']);
    const [office, warehouse] = p.rooms;
    expect(office?.drawAt).toBeCloseTo(p.open, 5);
    expect(warehouse?.drawAt ?? 0).toBeGreaterThan(office?.drawAt ?? 0);
    expect(p.legend).toEqual({ done: 'DONE', ahead: 'AHEAD' });
    expect(p.camera[0]).toMatchObject({ at: 0.5, x: 15.3, y: 5.5 });
  });

  it('rejects bad specs with sentences that say what to change', () => {
    const bad = (patch: Partial<AutomapInput>) => () => plan({ ...SPEC, ...patch });
    expect(() => automapSchema.parse({ ...SPEC, intent: undefined })).toThrow();
    expect(bad({ rooms: [{ cell: [0, 0], label: 'X' }] })).toThrow(/not inside a room/);
    expect(bad({ until: 1.5 })).toThrow(/too short/);
    expect(
      bad({
        marks: [
          { kind: 'item', pos: [3, 3], at: 1 },
          { kind: 'item', pos: [4, 3], at: 1 },
        ],
      }),
    ).toThrow(/only ONE item/);
    expect(bad({ rooms: [{ cell: [3, 3], label: 'THE OFFICE', labelAt: [3, 9.6] }] })).toThrow(
      /under the narration box/,
    );
    expect(bad({ rooms: [{ cell: [3, 3], label: 'THE OFFICE', labelAt: [-30, 2] }] })).toThrow(
      /off screen/,
    );
    expect(
      bad({
        rooms: [
          { cell: [3, 3], label: 'THE OFFICE', labelAt: [10, -1] },
          { cell: [12, 5], label: 'THE WAREHOUSE', labelAt: [10.5, -1] },
        ],
      }),
    ).toThrow(/collides with/);
    expect(bad({ replay: { from: -4, to: -2, dur: 1 } })).toThrow(/walk moves/);
  });
});

function world(): { world: B2World; hud: HudModel; automap: Automap } {
  const { level, path, plan: p } = plan();
  const w = new B2World(level, path, 3, 1);
  const automap = new Automap(p, path, 3);
  w.addAutomap(automap);
  const hud = new HudModel(3, 8);
  hud.minimap(-1, 8);
  hud.say('AN OFFICE, A WAREHOUSE:\nTHE GAME IS MADE.', '', 0.6, 3);
  return { world: w, hud, automap };
}

function frame(w: B2World, hud: HudModel, t: number, screen: Uint8Array): string {
  const cam = w.render(t, screen);
  return createHash('sha256')
    .update(screen)
    .update(hud.draw(t, cam, w).d)
    .digest('hex');
}

describe('automap frames', () => {
  it('opens on the minimap rect around the arrow and folds back onto it', () => {
    const { world: w, automap } = world();
    expect(w.mapCover(0.4)).toBeNull();
    const open = w.mapCover(0.5);
    expect(open).toMatchObject({ x0: MINI.x, y0: MINI.y });
    expect(automap.opaque(3)).toBe(true);
    const folded = w.mapCover(6.95);
    expect(folded?.x0).toBe(MINI.x - 1);
    expect(folded?.x1).toBe(MINI.x + MINI.w + 1);
    expect(w.mapCover(7)).toBeNull();
    // The first frame of the unfold is the minimap: the arrow sits at its centre.
    const screen = new Uint8Array(SCREEN_W * SCREEN_H);
    w.render(0.5, screen);
    const cx = Math.round(MINI.x + MINI.w / 2);
    const cy = Math.round(MINI.y + MINI.h / 2);
    const around = [-2, -1, 0, 1, 2].flatMap((dy) =>
      [-2, -1, 0, 1, 2].map((dx) => screen[(cy + dy) * SCREEN_W + cx + dx]),
    );
    expect(around).toContain(C.BULB);
  });

  it('is a pure function of t (any order, a fresh world) and palette indices only', () => {
    const times = [0.3, 0.55, 1.2, 2.4, 3.6, 4.4, 5.5, 6.3, 6.9];
    const screen = new Uint8Array(SCREEN_W * SCREEN_H);
    const a = world();
    const forward = times.map((t) => frame(a.world, a.hud, t, screen));
    const backward = [...times].reverse().map((t) => frame(a.world, a.hud, t, screen));
    expect(backward.reverse()).toEqual(forward);
    const b = world();
    expect(
      [...times]
        .reverse()
        .map((t) => frame(b.world, b.hud, t, screen))
        .reverse(),
    ).toEqual(forward);
    expect(new Set(forward).size).toBe(times.length);
    a.world.render(3.6, screen);
    expect(screen.reduce((max, c) => Math.max(max, c), 0)).toBeLessThan(32);
  });
});
