/**
 * Shared build steps of `pnpm dev` and `pnpm build` for the desktop app:
 * engine frame assets, demo files, the main/preload esbuild bundles and the renderer Vite config.
 */
import { copyFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { buildHarness, HARNESS_DIR } from '@reelforge/engine/cli';
import react from '@vitejs/plugin-react';
import type { BuildOptions } from 'esbuild';
import type { InlineConfig, Plugin } from 'vite';
import { rendererCsp } from '../src/shared/csp.js';
import { ENGINE_ASSET_DIR, ENGINE_FRAME_FILES } from '../src/shared/engine-assets.js';

export interface TaskContext {
  /** apps/desktop */
  readonly appRoot: string;
  readonly repoRoot: string;
}

export interface AppPaths {
  readonly out: string;
  /** Static files of the renderer (Vite publicDir): the engine frame. */
  readonly publicDir: string;
  readonly rendererOut: string;
  readonly demoDir: string;
}

export function appPaths(context: TaskContext): AppPaths {
  const out = path.join(context.appRoot, 'out');
  return {
    out,
    publicDir: path.join(out, 'public'),
    rendererOut: path.join(out, 'renderer'),
    demoDir: path.join(out, 'demo'),
  };
}

function packageSource(context: TaskContext, ...parts: string[]): string {
  return path.join(context.repoRoot, 'packages', ...parts);
}

/** Bundles the engine harness (packages/engine) and copies its sandboxed frame into publicDir. */
export async function prepareEngineFrame(context: TaskContext): Promise<void> {
  await buildHarness();
  const target = path.join(appPaths(context).publicDir, ENGINE_ASSET_DIR);
  await mkdir(target, { recursive: true });
  await Promise.all(
    ENGINE_FRAME_FILES.map((file) =>
      copyFile(path.join(HARNESS_DIR, file), path.join(target, file)),
    ),
  );
}

/** Example scene + words read by main for the demo preview (src/main/demo-manifest.ts). */
export async function copyDemo(context: TaskContext): Promise<void> {
  const examples = packageSource(context, 'engine', 'examples');
  const target = appPaths(context).demoDir;
  await mkdir(target, { recursive: true });
  await Promise.all(
    ['s00_hello.js', 'words.json'].map((file) =>
      copyFile(path.join(examples, file), path.join(target, file)),
    ),
  );
}

/** Files of templates/project that new video projects are made from (see @reelforge/project). */
const PROJECT_TEMPLATE_FILES = ['CLAUDE.md', '.gitignore', 'project.json'];

/** Copies templates/project for main (`AppLayout.projectTemplateDir`). */
export async function copyProjectTemplate(context: TaskContext): Promise<void> {
  const source = path.join(context.repoRoot, 'templates', 'project');
  const target = path.join(appPaths(context).out, 'template', 'project');
  await mkdir(target, { recursive: true });
  await Promise.all(
    PROJECT_TEMPLATE_FILES.map((file) =>
      copyFile(path.join(source, file), path.join(target, file)),
    ),
  );
}

/**
 * esbuild options for the main process (ESM: workspace code uses import.meta) and the preload
 * (CommonJS: sandboxed preloads cannot be ES modules).
 */
export function mainProcessBuilds(context: TaskContext): BuildOptions[] {
  const common: BuildOptions = {
    bundle: true,
    platform: 'node',
    target: 'node22',
    sourcemap: 'linked',
    external: ['electron'],
    alias: {
      '@reelforge/shared': packageSource(context, 'shared', 'src', 'index.ts'),
      '@reelforge/claude-bridge': packageSource(context, 'claude-bridge', 'src', 'index.ts'),
      '@reelforge/project': packageSource(context, 'project', 'src', 'index.ts'),
      '@reelforge/pipeline': packageSource(context, 'pipeline', 'src', 'index.ts'),
    },
    logLevel: 'warning',
  };
  const src = path.join(context.appRoot, 'src');
  const out = appPaths(context).out;
  return [
    {
      ...common,
      entryPoints: [path.join(src, 'main', 'main.ts')],
      outfile: path.join(out, 'main', 'main.mjs'),
      format: 'esm',
      // Bundled CommonJS dependencies may call require() for Node built-ins.
      banner: {
        js: "import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);",
      },
    },
    {
      ...common,
      entryPoints: [path.join(src, 'preload', 'preload.ts')],
      outfile: path.join(out, 'preload', 'preload.cjs'),
      format: 'cjs',
    },
  ];
}

/** Injects the renderer CSP (src/shared/csp.ts) as the first <meta> of index.html. */
function cspPlugin(): Plugin {
  return {
    name: 'reelforge-csp',
    transformIndexHtml(_html, context) {
      const devUrl = context.server?.resolvedUrls?.local[0];
      const content = rendererCsp({
        devServerOrigin: devUrl === undefined ? undefined : new URL(devUrl).origin,
      });
      return [
        {
          tag: 'meta',
          attrs: { 'http-equiv': 'Content-Security-Policy', content },
          injectTo: 'head-prepend',
        },
      ];
    },
  };
}

export function rendererViteConfig(
  context: TaskContext,
  mode: 'development' | 'production',
): InlineConfig {
  const paths = appPaths(context);
  return {
    configFile: false,
    mode,
    root: path.join(context.appRoot, 'src', 'renderer'),
    base: './',
    publicDir: paths.publicDir,
    clearScreen: false,
    plugins: [react(), cspPlugin()],
    resolve: {
      // Workspace packages from source (as in vitest.config.ts): HMR follows engine edits.
      alias: [
        {
          find: /^@reelforge\/engine$/,
          replacement: packageSource(context, 'engine', 'src', 'index.ts'),
        },
        {
          find: /^@reelforge\/shared$/,
          replacement: packageSource(context, 'shared', 'src', 'index.ts'),
        },
        {
          find: /^@reelforge\/kit$/,
          replacement: packageSource(context, 'kit', 'src', 'index.ts'),
        },
      ],
    },
    server: { host: '127.0.0.1', port: 5173, strictPort: false },
    build: {
      outDir: paths.rendererOut,
      emptyOutDir: true,
      target: 'chrome150',
      sourcemap: true,
      // Local app, assets load from disk: one chunk with the engine host is fine.
      chunkSizeWarningLimit: 2048,
    },
  };
}
