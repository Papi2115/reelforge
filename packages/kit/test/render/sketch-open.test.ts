/**
 * The Sketchbook open vocabulary (PLAN.md#13.15a) in the engine harness (SwiftShader, 960x540):
 * six scenes on topics far from the showcase (forest, ocean, space station, medieval village,
 * desert, city), built only from the open layer, at three times each - the world-look suite
 * (lint, goldens `look-sketchbook-open-<topic>-t<t>`, vibe guard, seek-order determinism, contact
 * sheet packages/kit/out/contact/look-sketchbook-open.png) plus the thumbnail strip at 64 px wide
 * (QUALITY.md §7 thumbnail test), packages/kit/out/contact/sketch-open-thumbs.png.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  encodePng,
  launchHarnessBrowser,
  type HarnessBrowser,
  type RgbaImage,
} from '../../../engine/src/cli/index.js';
import { composeSheet } from '../support/contact-sheet.js';
import { downscale, resizeNearest } from '../support/image.js';
import { KIT_OUT_DIR, sceneManifest } from '../support/scenes.js';
import { describeSketchbookLook, type SketchbookScene } from '../support/sketchbook-looks.js';

const SCENES: readonly SketchbookScene[] = [
  ['examples/sketchbook/open/o1_forest.js', 9, [2.5, 5.5, 8.9]],
  ['examples/sketchbook/open/o2_ocean.js', 9, [2.5, 5.5, 8.9]],
  ['examples/sketchbook/open/o3_space.js', 9, [2.5, 5.5, 8.9]],
  ['examples/sketchbook/open/o4_village.js', 9, [2.5, 5.5, 8.9]],
  ['examples/sketchbook/open/o5_desert.js', 9, [2.5, 5.5, 8.9]],
  ['examples/sketchbook/open/o6_city.js', 9, [2.5, 5.5, 8.9]],
];

describeSketchbookLook('sketchbook-open', SCENES);

/** 960 / 15 = 64 px wide, as a viewer sees a thumbnail. */
const THUMB_FACTOR = 15;

describe('sketchbook open vocabulary at thumbnail size (SwiftShader)', () => {
  let browser: HarnessBrowser;

  beforeAll(async () => {
    browser = await launchHarnessBrowser();
  });

  afterAll(async () => {
    await browser.close();
  });

  it('writes the 64 px strip of every last frame (enlarged x4 for viewing)', async () => {
    const page = await browser.open({ lint: true });
    try {
      const tiles: RgbaImage[] = [];
      for (const [file, duration, times] of SCENES) {
        const info = await page.load(sceneManifest(file, { style: 'sketchbook', duration }));
        const frame = {
          width: info.width,
          height: info.height,
          data: await page.frameAt(times.at(-1) ?? 0),
        };
        const thumb = downscale(frame, THUMB_FACTOR, 'box');
        expect(thumb.width, file).toBe(64);
        tiles.push(resizeNearest(thumb, thumb.width * 4, thumb.height * 4));
      }
      const strip = path.join(KIT_OUT_DIR, 'contact', 'sketch-open-thumbs.png');
      await mkdir(path.dirname(strip), { recursive: true });
      await writeFile(strip, encodePng(composeSheet(tiles, 3)));
      expect(page.errors).toEqual([]);
    } finally {
      await page.close();
    }
  }, 600_000);
});
