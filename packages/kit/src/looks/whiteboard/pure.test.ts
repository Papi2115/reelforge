import { describe, expect, it } from 'vitest';
import { GLYPH_ROWS, glyphOf } from '../../fx/font.js';
import { createResolver } from '../blueprint/timing.js';
import { DOODLE_NAMES, DOODLES } from './doodles.js';
import { parseStroke } from './dsl.js';
import { boundsOf, polylineLength, strokePixels, wobble, type Point } from './geometry.js';
import { createMark, drawMark, penState, shapeCost, strokeEase, type MarkShape } from './marks.js';
import { Raster, hexPixel } from '../blueprint/raster.js';
import { scheduleMarks } from './timing.js';
import { glyphStrokes, writeLine } from './writing.js';

const INK = hexPixel('#05060f');
const CALL = 'kit.fx.whiteboardSketch()';

function inked(raster: Raster): number {
  let count = 0;
  for (let y = 0; y < raster.height; y += 1) {
    for (let x = 0; x < raster.width; x += 1) if (raster.get(x, y) === INK) count += 1;
  }
  return count;
}

describe('stroke geometry', () => {
  it('rasterises to 8-connected integer pixels without repeats', () => {
    const pixels = strokePixels([
      [0, 0],
      [10, 4],
      [10, 4],
      [3, 9],
    ]);
    expect(pixels.every(([x, y]) => Number.isInteger(x) && Number.isInteger(y))).toBe(true);
    for (let index = 1; index < pixels.length; index += 1) {
      const [ax, ay] = pixels[index - 1] ?? [0, 0];
      const [bx, by] = pixels[index] ?? [0, 0];
      expect(Math.max(Math.abs(bx - ax), Math.abs(by - ay))).toBe(1);
    }
  });

  it('wobbles deterministically, within the amplitude, ends near their place', () => {
    const line: Point[] = [
      [10, 50],
      [300, 50],
    ];
    const a = wobble(line, 1.5, 42);
    expect(wobble(line, 1.5, 42)).toEqual(a);
    expect(wobble(line, 1.5, 43)).not.toEqual(a);
    expect(a.length).toBeGreaterThan(2);
    for (const [, y] of a) expect(Math.abs(y - 50)).toBeLessThanOrEqual(1.5);
    expect(wobble(line, 0, 42)).toEqual(line);
  });
});

describe('stroke language', () => {
  it('parses shapes, doodles, ink names and handwriting', () => {
    const arrow = parseStroke('arrow 100 100 200 100 red', CALL);
    expect(arrow.color).toBe('red');
    expect(arrow.figure.kind === 'pen' && arrow.figure.paths.length).toBe(2);
    const curved = parseStroke('arrow 100,100 150,60 200,100', CALL);
    expect(curved.figure.kind === 'pen' && (curved.figure.paths[0]?.length ?? 0)).toBeGreaterThan(
      4,
    );
    const bulb = parseStroke('bulb 320 180 50', CALL);
    if (bulb.figure.kind !== 'pen') throw new Error('expected pen');
    const box = boundsOf(bulb.figure.paths);
    expect(box.x + box.width / 2).toBeCloseTo(320, -1);
    expect(box.width).toBeLessThanOrEqual(52);
    expect(parseStroke('write 320 40 Hello, world', CALL).figure).toEqual({
      kind: 'write',
      x: 320,
      y: 40,
      text: 'Hello, world',
    });
    for (const source of [
      'line 0 0 5 5 9 9',
      'box 1 2 30 40 6',
      'circle 50 50 20 10',
      'bracket 0 0 100 0',
      'underline 0 0 50',
      'zigzag 0 0 90 0 4',
      'hatch 0 0 40 20',
      'dot 4 4',
    ]) {
      expect(parseStroke(source, CALL).figure.kind, source).toBe('pen');
    }
  });

  it('explains bad strokes', () => {
    expect(() => parseStroke('blob 1 2', CALL)).toThrow(/unknown shape "blob"; use line, curve/);
    expect(() => parseStroke('box 1 2 3', CALL)).toThrow(/expected box x y w h \[radius\]/);
    expect(() => parseStroke('line 1 2 3 4 big red', CALL)).toThrow(/one ink name at most/);
    expect(() => parseStroke('write 1 TEXT', CALL)).toThrow(/expected write x y TEXT/);
  });

  it('ships 20+ doodles that fit their 100 x 100 box', () => {
    expect(DOODLE_NAMES.length).toBeGreaterThanOrEqual(20);
    for (const name of DOODLE_NAMES) {
      const paths = DOODLES[name]();
      const box = boundsOf(paths);
      expect(box.width, name).toBeGreaterThan(20);
      expect(box.x, name).toBeGreaterThanOrEqual(-52);
      expect(box.x + box.width, name).toBeLessThanOrEqual(52);
      expect(box.y + box.height, name).toBeLessThanOrEqual(52);
    }
  });
});

