import { describe, expect, it } from 'vitest';
import { EncoderSessionMemory } from './encoder-memory.js';
import { detectEncoder, upscaleFilter, videoCodecArgs, type VideoEncoderId } from './encoders.js';
import { concatList, muxArgs, segmentArgs, thumbnailArgs } from './ffmpeg-media.js';
import { resolveOutputScale } from './presets.js';
import type { FfmpegRunner } from '../audio/passes.js';
import type { FfmpegError } from '../ffmpeg/errors.js';
import { err, ok } from '../result.js';

/** Fake ffmpeg: probes succeed only for `working` encoders; records the encoders probed. */
function fakeRunner(working: readonly VideoEncoderId[], cancel = false) {
  const probed: string[] = [];
  const runner: FfmpegRunner = {
    hasFilter: () => true,
    run(args) {
      const encoder = args[args.indexOf('-c:v') + 1] ?? '?';
      probed.push(encoder);
      if (cancel) return Promise.resolve(err({ kind: 'cancelled', message: 'cancelled' }));
      if (working.includes(encoder as VideoEncoderId)) {
        return Promise.resolve(ok({ stdout: '', stderr: '', durationMs: 1 }));
      }
      const failure: FfmpegError = {
        kind: 'exit-code',
        message: 'ffmpeg exited with 1',
        code: 1,
        signal: null,
        stderrTail: `[${encoder} @ 0] Cannot load driver\nError while opening encoder`,
      };
      return Promise.resolve(err(failure));
    },
  };
  return { runner, probed };
}

describe('detectEncoder', () => {
  it('prefers NVENC, then QSV, then AMF', async () => {
    const { runner, probed } = fakeRunner(['h264_amf', 'libx264']);
    const choice = await detectEncoder(runner);
    expect(choice.ok && choice.value.encoder).toBe('h264_amf');
    expect(choice.ok && choice.value.hardware).toBe(true);
    expect(probed).toEqual(['h264_nvenc', 'h264_qsv', 'h264_amf']);
    expect(choice.ok && choice.value.probes[0]).toEqual({
      encoder: 'h264_nvenc',
      ok: false,
      detail: '[h264_nvenc @ 0] Cannot load driver',
    });
  });

  it('falls back to libx264 when no GPU encoder works', async () => {
    const choice = await detectEncoder(fakeRunner(['libx264']).runner, { quality: 'draft' });
    expect(choice.ok && choice.value).toMatchObject({
      encoder: 'libx264',
      quality: 'draft',
      hardware: false,
    });
  });

  it('honours a forced encoder and falls back to libx264 if it fails', async () => {
    const forced = fakeRunner(['h264_qsv', 'libx264']);
    const qsv = await detectEncoder(forced.runner, { prefer: 'h264_qsv' });
    expect(qsv.ok && qsv.value.encoder).toBe('h264_qsv');
    expect(forced.probed).toEqual(['h264_qsv']);
    const broken = await detectEncoder(fakeRunner(['libx264']).runner, { prefer: 'h264_nvenc' });
    expect(broken.ok && broken.value.encoder).toBe('libx264');
  });

  it('skips encoders that failed to open earlier this session, never libx264', async () => {
    const memory = new EncoderSessionMemory();
    memory.rememberOpenFailure('h264_nvenc', 'InitializeEncoder failed: out of memory (10)');
    memory.rememberOpenFailure('libx264', 'ignored');
    const { runner, probed } = fakeRunner(['h264_nvenc', 'libx264']);
    const auto = await detectEncoder(runner, { skip: memory.skipped(), prefer: 'h264_nvenc' });
    expect(auto.ok && auto.value.encoder).toBe('libx264');
    expect(probed).toEqual(['libx264']);
    expect(auto.ok && auto.value.probes[0]).toEqual({
      encoder: 'h264_nvenc',
      ok: false,
      detail:
        'skipped: could not open earlier this session (InitializeEncoder failed: out of memory (10))',
    });
    const fresh = await detectEncoder(fakeRunner(['h264_nvenc']).runner, {
      skip: new EncoderSessionMemory().skipped(),
    });
    expect(fresh.ok && fresh.value.encoder).toBe('h264_nvenc');
  });

  it('reports when nothing works, and cancellation', async () => {
    const none = await detectEncoder(fakeRunner([]).runner);
    expect(!none.ok && none.error.kind).toBe('no-encoder');
    const cancelled = await detectEncoder(fakeRunner([], true).runner);
    expect(!cancelled.ok && cancelled.error.kind).toBe('cancelled');
  });
});

