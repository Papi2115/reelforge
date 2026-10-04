import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { buildPaletteLut, paletteRgb } from '../palette.js';
import { resolveStyle } from '../style.js';
import {
  assetLuminance,
  cropKey,
  ditherOffsets,
  planCrop,
  resampleArea,
  stretchContrast,
  stylizeAsset,
  type AssetSource,
  type StylizeOptions,
} from './stylize.js';
import { TEST_CARD_HEIGHT, TEST_CARD_WIDTH, testCardRgb } from './testing/test-card.js';

const CARD: AssetSource = { width: TEST_CARD_WIDTH, height: TEST_CARD_HEIGHT, rgb: testCardRgb() };
const STYLE = resolveStyle({});

function options(overrides: Partial<StylizeOptions> = {}): StylizeOptions {
  return {
    width: 96,
    height: 64,
    crop: 'cover',
    lut: STYLE.post.lut,
    dither: 0.5,
    ditherSize: 4,
    contrast: true,
    ...overrides,
  };
}

function sha(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

describe('planCrop', () => {
  const source = { width: 400, height: 200 };

  it("'cover' crops the overflow evenly and fills the target", () => {
    expect(planCrop(source, 100, 100, 'cover')).toEqual({
      x0: 100,
      y0: 0,
      x1: 300,
      y1: 200,
      target: { x: 0, y: 0, w: 100, h: 100 },
    });
  });

  it("'center' keeps the whole picture and letterboxes it", () => {
    expect(planCrop(source, 100, 100, 'center')).toEqual({
      x0: 0,
      y0: 0,
      x1: 400,
      y1: 200,
      target: { x: 0, y: 25, w: 100, h: 50 },
    });
  });

  it('focus + zoom magnifies around the focus, clamped inside the picture', () => {
    expect(planCrop(source, 100, 100, { focus: [0.75, 0.5], zoom: 2 })).toMatchObject({
      x0: 250,
      y0: 50,
      x1: 350,
      y1: 150,
    });
    expect(planCrop(source, 100, 100, { focus: [1, 0], zoom: 2 })).toMatchObject({
      x0: 300,
      y0: 0,
      x1: 400,
      y1: 100,
    });
  });
});

describe('resampleArea', () => {
  it('averages a 1-px checker into mid grey (rounded half up)', () => {
    const rgb = new Uint8Array(4 * 4 * 3);
    for (let pixel = 0; pixel < 16; pixel += 1) {
      const white = (pixel % 4) % 2 === Math.floor(pixel / 4) % 2;
      rgb.fill(white ? 255 : 0, pixel * 3, pixel * 3 + 3);
    }
    const source = { width: 4, height: 4, rgb };
    const { rgb: out, mask } = resampleArea(source, planCrop(source, 2, 2, 'cover'), 2, 2);
    expect([...out]).toEqual(new Array<number>(12).fill(128));
    expect([...mask]).toEqual([1, 1, 1, 1]);
  });

  it('repeats pixels when magnifying', () => {
    const source = { width: 2, height: 1, rgb: Uint8Array.from([10, 20, 30, 40, 50, 60]) };
    const { rgb } = resampleArea(source, planCrop(source, 4, 2, 'cover'), 4, 2);
    expect([...rgb.subarray(0, 12)]).toEqual([10, 20, 30, 10, 20, 30, 40, 50, 60, 40, 50, 60]);
  });
});

describe('stretchContrast', () => {
  it('stretches a narrow luma range to the full range and leaves flat pictures alone', () => {
    const rgb = Uint8Array.from([100, 100, 100, 150, 150, 150]);
    stretchContrast(rgb, Uint8Array.from([1, 1]));
    expect([...rgb]).toEqual([0, 0, 0, 255, 255, 255]);
    const flat = Uint8Array.from([100, 100, 100, 104, 104, 104]);
    stretchContrast(flat, Uint8Array.from([1, 1]));
    expect([...flat]).toEqual([100, 100, 100, 104, 104, 104]);
  });
});

describe('stylizeAsset', () => {
  it('maps every pixel to a palette colour of the LUT', () => {
    const { indices } = stylizeAsset(CARD, options());
    expect(indices.length).toBe(96 * 64);
    const count = STYLE.post.lut.palette.length;
    expect([...indices].every((index) => index < count)).toBe(true);
    expect(new Set(indices).size).toBeGreaterThan(8);
  });

  it('is deterministic: same input, same bytes (pinned hash of the test card)', () => {
    const first = stylizeAsset(CARD, options()).indices;
    const second = stylizeAsset({ ...CARD, rgb: testCardRgb() }, options()).indices;
    expect(Buffer.from(first).equals(Buffer.from(second))).toBe(true);
    expect(sha(first)).toBe(PINNED_CRISP_96X64);
  });

  it('crop modes, dither and contrast change the picture', () => {
    const base = sha(stylizeAsset(CARD, options()).indices);
    const variants = [
      options({ crop: 'center' }),
      options({ crop: { focus: [0.72, 0.27], zoom: 3 } }),
      options({ dither: 0 }),
      options({ contrast: false }),
    ].map((variant) => sha(stylizeAsset(CARD, variant).indices));
    expect(new Set([base, ...variants]).size).toBe(5);
  });

  it("letterboxes 'center' with the palette's darkest colour", () => {
    const lut = buildPaletteLut(paletteRgb({ a: '#000000', b: '#ffffff', c: '#ff0000' }));
    const { indices } = stylizeAsset(CARD, options({ width: 40, height: 40, crop: 'center', lut }));
    // 4:3 into a square: 5 rows of bars above and below.
    expect([...indices.subarray(0, 40 * 5)].every((index) => index === 0)).toBe(true);
    expect([...indices.subarray(40 * 35)].every((index) => index === 0)).toBe(true);
  });

  it('maps onto any colour list (a two-tone LUT gives exactly two colours)', () => {
    const lut = buildPaletteLut(paletteRgb({ ink: '#101018', paper: '#f0e8d8' }));
    const { indices } = stylizeAsset(CARD, options({ lut, dither: 1 }));
    expect(new Set(indices)).toEqual(new Set([0, 1]));
  });
});

describe('helpers', () => {
  it('dither offsets are symmetric integers and scale with strength', () => {
    expect([...ditherOffsets(4, 0)].every((value) => value === 0)).toBe(true);
    const full = ditherOffsets(4, 1);
    expect(Math.min(...full)).toBe(-Math.max(...full));
    expect(full.every((value) => Number.isInteger(value))).toBe(true);
  });

  it('luminance of a letterboxed slot is 0 in the bars', () => {
    const lum = assetLuminance(CARD, { width: 40, height: 40, crop: 'center', contrast: true });
    expect(lum[0]).toBe(0);
    expect(Math.max(...lum)).toBeGreaterThan(200);
  });

  it('crop keys are stable text', () => {
    expect(cropKey('cover')).toBe('cover');
    expect(cropKey({ focus: [0.3, 0.4], zoom: 2 })).toBe('f0.3,0.4z2');
  });
});

/** sha256 of the test card stylised at 96x64 (cover, dither 0.5, contrast) in Crisp 640. */
const PINNED_CRISP_96X64 = '081140e6c81e62afe0af00235931fb1bf4354b09e97c8935b782902dba021aa1';
