// `pnpm test:app:ci [-- --simulate-runner] [vitest args]`: the app smoke tests in CI mode
// (REELFORGE_CI=1, apps/desktop/test/support/ci-mode.ts): machine-dependent perf bars take their
// CI values and the default timeouts double, files run one at a time. `--simulate-runner`
// reproduces the GPU-less hosted runner locally: ANGLE on WARP (the "Microsoft Basic Render
// Driver"), no audio output and 100 % display scale (unless REELFORGE_TEST_ELECTRON_ARGS is set).
// Not reproduced: the runner's 1024x768 screen, which clamps the default 1280x800 window.
// Every other argument is passed to vitest. Spawns vitest's JS entry with the current node binary.
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import process from 'node:process';

const SIMULATE_FLAG = '--simulate-runner';
const RUNNER_SWITCHES =
  '--use-angle=d3d11-warp --disable-audio-output --force-device-scale-factor=1';

const args = process.argv.slice(2).filter((arg) => arg !== '--');
const simulate = args.includes(SIMULATE_FLAG);
const vitestArgs = args.filter((arg) => arg !== SIMULATE_FLAG);

/** @type {NodeJS.ProcessEnv} */
const env = { ...process.env, REELFORGE_CI: '1' };
if (simulate && env['REELFORGE_TEST_ELECTRON_ARGS'] === undefined) {
  env['REELFORGE_TEST_ELECTRON_ARGS'] = RUNNER_SWITCHES;
}

const require = createRequire(import.meta.url);
const vitestBin = path.join(path.dirname(require.resolve('vitest/package.json')), 'vitest.mjs');

const child = spawn(
  process.execPath,
  [vitestBin, 'run', '--project', 'app', '--reporter', 'verbose', ...vitestArgs],
  { stdio: 'inherit', env },
);
child.on('error', (error) => {
  process.stderr.write(`test:app:ci: cannot start vitest: ${error.message}\n`);
  process.exitCode = 1;
});
child.on('exit', (code) => {
  // A null code means the child was killed by a signal.
  process.exitCode = code ?? 1;
});
