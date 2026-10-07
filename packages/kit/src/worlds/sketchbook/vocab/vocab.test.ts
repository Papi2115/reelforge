/**
 * The open vocabulary's authoring layer (PLAN.md#13.15a): the doodle DSL and spot art validate
 * with errors that name the part and the field, compile deterministically and never come out
 * slick (loops overshoot, corners are missed), the generators cover every kind with valid,
 * seeded, fitted drawings that keep a silhouette, and the composition presets differ.
 */
import { describe, expect, it } from 'vitest';
import { InkCanvas } from '../draw/canvas.js';
import { drawMark } from '../draw/ink.js';
import { identity } from '../draw/paths.js';
import { INK } from '../inks.js';
import { compileDoodle, opsBox, spotDoodle, type Placement } from './compile.js';
import { heightOf } from './gen/family.js';
import { DRAW_KINDS, FAMILIES, makeDrawing, vocabularyLines } from './gen/index.js';
import { sequenceOps } from './sequence.js';
import { parseDoodle, parsePart, parseSpot, PART_KINDS } from './spec.js';

const PLACE: Placement = {
  x: 480,
  y: 400,
  scale: 2,
  anchor: 'bottom',
  flip: false,
  rot: 0,
  unit: 1,
};

const SPEC = {
  box: [100, 80],
  parts: [
    { blob: [50, 40, 30, 20], fill: 'green' },
    { rect: [10, 10, 30, 20], nib: 'ballpoint' },
    { line: [0, 70, 50, 60, 100, 70], arrow: true },
    { dots: [20, 20, 30, 30], size: 3 },
    { scribble: [60, 10, 90, 10, 90, 30, 60, 30], nib: 'crayon', color: 'orange' },
  ],
};

describe('doodle DSL', () => {
  it('names the part and the field in its errors', () => {
    expect(() => parsePart({ blobb: [1, 2, 3, 4] }, 2, 'page.doodle()')).toThrow(
      /parts\[2\] needs exactly one shape key of blob, circle, rect/,
    );
    expect(() => parsePart({ blob: [1, 2, 3, 4], rect: [1, 2, 3, 4] }, 0, 'x')).toThrow(
      /exactly one/,
    );
    expect(() => parsePart({ circle: [1, 2, -3] }, 4, 'x')).toThrow(
      /parts\[4\] \(circle\)\.circle\.2/,
    );
    expect(() => parsePart({ line: [1, 2, 3, 4], nib: 'brush' }, 1, 'x')).toThrow(/\(line\)\.nib/);
    expect(() => parsePart({ rect: [0, 0, 5, 5], colour: 'red' }, 0, 'x')).toThrow(/colour/);
    expect(() => parseDoodle({ parts: [] }, 'x')).toThrow(/parts/);
    for (const kind of PART_KINDS) expect(kind).toMatch(/^[a-z]+$/);
  });

  it('compiles the same ops for the same seed, other ops for another seed', () => {
    const spec = parseDoodle(SPEC, 'test');
    const a = compileDoodle(spec, PLACE, 7);
    expect(compileDoodle(spec, PLACE, 7)).toEqual(a);
    expect(compileDoodle(spec, PLACE, 8)).not.toEqual(a);
    expect(a.some((op) => op.kind === 'fill')).toBe(true);
  });

  it('is rough on purpose: loops overlap their start, corners are missed, never mirror-even', () => {
    const spec = parseDoodle(
      { box: [100, 100], parts: [{ circle: [50, 50, 40] }, { rect: [10, 10, 80, 80] }] },
      'test',
    );
    const [loop, rect] = compileDoodle(spec, { ...PLACE, scale: 1 }, 3);
    if (loop?.kind !== 'stroke' || rect?.kind !== 'stroke') throw new Error('strokes expected');
    const [x0, y0] = [loop.pts[0] ?? 0, loop.pts[1] ?? 0];
    const [x1, y1] = [loop.pts.at(-2) ?? 0, loop.pts.at(-1) ?? 0];
    expect(Math.hypot(x1 - x0, y1 - y0)).toBeGreaterThan(0.5);
    // The rectangle's corner (430, 310) on the page is missed by a little, not hit exactly.
    const corner = [rect.pts[0] ?? 0, rect.pts[1] ?? 0];
    expect(corner).not.toEqual([440, 310]);
    expect(Math.hypot((corner[0] ?? 0) - 440, (corner[1] ?? 0) - 310)).toBeLessThan(6);
  });

  it('places by anchor, height, mirror and rotation', () => {
    const spec = parseDoodle({ box: [100, 50], parts: [{ rect: [0, 0, 100, 50] }] }, 'test');
    const [x, y, w, h] = opsBox(compileDoodle(spec, { ...PLACE, scale: 1 }, 1));
    expect(x).toBeCloseTo(430, -1);
    expect(y + h).toBeCloseTo(400, -1);
    expect(w).toBeGreaterThan(95);
    const flipped = opsBox(compileDoodle(spec, { ...PLACE, scale: 1, flip: true }, 1));
    expect(flipped[0]).toBeCloseTo(430, -1);
    const turned = opsBox(compileDoodle(spec, { ...PLACE, scale: 1, rot: 90 }, 1));
    expect(turned[2]).toBeLessThan(60);
  });

  it('times the strokes for the hand: in order, with pauses and travel', () => {
    const ops = compileDoodle(parseDoodle(SPEC, 'test'), PLACE, 5);
    const marks = sequenceOps(ops, { t0: 1, seed: 5, speed: 1, fps: 12, held: true, unit: 1 });
    expect(marks).toHaveLength(ops.length);
    expect(marks[0]?.t0).toBe(1);
    for (let i = 1; i < marks.length; i += 1) {
      const [a, b] = [marks[i - 1], marks[i]];
      expect((b?.t0 ?? 0) > (a?.t0 ?? 0) + (a?.dur ?? 0)).toBe(true);
    }
    const end = Math.max(...marks.map((mark) => mark.t0 + mark.dur));
    expect(end - 1).toBeLessThan(3);
  });
});

