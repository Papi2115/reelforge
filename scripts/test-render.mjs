// `pnpm test:render [-- --update-goldens] [vitest args]`: runs the render test project
// (Playwright Chromium + SwiftShader golden frames). `--update-goldens` rewrites the goldens
// (sets REELFORGE_UPDATE_GOLDENS=1); every other argument is passed to vitest.
// Spawns vitest's JS entry with the current node binary, so it works the same on Windows.
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import process from 'node:process';

const UPDATE_FLAG = '--update-goldens';
const args = process.argv.slice(2).filter((arg) => arg !== '--');
const update = args.includes(UPDATE_FLAG);
const vitestArgs = args.filter((arg) => arg !== UPDATE_FLAG);

const require = createRequire(import.meta.url);
const vitestBin = path.join(path.dirname(require.resolve('vitest/package.json')), 'vitest.mjs');
const env = update ? { ...process.env, REELFORGE_UPDATE_GOLDENS: '1' } : process.env;

const child = spawn(process.execPath, [vitestBin, 'run', '--project', 'render', ...vitestArgs], {
  stdio: 'inherit',
  env,
});
child.on('error', (error) => {
  process.stderr.write(`test:render: cannot start vitest: ${error.message}\n`);
  process.exitCode = 1;
});
child.on('exit', (code) => {
  // A null code means the child was killed by a signal.
  process.exitCode = code ?? 1;
});