describe('ffmpeg arguments', () => {
  it('sets explicit quality, 4:2:0 and BT.709 tags for every encoder', () => {
    const nvenc = videoCodecArgs('h264_nvenc', 'final');
    expect(nvenc.join(' ')).toContain('-c:v h264_nvenc -preset p7 -tune hq -rc vbr -cq 19 -b:v 0');
    expect(videoCodecArgs('libx264', 'draft').join(' ')).toContain('-preset veryfast -crf 20');
    for (const encoder of ['h264_nvenc', 'h264_qsv', 'h264_amf', 'libx264'] as const) {
      const args = videoCodecArgs(encoder, 'final').join(' ');
      expect(args).toContain('-pix_fmt yuv420p');
      expect(args).toContain('-colorspace bt709');
    }
  });

  it('upscales with nearest neighbour to the preset size', () => {
    const scale = resolveOutputScale('4k', 640, 360);
    if (!scale.ok) throw new Error('scale');
    const args = segmentArgs(
      { file: 'C:\\a b\\seg.mp4', scale: scale.value, fps: 30, frames: 10 },
      { encoder: 'libx264', quality: 'final', hardware: false, probes: [] },
    );
    expect(args.join(' ')).toContain('-s 640x360 -r 30 -i pipe:0');
    expect(args).toContain(upscaleFilter(3840, 2160));
    expect(upscaleFilter(3840, 2160)).toMatch(/^scale=3840:2160:flags=neighbor:/);
    expect(args.at(-1)).toBe('C:\\a b\\seg.mp4');
  });

  it('writes concat lists relative to the list file with quotes escaped', () => {
    const dir = process.platform === 'win32' ? 'C:\\cache dir' : '/cache dir';
    const join = (...parts: string[]): string =>
      [dir, ...parts].join(process.platform === 'win32' ? '\\' : '/');
    expect(concatList([join('segments', 'a.mp4'), join('segments', "it's.mp4")], dir)).toBe(
      "file 'segments/a.mp4'\nfile 'segments/it'\\''s.mp4'\n",
    );
  });

  it('muxes AAC 192k audio padded to the exact video length, with faststart', () => {
    const spec = { segments: [], workDir: 'w', durationS: 6.5, output: 'o.mp4' };
    const withAudio = muxArgs({ ...spec, audio: 'mix.wav' }, 'list.txt').join(' ');
    expect(withAudio).toContain('-f concat -safe 0 -i list.txt -i mix.wav -map 0:v:0 -c:v copy');
    expect(withAudio).toContain('-map 1:a:0 -c:a aac -b:a 192k -af apad');
    expect(withAudio).toContain('-t 6.500000 -movflags +faststart');
    expect(muxArgs({ ...spec, audio: null }, 'list.txt').join(' ')).not.toContain('aac');
  });

  it('writes thumbnails as upscaled RGB PNG', () => {
    const args = thumbnailArgs({ file: 't.png', width: 640, height: 360, factor: 2 }).join(' ');
    expect(args).toContain('scale=1280:720:flags=neighbor');
    expect(args).toContain('-frames:v 1 -pix_fmt rgb24');
    const opening = { file: 'o.png', width: 1920, height: 1080, factor: 1 };
    const sized = thumbnailArgs({ ...opening, size: { width: 1280, height: 720 } }).join(' ');
    expect(sized).toContain('scale=1280:720:flags=area');
  });
});
