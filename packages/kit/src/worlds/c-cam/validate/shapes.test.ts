import { describe, expect, it } from 'vitest';
import { components, maskAt, rasterize } from './raster.js';
import {
  circleHitsBox,
  inkBounds,
  inkContains,
  inkDistance,
  regionContains,
  segmentHitsBox,
} from './shape-geometry.js';
import { ShapePaint } from './shape-paint.js';
import { THRESHOLDS } from './thresholds.js';

const TAU = Math.PI * 2;

/** A square ring: outer square (clockwise) + inner square (anticlockwise). */
function ring(g: ShapePaint, x: number, y: number, outer: number, inner: number): void {
  const d = (outer - inner) / 2;
  g.beginPath();
  g.moveTo(x, y);
  g.lineTo(x + outer, y);
  g.lineTo(x + outer, y + outer);
  g.lineTo(x, y + outer);
  g.closePath();
  g.moveTo(x + d, y + d);
  g.lineTo(x + d, y + d + inner);
  g.lineTo(x + d + inner, y + d + inner);
  g.lineTo(x + d + inner, y + d);
  g.closePath();
}

describe('ShapePaint', () => {
  it('flattens paths in device space with the transform current when each point is added', () => {
    const g = new ShapePaint();
    g.translate(100, 50);
    g.scale(2, 2);
    g.beginPath();
    g.rect(0, 0, 10, 5);
    g.fill();
    expect(inkBounds(g.shapes)).toEqual({ x0: 100, y0: 50, x1: 120, y1: 60 });
    expect(inkContains(g.shapes, 110, 55)).toBe(true);
    expect(inkContains(g.shapes, 121, 55)).toBe(false);
  });

  it('save / restore the transform and the clip', () => {
    const g = new ShapePaint();
    g.save();
    g.beginPath();
    g.rect(0, 0, 10, 10);
    g.clip();
    g.translate(5, 0);
    g.restore();
    g.beginPath();
    g.rect(0, 0, 20, 20);
    g.fill();
    expect(g.shapes[0]?.clips).toEqual([]);
    expect(inkBounds(g.shapes)).toEqual({ x0: 0, y0: 0, x1: 20, y1: 20 });
  });

  it('keeps clips on the shapes drawn under them', () => {
    const g = new ShapePaint();
    g.beginPath();
    g.rect(0, 0, 10, 10);
    g.clip();
    g.beginPath();
    g.rect(5, 5, 20, 20);
    g.fill();
    expect(inkContains(g.shapes, 7, 7)).toBe(true);
    expect(inkContains(g.shapes, 15, 15)).toBe(false);
    expect(inkBounds(g.shapes)).toEqual({ x0: 5, y0: 5, x1: 10, y1: 10 });
  });

  it('flattens a full ellipse and strokes with half the scaled line width', () => {
    const g = new ShapePaint();
    g.beginPath();
    g.ellipse(0, 0, 20, 10, 0, 0, TAU);
    g.scale(2, 2);
    g.lineWidth = 3;
    g.stroke();
    const s = g.shapes[0];
    expect(s?.kind).toBe('stroke');
    if (s?.kind !== 'stroke') return;
    expect(s.r).toBeCloseTo(3);
    expect(inkContains(g.shapes, 22.5, 0)).toBe(true);
    expect(inkContains(g.shapes, 0, 0)).toBe(false);
  });

  it('records fillRect without touching the current path', () => {
    const g = new ShapePaint();
    g.translate(10, 10);
    g.fillRect(0, 0, 4, 2);
    expect(inkBounds(g.shapes)).toEqual({ x0: 10, y0: 10, x1: 14, y1: 12 });
  });
});

