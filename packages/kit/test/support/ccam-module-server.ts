/**
 * Serves the kit's TypeScript sources to a Playwright page as ES modules, without a bundler: a
 * request for `<CCAM_ORIGIN>/<path>.js` is answered with `packages/kit/<path>.ts` transpiled by
 * `typescript`'s `transpileModule` (types stripped, no type check). Relative `.js` import
 * specifiers therefore resolve to the `.ts` sources, as they do for tsc. The origin is fake: every
 * request is fulfilled by `page.route`, nothing touches the network. Used by the C-CAM brush
 * render test (PLAN.md#14.3) to run the ported brushes on a real canvas.
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { Page } from 'playwright';
import ts from 'typescript';

export const CCAM_ORIGIN = 'http://ccam.test';

const KIT_ROOT = path.resolve(import.meta.dirname, '..', '..');

const BLANK_PAGE = '<!doctype html><html><head><title>ccam</title></head><body></body></html>';

/** Absolute `.ts` source for a URL path, or null when it would leave the kit folder. */
function sourceFor(urlPath: string): string | null {
  const file = path.resolve(KIT_ROOT, `.${decodeURIComponent(urlPath).replace(/\.js$/, '.ts')}`);
  return file.startsWith(`${KIT_ROOT}${path.sep}`) ? file : null;
}

function transpile(source: string, fileName: string): string {
  return ts.transpileModule(source, {
    fileName,
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
}

/** Routes `CCAM_ORIGIN`: `/` is a blank page, `*.js` the transpiled kit sources. */
export async function serveKitModules(page: Page): Promise<void> {
  await page.route(`${CCAM_ORIGIN}/**`, async (route) => {
    const urlPath = new URL(route.request().url()).pathname;
    if (urlPath === '/') {
      await route.fulfill({ contentType: 'text/html', body: BLANK_PAGE });
      return;
    }
    const file = urlPath.endsWith('.js') ? sourceFor(urlPath) : null;
    if (file === null) {
      await route.fulfill({ status: 403, body: `not a kit module: ${urlPath}` });
      return;
    }
    let source: string;
    try {
      source = await readFile(file, 'utf8');
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      await route.fulfill({ status: 404, body: `cannot read ${file}: ${reason}` });
      return;
    }
    await route.fulfill({ contentType: 'text/javascript', body: transpile(source, file) });
  });
}
