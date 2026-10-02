// Runs an app build task (scripts/<task>.ts) without a prior `tsc` build: bundles it with esbuild
// (workspace packages from their TypeScript sources), then imports it and calls its `run()`.
// Usage: node scripts/run.mjs <dev|build>
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const TASKS = ['dev', 'build'];
const [task = ''] = process.argv.slice(2);
if (!TASKS.includes(task)) {
  process.stderr.write(`usage: node scripts/run.mjs <${TASKS.join('|')}>\n`);
  process.exit(2);
}

const appRoot = path.resolve(import.meta.dirname, '..');
const repoRoot = path.resolve(appRoot, '..', '..');
const packageSource = (...parts) => path.join(repoRoot, 'packages', ...parts);
const outfile = path.join(appRoot, 'out', 'scripts', `${task}.mjs`);

await build({
  entryPoints: [path.join(appRoot, 'scripts', `${task}.ts`)],
  outfile,
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: 'node22',
  // Tooling with native parts or its own runtime resolution stays a real dependency.
  external: ['electron', 'esbuild', 'vite', '@vitejs/plugin-react', 'playwright'],
  alias: {
    '@reelforge/engine/cli': packageSource('engine', 'src', 'cli', 'index.ts'),
    '@reelforge/shared': packageSource('shared', 'src', 'index.ts'),
    '@reelforge/kit': packageSource('kit', 'src', 'index.ts'),
    '@reelforge/claude-bridge': packageSource('claude-bridge', 'src', 'index.ts'),
  },
  // Bundled CommonJS dependencies may call require() for Node built-ins.
  banner: {
    js: "import { createRequire as __reelforgeCreateRequire } from 'node:module'; const require = __reelforgeCreateRequire(import.meta.url);",
  },
  logLevel: 'warning',
});

const taskModule = await import(pathToFileURL(outfile).href);
await taskModule.run({ appRoot, repoRoot });
