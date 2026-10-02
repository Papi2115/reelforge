import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { renameRetrying } from './fs-retry.js';

let dir = '';

beforeEach(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), 'reelforge rename '));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('renameRetrying', () => {
  it('replaces the target and fails fast on errors that are not sharing violations', async () => {
    await writeFile(path.join(dir, 'a.partial'), 'new');
    await writeFile(path.join(dir, 'a.wav'), 'old');
    await renameRetrying(path.join(dir, 'a.partial'), path.join(dir, 'a.wav'));
    expect(await readFile(path.join(dir, 'a.wav'), 'utf8')).toBe('new');
    const started = performance.now();
    await expect(renameRetrying(path.join(dir, 'missing'), path.join(dir, 'b'))).rejects.toThrow(
      /ENOENT/,
    );
    expect(performance.now() - started).toBeLessThan(1000);
  });
});