describe('spot art', () => {
  it('rejects a character missing from the legend, naming row and column', () => {
    expect(() =>
      parseSpot({ rows: ['.#.', '#x#'], legend: { '#': 'ink' } }, 'page.spot()'),
    ).toThrow(/rows\[1\] column 1: 'x' is not in the legend/);
    expect(() => parseSpot({ rows: ['.#.'], legend: { '#': 'chartreuse' } }, 'x')).toThrow(
      /legend/,
    );
  });

  it('turns each run of a row into one dab, fat cells into several', () => {
    const art = parseSpot(
      {
        rows: ['.##.', '####', 'o..o'],
        legend: { '#': 'ink', o: { color: 'orange', nib: 'crayon' } },
      },
      'x',
    );
    expect(spotDoodle(art, 1).parts).toHaveLength(4);
    expect(spotDoodle(art, 4).parts.length).toBeGreaterThan(4);
    expect(spotDoodle(art, 1).box).toEqual([24, 18]);
  });
});

/** Ink pixels / bounding-box pixels of a drawing rendered alone (a silhouette, not a wire). */
function coverage(kind: string, type: string, height: number): number {
  const entry = FAMILIES.find((family) => family.kind === kind);
  if (!entry) throw new Error(kind);
  const knobs = { type, color: undefined, action: undefined, count: undefined, w: 300, h: height };
  const spec = makeDrawing(entry, knobs, 11, { plain: false, bold: true }, 'test');
  const [, bh] = spec.box;
  const place: Placement = {
    x: 480,
    y: 500,
    scale: height / bh,
    anchor: 'bottom',
    flip: false,
    rot: 0,
    unit: 1,
  };
  const ops = compileDoodle(spec, place, 11);
  const canvas = new InkCanvas(960, 540);
  for (const mark of sequenceOps(ops, {
    t0: 0,
    seed: 11,
    speed: 1,
    fps: 12,
    held: false,
    unit: 1,
  })) {
    drawMark(canvas, mark, 60, identity);
  }
  const [x, y, w, h] = opsBox(ops).map(Math.round) as [number, number, number, number];
  let ink = 0;
  for (let yy = Math.max(0, y); yy < Math.min(540, y + h); yy += 1) {
    for (let xx = Math.max(0, x); xx < Math.min(960, x + w); xx += 1) {
      if ((canvas.data[yy * 960 + xx] ?? INK.PAPER) !== INK.PAPER) ink += 1;
    }
  }
  return ink / Math.max(1, w * h);
}

