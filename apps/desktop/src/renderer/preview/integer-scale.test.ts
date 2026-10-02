import { describe, expect, it } from 'vitest';
import { integerDisplaySize } from './integer-scale.js';

describe('integerDisplaySize', () => {
  it('picks the largest integer factor that fits both axes', () => {
    expect(integerDisplaySize(1920, 1080, 640, 360).factor).toBe(3);
    expect(integerDisplaySize(1500, 1080, 640, 360).factor).toBe(2);
    expect(integerDisplaySize(1920, 700, 640, 360)).toEqual({
      factor: 1,
      cssWidth: 640,
      cssHeight: 360,
    });
  });

  it('counts device pixels under Windows display scaling', () => {
    // 1232x660 CSS px at 125 % = 1540x825 device px -> 2x = 1280x720 device = 1024x576 CSS.
    expect(integerDisplaySize(1232, 660, 640, 360, 1.25)).toEqual({
      factor: 2,
      cssWidth: 1024,
      cssHeight: 576,
    });
  });

  it('shrinks fractionally only below 1x and tolerates empty layouts', () => {
    expect(integerDisplaySize(320, 360, 640, 360).factor).toBe(0.5);
    expect(integerDisplaySize(0, 0, 640, 360).factor).toBe(1);
    expect(integerDisplaySize(800, 600, 0, 0).factor).toBe(1);
    expect(integerDisplaySize(1920, 1080, 640, 360, Number.NaN).factor).toBe(3);
  });
});
