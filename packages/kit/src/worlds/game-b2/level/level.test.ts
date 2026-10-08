/**
 * The Game B2 level format (PLAN.md#13.4): the built-in levels pass and compile, and every broken
 * level fails with an error that names the field or grid row, so the runtime Claude can fix it.
 */
import { describe, expect, it } from 'vitest';
import { compileLevel } from './compile.js';
import { BUILT_IN_LEVELS, builtInLevel } from './examples.js';
import { checkLevel, MAX_SPRITES, type LevelInput } from './schema.js';

const ROOM: LevelInput = {
  name: 'room',
  grid: ['#####', '#...#', '#.c.#', '#...#', '#####'],
  legend: { '#': { wall: 'concrete' }, c: { wall: 'counter' } },
  lights: [{ pos: [2.5, 1.5] }],
  sprites: [{ sprite: 'clerk', pos: [2.5, 1.5], id: 'clerk' }],
};

function errors(input: unknown): readonly string[] {
  const checked = checkLevel(input);
  return checked.ok ? [] : checked.errors;
}

describe('built-in levels', () => {
  it.each(BUILT_IN_LEVELS)(
    '%s passes the checks and compiles, with or without a stencil',
    (name) => {
      for (const stencil of [undefined, 'E.T.']) {
        const checked = checkLevel(builtInLevel(name, stencil));
        if (!checked.ok) throw new Error(checked.errors.join('\n'));
        const level = compileLevel(checked.level);
        expect(level.w * level.h).toBe(level.wall.length);
        expect(level.textures.length).toBeGreaterThan(3);
        expect(level.textures.length).toBeLessThan(255);
      }
    },
  );

  it('gives the office its own tungsten room next to the dark corridor', () => {
    const checked = checkLevel(builtInLevel('office'));
    if (!checked.ok) throw new Error(checked.errors.join('\n'));
    const level = compileLevel(checked.level);
    expect(level.regions.map((region) => region.mood)).toEqual(['dark', 'tungsten']);
    expect(level.region[6 * level.w + 5]).toBe(0);
    expect(level.region[6 * level.w + 16]).toBe(1);
    expect(level.lights.find((light) => light.id === 'bulb')?.region).toBe(0);
    expect(level.lights.find((light) => light.id === 'desk-lamp')?.region).toBe(1);
  });

  it('compiles the same arrays every time (pure)', () => {
    const checked = checkLevel(builtInLevel('warehouse', 'E.T.'));
    if (!checked.ok) throw new Error(checked.errors.join('\n'));
    const [a, b] = [compileLevel(checked.level), compileLevel(checked.level)];
    expect([...a.wall]).toEqual([...b.wall]);
    expect([...a.floor]).toEqual([...b.floor]);
    expect(a.textures).toEqual(b.textures);
  });
});

describe('readable level errors', () => {
  it('accepts a small closed room with a sprite standing on a counter', () => {
    expect(errors(ROOM)).toEqual([]);
    expect(errors({ ...ROOM, sprites: [{ sprite: 'boxes', pos: [2.5, 2.5], z: 0.42 }] })).toEqual(
      [],
    );
  });

  it('names ragged rows, unknown characters and an open border', () => {
    expect(errors({ ...ROOM, grid: ['#####', '#...#', '#..#', '#...#', '#####'] })).toContain(
      'grid row 2: 4 cells, expected 5 like row 0',
    );
    expect(errors({ ...ROOM, grid: ['#####', '#.x.#', '#...#', '#...#', '#####'] })).toContain(
      'grid row 1: "x" at x=2 is not in the legend',
    );
    expect(errors({ ...ROOM, grid: ['#####', '....#', '#...#', '#...#', '#####'] })).toContain(
      'grid row 1: cell x=0 is on the border and must be a wall (close the level)',
    );
  });

  it('names an unknown texture and an unknown key in the legend entry', () => {
    expect(errors({ ...ROOM, legend: { ...ROOM.legend, '#': { wall: 'brick' } } })[0]).toMatch(
      /^legend "#"\.wall: unknown wall texture "brick" \(known: concrete, wood-panel/,
    );
    expect(
      errors({ ...ROOM, legend: { ...ROOM.legend, c: { wall: 'counter', colour: 'red' } } })[0],
    ).toMatch(/^legend "c": .*colour/);
  });

  it('rejects things inside walls, doors without walls, labels it cannot draw, repeated ids', () => {
    expect(errors({ ...ROOM, sprites: [{ sprite: 'clerk', pos: [0.5, 0.5] }] })).toContain(
      'sprites[0] (clerk): pos [0.5, 0.5] is inside a wall cell; move it into an open cell',
    );
    expect(
      errors({
        ...ROOM,
        grid: ['#####', '#...#', '#.D.#', '#...#', '#####'],
        legend: { ...ROOM.legend, D: { door: true } },
      }),
    ).toContain(
      'grid row 2: door at x=2 needs walls on exactly two opposite sides (above+below or left+right)',
    );
    expect(
      errors({ ...ROOM, sprites: [{ sprite: 'sign', pos: [2.5, 1.5], label: 'é' }] })[0],
    ).toMatch(/cannot draw: é/);
    expect(
      errors({ ...ROOM, sprites: [{ sprite: 'sign', pos: [2.5, 1.5], label: 'RETURNS DESK' }] })[0],
    ).toMatch(/too long for it \(max 42 px wide/);
    expect(errors({ ...ROOM, lights: [{ id: 'clerk', pos: [1.5, 1.5] }] })).toContain(
      'ids must be unique: clerk',
    );
  });

  it('caps the grid at 32x32 and the sprites at 40', () => {
    const wide = { ...ROOM, grid: Array.from({ length: 33 }, () => '#####') };
    expect(errors(wide)[0]).toMatch(/^grid: /);
    const crowd = Array.from({ length: MAX_SPRITES + 1 }, () => ({
      sprite: 'boxes',
      pos: [1.5, 1.5],
    }));
    expect(errors({ ...ROOM, sprites: crowd })[0]).toMatch(/^sprites: /);
  });
});
