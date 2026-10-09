/** ASCII scratch helpers: root choice and fallback, model staging, copy-back, failure hints. */
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  copyTreeBack,
  createAsciiScratch,
  defaultScratchRoots,
  explainNonAsciiFailure,
  isAsciiPath,
  needsAsciiScratch,
  stageAscii,
  withAsciiScratch,
} from './ascii-scratch.js';
import { err, ok } from '../result.js';

let base = '';
beforeEach(async () => {
  base = await mkdtemp(path.join(os.tmpdir(), 'rf ascii scratch '));
});
afterEach(async () => {
  await rm(base, { recursive: true, force: true });
});

describe('ascii path checks', () => {
  it('accepts printable ASCII only', () => {
    expect(isAsciiPath('C:\\Users\\Papi\\Desktop\\filmy\\Why Do (2) [v1]; x.wav')).toBe(true);
    expect(isAsciiPath('C:\\filmy\\Why Do We Get Déjà Vu\\a.wav')).toBe(false);
    expect(isAsciiPath('C:\\filmy\\日本\\a.wav')).toBe(false);
    expect(isAsciiPath('C:\\filmy\\Here’s What\\a.wav')).toBe(false);
  });

  it('stages only on Windows and only when a path is not ASCII', () => {
    expect(needsAsciiScratch(['C:\\a', 'C:\\Déjà'], 'win32')).toBe(true);
    expect(needsAsciiScratch(['C:\\a', 'C:\\b'], 'win32')).toBe(false);
    expect(needsAsciiScratch(['/home/déjà'], 'linux')).toBe(false);
  });

  it('falls back to ProgramData and the system drive root after the temp folder', () => {
    const roots = defaultScratchRoots({ SystemDrive: 'D:', ProgramData: 'D:\\ProgramData' });
    expect(roots.slice(1)).toEqual(['D:\\ProgramData\\ReelForge\\scratch', 'D:\\rf-scratch']);
    expect(defaultScratchRoots({})[2]).toBe('C:\\rf-scratch');
  });

  it('explains open failures caused by non-ASCII arguments', () => {
    const message = 'exited with 2: error: failed to read audio data from C:\\D?ja\\a.wav';
    expect(explainNonAsciiFailure(message, ['-f', 'C:\\Déjà\\a.wav'])).toContain(
      'non-ASCII characters on Windows: C:\\Déjà\\a.wav',
    );
    expect(explainNonAsciiFailure(message, ['-f', 'C:\\ascii\\a.wav'])).toBe(message);
    expect(explainNonAsciiFailure('exited with 3221226505', ['C:\\Déjà'])).toBe(
      'exited with 3221226505',
    );
  });
});

describe('createAsciiScratch', () => {
  it('skips a non-ASCII temp root and uses the next ASCII one', async () => {
    const created = await createAsciiScratch([
      path.join(base, 'Użytkownik Déjà', 'Temp'),
      path.join(base, 'fallback'),
    ]);
    expect(created.ok && path.dirname(created.value)).toBe(path.join(base, 'fallback'));
    expect(created.ok && isAsciiPath(created.value)).toBe(true);
    expect(existsSync(path.join(base, 'Użytkownik Déjà'))).toBe(false);
  });

  it('skips a root that cannot be created', async () => {
    const blocker = path.join(base, 'blocker');
    await writeFile(blocker, 'file, not a folder');
    const created = await createAsciiScratch([path.join(blocker, 'tmp'), path.join(base, 'ok')]);
    expect(created.ok && path.dirname(created.value)).toBe(path.join(base, 'ok'));
  });

  it('reports every root when none is usable', async () => {
    const created = await createAsciiScratch([path.join(base, 'Déjà')]);
    expect(created).toMatchObject({ ok: false, error: { kind: 'io' } });
    expect(!created.ok && created.error.message).toContain('Déjà: not ASCII');
  });
});

describe('staging and cleanup', () => {
  it('links or copies a non-ASCII file into the scratch folder and leaves ASCII paths alone', async () => {
    const source = path.join(base, 'Déjà Vu ✓ 日本', 'ggml-model.bin');
    await mkdir(path.dirname(source), { recursive: true });
    await writeFile(source, 'weights');
    const dir = path.join(base, 'scratch');
    await mkdir(dir);
    const staged = await stageAscii(source, dir, 'model');
    expect(staged).toBe(path.join(dir, 'model.bin'));
    expect(await readFile(staged, 'utf8')).toBe('weights');
    const ascii = path.join(base, 'plain.bin');
    expect(await stageAscii(ascii, dir, 'other')).toBe(ascii);
  });

  it('copies the work tree back, replacing stale sub-folders', async () => {
    const from = path.join(base, 'from');
    const to = path.join(base, 'Déjà to');
    await mkdir(path.join(from, 'chunks'), { recursive: true });
    await writeFile(path.join(from, 'asr.16k.wav'), 'wav');
    await writeFile(path.join(from, 'chunks', 'c000.wav.json'), '{}');
    await mkdir(path.join(to, 'chunks'), { recursive: true });
    await writeFile(path.join(to, 'chunks', 'stale.wav'), 'old');
    await copyTreeBack(from, to);
    expect((await readdir(to)).sort()).toEqual(['asr.16k.wav', 'chunks']);
    expect(await readdir(path.join(to, 'chunks'))).toEqual(['c000.wav.json']);
  });

  it('removes the scratch folder after success, failure and a throw', async () => {
    const roots = [path.join(base, 'roots')];
    const seen: string[] = [];
    await withAsciiScratch({ roots }, async (dir) => {
      seen.push(dir);
      await writeFile(path.join(dir, 'x'), 'x');
      return ok(1);
    });
    await withAsciiScratch({ roots }, (dir) => {
      seen.push(dir);
      return Promise.resolve(err({ kind: 'no-speech', message: 'none' }));
    });
    await expect(
      withAsciiScratch({ roots }, (dir) => {
        seen.push(dir);
        return Promise.reject(new Error('boom'));
      }),
    ).rejects.toThrow('boom');
    expect(seen).toHaveLength(3);
    expect(await readdir(roots[0] ?? '')).toEqual([]);
  });
});
