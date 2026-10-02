import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { countDifferingPixels, diffImage } from './frame-stats.js';
import { DEFAULT_GOLDEN_CONFIG, goldenTolerance, loadGoldenConfig } from './golden-config.js';
import { compareWithGolden, GoldenMismatchError } from './goldens.js';
import { decodePng, encodePng, type RgbaImage } from './png.js';

function image(width: number, height: number, fill: readonly number[]): RgbaImage {
  const data = new Uint8Array(width * height * 4);
  for (let offset = 0; offset < data.length; offset += 4) data.set(fill, offset);
  return { width, height, data };
}

function withPixel(base: RgbaImage, index: number, rgba: readonly number[]): RgbaImage {
  const data = base.data.slice();
  data.set(rgba, index * 4);
  return { ...base, data };
}

describe('pixel tolerance', () => {
  const grey = image(2, 2, [100, 100, 100, 255]);

  it('ignores channel deltas up to the per-channel tolerance', () => {
    const nudged = withPixel(grey, 1, [103, 100, 100, 255]);
    expect(countDifferingPixels(grey.data, nudged.data)).toBe(1);
    expect(countDifferingPixels(grey.data, nudged.data, 2)).toBe(1);
    expect(countDifferingPixels(grey.data, nudged.data, 3)).toBe(0);
  });

  it('marks differing pixels red in the diff image', () => {
    const diff = diffImage(grey, withPixel(grey, 2, [0, 0, 0, 255]));
    expect(Array.from(diff.data.subarray(8, 12))).toEqual([255, 0, 0, 255]);
    expect(Array.from(diff.data.subarray(0, 4))).toEqual([35, 35, 35, 255]);
  });
});

describe('golden config', () => {
  it('reads the repo config and applies overrides, then the environment', () => {
    const config = { ...DEFAULT_GOLDEN_CONFIG, overrides: { noisy: { maxDiffShare: 0.05 } } };
    expect(goldenTolerance('plain', config, {})).toEqual({
      channelTolerance: 0,
      maxDiffShare: 0.002,
    });
    expect(goldenTolerance('noisy', config, {})).toEqual({
      channelTolerance: 0,
      maxDiffShare: 0.05,
    });
    expect(
      goldenTolerance('noisy', config, {
        REELFORGE_GOLDEN_CHANNEL_TOLERANCE: '4',
        REELFORGE_GOLDEN_MAX_DIFF_SHARE: '0.1',
      }),
    ).toEqual({ channelTolerance: 4, maxDiffShare: 0.1 });
    expect(() =>
      goldenTolerance('x', config, { REELFORGE_GOLDEN_CHANNEL_TOLERANCE: '300' }),
    ).toThrow(/REELFORGE_GOLDEN_CHANNEL_TOLERANCE="300" is not a valid value/);
    expect(loadGoldenConfig({}).version).toBe(1);
  });

  it('rejects a missing or invalid config file', async () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'reelforge-golden-config-'));
    try {
      const file = path.join(directory, 'config.json');
      expect(() => loadGoldenConfig({ REELFORGE_GOLDEN_CONFIG: file })).toThrow(/missing file/);
      await writeFile(file, JSON.stringify({ version: 1, channelTolerance: -1, maxDiffShare: 0 }));
      expect(() => loadGoldenConfig({ REELFORGE_GOLDEN_CONFIG: file })).toThrow(/channelTolerance/);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});

describe('compareWithGolden', () => {
  let directory: string;
  let options: { goldenDir: string; diffDir: string; update: boolean; ci: boolean };
  const frame = image(10, 10, [10, 20, 30, 255]);

  beforeEach(() => {
    directory = mkdtempSync(path.join(tmpdir(), 'reelforge-goldens-'));
    options = {
      goldenDir: path.join(directory, 'goldens'),
      diffDir: path.join(directory, 'diff'),
      update: false,
      ci: false,
    };
  });

  afterEach(() => {
    rmSync(directory, { recursive: true, force: true });
  });

  it('writes a missing golden locally, then matches it', async () => {
    expect((await compareWithGolden('a', frame, undefined, options)).status).toBe('written');
    const golden = decodePng(await readFile(path.join(options.goldenDir, 'a.png')));
    expect(golden).toEqual(frame);
    const result = await compareWithGolden('a', frame, undefined, options);
    expect(result).toMatchObject({ status: 'match', differingPixels: 0 });
  });

  it('fails on CI when the golden is missing', async () => {
    await expect(
      compareWithGolden('a', frame, undefined, { ...options, ci: true }),
    ).rejects.toThrow(/is missing \(CI never writes goldens/);
  });

  it('fails beyond the tolerance and writes actual/expected/diff images', async () => {
    await compareWithGolden('b', frame, undefined, options);
    const changed = withPixel(withPixel(frame, 0, [255, 255, 255, 255]), 1, [255, 255, 255, 255]);
    // 2 of 100 px differ: within a 2 % share, outside 1 %.
    expect((await compareWithGolden('b', changed, 0.02, options)).differingPixels).toBe(2);
    const failure = compareWithGolden('b', changed, 0.01, options);
    await expect(failure).rejects.toBeInstanceOf(GoldenMismatchError);
    await expect(failure).rejects.toThrow(
      /2 px \(2\.000%\) differ by more than 0\/255, tolerance 1\.000%/,
    );
    for (const kind of ['actual', 'expected', 'diff']) {
      expect(existsSync(path.join(options.diffDir, `b.${kind}.png`))).toBe(true);
    }
    // A later passing run removes the stale diff files.
    await compareWithGolden('b', frame, undefined, options);
    expect(existsSync(path.join(options.diffDir, 'b.diff.png'))).toBe(false);
  });

  it('rewrites the golden in update mode and reports size mismatches', async () => {
    await compareWithGolden('c', frame, undefined, options);
    const other = image(10, 10, [0, 0, 0, 255]);
    expect(
      (await compareWithGolden('c', other, undefined, { ...options, update: true })).status,
    ).toBe('written');
    expect((await compareWithGolden('c', other, undefined, options)).status).toBe('match');
    await expect(
      compareWithGolden('c', image(5, 5, [0, 0, 0, 255]), undefined, options),
    ).rejects.toThrow(/size 10x10 != 5x5/);
  });

  it('round-trips through encodePng for the files it writes', () => {
    expect(decodePng(encodePng(frame))).toEqual(frame);
  });
});
