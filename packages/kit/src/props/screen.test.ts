import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createVoxelApi } from '../voxel/api.js';
import { createKitContext } from '../context.js';
import { CRISP_PALETTE } from '../testing/palettes.js';
import { testRng } from '../testing/rng.js';
import { fitScale, textBlock, drawText } from './font.js';
import { applyGlitch, isAnimated, paintScreen, ROLE, type ScreenState } from './screen-content.js';
import { Sketch } from './sketch.js';

const BASE: ScreenState = {
  mode: 'text',
  text: '42',
  align: 'right',
  glitch: 0,
  on: true,
  t: 0,
  seed: 3,
};

function count(pixels: Uint8Array, role: number): number {
  return pixels.filter((value) => value === role).length;
}

describe('screen content', () => {
  it('draws right-aligned text in ink on the back colour', () => {
    const pixels = paintScreen(40, 16, BASE);
    expect(count(pixels, ROLE.ink)).toBeGreaterThan(20);
    const inkColumns = [...pixels.keys()]
      .filter((index) => pixels[index] === ROLE.ink)
      .map((index) => index % 40);
    expect(Math.max(...inkColumns)).toBe(38);
    expect(Math.min(...inkColumns)).toBeGreaterThan(20);
    expect(count(paintScreen(40, 16, { ...BASE, mode: 'blank' }), ROLE.back)).toBe(640);
    expect(count(paintScreen(40, 16, { ...BASE, on: false }), ROLE.off)).toBe(640);
  });

  it('animates doom, code, chart and glitch as pure functions of t', () => {
    for (const mode of ['doom', 'code', 'chart', 'glitch'] as const) {
      const state = { ...BASE, mode };
      const early = paintScreen(44, 26, { ...state, t: 0.2 });
      const late = paintScreen(44, 26, { ...state, t: 2.4 });
      expect(late, mode).not.toEqual(early);
      expect(paintScreen(44, 26, { ...state, t: 0.2 }), mode).toEqual(early);
      expect(isAnimated(state), mode).toBe(true);
    }
    expect(isAnimated(BASE)).toBe(false);
    expect(isAnimated({ ...BASE, glitch: 0.5 })).toBe(true);
    expect(count(paintScreen(44, 26, { ...BASE, mode: 'chart', t: 0 }), ROLE.cool)).toBeGreaterThan(
      50,
    );
  });

  it('glitches proportionally to the amount (0 = unchanged)', () => {
    const clean = paintScreen(40, 16, BASE);
    const canvas = { width: 40, height: 16, pixels: clean.slice() };
    applyGlitch(canvas, 0, 1, 3);
    expect(canvas.pixels).toEqual(clean);
    const changed = (amount: number): number => {
      const glitched = paintScreen(40, 16, { ...BASE, glitch: amount, t: 1 });
      return glitched.filter((value, index) => value !== clean[index]).length;
    };
    expect(changed(1)).toBeGreaterThan(changed(0.2));
  });
});

describe('pixel font', () => {
  it('measures, fits and draws text (unknown characters as ?)', () => {
    const block = textBlock('61 KB');
    expect(block).toMatchObject({ width: 19, height: 5 });
    expect(fitScale(block, 40, 16)).toBe(2);
    const lit: string[] = [];
    drawText('~', { x: 0, y: 0, width: 3 }, 1, 'left', (x, y) =>
      lit.push(`${String(x)},${String(y)}`),
    );
    expect(lit).toEqual(['0,0', '1,0', '2,0', '2,1', '1,2', '1,4']);
  });
});

describe('sketch and screen panel', () => {
  it('clips boxes, paints filled cells only and rejects unknown pattern keys', () => {
    const context = createKitContext(THREE, CRISP_PALETTE, testRng(1));
    const voxel = createVoxelApi(context);
    const sketch = new Sketch<'a' | 'b'>([4, 2, 1], { a: 'hero', b: 'accent1' });
    sketch.box('a', [-2, 0, 0], [2, 1, 1]).paint('b', [1, 0, 0], [4, 2, 1]);
    const model = sketch.model(voxel);
    expect(Array.from(model.data)).toEqual([1, 2, 0, 0, 0, 0, 0, 0]);
    sketch.pattern(['.a', 'b.'], { a: 'a', b: 'b' }, 'xy', [2, 0, 0]);
    expect(sketch.filled(3, 1, 0) && sketch.filled(2, 0, 0)).toBe(true);
    expect(() => sketch.pattern(['c'], { a: 'a' }, 'xz', [0, 0, 0])).toThrow(
      /"c" is not in the key/,
    );
  });
});
