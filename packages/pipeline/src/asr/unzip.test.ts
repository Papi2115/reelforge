import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { WHISPER_BINARIES } from './assets.js';
import { buildZip } from './test-zip.js';
import { extractZip } from './unzip.js';
import { SPIKE_DIR } from '../align/test-fixtures.js';

let dir = '';
beforeEach(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), 'reelforge zip żółć '));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

async function zipFile(entries: Parameters<typeof buildZip>[0]): Promise<string> {
  const file = path.join(dir, 'test.zip');
  await writeFile(file, buildZip(entries));
  return file;
}

describe('extractZip', () => {
  it('extracts stored and deflated entries, directories and UTF-8 names', async () => {
    const big = Buffer.from('whisper '.repeat(50_000));
    const zip = await zipFile([
      { name: 'Release/' },
      { name: 'Release/whisper-cli.exe', data: big },
      { name: 'Release/ggml.dll', data: Buffer.from('dll'), method: 0 },
      { name: 'Release/empty.txt' },
      { name: 'docs/żółć.txt', data: Buffer.from('ąę') },
    ]);
    const out = path.join(dir, 'out');
    const result = await extractZip(zip, out);
    expect(result.ok).toBe(true);
    expect(await readFile(path.join(out, 'Release', 'whisper-cli.exe'))).toEqual(big);
    expect(await readFile(path.join(out, 'Release', 'ggml.dll'), 'utf8')).toBe('dll');
    expect(await readFile(path.join(out, 'Release', 'empty.txt'), 'utf8')).toBe('');
    expect(await readFile(path.join(out, 'docs', 'żółć.txt'), 'utf8')).toBe('ąę');
  });

  it('detects CRC corruption', async () => {
    const zip = await zipFile([{ name: 'a.bin', data: Buffer.from('payload'), crc: 1234 }]);
    const result = await extractZip(zip, path.join(dir, 'out'));
    expect(result).toMatchObject({ ok: false, error: { kind: 'extract-failed' } });
    if (!result.ok) expect(result.error.message).toMatch(/CRC/);
  });

  it('refuses entries that escape the target directory', async () => {
    const zip = await zipFile([{ name: '../evil.txt', data: Buffer.from('x') }]);
    const result = await extractZip(zip, path.join(dir, 'out'));
    expect(result).toMatchObject({ ok: false, error: { kind: 'extract-failed' } });
    expect(existsSync(path.join(dir, 'evil.txt'))).toBe(false);
  });

  it('rejects files that are not zips', async () => {
    const file = path.join(dir, 'not.zip');
    await writeFile(file, 'plain text');
    expect(await extractZip(file, path.join(dir, 'out'))).toMatchObject({
      ok: false,
      error: { kind: 'extract-failed' },
    });
  });

  // The real 21 MB OpenBLAS release zip, when the spike downloaded it (gitignored cache).
  const realZip = path.join(SPIKE_DIR, '.cache', 'dl', WHISPER_BINARIES.blas.fileName);
  it.skipIf(!existsSync(realZip))('extracts the real whisper.cpp release zip', async () => {
    const out = path.join(dir, 'blas');
    const result = await extractZip(realZip, out);
    expect(result.ok).toBe(true);
    expect(existsSync(path.join(out, 'Release', 'whisper-cli.exe'))).toBe(true);
    expect(existsSync(path.join(out, 'Release', 'whisper-vad-speech-segments.exe'))).toBe(true);
  });
});