describe('generators', () => {
  it('has unique kinds, docs for every kind, and draws every type validly and seeded', () => {
    expect(new Set(DRAW_KINDS).size).toBe(DRAW_KINDS.length);
    const docs = vocabularyLines().join('\n');
    for (const entry of FAMILIES) {
      expect(docs).toContain(entry.kind);
      for (const type of Object.keys(entry.types)) {
        const knobs = {
          type,
          color: undefined,
          action: entry.actions?.[1],
          count: undefined,
          w: 400,
          h: 160,
        };
        for (const seed of [1, 2, 5, 9, 17, 40])
          makeDrawing(
            entry,
            { ...knobs, w: 120 + seed * 20 },
            seed,
            { plain: false, bold: false },
            type,
          );
        const a = makeDrawing(entry, knobs, 3, { plain: false, bold: false }, type);
        expect(a.parts.length, `${entry.kind}/${type}`).toBeGreaterThan(0);
        expect(makeDrawing(entry, knobs, 3, { plain: false, bold: false }, type)).toEqual(a);
        expect(heightOf(entry, type)).toBeGreaterThan(10);
      }
    }
  });

  it('is never the same drawing twice: another seed, another tree', () => {
    const tree = FAMILIES.find((entry) => entry.kind === 'tree');
    if (!tree) throw new Error('tree');
    const knobs = {
      type: 'pine',
      color: undefined,
      action: undefined,
      count: undefined,
      w: 0,
      h: 0,
    };
    const finish = { plain: false, bold: false };
    expect(makeDrawing(tree, knobs, 1, finish, 't')).not.toEqual(
      makeDrawing(tree, knobs, 2, finish, 't'),
    );
  });

  it('plain drops the crayon, bold fattens the felt outline', () => {
    const house = FAMILIES.find((entry) => entry.kind === 'building');
    if (!house) throw new Error('building');
    const knobs = {
      type: 'house',
      color: undefined,
      action: undefined,
      count: undefined,
      w: 0,
      h: 0,
    };
    const plain = makeDrawing(house, knobs, 1, { plain: true, bold: false }, 't');
    expect(plain.parts.every((part) => part.fill === undefined && !('hatch' in part))).toBe(true);
    const bold = makeDrawing(house, knobs, 1, { plain: false, bold: true }, 't');
    expect(
      bold.parts.filter((part) => part.nib === 'felt').every((part) => (part.width ?? 0) >= 3),
    ).toBe(true);
  });

  it('keeps a silhouette at hero size (ink covers enough of the box to read at 64 px)', () => {
    const heroes: [string, string][] = [
      ['tree', 'oak'],
      ['tree', 'pine'],
      ['beast', 'camel'],
      ['beast', 'bear'],
      ['fish', 'whale'],
      ['building', 'house'],
      ['building', 'castle'],
      ['vehicle', 'car'],
      ['vehicle', 'rocket'],
      ['vehicle', 'station'],
      ['cactus', 'saguaro'],
      ['sealife', 'octopus'],
    ];
    for (const [kind, type] of heroes)
      expect(coverage(kind, type, 220), `${kind}/${type}`).toBeGreaterThan(0.12);
  });
});