describe('marks', () => {
  const shape: MarkShape = {
    paths: [
      strokePixels([
        [2, 2],
        [40, 2],
      ]),
      strokePixels([
        [2, 20],
        [40, 20],
      ]),
    ],
    color: INK,
    nib: { kind: 'pen', size: 2 },
  };

  it('reveals ink along the arc length with the pen at the head', () => {
    const mark = createMark(shape, 1, 2);
    const amounts = [0.9, 1.3, 1.8, 2.4, 3.2].map((t) => {
      const raster = new Raster(48, 24);
      drawMark(raster, mark, t);
      return inked(raster);
    });
    expect(amounts[0]).toBe(0);
    for (let index = 1; index < amounts.length; index += 1) {
      expect(amounts[index]).toBeGreaterThan(amounts[index - 1] ?? 0);
    }
    const midway = penState(mark, 0.25).head;
    expect(midway?.[1]).toBe(2);
    expect(penState(mark, 1).head).toEqual([40, 20]);
    expect(shapeCost(shape)).toBeGreaterThan(78);
  });

  it('eases strokes but never stalls', () => {
    expect(strokeEase(0)).toBe(0);
    expect(strokeEase(1)).toBe(1);
    expect(strokeEase(0.5)).toBeCloseTo(0.5);
    expect(strokeEase(0.01)).toBeGreaterThan(0.002);
  });
});

describe('timing', () => {
  const resolve = createResolver((phrase) => ({ t: phrase === 'idea' ? 4 : 0 }), CALL);

  it('auto-times by length, keeps pinned marks on their phrase and follows them', () => {
    const slots = scheduleMarks(
      [{ cost: 380 }, { cost: 38 }, { cost: 760, at: 'idea' }, { cost: 190, duration: 2 }],
      { start: 0.5, gap: 0.1, speed: 380, resolve },
    );
    expect(slots[0]).toEqual({ start: 0.5, duration: 1 });
    expect(slots[1]?.start).toBeCloseTo(1.6);
    expect(slots[1]?.duration).toBeCloseTo(0.18);
    expect(slots[2]).toEqual({ start: 4, duration: 2 });
    expect(slots[3]).toEqual({ start: 6.1, duration: 2 });
  });

  it('hurries auto-timed marks so the hand is free on a pinned phrase', () => {
    const slots = scheduleMarks([{ cost: 760 }, { cost: 760 }, { cost: 380, at: 'idea' }], {
      start: 0.5,
      gap: 0.1,
      speed: 380,
      resolve,
    });
    const second = slots[1] ?? { start: 0, duration: 0 };
    expect(second.start + second.duration).toBeLessThanOrEqual(4 - 0.1 + 1e-9);
    expect(slots[0]?.duration).toBeLessThan(2);
    expect(slots[2]?.start).toBe(4);
  });
});

describe('handwriting', () => {
  it('puts every ink cell of a glyph into pen paths exactly once (plus resumed branches)', () => {
    for (const char of ['A', 'E', 'K', 'O', '8', '$', '?']) {
      const glyph = glyphOf(char);
      if (!glyph) throw new Error(char);
      const cells = new Set(
        glyphStrokes(glyph)
          .flat()
          .map(([x, y]) => `${String(x)},${String(y)}`),
      );
      const ink = glyph.bits.reduce((sum, bit) => sum + bit, 0);
      expect(cells.size, char).toBe(ink);
    }
  });

  it('writes slanted, bobbing caps deterministically, with word boxes', () => {
    const style = { scale: 3, slant: 0.5, seed: 9 };
    const line = writeLine('BIG IDEA', 10, 20, style);
    expect(writeLine('BIG IDEA', 10, 20, style)).toEqual(line);
    expect(line.glyphs).toHaveLength(7);
    expect(line.words).toHaveLength(2);
    expect(line.box.height).toBeGreaterThanOrEqual(GLYPH_ROWS * 3);
    const bobs = new Set(line.glyphs.map((glyph) => glyph.box.y));
    expect(bobs.size).toBeGreaterThan(1);
    const first = line.glyphs[0]?.paths.flat() ?? [];
    expect(polylineLength(first)).toBeGreaterThan(0);
  });
});
