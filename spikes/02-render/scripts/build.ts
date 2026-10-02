/** Bundles the browser harness (out/page.js + page.html) and the Electron main (out/electron-main.cjs). */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { build } from 'esbuild';

const spikeRoot = path.resolve(import.meta.dirname, '..');
const outDir = path.join(spikeRoot, 'out');

const PAGE_HTML = `<!doctype html>
<html>
  <head><meta charset="utf-8" /><title>spike-02-render</title></head>
  <body style="margin:0;background:#000">
    <script src="page.js"></script>
  </body>
</html>
`;

export async function buildSpike(): Promise<void> {
  await mkdir(outDir, { recursive: true });
  await build({
    entryPoints: [path.join(spikeRoot, 'src', 'page.ts')],
    outfile: path.join(outDir, 'page.js'),
    bundle: true,
    format: 'iife',
    platform: 'browser',
    target: 'es2022',
    logLevel: 'warning',
  });
  for (const name of ['electron-main', 'electron-preload']) {
    await build({
      entryPoints: [path.join(spikeRoot, 'scripts', `${name}.ts`)],
      outfile: path.join(outDir, `${name}.cjs`),
      bundle: true,
      format: 'cjs',
      platform: 'node',
      target: 'node22',
      // ws optionally requires these native add-ons; they are not installed.
      external: ['electron', 'bufferutil', 'utf-8-validate'],
      logLevel: 'warning',
    });
  }
  await writeFile(path.join(outDir, 'page.html'), PAGE_HTML, 'utf8');
}

if (process.argv[1] === import.meta.filename) {
  await buildSpike();
  console.log(`built -> ${outDir}`);
}
