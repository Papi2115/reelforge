/** `pnpm check:cli-bundle` (scripts/check-bundle.mjs): a bundle older than a source is stale. */
import { mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';

type Freshness = (bundle: string, dirs: readonly string[]) => { fresh: boolean; reason: string };

const SCRIPT = path.resolve(import.meta.dirname, '..', 'scripts', 'check-bundle.mjs');

async function loadFreshness(): Promise<Freshness> {
  const module: unknown = await import(pathToFileURL(SCRIPT).href);
  const value: unknown =
    typeof module === 'object' && module !== null
      ? Reflect.get(module, 'bundleFreshness')
      : undefined;
  if (typeof value !== 'function') throw new Error(`${SCRIPT} does not export bundleFreshness`);
  return value as Freshness;
}

const root = mkdtempSync(path.join(tmpdir(), 'reelforge bundle ż '));
afterAll(() => {
  rmSync(root, { recursive: true, force: true });
});

function file(relative: string, seconds: number): string {
  const target = path.join(root, relative);
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, '// x\n');
  utimesSync(target, seconds, seconds);
  return target;
}

describe('bundleFreshness', () => {
  it('reports a missing bundle, a newer source and ignores tests', async () => {
    const freshness = await loadFreshness();
    const src = path.join(root, 'pkg', 'src');
    file('pkg/src/a.ts', 1_000);
    expect(freshness(path.join(root, 'dist', 'reelforge.mjs'), [src]).fresh).toBe(false);
    const bundle = file('dist/reelforge.mjs', 2_000);
    expect(freshness(bundle, [src, path.join(root, 'missing')])).toMatchObject({ fresh: true });
    file('pkg/src/deep/a.test.ts', 3_000);
    expect(freshness(bundle, [src]).fresh).toBe(true);
    const newer = file('pkg/src/deep/b.ts', 3_000);
    const stale = freshness(bundle, [src]);
    expect(stale.fresh).toBe(false);
    expect(stale.reason).toContain(newer);
  });
});
