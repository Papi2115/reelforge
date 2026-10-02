import { mkdir, mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { locateFfmpeg, writeWavAtomic } from '@reelforge/pipeline';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PEAKS_PER_SECOND } from '../shared/timeline-contract.js';
import { createLogger } from './logger.js';
import { decodeArgs, PeakAccumulator, PEAKS_CACHE_DIR, WaveformService } from './waveform-peaks.js';

function pcm(samples: readonly number[]): Uint8Array {
  const bytes = new Uint8Array(samples.length * 2);
  const view = new DataView(bytes.buffer);
  samples.forEach((sample, index) => {
    view.setInt16(index * 2, sample, true);
  });
  return bytes;
}

describe('PeakAccumulator', () => {
  it('keeps the loudest |sample| per bucket, across odd chunk splits', () => {
    const bytes = pcm([100, -32768, 5, 0, 16384, -16384, 1]);
    const accumulator = new PeakAccumulator(2);
    // Split mid-sample on purpose.
    accumulator.push(bytes.subarray(0, 3));
    accumulator.push(bytes.subarray(3, 9));
    accumulator.push(bytes.subarray(9));
    expect([...accumulator.finish()]).toEqual([255, 0, 128, 0]);
  });

  it('returns nothing for no samples', () => {
    expect(new PeakAccumulator(40).finish()).toHaveLength(0);
  });
});

describe('decodeArgs', () => {
  it('decodes to mono 16-bit PCM on stdout', () => {
    expect(decodeArgs('C:\\Mój film\\vo.wav')).toEqual([
      '-hide_banner',
      '-nostdin',
      '-v',
      'error',
      '-i',
      'C:\\Mój film\\vo.wav',
      '-vn',
      '-ac',
      '1',
      '-ar',
      '8000',
      '-f',
      's16le',
      '-acodec',
      'pcm_s16le',
      'pipe:1',
    ]);
  });
});

const ffmpeg = locateFfmpeg();

describe.skipIf(!ffmpeg.ok)('WaveformService (real ffmpeg)', () => {
  let root: string;
  let dir: string;
  let decodes = 0;
  let service: WaveformService;

  beforeAll(async () => {
    root = await mkdtemp(path.join(tmpdir(), 'reelforge waveform ż-'));
    dir = path.join(root, 'Mój film');
    await mkdir(path.join(dir, 'audio'), { recursive: true });
    // 1 s of silence, then 1 s of a full-scale square wave (stereo float, 48 kHz).
    const rate = 48_000;
    const left = new Float32Array(rate * 2);
    for (let index = rate; index < left.length; index += 1)
      left[index] = index % 96 < 48 ? 0.9 : -0.9;
    const written = await writeWavAtomic(
      path.join(dir, 'audio', 'vo.clean.wav'),
      [left, left],
      rate,
      'float32',
    );
    if (!written.ok) throw new Error(written.error.message);
    service = new WaveformService({
      projectDir: () => dir,
      ffmpeg: () => {
        decodes += 1;
        return ffmpeg.ok ? { path: ffmpeg.value.ffmpegPath } : { error: 'no ffmpeg' };
      },
      track: () => undefined,
      log: createLogger(() => undefined),
    });
  });

  afterAll(async () => {
    await rm(root, { recursive: true, force: true, maxRetries: 5 });
  });

  it('computes peaks once and serves them from the cache afterwards', async () => {
    const first = await service.peaks('audio/vo.clean.wav');
    if (first.status !== 'ok') throw new Error(first.reason);
    expect(first.peaksPerSecond).toBe(PEAKS_PER_SECOND);
    expect(first.peaks.length).toBeGreaterThanOrEqual(2 * PEAKS_PER_SECOND - 2);
    expect(Math.max(...first.peaks.subarray(0, PEAKS_PER_SECOND - 5))).toBeLessThan(3);
    expect(
      Math.min(...first.peaks.subarray(PEAKS_PER_SECOND + 5, 2 * PEAKS_PER_SECOND - 5)),
    ).toBeGreaterThan(200);
    expect(await readdir(path.join(dir, PEAKS_CACHE_DIR))).toEqual([
      expect.stringMatching(/^peaks-[0-9a-f]{16}\.json$/),
    ]);

    const again = await service.peaks('audio/vo.clean.wav');
    expect(again.status === 'ok' && [...again.peaks]).toEqual([...first.peaks]);
    expect(decodes).toBe(1);
  });

  it('reports missing files and files outside the project', async () => {
    expect(await service.peaks('audio/none.wav')).toMatchObject({ status: 'unavailable' });
    expect(await service.peaks('../outside.wav')).toMatchObject({
      status: 'unavailable',
      reason: expect.stringMatching(/outside|no such file/i) as unknown,
    });
  });
});
