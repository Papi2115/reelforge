import { describe, expect, it } from 'vitest';
import { postFragmentShader } from '../gl/post-shader.js';
import { BAYER_4X4 } from '../palette.js';
import { resolveStyle } from '../style.js';
import {
  BOKEH_TAPS_PER_RADIUS,
  bokehRadius,
  bokehTap,
  bokehTapTable,
  DEFAULT_BOKEH,
  MAX_BOKEH_RADIUS,
} from './bokeh.js';

describe('circle of confusion', () => {
  const focus = { distance: 4, aperture: DEFAULT_BOKEH };

  it('is 0 in focus, the aperture at twice and half the distance, capped far and near', () => {
    expect(bokehRadius(4, focus)).toBe(0);
    expect(bokehRadius(4.5, focus)).toBe(0);
    expect(bokehRadius(8, focus)).toBe(DEFAULT_BOKEH);
    expect(bokehRadius(2, focus)).toBe(DEFAULT_BOKEH);
    expect(bokehRadius(1000, focus)).toBe(MAX_BOKEH_RADIUS);
    expect(bokehRadius(0.2, focus)).toBe(MAX_BOKEH_RADIUS);
  });

  it('is 0 everywhere without an aperture', () => {
    for (const depth of [0.5, 4, 50])
      expect(bokehRadius(depth, { distance: 4, aperture: 0 })).toBe(0);
  });
});

describe('ordered-dither taps', () => {
  const taps = bokehTapTable();

  it('has 16 integer taps per radius, each inside its circle', () => {
    expect(taps).toHaveLength(MAX_BOKEH_RADIUS * BOKEH_TAPS_PER_RADIUS);
    taps.forEach(([x, y], index) => {
      const radius = Math.floor(index / BOKEH_TAPS_PER_RADIUS) + 1;
      expect(Number.isInteger(x) && Number.isInteger(y)).toBe(true);
      expect(Math.hypot(x, y)).toBeLessThanOrEqual(radius + 0.5);
    });
  });

  it('spreads the taps of a radius over the disk (every direction is sampled)', () => {
    for (let radius = 2; radius <= MAX_BOKEH_RADIUS; radius += 1) {
      const ring = taps.slice((radius - 1) * BOKEH_TAPS_PER_RADIUS, radius * BOKEH_TAPS_PER_RADIUS);
      expect(ring.some(([x]) => x > 0) && ring.some(([x]) => x < 0)).toBe(true);
      expect(ring.some(([, y]) => y > 0) && ring.some(([, y]) => y < 0)).toBe(true);
      expect(new Set(ring.map(([x, y]) => `${String(x)},${String(y)}`)).size).toBeGreaterThan(10);
    }
  });

  it('picks the tap by the pixel rank in the 4x4 Bayer matrix (repeats every 4 px)', () => {
    expect(bokehTap(5, 5, 0)).toEqual([0, 0]);
    for (let y = 0; y < 4; y += 1) {
      for (let x = 0; x < 4; x += 1) {
        const rank = BAYER_4X4[y * 4 + x] ?? -1;
        expect(bokehTap(x, y, 3)).toEqual(taps[2 * BOKEH_TAPS_PER_RADIUS + rank]);
        expect(bokehTap(x + 4, y + 8, 3)).toEqual(bokehTap(x, y, 3));
      }
    }
  });
});

describe('post shader variants', () => {
  it('adds the bokeh only to the variant and only for styles with depth', () => {
    const post = resolveStyle({ style: 'voxel-pixel-crisp640' }).post;
    const base = postFragmentShader(post);
    expect(base).not.toContain('focusA');
    expect(postFragmentShader(post, { bokeh: false })).toBe(base);
    const bokeh = postFragmentShader(post, { bokeh: true });
    expect(bokeh).toContain('uniform vec2 focusA;');
    expect(bokeh).toContain('vec3 shadeBase(');
    expect(bokeh).toContain(`BOKEH_TAPS[${String(MAX_BOKEH_RADIUS * BOKEH_TAPS_PER_RADIUS)}]`);
    const flat = { ...post, ao: undefined, outline: undefined };
    expect(postFragmentShader(flat, { bokeh: true })).toBe(postFragmentShader(flat));
  });
});
