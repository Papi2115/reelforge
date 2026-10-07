/**
 * Look A composition presets (`kit.fx.sketchPage({ layout })` + `page.slots()`) in the engine
 * harness (SwiftShader, 960x540): the template packages/kit/examples/sketchbook/a4_layouts.js with
 * each layout, rendered when the page is drawn. Goldens `sketch-layout-<layout>`, contact strip
 * packages/kit/out/contact/sketch-layouts.png (four different page grammars side by side).
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  compareWithGolden,
  encodePng,
  launchHarnessBrowser,
  type HarnessBrowser,
  type RgbaImage,
} from '../../../engine/src/cli/index.js';
import { lintScene } from '../../../engine/src/index.js';
import { composeSheet } from '../support/contact-sheet.js';
import { downscale } from '../support/image.js';
import { KIT_GOLDEN_DIR, KIT_OUT_DIR, sceneManifest, sceneSource } from '../support/scenes.js';
import { expectVibe } from '../support/vibe.js';

const FILE = 'examples/sketchbook/a4_layouts.js';
const LAYOUTS = ['hero-left', 'facing', 'tall-diagram', 'wide-strip'] as const;
const DURATION = 7;
const AT = 6.97;

function layoutSource(layout: string): string {
  const source = sceneSource(FILE);
  const declaration = "const LAYOUT = 'hero-left';";
  if (!source.includes(declaration)) throw new Error(`${FILE} no longer declares ${declaration}`);
  return source.replace(declaration, `const LAYOUT = '${layout}';`);
}

describe('sketchbook look A layouts (SwiftShader)', () => {
  let browser: HarnessBrowser;

  beforeAll(async () => {
    browser = await launchHarnessBrowser();
  });

  afterAll(async () => {
    await browser.close();
  });

  it('every layout passes the determinism lint', () => {
    for (const layout of LAYOUTS) {
      expect(lintScene(layoutSource(layout), { filename: 'a4_layouts.js' }), layout).toEqual([]);
    }
  });

  it('renders four different page grammars (goldens + strip)', async () => {
    const page = await browser.open({ lint: true });
    try {
      const tiles: RgbaImage[] = [];
      for (const layout of LAYOUTS) {
        const info = await page.load(
          sceneManifest(FILE, {
            source: layoutSource(layout),
            style: 'sketchbook',
            duration: DURATION,
          }),
        );
        const frame = { width: info.width, height: info.height, data: await page.frameAt(AT) };
        expectVibe(frame, layout, 'sketchbook');
        tiles.push(downscale(frame, 2, 'nearest'));
        await compareWithGolden(`sketch-layout-${layout}`, frame, undefined, {
          goldenDir: KIT_GOLDEN_DIR,
        });
      }
      const strip = path.join(KIT_OUT_DIR, 'contact', 'sketch-layouts.png');
      await mkdir(path.dirname(strip), { recursive: true });
      await writeFile(strip, encodePng(composeSheet(tiles, 2)));
      expect(page.errors).toEqual([]);
    } finally {
      await page.close();
    }
  }, 600_000);
});
