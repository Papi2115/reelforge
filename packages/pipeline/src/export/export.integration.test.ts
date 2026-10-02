/**
 * Integration: a 3-shot, 6 s video from the engine example scene, rendered by the real engine in
 * Playwright Chromium (SwiftShader) and encoded with the real ffmpeg (autodetected encoder), muxed
 * with a generated mix.wav. Skipped when ffmpeg/ffprobe or Playwright's Chromium is missing.
 */
import { mkdir, mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { launchHarnessBrowser } from '@reelforge/engine/cli';
import type { RenderManifest, WordsFile } from '@reelforge/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { RenderIdentity } from './cache-key.js';
import { detectEncoder, type EncoderChoice } from './encoders.js';
import { describeUnknown } from './errors.js';
import { exportVideo, type ExportProgress } from './export-video.js';
import { createFfmpegMedia } from './ffmpeg-media.js';
import { createPlaywrightFrameSources } from './testing/playwright-frame-source.js';
import { FfmpegManager } from '../ffmpeg/manager.js';
import { runProcess } from '../ffmpeg/process.js';

const engineDir = path.resolve(import.meta.dirname, '..', '..', '..', 'engine');

const created = await FfmpegManager.create();
const manager = created.ok && created.value.binary.ffprobePath !== null ? created.value : null;
const chromium = await launchHarnessBrowser().then(
  async (browser) => {
    await browser.close();
    return null;
  },
  (error: unknown) => describeUnknown(error).split('\n')[0] ?? 'unknown error',
);
const skipReason =
  manager === null
    ? 'ffmpeg/ffprobe not found; set REELFORGE_FFMPEG or add them to PATH'
    : chromium !== null
      ? `Playwright Chromium unavailable (pnpm --filter @reelforge/engine exec playwright install --only-shell chromium): ${chromium}`
      : null;

interface ProbeStream {
  codec_type?: string;
  codec_name?: string;
  width?: number;
  height?: number;
  r_frame_rate?: string;
  nb_read_frames?: string;
  pix_fmt?: string;
  color_space?: string;
}

async function ffprobe(file: string): Promise<{ streams: ProbeStream[]; duration: number }> {
  const probePath = manager?.binary.ffprobePath ?? 'ffprobe';
  const run = await runProcess(probePath, [
    '-v',
    'error',
    '-count_frames',
    '-show_entries',
    'stream=codec_type,codec_name,width,height,r_frame_rate,nb_read_frames,pix_fmt,color_space:format=duration',
    '-of',
    'json',
    file,
  ]);
  if (!run.ok) throw new Error(run.error.message);
  const json = JSON.parse(run.value.stdout) as {
    streams?: ProbeStream[];
    format?: { duration?: string };
  };
  return { streams: json.streams ?? [], duration: Number(json.format?.duration ?? 'NaN') };
}

/** Decodes the first (selected) frame of `file` to packed RGB24. */
async function decodeRgb(file: string, filter: readonly string[]): Promise<Buffer> {
  const out = path.join(path.dirname(file), `decoded-${path.basename(file)}.rgb`);
  const run = await (manager as FfmpegManager).run([
    '-loglevel',
    'error',
    '-i',
    file,
    ...filter,
    '-frames:v',
    '1',
    '-f',
    'rawvideo',
    '-pix_fmt',
    'rgb24',
    '-y',
    out,
  ]);
  if (!run.ok) throw new Error(run.error.message);
  const bytes = await readFile(out);
  await rm(out, { force: true });
  return bytes;
}

/** Mean |RGB difference| between a 640x360 RGBA engine frame and an integer-upscaled RGB24 image. */
function meanAbsDiff(rgba: Uint8Array, rgb: Uint8Array, rgbWidth: number, factor: number): number {
  let sum = 0;
  for (let y = 0; y < 360; y += 1) {
    for (let x = 0; x < 640; x += 1) {
      const source = (y * 640 + x) * 4;
      const sampleX = x * factor + Math.floor(factor / 2);
      const sampleY = y * factor + Math.floor(factor / 2);
      const target = (sampleY * rgbWidth + sampleX) * 3;
      for (let channel = 0; channel < 3; channel += 1) {
        sum += Math.abs((rgba[source + channel] ?? 0) - (rgb[target + channel] ?? 0));
      }
    }
  }
  return sum / (640 * 360 * 3);
}

describe.skipIf(skipReason !== null)(
  skipReason === null ? 'export integration' : `export integration (SKIPPED: ${skipReason})`,
  () => {
    const ffmpeg = manager as FfmpegManager;
    const sources = createPlaywrightFrameSources();
    let projectDir = '';
    let manifest: RenderManifest;
    let identity: RenderIdentity;
    let choice: EncoderChoice;

    beforeAll(async () => {
      projectDir = await mkdtemp(path.join(os.tmpdir(), 'reelforge export it '));
      const hello = await readFile(path.join(engineDir, 'examples', 's00_hello.js'), 'utf8');
      const words = JSON.parse(
        await readFile(path.join(engineDir, 'examples', 'words.json'), 'utf8'),
      ) as WordsFile;
      const scene = { file: 'scenes/s00_hello.js', source: hello };
      manifest = {
        version: 1,
        fps: 30,
        seed: 2115,
        words,
        shots: [
          { id: 's01', t0: 0, t1: 2, scene },
          { id: 's02', t0: 2, t1: 4, transitionIn: { type: 'crossfade', duration: 0.5 }, scene },
          { id: 's03', t0: 4, t1: 6, scene },
        ],
      };
      const preset: unknown = JSON.parse(
        await readFile(path.join(engineDir, 'src', 'presets', 'voxel-pixel-crisp640.json'), 'utf8'),
      );
      identity = {
        engineVersion: 'test',
        kitVersion: 'test',
        style: { id: 'voxel-pixel-crisp640', width: 640, height: 360, preset },
      };
      const mix = path.join(projectDir, 'audio', 'mix.wav');
      await mkdir(path.dirname(mix), { recursive: true });
      const audio = await ffmpeg.run([
        '-f',
        'lavfi',
        '-i',
        'sine=frequency=440:sample_rate=48000:duration=6',
        '-ac',
        '2',
        '-y',
        mix,
      ]);
      if (!audio.ok) throw new Error(audio.error.message);
      const detected = await detectEncoder(ffmpeg);
      if (!detected.ok) throw new Error(detected.error.message);
      choice = detected.value;
    }, 120_000);

    afterAll(async () => {
      await sources.close();
      await rm(projectDir, { recursive: true, force: true });
    });

    it('exports a 1080p30 MP4 with audio, a thumbnail and chapters', async () => {
      const media = createFfmpegMedia(ffmpeg, choice);
      const base = {
        projectDir,
        title: 'Hello: export',
        manifest,
        identity,
        media,
        createFrameSource: sources.factory,
        // One worker: parallel SwiftShader pages saturate the CPU and starve the other test files
        // (worker parallelism is covered by the fake-source tests).
        workers: 1,
        thumbnailAt: 2.5,
      };
      // 2 s chapters are too short for YouTube: rejected before anything is rendered.
      const badChapters = await exportVideo({
        ...base,
        chapters: [
          { title: 'One', t: 0 },
          { title: 'Two', t: 2 },
          { title: 'Three', t: 4 },
        ],
      });
      expect(!badChapters.ok && badChapters.error.message).toMatch(/lasts under 10 s/);

      const events: ExportProgress[] = [];
      const result = await exportVideo({ ...base, onProgress: (event) => events.push(event) });
      if (!result.ok) throw new Error(result.error.message);
      expect(result.value.output).toBe(path.join(projectDir, 'out', 'Hello export.mp4'));
      expect([...result.value.renderedShots].sort()).toEqual(['s01', 's02', 's03']);
      const sourceEvent = events.find((event) => event.type === 'source');
      expect(sourceEvent?.type === 'source' && sourceEvent.software).toBe(true);
      expect(events.filter((event) => event.type === 'frame')).toHaveLength(180);

      const probe = await ffprobe(result.value.output);
      const video = probe.streams.find((stream) => stream.codec_type === 'video');
      const audio = probe.streams.find((stream) => stream.codec_type === 'audio');
      expect(video).toMatchObject({
        codec_name: 'h264',
        width: 1920,
        height: 1080,
        r_frame_rate: '30/1',
        nb_read_frames: '180',
        pix_fmt: 'yuv420p',
        color_space: 'bt709',
      });
      expect(audio).toMatchObject({ codec_name: 'aac' });
      expect(probe.duration).toBeCloseTo(6, 1);
      const thumbProbe = await ffprobe(path.join(projectDir, 'out', 'thumb.png'));
      expect(thumbProbe.streams[0]).toMatchObject({ codec_name: 'png', width: 1280, height: 720 });

      // Preview = export: the engine's own frame at t=2.5 (inside the s01->s02 crossfade).
      const browser = await launchHarnessBrowser();
      const page = await browser.open();
      await page.load(manifest);
      const engineFrame = await page.frameAt(2.5);
      const otherFrame = await page.frameAt(3.5);
      await browser.close();
      // The thumbnail is lossless: exactly the engine frame, upscaled x2.
      const thumb = await decodeRgb(path.join(projectDir, 'out', 'thumb.png'), []);
      expect(meanAbsDiff(engineFrame, thumb, 1280, 2)).toBe(0);
      // Frame 75 of the MP4 is t=2.5: close to it (H.264 + 4:2:0 loss), far from t=3.5.
      const decoded = await decodeRgb(result.value.output, ['-vf', String.raw`select=eq(n\,75)`]);
      const sameDiff = meanAbsDiff(engineFrame, decoded, 1920, 3);
      expect(sameDiff).toBeLessThan(8);
      expect(meanAbsDiff(otherFrame, decoded, 1920, 3)).toBeGreaterThan(sameDiff * 2);
    }, 300_000);

    it('re-renders only the edited shot', async () => {
      const [s01, s02, s03] = manifest.shots;
      if (!s01 || !s02 || !s03) throw new Error('fixture');
      const edited: RenderManifest = {
        ...manifest,
        shots: [
          s01,
          s02,
          { ...s03, scene: { ...s03.scene, source: `${s03.scene.source}\n// edited\n` } },
        ],
      };
      const result = await exportVideo({
        projectDir,
        title: 'Hello: export',
        manifest: edited,
        identity,
        media: createFfmpegMedia(ffmpeg, choice),
        createFrameSource: sources.factory,
        thumbnailAt: null,
      });
      if (!result.ok) throw new Error(result.error.message);
      expect(result.value.renderedShots).toEqual(['s03']);
      expect(result.value.cachedShots).toEqual(['s01', 's02']);
      const probe = await ffprobe(result.value.output);
      expect(probe.streams.find((stream) => stream.codec_type === 'video')?.nb_read_frames).toBe(
        '180',
      );
    }, 300_000);

    it('cancels mid-shot: kills ffmpeg and leaves no partial segment', async () => {
      const controller = new AbortController();
      let frames = 0;
      const result = await exportVideo({
        projectDir,
        title: 'Hello: export',
        manifest,
        identity,
        // 4K draft: new cache keys, so every shot has to render.
        preset: '4k',
        media: createFfmpegMedia(ffmpeg, { ...choice, quality: 'draft' }),
        createFrameSource: sources.factory,
        workers: 1,
        signal: controller.signal,
        onProgress: (event) => {
          if (event.type === 'frame' && (frames += 1) === 10) controller.abort();
        },
      });
      expect(!result.ok && result.error.kind).toBe('cancelled');
      const segments = await readdir(
        path.join(projectDir, '.reelforge', 'cache', 'export', 'segments'),
      );
      expect(segments.filter((name) => name.includes('.partial'))).toEqual([]);
    }, 300_000);
  },
);
