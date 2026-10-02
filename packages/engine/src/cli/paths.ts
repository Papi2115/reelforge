/**
 * Locations inside the engine package. Resolved by walking up from this module to the engine's
 * package.json, so they are right whether the code runs from src/ (vitest), dist/ or a bundle
 * in out/cli/. A bundle living in another package (e.g. packages/cli/dist/reelforge.mjs) finds
 * the engine as its dependency in node_modules/@reelforge/engine on the way up.
 */
import { existsSync, readFileSync, realpathSync } from 'node:fs';
import path from 'node:path';

const PACKAGE_NAME = '@reelforge/engine';

function isEnginePackage(directory: string): boolean {
  const manifest = path.join(directory, 'package.json');
  if (!existsSync(manifest)) return false;
  const parsed: unknown = JSON.parse(readFileSync(manifest, 'utf8'));
  return (
    typeof parsed === 'object' &&
    parsed !== null &&
    'name' in parsed &&
    parsed.name === PACKAGE_NAME
  );
}

function findEngineRoot(start: string): string {
  for (let directory = start; ; directory = path.dirname(directory)) {
    if (isEnginePackage(directory)) return directory;
    const dependency = path.join(directory, 'node_modules', '@reelforge', 'engine');
    if (isEnginePackage(dependency)) return realpathSync(dependency);
    if (path.dirname(directory) === directory) {
      throw new Error(`cannot find the ${PACKAGE_NAME} package above ${start}`);
    }
  }
}

export const ENGINE_ROOT = findEngineRoot(import.meta.dirname);
/** Generated, git-ignored output of the engine tooling. */
export const ENGINE_OUT_DIR = path.join(ENGINE_ROOT, 'out');
export const HARNESS_DIR = path.join(ENGINE_OUT_DIR, 'harness');
export const GOLDEN_ROOT = path.join(ENGINE_ROOT, 'test', 'goldens');
export const GOLDEN_DIFF_DIR = path.join(ENGINE_OUT_DIR, 'golden-diff');
export const DEFAULT_FRAMES_DIR = path.join(ENGINE_OUT_DIR, 'frames');
