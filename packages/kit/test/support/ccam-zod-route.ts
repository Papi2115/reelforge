/**
 * Lets C-CAM modules that import `zod` (poses, the character contract, limb styles) run in a
 * Playwright page served by ccam-module-server.ts: `RIG_PAGE_URL` is a blank page with an import
 * map (`zod` -> `/__zod/index.js`) and `/__zod/**` is answered with the files of the installed
 * zod package (its ES build only uses relative imports). Register after `serveKitModules`, so these
 * routes win (Playwright runs the most recently registered matching route first). Nothing touches
 * the network. Used by the C-CAM rig render test (PLAN.md#14.5).
 */
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import type { Page } from 'playwright';
import { CCAM_ORIGIN } from './ccam-module-server.js';

export const RIG_PAGE_URL = `${CCAM_ORIGIN}/rig.html`;

const ZOD_PREFIX = '/__zod/';

const require = createRequire(import.meta.url);
const ZOD_ROOT = path.dirname(require.resolve('zod/package.json'));

const RIG_PAGE = `<!doctype html><html><head><title>ccam rig</title>
<script type="importmap">{"imports":{"zod":"${ZOD_PREFIX}index.js"}}</script>
</head><body></body></html>`;

/** Absolute zod file for a URL path, or null when it would leave the package folder. */
function zodFile(urlPath: string): string | null {
  const rel = decodeURIComponent(urlPath.slice(ZOD_PREFIX.length));
  const file = path.resolve(ZOD_ROOT, rel);
  return file.startsWith(`${ZOD_ROOT}${path.sep}`) && file.endsWith('.js') ? file : null;
}

export async function serveZod(page: Page): Promise<void> {
  await page.route(RIG_PAGE_URL, async (route) => {
    await route.fulfill({ contentType: 'text/html', body: RIG_PAGE });
  });
  await page.route(`${CCAM_ORIGIN}${ZOD_PREFIX}**`, async (route) => {
    const urlPath = new URL(route.request().url()).pathname;
    const file = zodFile(urlPath);
    if (file === null) {
      await route.fulfill({ status: 403, body: `not a zod module: ${urlPath}` });
      return;
    }
    try {
      await route.fulfill({ contentType: 'text/javascript', body: await readFile(file, 'utf8') });
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      await route.fulfill({ status: 404, body: `cannot read ${file}: ${reason}` });
    }
  });
}
