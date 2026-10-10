import { describe, expect, it } from 'vitest';
import { compositeOverlay } from './direction-frame.js';
import { buildPaletteLut, hexToRgb } from './palette.js';

/** One opaque #7a5c3e pixel, one transparent pixel. */
const OVERLAY = new Uint8Array([0x7a, 0x5c, 0x3e, 255, 1, 2, 3, 0]);

function blankFrame(): Uint8Array {
  return new Uint8Array([9, 9, 9, 255, 9, 9, 9, 255]);
}

describe('compositeOverlay', () => {
  it('snaps overlay colours to the palette LUT of a quantizing style', () => {
    const lut = buildPaletteLut(['#000000', '#ffffff'].map(hexToRgb));
    const frame = blankFrame();
    compositeOverlay(frame, OVERLAY, lut, new Map());
    expect([...frame.subarray(0, 4)]).toEqual([0, 0, 0, 255]);
    expect([...frame.subarray(4, 8)]).toEqual([9, 9, 9, 255]);
  });

  it('copies overlay colours unchanged without a LUT (full-colour style)', () => {
    const frame = blankFrame();
    compositeOverlay(frame, OVERLAY, undefined, new Map());
    expect([...frame.subarray(0, 4)]).toEqual([0x7a, 0x5c, 0x3e, 255]);
    expect([...frame.subarray(4, 8)]).toEqual([9, 9, 9, 255]);
  });
});
