import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

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
      // After the /cli subpath: aliases match by prefix, the first match wins.
      '@reelforge/engine': workspaceSource('engine'),
      '@reelforge/pipeline': workspaceSource('pipeline'),
      '@reelforge/claude-bridge': workspaceSource('claude-bridge'),
      '@reelforge/project': workspaceSource('project'),
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
          include: ['{apps,packages,tools,spikes}/*/src/**/*.test.ts'],
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
          environment: 'node',
          testTimeout: 90_000,
          hookTimeout: 120_000,
          fileParallelism: false,
        },
      },
    ],
  },
});
