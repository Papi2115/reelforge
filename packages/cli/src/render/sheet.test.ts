import { describe, expect, it } from 'vitest';
import { createImage, downscale, drawLabel, labelWidth } from './image.js';
import { composeSheet } from './sheet.js';

function solid(width: number, height: number, color: readonly [number, number, number]) {
  return createImage(width, height, color);
}

function pixel(image: { width: number; data: Uint8Array }, x: number, y: number): number[] {
  const offset = (y * image.width + x) * 4;
  return [...image.data.subarray(offset, offset + 4)];
}

describe('image helpers', () => {
  it('downscales by averaging blocks', () => {
    const image = createImage(2, 2, [0, 0, 0]);
    image.data.set([200, 100, 0, 255], 0);
    expect(pixel(downscale(image, 2), 0, 0)).toEqual([50, 25, 0, 255]);
  });

  it('draws pixel-font labels and measures them (6 px per mono character)', () => {
    const image = createImage(40, 14, [0, 0, 0]);
    drawLabel(image, 's01', 1, 1, [255, 255, 255], 1);
    expect(labelWidth('s01', 2)).toBe(36);
    const inked = [...Array(40 * 14).keys()].filter((index) => image.data[index * 4] === 255);
    expect(inked.length).toBeGreaterThan(10);
  });
});

describe('composeSheet', () => {
  it('lays out one row per shot with labelled tiles and failure tiles', () => {
    const frame = solid(64, 36, [10, 200, 30]);
    const sheet = composeSheet({ title: 'T', frameWidth: 64, frameHeight: 36, factor: 1 }, [
      {
        tiles: [
          { label: 's01 0.50s', frame },
          { label: 's01 1.50s', frame },
        ],
      },
      { tiles: [{ label: 's02 0.50s', failure: 'FAILED TO LOAD' }] },
    ]);
    // 2 columns of 64 px + 3 gaps of 6; title band 36; two rows of (label 28 + 36 + gap 6).
    expect([sheet.width, sheet.height]).toEqual([2 * 64 + 3 * 6, 36 + 2 * (28 + 36 + 6)]);
    expect(pixel(sheet, 6 + 32, 36 + 28 + 18)).toEqual([10, 200, 30, 255]);
    expect(pixel(sheet, 6 + 1, 36 + 70 + 28 + 1)).toEqual([110, 18, 36, 255]);
  });

  it('halves frames with factor 2 and widens the sheet for a long title', () => {
    const frame = solid(64, 36, [1, 2, 3]);
    const title = 'a long contact sheet title that needs room';
    const sheet = composeSheet({ title, frameWidth: 64, frameHeight: 36, factor: 2 }, [
      { tiles: [{ label: 'x', frame }] },
    ]);
    expect(sheet.width).toBe(labelWidth(title, 2) + 12);
    expect(sheet.height).toBe(36 + 28 + 18 + 6);
  });
});
