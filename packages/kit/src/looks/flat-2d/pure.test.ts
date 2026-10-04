import { describe, expect, it } from 'vitest';
import { testRng } from '../../testing/rng.js';
import { morphRing, PROFILE_SAMPLES, radialProfile, shapeRings, SHAPE_KINDS } from './geometry.js';
import { ICON_CELLS } from './icon-types.js';
import { ICON_NAMES, ICONS } from './icons.js';
import { formatNumber } from './info-common.js';
import { shorthandWords } from './kinetic.js';
import { entrancePose, ENTRANCES, motionPose, REST } from './motion.js';
import { Raster, hexPixel } from './raster.js';
import { decorLayout } from './stage-env.js';
import { createResolver, easeOutBack } from './timing.js';

const SIZE = { w: 80, h: 80, round: 10, thickness: 12 };

describe('flat-2d geometry', () => {
  it('outlines every shape kind around its centre', () => {
    for (const kind of SHAPE_KINDS) {
      const rings = shapeRings(kind, SIZE);
      expect(rings.length, kind).toBe(kind === 'ring' ? 2 : 1);
      for (const [x, y] of rings.flat()) {
        expect(Math.abs(x), kind).toBeLessThanOrEqual(40.001);
        expect(Math.abs(y), kind).toBeLessThanOrEqual(40.001);
      }
    }
  });

  it('morphs through radial profiles that match both ends', () => {
    const circle = radialProfile('circle', SIZE);
    const square = radialProfile('rect', { ...SIZE, round: 0 });
    expect(circle).toHaveLength(PROFILE_SAMPLES);
    for (const r of circle) expect(r).toBeCloseTo(40, 0);
    // A square's corner (45 degrees) is sqrt(2) further out than its edge midpoint.
    expect(Math.max(...square)).toBeCloseTo(40 * Math.SQRT2, 0);
    expect(Math.min(...square)).toBeCloseTo(40, 0);
    const start = morphRing(circle, square, 0);
    const end = morphRing(circle, square, 1);
    expect(Math.hypot(...(start[16] ?? [0, 0]))).toBeCloseTo(circle[16] ?? 0, 6);
    expect(Math.hypot(...(end[16] ?? [0, 0]))).toBeCloseTo(square[16] ?? 0, 6);
  });

  it('fills polygons and ellipses without anti-aliasing (palette colours only)', () => {
    const raster = new Raster(40, 40);
    const color = hexPixel('#ff8c42');
    raster.ellipse(20, 20, 12, 8, color);
    raster.polygon(shapeRings('star', { w: 20, h: 20, round: 0, thickness: 1 }), color);
    const view = new Uint32Array(raster.data.buffer);
    expect(new Set(view)).toEqual(new Set([0, color]));
  });
});

describe('flat-2d icons', () => {
  it('ships 24+ icons, each 16x16 in the cell legend', () => {
    expect(ICON_NAMES.length).toBeGreaterThanOrEqual(24);
    for (const required of [
      'person',
      'gear',
      'lightbulb',
      'lock',
      'cloud',
      'phone',
      'chart',
      'star',
      'arrow',
      'check',
      'cross',
      'heart',
      'clock',
      'globe',
      'magnifier',
      'document',
      'envelope',
      'battery',
      'wifi',
      'coin',
      'rocket',
      'shield',
      'camera',
      'play',
    ]) {
      expect(ICON_NAMES).toContain(required);
    }
    for (const [name, icon] of Object.entries(ICONS)) {
      expect(icon.rows, name).toHaveLength(ICON_CELLS);
      for (const row of icon.rows) expect(row, name).toMatch(/^[.#+*ox]{16}$/);
      expect(icon.rows.join('').replace(/\./g, '').length, name).toBeGreaterThan(30);
    }
  });
});

describe('flat-2d motion and timing', () => {
  it('rests at 1 and starts hidden or offset for every entrance', () => {
    for (const kind of ENTRANCES) {
      const rest = entrancePose(kind, 1, 50);
      expect(rest.scale, kind).toBeCloseTo(1, 6);
      expect(rest.dx, kind).toBeCloseTo(0, 6);
      expect(rest.dy, kind).toBeCloseTo(0, 6);
      expect(rest.reveal, kind).toBe(1);
    }
    expect(entrancePose('pop', 0, 50).scale).toBe(0);
    expect(entrancePose('slide-left', 0, 50).dx).toBe(-50);
    expect(Math.max(...[0.5, 0.6, 0.7, 0.8].map(easeOutBack))).toBeGreaterThan(1);
  });

  it('hides an element before it enters and after it leaves', () => {
    const spec = {
      at: 1,
      enter: 'pop',
      out: 3,
      idle: 'float',
      duration: 0.4,
      seed: 1,
      distance: 60,
    } as const;
    expect(motionPose(0.5, spec).visible).toBe(false);
    expect(motionPose(2, spec).visible).toBe(true);
    expect(motionPose(4, spec).visible).toBe(false);
    expect(motionPose(2, { ...spec, idle: 'none' })).toEqual(REST);
  });

  it('resolves phrases once through the anchor and caches them', () => {
    let calls = 0;
    const resolve = createResolver((phrase, nth) => {
      calls += 1;
      return { t: phrase.length + (nth ?? 1) };
    }, 'kit.fx.flatShapes()');
    expect(resolve('abc#2', 0)).toBe(5);
    expect(resolve('abc#2', 0)).toBe(5);
    expect(resolve(undefined, 7)).toBe(7);
    expect(calls).toBe(1);
  });
});

describe('flat-2d text and numbers', () => {
  it('splits the kinetic shorthand into lines and marked words', () => {
    expect(shorthandWords('ONE IDEA / *CHANGED* IT', 'plate')).toEqual([
      { text: 'ONE', mark: 'none', br: false },
      { text: 'IDEA', mark: 'none', br: false },
      { text: 'CHANGED', mark: 'plate', br: true },
      { text: 'IT', mark: 'none', br: false },
    ]);
  });

  it('formats numbers with digit groups and decimals', () => {
    expect(formatNumber(1_250_000, 0)).toBe('1,250,000');
    expect(formatNumber(3.14159, 2)).toBe('3.14');
    expect(formatNumber(-42.5, 1)).toBe('-42.5');
  });
});

describe('flat-2d stage decor', () => {
  it('is seeded and keeps the centre of the frame free', () => {
    const a = decorLayout(8, testRng(3), 'confetti');
    expect(decorLayout(8, testRng(3), 'confetti')).toEqual(a);
    for (const item of a) {
      const reach = Math.hypot(item.u - 0.5, item.v - 0.5);
      expect(reach).toBeGreaterThan(0.3);
      expect(item.u).toBeGreaterThan(0);
      expect(item.u).toBeLessThan(1);
    }
    expect(new Set(decorLayout(5, testRng(1), 'subtle').map((item) => item.color))).toEqual(
      new Set(['card']),
    );
  });
});
