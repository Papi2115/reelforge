/**
 * Bundles the harness pages into `packages/engine/out/harness/`:
 * - `harness.html` + `harness.js`: host page exposing `window.__reelforge`;
 * - `engine-frame.html` + `engine-frame.js`: the engine, loaded by the host in a sandboxed iframe.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { build } from 'esbuild';
import { ENGINE_ROOT, HARNESS_DIR } from './paths.js';

export { HARNESS_DIR };

/**
 * The engine frame may only run its own bundle and blob: scene modules; no network (fetch/XHR/
 * WebSocket), images, fonts or workers. Scenes get data only through ctx.
 */
const FRAME_CSP = "default-src 'none'; script-src 'self' blob:";

const page = (title: string, script: string, head = ''): string => `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    ${head}<title>${title}</title>
  </head>
  <body>
    <script src="${script}"></script>
  </body>
</html>
`;

export async function buildHarness(): Promise<string> {
  await mkdir(HARNESS_DIR, { recursive: true });
  const entries = [
    { entry: 'host-entry.ts', out: 'harness.js' },
    { entry: 'frame-entry.ts', out: 'engine-frame.js' },
  ];
  await Promise.all(
    entries.map(({ entry, out }) =>
      build({
        entryPoints: [path.join(ENGINE_ROOT, 'src', 'harness', entry)],
        outfile: path.join(HARNESS_DIR, out),
        bundle: true,
        format: 'iife',
        platform: 'browser',
        target: 'es2022',
        alias: {
          '@reelforge/shared': path.join(ENGINE_ROOT, '..', 'shared', 'src', 'index.ts'),
          '@reelforge/kit': path.join(ENGINE_ROOT, '..', 'kit', 'src', 'index.ts'),
        },
        logLevel: 'warning',
      }),
    ),
  );
  const frameHead = `<meta http-equiv="Content-Security-Policy" content="${FRAME_CSP}" />\n    `;
  await writeFile(path.join(HARNESS_DIR, 'harness.html'), page('reelforge harness', 'harness.js'));
  await writeFile(
    path.join(HARNESS_DIR, 'engine-frame.html'),
    page('reelforge engine', 'engine-frame.js', frameHead),
  );
  return HARNESS_DIR;
}
