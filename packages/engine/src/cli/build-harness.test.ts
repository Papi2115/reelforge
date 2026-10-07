import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { parse } from 'acorn';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildHarnessFiles } from './build-harness.js';

const FILES = ['engine-frame.html', 'engine-frame.js', 'harness.html', 'harness.js'];
const SCRIPTS = ['engine-frame.js', 'harness.js'];

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'reelforge-harness-'));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

async function contents(): Promise<Map<string, Buffer>> {
  const entries = await Promise.all(
    FILES.map(async (file) => [file, await readFile(path.join(dir, file))] as const),
  );
  return new Map(entries);
}

/** A truncated bundle does not parse. */
function isCompleteBundle(text: string): boolean {
  try {
    parse(text, { ecmaVersion: 'latest' });
    return true;
  } catch {
    return false;
  }
}

describe('buildHarnessFiles', () => {
  it('writes the harness once and skips every file whose content did not change', async () => {
    const first = await buildHarnessFiles(dir);
    expect(Object.keys(first).sort()).toEqual(FILES);
    expect(Object.values(first).every((outcome) => outcome === 'written')).toBe(true);
    const before = await contents();
    const second = await buildHarnessFiles(dir);
    const after = await contents();
    // Sources may be edited between the builds (other work in the tree): judge per file.
    for (const file of FILES) {
      const same = before.get(file)?.equals(after.get(file) ?? Buffer.alloc(0)) === true;
      expect(second[file], file).toBe(same ? 'unchanged' : 'written');
    }
    expect(second['harness.html']).toBe('unchanged');
    expect(second['engine-frame.html']).toBe('unchanged');
    expect((await readdir(dir)).sort()).toEqual(FILES);
  }, 60_000);

  it('parallel builds (concurrent `reelforge frames` runs) all succeed with complete files', async () => {
    const reports = await Promise.all(Array.from({ length: 4 }, () => buildHarnessFiles(dir)));
    expect(reports).toHaveLength(4);
    // No temp file left behind, every script a whole bundle.
    expect((await readdir(dir)).sort()).toEqual(FILES);
    for (const file of SCRIPTS) {
      expect(isCompleteBundle(await readFile(path.join(dir, file), 'utf8')), file).toBe(true);
    }
    expect(await readFile(path.join(dir, 'harness.js'), 'utf8')).toContain('__reelforge');
  }, 60_000);
});
