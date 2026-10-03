import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { encodeWav, FfmpegManager, MIX_SAMPLE_RATE, ok } from '@reelforge/pipeline';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createLogger } from '../logger.js';
import { MixPreviewService, PREVIEW_DIR, previewWindow } from './mix-preview-service.js';
import { parseWavLayout, spliceWav, wavSeconds } from './wav-splice.js';

function tone(seconds: number, channels: number, amplitude: number): Buffer {
  const frames = seconds * MIX_SAMPLE_RATE;
  const data = Array.from({ length: channels }, () =>
    Float32Array.from(
      { length: frames },
      (_, index) => amplitude * Math.sin((2 * Math.PI * 220 * index) / MIX_SAMPLE_RATE),
    ),
  );
  return encodeWav(data, MIX_SAMPLE_RATE, 'pcm16');
}

describe('wav splicing', () => {
  it('finds the data chunk after LIST chunks and replaces samples in place', async () => {
    const plain = tone(1, 2, 0.1);
    const list = Buffer.concat([
      Buffer.from('LIST'),
      Buffer.from([4, 0, 0, 0]),
      Buffer.from('INFO'),
    ]);
    // RIFF header + fmt (36 bytes) + LIST + data.
    const withList = Buffer.concat([plain.subarray(0, 36), list, plain.subarray(36)]);
    const layout = parseWavLayout(withList);
    expect(layout).toMatchObject({
      channels: 2,
      sampleRate: 48_000,
      bitsPerSample: 16,
      dataOffset: 56,
    });
    expect(layout === null ? 0 : wavSeconds(layout)).toBe(1);
    expect(parseWavLayout(Buffer.from('not a wav file at all'))).toBeNull();

    const dir = await mkdtemp(path.join(tmpdir(), 'reelforge splice '));
    try {
      const target = path.join(dir, 'target.wav');
      const window = path.join(dir, 'window.wav');
      await writeFile(target, withList);
      await writeFile(window, tone(1, 2, 0).subarray(0, 44 + 0.25 * 48_000 * 4));
      expect(await spliceWav(target, window, 0.5)).toBeNull();
      const spliced = await readFile(target);
      expect(spliced.length).toBe(withList.length);
      const sample = (seconds: number): number =>
        spliced.readInt16LE(56 + Math.round(seconds * 48_000) * 4);
      expect(sample(0.6)).toBe(0);
      expect(Math.abs(sample(0.25 + 1 / 880))).toBeGreaterThan(1000);
      expect(
        Buffer.compare(spliced.subarray(0, 56 + 24_000 * 4), withList.subarray(0, 56 + 24_000 * 4)),
      ).toBe(0);
      await writeFile(window, tone(1, 1, 0));
      expect(await spliceWav(target, window, 0)).toBe(
        'the preview window has another sample format',
      );
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('centres a ≤ 20 s window just before the playhead, inside the mix', () => {
    expect(previewWindow(30, 120)).toEqual({ startS: 25, durationS: 20 });
    expect(previewWindow(2, 120)).toEqual({ startS: 0, durationS: 20 });
    expect(previewWindow(118, 120)).toEqual({ startS: 100, durationS: 20 });
    expect(previewWindow(5, 12)).toEqual({ startS: 0, durationS: 12 });
  });
});

const created = await FfmpegManager.create();
const ffmpeg = created.ok ? created.value : null;

/** Duration in seconds as ffprobe reads the file (null without ffprobe). */
function probedSeconds(file: string): number | null {
  const ffprobe = ffmpeg?.binary.ffprobePath ?? null;
  if (ffprobe === null) return null;
  const output = execFileSync(
    ffprobe,
    ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file],
    { encoding: 'utf8' },
  );
  return Number(output.trim());
}

describe.skipIf(ffmpeg === null)('MixPreviewService (real ffmpeg)', () => {
  let root = '';
  let dir = '';
  const service = new MixPreviewService({
    currentProject: () => dir,
    ffmpeg: () => Promise.resolve(ok(ffmpeg as FfmpegManager)),
    log: createLogger(() => undefined),
  });

  beforeAll(async () => {
    root = await mkdtemp(path.join(tmpdir(), 'reelforge preview ż-'));
    dir = path.join(root, 'Mój film');
    await mkdir(path.join(dir, 'audio'), { recursive: true });
    await writeFile(path.join(dir, 'audio', 'vo.clean.wav'), tone(30, 1, 0.2));
    await writeFile(path.join(dir, 'audio', 'mix.wav'), tone(30, 2, 0.2));
  });

  afterAll(async () => {
    await rm(root, { recursive: true, force: true, maxRetries: 5 });
  });

  it('is unavailable without a mix, then splices each edit into a new full-length file', async () => {
    const mix = await readFile(path.join(dir, 'audio', 'mix.wav'));
    await writeFile(
      path.join(dir, 'cues.json'),
      JSON.stringify({ version: 1, sfx: [{ t: 12, name: 'hit' }] }),
    );
    const first = await service.render(10);
    if (first.status !== 'ok') throw new Error(JSON.stringify(first));
    expect(first).toMatchObject({ startS: 5, durationS: 20 });
    const preview = await readFile(path.join(dir, ...first.file.split('/')));
    expect(preview.length).toBe(mix.length);
    // The spliced copy is a valid WAV of the same length (what the player's <audio> reads).
    const probed = probedSeconds(path.join(dir, ...first.file.split('/')));
    if (probed !== null) expect(probed).toBeCloseTo(30, 3);
    // Outside the window: the mix as it was.
    const before = 44 + 4 * 48_000 * 4;
    expect(Buffer.compare(preview.subarray(0, before), mix.subarray(0, before))).toBe(0);
    const after = 44 + 26 * 48_000 * 4;
    expect(Buffer.compare(preview.subarray(after), mix.subarray(after))).toBe(0);
    // Inside: re-rendered (the hit at 12 s).
    expect(Buffer.compare(preview.subarray(before, after), mix.subarray(before, after))).not.toBe(
      0,
    );

    await writeFile(
      path.join(dir, 'cues.json'),
      JSON.stringify({
        version: 1,
        sfx: [
          { t: 12, name: 'hit' },
          { t: 27, name: 'pop' },
        ],
      }),
    );
    const second = await service.render(26);
    if (second.status !== 'ok') throw new Error(JSON.stringify(second));
    expect(second.file).not.toBe(first.file);
    const both = await readFile(path.join(dir, ...second.file.split('/')));
    // The first edit stays in the chain (its region is outside the second window).
    const firstOnly = 44 + 9 * 48_000 * 4;
    expect(
      Buffer.compare(both.subarray(before, firstOnly), preview.subarray(before, firstOnly)),
    ).toBe(0);
    const files = (await readdir(path.join(dir, ...PREVIEW_DIR.split('/')))).sort();
    expect(files).toEqual(
      [path.posix.basename(first.file), path.posix.basename(second.file)].sort(),
    );

    await rm(path.join(dir, 'audio', 'mix.wav'));
    expect((await service.render(1)).status).toBe('unavailable');
  }, 60_000);
});
