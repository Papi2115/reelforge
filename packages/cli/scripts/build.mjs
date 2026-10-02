// Bundles the `reelforge` CLI (src/main.ts) into one Node script, dist/reelforge.mjs. Workspace
// packages are bundled from their TypeScript sources; playwright and esbuild stay external (native
// binaries; required lazily from packages/cli/node_modules by the rendering commands only). The
// engine harness pages are built from the engine sources when a rendering command needs them.
import { realpathSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const cliRoot = path.resolve(import.meta.dirname, '..');
const packagesRoot = path.resolve(cliRoot, '..');
export const BUNDLE_FILE = path.join(cliRoot, 'dist', 'reelforge.mjs');

/** `@reelforge/<name>[/cli]` -> its TypeScript entry. */
const WORKSPACE_ENTRIES = {
  '@reelforge/shared': path.join(packagesRoot, 'shared', 'src', 'index.ts'),
  '@reelforge/kit': path.join(packagesRoot, 'kit', 'src', 'index.ts'),
  '@reelforge/engine': path.join(packagesRoot, 'engine', 'src', 'index.ts'),
  '@reelforge/engine/cli': path.join(packagesRoot, 'engine', 'src', 'cli', 'index.ts'),
  '@reelforge/engine/raster': path.join(packagesRoot, 'engine', 'src', 'raster', 'index.ts'),
  '@reelforge/pipeline': path.join(packagesRoot, 'pipeline', 'src', 'index.ts'),
};

/** @type {import('esbuild').Plugin} */
const workspaceSources = {
  name: 'reelforge-workspace-sources',
  setup(pluginBuild) {
    pluginBuild.onResolve({ filter: /^@reelforge\// }, (args) => {
      const entry = WORKSPACE_ENTRIES[/** @type {keyof typeof WORKSPACE_ENTRIES} */ (args.path)];
      return entry === undefined ? undefined : { path: entry };
    });
  },
};

const LAZY_EXTERNALS = /^(esbuild|playwright)$/;

/**
 * esbuild hoists external ESM imports to the top of the bundle, so `reelforge status` would need
 * playwright/esbuild installed next to it. Routing them through CommonJS proxies turns them into
 * require() calls that run only when the engine tooling is first loaded (by rendering commands).
 * @type {import('esbuild').Plugin}
 */
const lazyExternals = {
  name: 'reelforge-lazy-externals',
  setup(pluginBuild) {
    pluginBuild.onResolve({ filter: LAZY_EXTERNALS }, (args) =>
      args.namespace === 'lazy-external'
        ? { path: args.path, external: true }
        : { path: args.path, namespace: 'lazy-external' },
    );
    pluginBuild.onLoad({ filter: /.*/, namespace: 'lazy-external' }, (args) => ({
      contents: `module.exports = require(${JSON.stringify(args.path)});`,
      loader: 'js',
    }));
  },
};

export async function buildCli() {
  await build({
    entryPoints: [path.join(cliRoot, 'src', 'main.ts')],
    outfile: BUNDLE_FILE,
    bundle: true,
    format: 'esm',
    platform: 'node',
    target: 'node20',
    plugins: [workspaceSources, lazyExternals],
    // Bundled CommonJS dependencies may call require(); give the ESM bundle one.
    banner: {
      js: "import { createRequire as __reelforgeCreateRequire } from 'node:module';\nconst require = __reelforgeCreateRequire(import.meta.url);",
    },
    legalComments: 'none',
    logLevel: 'warning',
  });
  return BUNDLE_FILE;
}

const invokedDirectly =
  process.argv[1] !== undefined &&
  pathToFileURL(realpathSync(process.argv[1])).href ===
    pathToFileURL(realpathSync(import.meta.filename)).href;
if (invokedDirectly) {
  const file = await buildCli();
  process.stdout.write(`built ${path.relative(process.cwd(), file)}\n`);
}
