/**
 * Shared build steps of `pnpm dev` and `pnpm build` for the desktop app:
 * engine frame assets, demo files, the main/preload esbuild bundles and the renderer Vite config.
 */
import { copyFile, cp, mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { buildHarness, HARNESS_DIR } from '@reelforge/engine/cli';
import react from '@vitejs/plugin-react';
import { build, type BuildOptions } from 'esbuild';
import type { InlineConfig, Plugin } from 'vite';
import { EXTERNAL_RESOURCES } from '../src/main/app-paths.js';
import { rendererCsp } from '../src/shared/csp.js';
import { ENGINE_ASSET_DIR, ENGINE_FRAME_FILES } from '../src/shared/engine-assets.js';
import {
  RENDER_HOST_HTML,
  RENDER_HOST_SCRIPT,
  RENDER_PRELOAD_FILE,
} from '../src/shared/render-host-contract.js';

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

/**
 * Bundles the engine harness (packages/engine), copies its sandboxed frame into publicDir and
 * builds the render host page next to it.
 */
export async function prepareEngineFrame(context: TaskContext): Promise<void> {
  await buildHarness();
  const target = path.join(appPaths(context).publicDir, ENGINE_ASSET_DIR);
  await mkdir(target, { recursive: true });
  await Promise.all(
    ENGINE_FRAME_FILES.map((file) =>
      copyFile(path.join(HARNESS_DIR, file), path.join(target, file)),
    ),
  );
  await buildRenderHost(context);
}

/** The render host may run its own bundle and frame the engine page; nothing else. */
const RENDER_HOST_CSP = "default-src 'none'; script-src 'self'; frame-src 'self'";

/**
 * The hidden render window's page (src/renderer/render-host): the preview's harness host + the
 * same engine frame, next to it in publicDir/engine/ (export and render service, ADR-002).
 */
export async function buildRenderHost(context: TaskContext): Promise<void> {
  const target = path.join(appPaths(context).publicDir, ENGINE_ASSET_DIR);
  await mkdir(target, { recursive: true });
  await build({
    entryPoints: [path.join(context.appRoot, 'src', 'renderer', 'render-host', 'render-host.ts')],
    outfile: path.join(target, RENDER_HOST_SCRIPT),
    bundle: true,
    format: 'iife',
    platform: 'browser',
    target: 'chrome150',
    alias: {
      '@reelforge/engine': packageSource(context, 'engine', 'src', 'index.ts'),
      '@reelforge/shared': packageSource(context, 'shared', 'src', 'index.ts'),
      '@reelforge/kit': packageSource(context, 'kit', 'src', 'index.ts'),
    },
    logLevel: 'warning',
  });
  await writeFile(
    path.join(target, RENDER_HOST_HTML),
    `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta http-equiv="Content-Security-Policy" content="${RENDER_HOST_CSP}" />
    <title>ReelForge renderer</title>
  </head>
  <body>
    <script src="${RENDER_HOST_SCRIPT}"></script>
  </body>
</html>
`,
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

/**
 * Copies templates/project and the style bibles (`styles/<id>/STYLE.md`) for main
 * (`AppLayout.projectTemplateDir` / `AppLayout.stylesDir`).
 */
export async function copyProjectTemplate(context: TaskContext): Promise<void> {
  const template = path.join(appPaths(context).out, EXTERNAL_RESOURCES.template);
  const source = path.join(context.repoRoot, 'templates', 'project');
  const target = path.join(template, 'project');
  await mkdir(target, { recursive: true });
  await Promise.all(
    PROJECT_TEMPLATE_FILES.map((file) =>
      copyFile(path.join(source, file), path.join(target, file)),
    ),
  );
  const styles = path.join(context.repoRoot, 'styles');
  const presets = (await readdir(styles, { withFileTypes: true })).filter((entry) =>
    entry.isDirectory(),
  );
  await Promise.all(
    presets.map(async ({ name }) => {
      await mkdir(path.join(template, 'styles', name), { recursive: true });
      await copyFile(
        path.join(styles, name, 'STYLE.md'),
        path.join(template, 'styles', name, 'STYLE.md'),
      );
    }),
  );
  await copyExamples(context, template);
}

/**
 * The first-run example projects (`templates/examples/`, PLAN.md#10.3) without the CLI's frame
 * cache, and docs/licenses.md for Help → About (`AppLayout.examplesDir` / `licensesFile`).
 */
async function copyExamples(context: TaskContext, template: string): Promise<void> {
  const target = path.join(template, 'examples');
  await rm(target, { recursive: true, force: true });
  await cp(path.join(context.repoRoot, 'templates', 'examples'), target, {
    recursive: true,
    filter: (source) => path.basename(source) !== '.reelforge',
  });
  await copyFile(
    path.join(context.repoRoot, 'docs', 'licenses.md'),
    path.join(template, 'licenses.md'),
  );
}

/**
 * What chat turns need at runtime (PLAN.md#6.6): the claude-bridge's PreToolUse bash guard (main
 * passes its path as `permissions.hookScriptPath`; a bundled main has no package folder) and the
 * bundled `reelforge` CLI behind the PATH launchers (built by packages/cli/scripts/build.mjs).
 */
export async function copyClaudeResources(context: TaskContext): Promise<void> {
  const out = appPaths(context).out;
  await mkdir(path.join(out, EXTERNAL_RESOURCES.hooks), { recursive: true });
  await copyFile(
    packageSource(context, 'claude-bridge', 'hooks', 'bash-guard.mjs'),
    path.join(out, EXTERNAL_RESOURCES.hooks, 'bash-guard.mjs'),
  );
  const script = packageSource(context, 'cli', 'scripts', 'build.mjs');
  const cliBuild: unknown = await import(pathToFileURL(script).href);
  const buildCli: unknown =
    typeof cliBuild === 'object' && cliBuild !== null
      ? Reflect.get(cliBuild, 'buildCli')
      : undefined;
  if (typeof buildCli !== 'function') throw new Error(`${script} does not export buildCli()`);
  const bundle: unknown = await (buildCli as () => Promise<unknown>)();
  if (typeof bundle !== 'string') throw new Error('buildCli() did not return the bundle path');
  await mkdir(path.join(out, EXTERNAL_RESOURCES.cli), { recursive: true });
  await copyFile(bundle, path.join(out, EXTERNAL_RESOURCES.cli, 'reelforge.mjs'));
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
      // Exact subpaths first: esbuild maps a package alias onto its subpaths too.
      '@reelforge/engine/raster': packageSource(context, 'engine', 'src', 'raster', 'index.ts'),
      '@reelforge/engine': packageSource(context, 'engine', 'src', 'index.ts'),
      '@reelforge/kit': packageSource(context, 'kit', 'src', 'index.ts'),
      '@reelforge/cli/service': packageSource(context, 'cli', 'src', 'service', 'index.ts'),
      '@reelforge/cli/shims': packageSource(context, 'cli', 'src', 'shims.ts'),
      '@reelforge/prompts': packageSource(context, 'prompts', 'src', 'index.ts'),
      '@reelforge/stages': packageSource(context, 'stages', 'src', 'index.ts'),
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
    {
      ...common,
      entryPoints: [path.join(src, 'preload', 'render-preload.ts')],
      outfile: path.join(out, 'preload', RENDER_PRELOAD_FILE),
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
