import { describe, expect, it } from 'vitest';
import { Sketch } from '../../props/sketch.js';
import { CRISP_PALETTE } from '../../testing/palettes.js';
import { BASE, DioramaCanvas, OVERHANG, Stamp } from './canvas.js';
import { CITY_ROWS, INNER_LANE, OUTER_LANE } from './city.js';
import { faceCorners } from './glow.js';
import { OFFICE_ROWS } from './office.js';
import { ROOM_ROWS } from './room.js';
import { SERVER_ROOM_ROWS } from './server-room.js';
import { dioramaColors, type Slot } from './tones.js';
import {
  blinkOn,
  heightAt,
  kindAt,
  loopLength,
  parseTiles,
  pingPong,
  pointOnLoop,
  TILE_VOXELS,
} from './tiles.js';

const LEGEND = {
  '.': { kind: 'floor' },
  s: { kind: 'step', height: 2 },
  r: { kind: 'road' },
} as const;

describe('tile grid', () => {
  const grid = parseTiles(['..s', '.rs', 'rr.'], LEGEND);

  it('parses kinds and heights row-major (row 0 = back edge)', () => {
    expect(grid.width).toBe(3);
    expect(grid.depth).toBe(3);
    expect(kindAt(grid, 2, 0)).toBe('step');
    expect(kindAt(grid, 1, 1)).toBe('road');
    expect(kindAt(grid, 3, 0)).toBeUndefined();
    expect(heightAt(grid, 2, 1)).toBe(2);
    expect(heightAt(grid, 0, 0)).toBe(0);
    expect(heightAt(grid, -1, 0)).toBe(0);
  });

  it('rejects ragged rows and unknown characters', () => {
    expect(() => parseTiles(['..', '.'], LEGEND)).toThrow(/row 1 has 1 tiles, expected 2/);
    expect(() => parseTiles(['.x'], LEGEND)).toThrow(/"x" is not in the legend/);
    expect(() => parseTiles([], LEGEND)).toThrow(/no rows/);
  });

  it('parses every shipped diorama layout', () => {
    expect(parseTiles(OFFICE_ROWS, { '.': { kind: 'c' }, m: { kind: 'm' } }).width).toBe(10);
    expect(parseTiles(SERVER_ROOM_ROWS, { '.': { kind: 'f' }, c: { kind: 'c' } }).depth).toBe(8);
    expect(parseTiles(ROOM_ROWS, { '.': { kind: 'p' } }).width).toBe(8);
    const legend = { B: { kind: 'B' }, s: { kind: 's' }, r: { kind: 'r' }, g: { kind: 'g' } };
    const city = parseTiles(CITY_ROWS, { ...legend, p: { kind: 'p' } });
    // Both car lanes run on road tiles only.
    for (const lane of [INNER_LANE, OUTER_LANE]) {
      for (let s = 0; s < loopLength(lane); s += 0.25) {
        const point = pointOnLoop(lane, s);
        expect(kindAt(city, Math.floor(point.x), Math.floor(point.z)), String(s)).toBe('r');
      }
    }
  });
});

describe('mover paths', () => {
  const rect = { x0: 1, z0: 2, x1: 4, z1: 4 };

  it('walks a loop around the rect edges and wraps', () => {
    expect(loopLength(rect)).toBe(10);
    expect(pointOnLoop(rect, 0)).toEqual({ x: 1, z: 2, heading: 0 });
    expect(pointOnLoop(rect, 4)).toEqual({ x: 4, z: 3, heading: -Math.PI / 2 });
    expect(pointOnLoop(rect, 6)).toEqual({ x: 3, z: 4, heading: Math.PI });
    expect(pointOnLoop(rect, 9)).toEqual({ x: 1, z: 3, heading: Math.PI / 2 });
    expect(pointOnLoop(rect, 12)).toEqual(pointOnLoop(rect, 2));
    expect(pointOnLoop(rect, -1)).toEqual(pointOnLoop(rect, 9));
  });

  it('ping-pongs between two points with a matching heading', () => {
    const from = [0, 0] as const;
    const to = [4, 0] as const;
    expect(pingPong(from, to, 2, 0)).toMatchObject({ x: 0, z: 0 });
    expect(pingPong(from, to, 2, 0).heading).toBeCloseTo(0);
    expect(pingPong(from, to, 2, 1).x).toBeCloseTo(2);
    const back = pingPong(from, to, 2, 3);
    expect(back.x).toBeCloseTo(2);
    expect(Math.abs(back.heading)).toBeCloseTo(Math.PI);
    expect(pingPong(from, to, 2, 4)).toEqual(pingPong(from, to, 2, 0));
    expect(pingPong(from, from, 2, 1)).toEqual({ x: 0, z: 0, heading: 0 });
  });

  it('blinks as a square wave of t', () => {
    expect(blinkOn(0, 1, 0)).toBe(true);
    expect(blinkOn(0.6, 1, 0)).toBe(false);
    expect(blinkOn(1.2, 1, 0)).toBe(true);
    expect(blinkOn(-0.6, 1, 0)).toBe(true);
    expect(blinkOn(5, 0, 0)).toBe(true);
  });
});

