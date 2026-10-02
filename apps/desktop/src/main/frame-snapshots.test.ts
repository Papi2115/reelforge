import { mkdtemp, readdir, readFile, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  checkPng,
  freeSnapshotPath,
  saveFrameSnapshot,
  snapshotFileName,
} from './frame-snapshots.js';
import { createLogger } from './logger.js';

/** Signature + IHDR header of a PNG of the given size (enough for the header check). */
function pngHeader(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(33);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const view = new DataView(bytes.buffer);
  view.setUint32(8, 13);
  bytes.set([0x49, 0x48, 0x44, 0x52], 12);
  view.setUint32(16, width);
  view.setUint32(20, height);
  bytes.set([8, 6, 0, 0, 0], 24);
  return bytes;
}

const log = createLogger(() => undefined);
let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'reelforge snap ż-'));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('checkPng', () => {
  it('reads the size of a PNG header', () => {
    expect(checkPng(pngHeader(640, 360))).toEqual({ ok: true, size: { width: 640, height: 360 } });
    expect(checkPng(pngHeader(1920, 1080))).toMatchObject({ ok: true });
  });

  it('rejects other data and absurd sizes', () => {
    expect(checkPng(new Uint8Array([1, 2, 3]))).toMatchObject({ ok: false });
    const jpeg = pngHeader(640, 360);
    jpeg[0] = 0xff;
    expect(checkPng(jpeg)).toEqual({ ok: false, error: 'not a PNG (bad signature)' });
    const noHeader = pngHeader(640, 360);
    noHeader[12] = 0x58;
    expect(checkPng(noHeader)).toEqual({ ok: false, error: 'not a PNG (IHDR chunk missing)' });
    expect(checkPng(pngHeader(0, 360))).toMatchObject({ ok: false });
    expect(checkPng(pngHeader(100_000, 360))).toMatchObject({ ok: false });
  });
});

describe('snapshot file names', () => {
  it('sort by time and name the shot and size', () => {
    expect(snapshotFileName(2.2, { width: 640, height: 360 }, 's02')).toBe(
      's02_t002.200_640x360.png',
    );
    expect(snapshotFileName(125.0333, { width: 1920, height: 1080 })).toBe(
      't125.033_1920x1080.png',
    );
  });

  it('never overwrite an earlier snapshot', async () => {
    expect(freeSnapshotPath(dir, 'a.png')).toBe(path.join(dir, 'a.png'));
    await writeFile(path.join(dir, 'a.png'), '');
    await writeFile(path.join(dir, 'a-2.png'), '');
    expect(freeSnapshotPath(dir, 'a.png')).toBe(path.join(dir, 'a-3.png'));
  });
});

describe('saveFrameSnapshot', () => {
  it('writes the PNG into out/snapshots of the project and returns its paths', async () => {
    const png = pngHeader(640, 360);
    const first = await saveFrameSnapshot(dir, { png, t: 2.2, shotId: 's02' }, log);
    expect(first).toEqual({
      status: 'saved',
      path: path.join(dir, 'out', 'snapshots', 's02_t002.200_640x360.png'),
      relative: 'out/snapshots/s02_t002.200_640x360.png',
      width: 640,
      height: 360,
    });
    expect(
      new Uint8Array(
        await readFile(path.join(dir, first.status === 'saved' ? first.relative : '')),
      ),
    ).toEqual(png);
    const second = await saveFrameSnapshot(dir, { png, t: 2.2, shotId: 's02' }, log);
    expect(second).toMatchObject({ relative: 'out/snapshots/s02_t002.200_640x360-2.png' });
    // Atomic write: no temp files left behind.
    expect((await readdir(path.join(dir, 'out', 'snapshots'))).sort()).toEqual([
      's02_t002.200_640x360-2.png',
      's02_t002.200_640x360.png',
    ]);
  });

  it('refuses without a project and for data that is not a PNG', async () => {
    const png = pngHeader(640, 360);
    expect(await saveFrameSnapshot(undefined, { png, t: 0 }, log)).toEqual({
      status: 'error',
      message: 'no project is open',
    });
    expect(await saveFrameSnapshot(dir, { png: new Uint8Array(40), t: 0 }, log)).toMatchObject({
      status: 'error',
      message: 'not a PNG (bad signature)',
    });
  });

  it('reports a write failure as an error result', async () => {
    // A file where the snapshots folder should be.
    await mkdir(path.join(dir, 'out'));
    await writeFile(path.join(dir, 'out', 'snapshots'), 'not a folder');
    const result = await saveFrameSnapshot(dir, { png: pngHeader(640, 360), t: 0 }, log);
    expect(result).toMatchObject({ status: 'error' });
  });
});
