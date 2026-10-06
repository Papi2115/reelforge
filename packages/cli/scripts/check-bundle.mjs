// Fails when the `reelforge` CLI bundle (dist/reelforge.mjs) is older than a source file it is
// built from. `tsc -b` does not rebuild it, so a dev driver or a real run after a source change
// would hand the runtime Claude a stale CLI (real run Sketchbook 2: `unknown style preset
// "sketchbook"`). Fix: `pnpm build:cli`. Tests are not sources (they are not bundled).
import { existsSync, readdirSync, realpathSync, statSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { BUNDLE_FILE, BUNDLE_SOURCE_DIRS } from './build.mjs';

const SOURCE = /\.(ts|mts|js|mjs|json)$/;
const TEST = /\.test\.(ts|mts|js|mjs)$/;

/**
 * The newest bundled source file under `dirs` (tests excluded).
 * @param {readonly string[]} dirs
 * @returns {{ file: string, mtimeMs: number } | undefined}
 */
export function newestSource(dirs) {
  /** @type {{ file: string, mtimeMs: number } | undefined} */
  let newest;
  /** @param {string} dir */
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(file);
      } else if (SOURCE.test(entry.name) && !TEST.test(entry.name)) {
        const { mtimeMs } = statSync(file);
        if (newest === undefined || mtimeMs > newest.mtimeMs) newest = { file, mtimeMs };
      }
    }
  };
  for (const dir of dirs) if (existsSync(dir)) walk(dir);
  return newest;
}

/**
 * Whether the bundle is missing or older than its newest source.
 * @param {string} bundleFile
 * @param {readonly string[]} dirs
 * @returns {{ fresh: boolean, reason: string }}
 */
export function bundleFreshness(bundleFile, dirs) {
  if (!existsSync(bundleFile)) return { fresh: false, reason: `${bundleFile} does not exist` };
  const built = statSync(bundleFile).mtimeMs;
  const newest = newestSource(dirs);
  if (newest === undefined || newest.mtimeMs <= built) {
    return { fresh: true, reason: `${bundleFile} is up to date` };
  }
  return { fresh: false, reason: `${newest.file} is newer than ${bundleFile}` };
}

const invokedDirectly =
  process.argv[1] !== undefined &&
  pathToFileURL(realpathSync(process.argv[1])).href ===
    pathToFileURL(realpathSync(import.meta.filename)).href;
if (invokedDirectly) {
  const { fresh, reason } = bundleFreshness(BUNDLE_FILE, BUNDLE_SOURCE_DIRS);
  if (fresh) {
    process.stdout.write(`reelforge CLI bundle: ${reason}\n`);
  } else {
    process.stderr.write(`reelforge CLI bundle is stale: ${reason}\nrun: pnpm build:cli\n`);
    process.exitCode = 1;
  }
}
