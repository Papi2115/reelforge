// `pnpm kit:catalog`: regenerates docs/kit-catalog.md and the prop thumbnails in
// docs/kit-catalog/ (packages/kit/test/render/kit-catalog.test.ts, enabled by
// REELFORGE_KIT_CATALOG=1) through the engine harness (Playwright Chromium + SwiftShader).
// Spawns vitest's JS entry with the current node binary, so it works the same on Windows.
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import process from 'node:process';

const require = createRequire(import.meta.url);
const vitestBin = path.join(path.dirname(require.resolve('vitest/package.json')), 'vitest.mjs');
const testFile = path.join('packages', 'kit', 'test', 'render', 'kit-catalog.test.ts');

const child = spawn(process.execPath, [vitestBin, 'run', '--project', 'render', testFile], {
  stdio: 'inherit',
  env: { ...process.env, REELFORGE_KIT_CATALOG: '1' },
});
child.on('error', (error) => {
  process.stderr.write(`kit:catalog: cannot start vitest: ${error.message}\n`);
  process.exitCode = 1;
});
child.on('exit', (code) => {
  // A null code means the child was killed by a signal.
  process.exitCode = code ?? 1;
});
