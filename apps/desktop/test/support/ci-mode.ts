/**
 * CI mode of the app smoke tests (`pnpm test:app:ci` sets REELFORGE_CI=1; PLAN.md#10.1). The
 * hosted Windows runner has no GPU (ANGLE on WARP, the "Microsoft Basic Render Driver"), no audio
 * device, 4 vCPUs and a slower disk. In CI mode the bars that measure the machine (preview fps,
 * timeline draw time) take their CI values and the default test/hook timeouts double
 * (vitest.config.ts); what a test checks functionally stays the same. Without the variable
 * (`pnpm test:app`) every strict value applies.
 *
 * REELFORGE_TEST_ELECTRON_ARGS adds Chromium switches to every app launch, to reproduce the runner
 * locally (`pnpm test:app:ci -- --simulate-runner` sets `--use-angle=d3d11-warp
 * --disable-audio-output`).
 */
export const CI_ENV = 'REELFORGE_CI';
export const ELECTRON_ARGS_ENV = 'REELFORGE_TEST_ELECTRON_ARGS';

type Env = Readonly<Record<string, string | undefined>>;

export function isCiMode(env: Env = process.env): boolean {
  return env[CI_ENV] === '1';
}

export const CI_MODE = isCiMode();

/** The bar of a machine-dependent measurement: the strict value, or the CI value in CI mode. */
export function perfBar(strict: number, ci: number, ciMode = CI_MODE): number {
  return ciMode ? ci : strict;
}

/** Extra Chromium switches for the app launch: whitespace-separated `--switch[=value]` items. */
export function extraElectronArgs(env: Env = process.env): string[] {
  const raw = env[ELECTRON_ARGS_ENV] ?? '';
  const args = raw.split(/\s+/).filter((arg) => arg !== '');
  const invalid = args.find((arg) => !/^--[a-z0-9-]+(=\S+)?$/i.test(arg));
  if (invalid !== undefined) {
    throw new Error(`${ELECTRON_ARGS_ENV}: "${invalid}" is not a --switch or --switch=value`);
  }
  return args;
}
