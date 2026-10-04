import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { decodePng, encodePng } from '../../cli/png.js';
import { TEST_CARD_HEIGHT, TEST_CARD_WIDTH, testCardRgb, testCardRgba } from './test-card.js';

const TEST_CARD_FIXTURE = path.resolve(
  import.meta.dirname,
  '..',
  '..',
  '..',
  'test',
  'fixtures',
  'asset-test-card.png',
);

describe('asset test card', () => {
  it('is the committed fixture (REELFORGE_UPDATE_GOLDENS=1 rewrites it)', () => {
    const image = { width: TEST_CARD_WIDTH, height: TEST_CARD_HEIGHT, data: testCardRgba() };
    if (process.env['REELFORGE_UPDATE_GOLDENS'] === '1') {
      writeFileSync(TEST_CARD_FIXTURE, encodePng(image));
    }
    const fixture = decodePng(readFileSync(TEST_CARD_FIXTURE));
    expect([fixture.width, fixture.height]).toEqual([TEST_CARD_WIDTH, TEST_CARD_HEIGHT]);
    expect(Buffer.from(fixture.data).equals(Buffer.from(image.data))).toBe(true);
  });

  it('looks like a photo: many colours, sun, patches and a checker', () => {
    const rgb = testCardRgb();
    const colours = new Set<number>();
    for (let at = 0; at < rgb.length; at += 3) {
      colours.add(((rgb[at] ?? 0) << 16) | ((rgb[at + 1] ?? 0) << 8) | (rgb[at + 2] ?? 0));
    }
    expect(colours.size).toBeGreaterThan(200);
    const pixel = (x: number, y: number) => [
      ...rgb.subarray((y * 320 + x) * 3, (y * 320 + x) * 3 + 3),
    ];
    expect(pixel(230, 64)).toEqual([255, 236, 160]);
    expect(pixel(5, 230)).toEqual([220, 40, 40]);
    expect(pixel(272, 156)).toEqual([255, 255, 255]);
    expect(pixel(273, 156)).toEqual([0, 0, 0]);
  });
});