describe('canvas and stamps', () => {
  const grid = parseTiles(['..', '.s'], LEGEND);
  const colors = dioramaColors(CRISP_PALETTE, 'day', 'concrete', 'accent1');

  it('maps tiles to voxels on the platform top (raised tiles higher)', () => {
    const canvas = new DioramaCanvas(grid, colors, 4);
    expect(canvas.size).toEqual([2 * TILE_VOXELS + 2 * OVERHANG, BASE + 2 + 4, 20]);
    expect(canvas.tile(0, 0)).toEqual([OVERHANG, BASE, OVERHANG]);
    expect(canvas.tile(1, 1)).toEqual([OVERHANG + 8, BASE + 2, OVERHANG + 8]);
    expect(canvas.toLocal(canvas.pivot)).toEqual([0, 0, 0]);
    expect(canvas.toLocal([canvas.pivot[0] + 8, BASE, canvas.pivot[2]])).toEqual([1, 0, 0]);
    canvas.anchor('a', [canvas.pivot[0], BASE + 4, canvas.pivot[2] - 8]);
    expect(canvas.localAnchors()).toEqual({ a: [0, 0.5, -1] });
  });

  it('turns a stamp facing +x so its front faces +x', () => {
    const sketch = new Sketch<Slot>([10, 4, 10], colors);
    const stamp = new Stamp(sketch, [2, 0, 3], [4, 2], 'x');
    // Local front row (v = 1) lands on the +x side; local u = 0 on the +z side.
    expect(stamp.cell(0, 0, 1)).toEqual([3, 0, 6]);
    expect(stamp.cell(3, 0, 0)).toEqual([2, 0, 3]);
    expect(stamp.front(0, 0, 1)).toEqual({ cell: [3, 0, 6], face: 'x' });
    expect(stamp.side(0, 0, 0)).toEqual({ cell: [2, 0, 6], face: 'z' });
    stamp.box('floor', [0, 0, 0], [4, 1, 2]);
    for (let z = 3; z < 7; z += 1)
      for (let x = 2; x < 4; x += 1) expect(sketch.filled(x, 0, z)).toBe(true);
    expect(sketch.filled(4, 0, 3)).toBe(false);
    expect(sketch.filled(2, 0, 7)).toBe(false);
  });

  it('keeps a stamp facing +z in canvas axes', () => {
    const sketch = new Sketch<Slot>([10, 4, 10], colors);
    const stamp = new Stamp(sketch, [1, 1, 1], [3, 2], 'z');
    expect(stamp.cell(2, 0, 1)).toEqual([3, 1, 2]);
    expect(stamp.visibleSide()).toBe(2);
    expect(stamp.side(2, 0, 0)).toEqual({ cell: [3, 1, 1], face: 'x' });
  });

  it('lays glow quads on the outside of each face', () => {
    expect(faceCorners({ cell: [1, 2, 3], face: 'z' }).every((corner) => corner[2] > 4)).toBe(true);
    expect(faceCorners({ cell: [1, 2, 3], face: 'x' }).every((corner) => corner[0] > 2)).toBe(true);
    expect(faceCorners({ cell: [1, 2, 3], face: 'y' }).every((corner) => corner[1] > 3)).toBe(true);
  });
});
