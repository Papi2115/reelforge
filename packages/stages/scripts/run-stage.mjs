// Dev entry: builds the package (tsc -b, incl. references) and runs one stage on a project.
// Usage: pnpm --filter @reelforge/stages run-stage <project> <stage> [--source <file>] [--economy]
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const packageRoot = path.resolve(import.meta.dirname, '..');
const tsc = createRequire(import.meta.url).resolve('typescript/bin/tsc');
const build = spawnSync(process.execPath, [tsc, '-b', packageRoot], { stdio: 'inherit' });
if (build.status !== 0) process.exit(build.status ?? 1);
const { main } = await import(
  pathToFileURL(path.join(packageRoot, 'dist', 'cli', 'run-stage.js')).href
);
process.exitCode = await main(process.argv.slice(2));
