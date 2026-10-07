/** Per-asset legibility crops (real runs Game B2 2 / Game B1 2): where the asset is, film size, sheet. */
import { describe, expect, it } from 'vitest';
import { createImage, fillRect } from '../render/image.js';
import {
  assetBounds,
  composeCropSheet,
  CROP_TILE_HEIGHT,
  cropTileCode,
  filmScale,
  filmSizeCrop,
} from './crops.js';

function page(withAsset: { x: number; y: number; w: number; h: number } | undefined) {
  const image = createImage(640, 360, [200, 190, 160]);
  if (withAsset) fillRect(image, withAsset.x, withAsset.y, withAsset.w, withAsset.h, [20, 60, 30]);
  return image;
}

describe('world asset crops', () => {
  it('finds the asset as the difference to the empty page (padded)', () => {
    const bounds = assetBounds(page({ x: 100, y: 50, w: 10, h: 20 }), page(undefined));
    expect(bounds).toEqual({ x: 97, y: 47, width: 16, height: 26 });
  });

  it('uses the whole frame without an empty render and nothing when the asset draws nothing', () => {
    expect(assetBounds(page(undefined), undefined)).toEqual({
      x: 0,
      y: 0,
      width: 640,
      height: 360,
    });
    expect(assetBounds(page(undefined), page(undefined))).toBeUndefined();
  });

  it('shows a small sprite at its 1080p size, never larger', () => {
    // 640x360 frames are 3x in 1080p: a 16x26 crop is 48x78 there.
    const bounds = { x: 97, y: 47, width: 16, height: 26 };
    expect(filmScale(360, bounds)).toBe(3);
    const crop = filmSizeCrop(page({ x: 100, y: 50, w: 10, h: 20 }), bounds);
    expect([crop.width, crop.height]).toEqual([48, 78]);
  });

  it('shrinks a big thing to at most 128 px tall', () => {
    const crop = filmSizeCrop(page({ x: 0, y: 0, w: 200, h: 300 }), {
      x: 0,
      y: 0,
      width: 200,
      height: 300,
    });
    expect(crop.height).toBe(CROP_TILE_HEIGHT);
    expect(crop.width).toBe(85);
  });

  it('codes crops A1..A6, B1.. and lays six to an image', () => {
    expect([0, 5, 6, 13].map(cropTileCode)).toEqual(['A1', 'A6', 'B1', 'C2']);
    const crop = createImage(40, 60, [255, 0, 0]);
    const sheet = composeCropSheet(
      Array.from({ length: 6 }, (_, index) => ({ code: cropTileCode(index), image: crop })),
    );
    expect(sheet.width).toBe(8 + 3 * (256 + 8));
    const failed = composeCropSheet([{ code: 'A1', failure: 'draws nothing' }]);
    expect(failed.width).toBe(8 + 256 + 8);
  });
});
