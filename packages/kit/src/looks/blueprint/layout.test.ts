import { describe, expect, it } from 'vitest';
import { chartLayout } from './chart-layout.js';
import { wheelPositions, wholeDigitsOf } from './counter.js';
import { chartDataFromCsv } from './csv.js';
import { borderPoint, edgePath, flowLayers, layoutCentres, pointAlong } from './graph-layout.js';
import { stackLabels, visibleRange } from './timeline.js';
import { createResolver, scheduleTimes } from './timing.js';

const AREA = { x: 20, y: 40, width: 600, height: 280 };

describe('chart layout', () => {
  const data = chartDataFromCsv('year,units\n1998,12\n2000,40\n2005,95\n2010,61\n2020,18');
  const options = { s: 1, decimals: 0, prefix: '', suffix: 'M' } as const;

  it('keeps bars, labels and the scale inside the area', () => {
    const layout = chartLayout(data, AREA, { ...options, type: 'bar' });
    expect(layout.scale.max).toBe(100);
    expect(layout.plot.x).toBeGreaterThan(AREA.x);
    expect(layout.plot.x + layout.plot.width).toBeLessThanOrEqual(AREA.x + AREA.width);
    expect(layout.plot.y + layout.plot.height).toBeLessThan(AREA.y + AREA.height);
    expect(layout.labelScale).toBe(2);
    expect(layout.labelStep).toBe(1);
    expect(layout.position(0)).toBeCloseTo(layout.plot.y + layout.plot.height);
    expect(layout.position(100)).toBeCloseTo(layout.plot.y);
    const centres = layout.centres;
    for (let index = 1; index < centres.length; index += 1) {
      expect((centres[index] ?? 0) - (centres[index - 1] ?? 0)).toBeCloseTo(layout.band);
    }
  });

  it('thins crowded labels and lays horizontal bars out in rows', () => {
    const many = chartDataFromCsv(
      Array.from({ length: 30 }, (_, i) => `LABEL ${String(i)},${String(i)}`).join('\n'),
    );
    const crowded = chartLayout(many, AREA, { ...options, type: 'bar' });
    expect(crowded.labelScale).toBe(1);
    expect(crowded.labelStep).toBeGreaterThan(1);
    const rows = chartLayout(data, AREA, { ...options, type: 'hbar' });
    expect(rows.centres[1] ?? 0).toBeGreaterThan(rows.centres[0] ?? 0);
    expect(rows.position(0)).toBeCloseTo(rows.plot.x);
  });
});

describe('counter wheels', () => {
  it('turns a wheel only while every wheel to its right passes 9 -> 0', () => {
    expect(wheelPositions(1234, 4, 0)).toEqual([1, 2, 3, 4]);
    const rolling = wheelPositions(1999.5, 4, 0);
    expect(rolling.map((value) => Math.round(value * 10) / 10)).toEqual([1.5, 9.5, 9.5, 9.5]);
    expect(wheelPositions(1234.5, 4, 0)[2]).toBe(3);
    const decimals = wheelPositions(12.34, 2, 2).map((value) => Math.round(value * 1000) / 1000);
    expect(decimals).toEqual([1, 2, 3, 4]);
    expect(wholeDigitsOf(0)).toBe(1);
    expect(wholeDigitsOf(1250000)).toBe(7);
  });
});

describe('graph layout', () => {
  it('layers a flow left to right and pulls sources next to their consumer', () => {
    // src -> cc -> bin -> dev, wad -> bin
    const edges = [
      [0, 2],
      [2, 3],
      [1, 3],
      [3, 4],
    ] as const;
    expect(flowLayers(5, edges)).toEqual([0, 1, 1, 2, 3]);
    expect(
      flowLayers(2, [
        [0, 1],
        [1, 0],
      ]),
    ).toHaveLength(2);
    const centres = layoutCentres('flow', 5, edges, AREA);
    for (const [x, y] of centres) {
      expect(x).toBeGreaterThan(AREA.x);
      expect(x).toBeLessThan(AREA.x + AREA.width);
      expect(y).toBeGreaterThan(AREA.y);
      expect(y).toBeLessThan(AREA.y + AREA.height);
    }
    expect(layoutCentres('circle', 4, [], AREA)[0]?.[0]).toBeCloseTo(AREA.x + AREA.width / 2);
  });

  it('starts and ends edges on box borders', () => {
    const a = { cx: 100, cy: 100, width: 40, height: 20 };
    const b = { cx: 300, cy: 160, width: 40, height: 20 };
    expect(borderPoint(a, 300, 100)).toEqual([120, 100]);
    const elbow = edgePath(a, b, true);
    expect(elbow).toHaveLength(4);
    expect(elbow[0]?.[0]).toBe(121);
    expect(elbow.at(-1)?.[0]).toBe(278);
    const straight = edgePath(a, b, false);
    expect(straight).toHaveLength(2);
    expect(pointAlong(elbow, 0)).toEqual(elbow[0]);
    expect(pointAlong(elbow, 1)).toEqual(elbow.at(-1));
  });
});

describe('timeline layout', () => {
  it('eases between views in order', () => {
    const views = [{ at: 1, range: [2010, 2022] as const }];
    expect(visibleRange([1990, 2025], views, 0)).toEqual([1990, 2025]);
    expect(visibleRange([1990, 2025], views, 5)).toEqual([2010, 2022]);
    const middle = visibleRange([1990, 2025], views, 1.4);
    expect(middle[0]).toBeGreaterThan(1990);
    expect(middle[0]).toBeLessThan(2010);
  });

  it('stacks labels above and below without overlaps', () => {
    const rows = stackLabels([100, 110, 120, 400], [60, 60, 60, 60], 4);
    expect(rows.map((row) => row.row)).toEqual([0, 1, 2, 1]);
    for (const [index, row] of rows.entries()) {
      for (const other of rows.slice(index + 1)) {
        if (other.row !== row.row) continue;
        expect(row.right <= other.left || other.right <= row.left).toBe(true);
      }
    }
  });
});

describe('reveal times', () => {
  it('passes seconds through, resolves phrases (nth via #) and falls back to a schedule', () => {
    const calls: string[] = [];
    const resolve = createResolver((phrase, nth) => {
      calls.push(`${phrase}/${String(nth)}`);
      return { t: phrase === 'peak' ? 3.4 : 1 + (nth ?? 1) };
    }, 'kit.fx.test()');
    expect(resolve(2.5, 0)).toBe(2.5);
    expect(resolve('peak', 0)).toBe(3.4);
    expect(resolve('peak', 0)).toBe(3.4);
    expect(resolve('two thousand#2', 0)).toBe(3);
    expect(calls).toEqual(['peak/1', 'two thousand/2']);
    expect(scheduleTimes([undefined, 5, undefined], resolve, 0.4, 0.5)).toEqual([0.4, 5, 1.4]);
  });

  it('asks for ctx.anchor when a phrase has no resolver', () => {
    expect(() => createResolver(undefined, 'kit.fx.blueprintChart()')('peak', 0)).toThrow(
      /kit\.fx\.blueprintChart\(\): "peak" is a spoken phrase; pass anchor: ctx\.anchor/,
    );
  });
});
