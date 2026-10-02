// Runs the engine dev CLI (packages/engine/src/cli/main.ts) without a prior `tsc` build:
// bundles it with esbuild into out/cli/engine-cli.mjs (dependencies stay external and resolve
// from packages/engine/node_modules), then imports it. Usage: node run-cli.mjs <command> [args]
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const engineRoot = path.resolve(import.meta.dirname, '..');
const outfile = path.join(engineRoot, 'out', 'cli', 'engine-cli.mjs');

await build({
  entryPoints: [path.join(engineRoot, 'src', 'cli', 'main.ts')],
  outfile,
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: 'node20',
  external: ['acorn', 'esbuild', 'playwright', 'three', 'zod'],
  alias: { '@reelforge/shared': path.join(engineRoot, '..', 'shared', 'src', 'index.ts') },
  logLevel: 'warning',
});
await import(pathToFileURL(outfile).href);
