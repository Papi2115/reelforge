/**
 * `pnpm kit:catalog` (REELFORGE_KIT_CATALOG=1): renders a thumbnail of every prop through the
 * engine harness (examples/k04_props.js at t = 0, a 3/4 view, box-filtered from 640x360 to
 * 160x90) into docs/kit-catalog/<name>.png and writes docs/kit-catalog.md from kitCatalog().
 * Skipped in plain `pnpm test:render`, so the render suite never rewrites docs.
 */
import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { encodePng, launchHarnessBrowser } from '../../../engine/src/cli/index.js';
import { kitCatalogMarkdown } from '../../src/catalog-markdown.js';
import { kitCatalog } from '../../src/kit.js';
import { downscale } from '../support/image.js';
import { PROP_SETUPS, PROPS_FILE, propSource, sceneManifest } from '../support/scenes.js';

const ENABLED = process.env['REELFORGE_KIT_CATALOG'] === '1';
const DOCS_DIR = path.resolve(import.meta.dirname, '..', '..', '..', '..', 'docs');
const THUMBNAIL_DIR = 'kit-catalog';
const THUMBNAIL_FACTOR = 4;

describe('kit catalog generator', () => {
  it.runIf(ENABLED)(
    'writes docs/kit-catalog.md and the prop thumbnails',
    async () => {
      const directory = path.join(DOCS_DIR, THUMBNAIL_DIR);
      await rm(directory, { recursive: true, force: true });
      await mkdir(directory, { recursive: true });
      const thumbnails: Record<string, string> = {};
      const browser = await launchHarnessBrowser();
      try {
        const page = await browser.open({ lint: true });
        for (const setup of PROP_SETUPS) {
          const info = await page.load(sceneManifest(PROPS_FILE, { source: propSource(setup) }));
          const frame = { width: info.width, height: info.height, data: await page.frameAt(0) };
          const file = `${THUMBNAIL_DIR}/${setup}.png`;
          await writeFile(
            path.join(DOCS_DIR, file),
            encodePng(downscale(frame, THUMBNAIL_FACTOR, 'box')),
          );
          thumbnails[setup] = file;
        }
        expect(page.errors).toEqual([]);
      } finally {
        await browser.close();
      }
      const markdown = kitCatalogMarkdown(kitCatalog(), { thumbnails });
      await writeFile(path.join(DOCS_DIR, 'kit-catalog.md'), markdown);
    },
    300_000,
  );
});