describe('geometry', () => {
  it('honours nonzero vs evenodd on a ring', () => {
    const g = new ShapePaint();
    ring(g, 0, 0, 40, 20);
    g.fill('nonzero');
    const region = g.shapes[0]?.kind === 'fill' ? g.shapes[0].region : null;
    expect(region).not.toBeNull();
    if (!region) return;
    expect(regionContains(region, 20, 20)).toBe(false); // opposite windings cancel
    expect(regionContains(region, 5, 20)).toBe(true);
    expect(regionContains({ ...region, rule: 'evenodd' }, 20, 20)).toBe(false);
    const same = {
      paths: [region.paths[0], { pts: [10, 10, 30, 10, 30, 30, 10, 30], closed: true }].flatMap(
        (p) => (p ? [p] : []),
      ),
      rule: 'nonzero' as const,
    };
    expect(regionContains(same, 20, 20)).toBe(true); // same winding adds up
    expect(regionContains({ ...same, rule: 'evenodd' }, 20, 20)).toBe(false);
  });

  it('measures the distance to the ink and its nearest point', () => {
    const g = new ShapePaint();
    g.beginPath();
    g.rect(0, 0, 10, 10);
    g.fill();
    expect(inkDistance(g.shapes, 5, 5).d).toBe(0);
    const r = inkDistance(g.shapes, 14, 5);
    expect(r.d).toBeCloseTo(4);
    expect(r.at[0]).toBeCloseTo(10);
    expect(r.at[1]).toBeCloseTo(5);
  });

  it('segment / box and palm / box tests (c-plus segBox, inBox)', () => {
    const box = { x0: 0, y0: 0, x1: 10, y1: 10 };
    expect(segmentHitsBox([-5, 5], [15, 5], box)).toBe(true);
    expect(segmentHitsBox([-5, -1], [15, -1], box)).toBe(false);
    expect(segmentHitsBox([-5, -5], [-1, 15], box)).toBe(false);
    // palm radius boundary: strict overlap, touching is clear
    const r = 40 * THRESHOLDS.palmRadius; // a 40 px hand: 14 px
    expect(r).toBeCloseTo(14, 9);
    expect(circleHitsBox([24.001, 5], r, box)).toBe(false);
    expect(circleHitsBox([23.999, 5], r, box)).toBe(true);
    expect(circleHitsBox([5, -13.999], r, box)).toBe(true);
  });
});

describe('raster', () => {
  it('counts one piece and one hole for a ring, two pieces for two squares', () => {
    const g = new ShapePaint();
    ring(g, 0, 0, 40, 20);
    g.fill();
    const box = inkBounds(g.shapes);
    if (!box) throw new Error('no ink');
    const m = rasterize(g.shapes, box);
    expect(maskAt(m, 5, 5)).toBe(true);
    expect(maskAt(m, 20, 20)).toBe(false);
    expect(components(m, THRESHOLDS.minPiecePx, THRESHOLDS.minHolePx)).toEqual({
      comps: 1,
      holes: 1,
      biggestHole: 400,
    });

    const two = new ShapePaint();
    two.beginPath();
    two.rect(0, 0, 10, 10);
    two.rect(20, 0, 10, 10);
    two.fill();
    const b2 = inkBounds(two.shapes);
    if (!b2) throw new Error('no ink');
    expect(
      components(rasterize(two.shapes, b2), THRESHOLDS.minPiecePx, THRESHOLDS.minHolePx).comps,
    ).toBe(2);
  });

  it('ignores pieces under minPiecePx and holes under minHolePx (boundary)', () => {
    const paint = (holeW: number, holeH: number, speck: number): ReturnType<typeof components> => {
      const g = new ShapePaint();
      g.beginPath();
      g.rect(0, 0, 30, 30);
      // the hole runs the other way round (nonzero: windings cancel)
      g.moveTo(5, 5);
      g.lineTo(5, 5 + holeH);
      g.lineTo(5 + holeW, 5 + holeH);
      g.lineTo(5 + holeW, 5);
      g.closePath();
      g.fill();
      g.fillRect(50, 0, speck, 1);
      const box = inkBounds(g.shapes);
      if (!box) throw new Error('no ink');
      return components(rasterize(g.shapes, box), THRESHOLDS.minPiecePx, THRESHOLDS.minHolePx);
    };
    // a 1 x 19 px gap is a sliver, a 4 x 5 = 20 px one is a hole; a 5 px speck is ignored, 6 px is a piece
    expect(paint(1, 19, 5)).toEqual({ comps: 1, holes: 0, biggestHole: 0 });
    expect(paint(4, 5, 6)).toEqual({ comps: 2, holes: 1, biggestHole: 20 });
  });
});
