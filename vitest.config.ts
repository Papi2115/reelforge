import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

/**
 * `pnpm test:app:ci` (REELFORGE_CI=1, see apps/desktop/test/support/ci-mode.ts): the GPU-less
 * hosted runner gets twice the default app test and hook timeouts.
 */
const appTimeoutScale = process.env['REELFORGE_CI'] === '1' ? 2 : 1;

/** Workspace packages resolve to their TypeScript sources, so tests never need a prior build. */
const workspaceSource = (name: string): string =>
  fileURLToPath(new URL(`./packages/${name}/src/index.ts`, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@reelforge/shared': workspaceSource('shared'),
      '@reelforge/kit': workspaceSource('kit'),
      // Engine dev tooling (Playwright harness), used by pipeline export integration tests.
      '@reelforge/engine/cli': fileURLToPath(
        new URL('./packages/engine/src/cli/index.ts', import.meta.url),
      ),
      '@reelforge/engine/raster': fileURLToPath(
        new URL('./packages/engine/src/raster/index.ts', import.meta.url),
      ),
      // After the /cli subpath: aliases match by prefix, the first match wins.
      '@reelforge/engine': workspaceSource('engine'),
      '@reelforge/pipeline': workspaceSource('pipeline'),
      '@reelforge/claude-bridge': workspaceSource('claude-bridge'),
      '@reelforge/project': workspaceSource('project'),
      '@reelforge/prompts': workspaceSource('prompts'),
      '@reelforge/cli/service': fileURLToPath(
        new URL('./packages/cli/src/service/index.ts', import.meta.url),
      ),
      '@reelforge/cli/shims': fileURLToPath(
        new URL('./packages/cli/src/shims.ts', import.meta.url),
      ),
      '@reelforge/stages': workspaceSource('stages'),
      '@reelforge/fake-claude': fileURLToPath(
        new URL('./tools/fake-claude/src/index.ts', import.meta.url),
      ),
    },
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          include: [
            '{apps,packages,tools,spikes}/*/src/**/*.test.ts',
            'apps/*/scripts/**/*.test.ts',
            // Pure helpers of the app smoke tests (CI mode, media tools): no Electron needed.
            'apps/*/test/support/**/*.test.ts',
          ],
          environment: 'node',
          // DSP/zip/ffmpeg tests get slow when the whole suite runs in parallel.
          testTimeout: 30_000,
        },
      },
      {
        extends: true,
        test: {
          // Real WebGL in Playwright Chromium (SwiftShader); run with `pnpm test:render`.
          name: 'render',
          include: ['packages/*/test/**/*.test.ts'],
          environment: 'node',
          testTimeout: 60_000,
          hookTimeout: 120_000,
          fileParallelism: false,
        },
      },
      {
        extends: true,
        test: {
          // Launches the built Electron app (Playwright _electron); run with `pnpm test:app`.
          name: 'app',
          include: ['apps/*/test/**/*.test.ts'],
          exclude: ['apps/*/test/packaged/**', 'apps/*/test/support/**'],
          environment: 'node',
          testTimeout: 90_000 * appTimeoutScale,
          hookTimeout: 120_000 * appTimeoutScale,
          // Hosted runners are slow and share one desktop: retry timing-sensitive UI tests there only.
          retry: process.env['REELFORGE_CI'] === '1' ? 2 : 0,
          fileParallelism: false,
        },
      },
      {
        extends: true,
        test: {
          // The packaged app (release/): run with `pnpm test:packaged` after `pnpm package` /
          // `pnpm dist` (the installer test installs, launches and uninstalls it silently).
          name: 'packaged',
          include: ['apps/desktop/test/packaged/**/*.test.ts'],
          environment: 'node',
          testTimeout: 120_000,
          hookTimeout: 180_000,
          fileParallelism: false,
        },
      },
    ],
  },
});
