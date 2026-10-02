/**
 * Render backend smoke test on the built app (`pnpm test:app`): a copy of the CLI fixture project
 * stretched to 10 s with a generated mix.wav.
 * - Render service: the BUILT `reelforge` CLI runs as a child process with the env the app gives
 *   Claude (REELFORGE_RENDER_URL/TOKEN) and renders frames through the app's hidden GPU window;
 *   the same command without the env renders through Playwright (SwiftShader). Electron frames are
 *   bit-identical across runs and close to SwiftShader (PSNR; GPU vs SwiftShader differ, ADR-002).
 * - Export: `api.startExport` exports the project through the Electron FrameSource
 *   (libx264 and NVENC), progress arrives over IPC, ffprobe checks the MP4, and a decoded MP4 frame
 *   matches the Electron frame of the same time.
 * Numbers go to out/test-app/render-metrics.json.
 */
import { spawn, spawnSync } from 'node:child_process';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { computeFrameStats, decodePng, type RgbaImage } from '@reelforge/engine/raster';
import { FfmpegManager, runProcess } from '@reelforge/pipeline';
import type { ElectronApplication, Page } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  FIRST_FRAME_TIMEOUT_MS,
  fixtureProject,
  launchApp,
  screenshotDir,
  stubFolderPicker,
} from './support/electron-app.js';
import { toneWav } from './support/player-probes.js';
import { logFile } from '../src/main/app-paths.js';
import type { ExportApi, ExportStartRequest } from '../src/shared/export-contract.js';

const repoRoot = path.resolve(import.meta.dirname, '..', '..', '..');
const cliRoot = path.join(repoRoot, 'packages', 'cli');
const cliBundle = path.join(cliRoot, 'dist', 'reelforge.mjs');
const VIDEO_SECONDS = 10;
const metrics: Record<string, unknown> = {};

let app: ElectronApplication;
let page: Page;
let userDataDir: string;
let projectDir: string;
let serviceEnv: Record<string, string>;

interface CliRun {
  readonly status: number | null;
  readonly stdout: string;
  readonly stderr: string;
  readonly ms: number;
}

/**
 * Runs the built CLI asynchronously: a synchronous spawn would block this process, and Playwright
 * must keep serving the app (it resumes every new window the app opens, like the render window).
 */
async function reelforge(env: Record<string, string>, ...args: string[]): Promise<CliRun> {
  const started = performance.now();
  const childEnv: Record<string, string> = {};
  for (const [name, value] of Object.entries(process.env)) {
    if (value !== undefined && !name.startsWith('REELFORGE_RENDER_')) childEnv[name] = value;
  }
  const child = spawn(process.execPath, [cliBundle, ...args], {
    cwd: projectDir,
    env: { ...childEnv, ...env },
    windowsHide: true,
  });
  let stdout = '';
  let stderr = '';
  child.stdout.setEncoding('utf8').on('data', (chunk: string) => (stdout += chunk));
  child.stderr.setEncoding('utf8').on('data', (chunk: string) => (stderr += chunk));
  const status = await new Promise<number | null>((resolve) => child.once('close', resolve));
  return { status, stdout, stderr, ms: performance.now() - started };
}

interface FramesReport {
  readonly frames: readonly { t: number; file: string; blank: string | null }[];
  readonly issues: readonly unknown[];
}

async function framesOf(run: CliRun): Promise<RgbaImage[]> {
  expect(run.stderr).toBe('');
  expect(run.status, run.stdout).toBe(0);
  const report = JSON.parse(run.stdout) as FramesReport;
  expect(report.issues).toEqual([]);
  return Promise.all(report.frames.map(async (frame) => decodePng(await readFile(frame.file))));
}

/** PSNR (dB) over RGB of two equally sized RGBA images. */
function psnr(first: RgbaImage, second: RgbaImage): number {
  let squared = 0;
  let count = 0;
  for (let offset = 0; offset < first.data.length; offset += 4) {
    for (let channel = 0; channel < 3; channel += 1) {
      const delta = (first.data[offset + channel] ?? 0) - (second.data[offset + channel] ?? 0);
      squared += delta * delta;
      count += 1;
    }
  }
  const mse = squared / count;
  return mse === 0 ? Infinity : 10 * Math.log10((255 * 255) / mse);
}

const ffmpegManager = await FfmpegManager.create();
const ffmpeg =
  ffmpegManager.ok && ffmpegManager.value.binary.ffprobePath !== null ? ffmpegManager.value : null;

async function ffprobe(file: string): Promise<Record<string, unknown>[]> {
  const run = await runProcess(ffmpeg?.binary.ffprobePath ?? 'ffprobe', [
    '-v',
    'error',
    '-count_frames',
    '-show_entries',
    'stream=codec_type,codec_name,width,height,r_frame_rate,nb_read_frames,pix_fmt:format=duration',
    '-of',
    'json',
    file,
  ]);
  if (!run.ok) throw new Error(run.error.message);
  const json = JSON.parse(run.value.stdout) as {
    streams: Record<string, unknown>[];
    format: { duration: string };
  };
  return [...json.streams, { duration: Number(json.format.duration) }];
}

/** Frame `index` of an MP4 downscaled x3 with neighbour sampling (back to 640x360 RGB). */
async function decodeVideoFrame(file: string, index: number): Promise<RgbaImage> {
  const out = path.join(userDataDir, `frame-${String(index)}.rgb`);
  const run = await ffmpeg?.run([
    '-loglevel',
    'error',
    '-i',
    file,
    '-vf',
    `select=eq(n\\,${String(index)}),scale=640:360:flags=neighbor`,
    '-frames:v',
    '1',
    '-f',
    'rawvideo',
    '-pix_fmt',
    'rgba',
    '-y',
    out,
  ]);
  if (run === undefined || !run.ok) throw new Error('cannot decode the MP4 frame');
  return { width: 640, height: 360, data: new Uint8Array(await readFile(out)) };
}

beforeAll(async () => {
  const build = spawnSync(process.execPath, [path.join(cliRoot, 'scripts', 'build.mjs')], {
    cwd: cliRoot,
    encoding: 'utf8',
  });
  if (build.status !== 0) throw new Error(`CLI build failed: ${build.stderr}`);
  userDataDir = await mkdtemp(path.join(tmpdir(), 'reelforge render ż-'));
  projectDir = path.join(userDataDir, 'Render ż projekt');
  await cp(fixtureProject, projectDir, { recursive: true });
  const storyboardFile = path.join(projectDir, 'storyboard.json');
  const storyboard = JSON.parse(await readFile(storyboardFile, 'utf8')) as {
    shots: { t1: number }[];
  };
  const last = storyboard.shots.at(-1);
  if (last) last.t1 = VIDEO_SECONDS;
  await writeFile(storyboardFile, JSON.stringify(storyboard, null, 2));
  await mkdir(path.join(projectDir, 'audio'));
  await writeFile(path.join(projectDir, 'audio', 'mix.wav'), toneWav(VIDEO_SECONDS));
  await mkdir(screenshotDir, { recursive: true });
  app = await launchApp(userDataDir, { env: { REELFORGE_TEST_HOOKS: '1' } });
  page = await app.firstWindow();
  await page.getByRole('region', { name: 'Start' }).waitFor();
  await stubFolderPicker(app, projectDir);
  await page.getByRole('button', { name: 'Open project…' }).click();
  await page
    .locator('canvas.preview-canvas[data-rendered-t]')
    .waitFor({ timeout: FIRST_FRAME_TIMEOUT_MS });
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const env = await app.evaluate(
      (_electron, name) =>
        (
          Reflect.get(globalThis, name) as { serviceEnv(): Record<string, string> | undefined }
        ).serviceEnv(),
      '__reelforgeRenderTest',
    );
    if (env !== undefined) {
      serviceEnv = env;
      break;
    }
    await page.waitForTimeout(100);
  }
}, 180_000);

afterAll(async () => {
  await writeFile(
    path.join(screenshotDir, 'render-metrics.json'),
    `${JSON.stringify(metrics, null, 2)}\n`,
  );
  await app.close();
  // The app log explains failures of the hidden render windows / the service.
  await cp(logFile(userDataDir), path.join(screenshotDir, 'render-main.log')).catch(
    () => undefined,
  );
  await rm(userDataDir, { recursive: true, force: true });
});

describe('render service (reelforge CLI in the app)', () => {
  let electronFrames: RgbaImage[] = [];

  it('renders frames through the app: non-blank, bit-identical across runs', async () => {
    expect(serviceEnv['REELFORGE_RENDER_URL']).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);
    const args = ['frames', '--shot', 's02', '--at', '0,2.5,5', '--json'];
    const first = await reelforge(serviceEnv, ...args);
    electronFrames = await framesOf(first);
    expect(electronFrames.map((image) => [image.width, image.height])).toEqual([
      [640, 360],
      [640, 360],
      [640, 360],
    ]);
    for (const image of electronFrames) {
      expect(computeFrameStats(image.data).dominantColorShare).toBeLessThan(0.9);
    }
    await cp(
      path.join(projectDir, '.reelforge', 'frames', 's02', 's02_t2.500.png'),
      path.join(screenshotDir, 'render-service-s02_t2.500.png'),
    );
    const second = await reelforge(serviceEnv, ...args);
    const again = await framesOf(second);
    for (const [index, image] of again.entries()) {
      expect(Buffer.compare(image.data, electronFrames[index]?.data ?? new Uint8Array())).toBe(0);
    }
    metrics['serviceFramesMs'] = { first: Math.round(first.ms), warm: Math.round(second.ms) };
  });

  it('matches the Playwright (SwiftShader) path closely; same output format', async () => {
    const playwright = await reelforge({}, 'frames', '--shot', 's02', '--at', '0,2.5,5', '--json');
    const swiftshader = await framesOf(playwright);
    const quality = swiftshader.map((image, index) => {
      const electron = electronFrames[index];
      if (!electron) throw new Error('missing Electron frame');
      return psnr(image, electron);
    });
    metrics['playwrightFramesMs'] = Math.round(playwright.ms);
    metrics['psnrGpuVsSwiftShaderDb'] = quality.map((value) => Number(value.toFixed(1)));
    for (const value of quality) expect(value).toBeGreaterThan(20);
    // Text output: identical apart from the timing-free frame lines.
    const text = await reelforge(serviceEnv, 'frames', '--shot', 's02', '--at', '2.5');
    const local = await reelforge({}, 'frames', '--shot', 's02', '--at', '2.5');
    expect(text.stdout).toBe(local.stdout);
  });

  it('reports console errors of the engine frame like the Playwright path', async () => {
    const title = await readFile(path.join(projectDir, 'scenes', 's01_title.js'), 'utf8');
    await writeFile(
      path.join(projectDir, 'scenes', 'noisy.js'),
      title.replace(
        'export function build(ctx) {',
        "export function build(ctx) {\n  console.error('noisy scene');",
      ),
    );
    const args = ['frames', '--scene', 'scenes/noisy.js', '--at', '0.5', '--json'];
    const [service, local] = [await reelforge(serviceEnv, ...args), await reelforge({}, ...args)];
    expect(service.status).toBe(1);
    const issues = (run: CliRun): unknown => (JSON.parse(run.stdout) as { issues: unknown }).issues;
    expect(issues(service)).toEqual([{ kind: 'console', message: 'noisy scene' }]);
    expect(issues(service)).toEqual(issues(local));
  });

  it('refuses wrong tokens, browser origins and other folders', async () => {
    const url = serviceEnv['REELFORGE_RENDER_URL'] ?? '';
    const token = serviceEnv['REELFORGE_RENDER_TOKEN'] ?? '';
    const post = (headers: Record<string, string>, body: unknown): Promise<Response> =>
      fetch(`${url}/anchors`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...headers },
        body: JSON.stringify(body),
      });
    const target = { projectDir, shot: 's01' };
    expect((await post({ authorization: 'Bearer wrong' }, target)).status).toBe(401);
    expect(
      (await post({ authorization: `Bearer ${token}`, origin: 'https://evil.example' }, target))
        .status,
    ).toBe(403);
    const other = await post(
      { authorization: `Bearer ${token}` },
      { ...target, projectDir: userDataDir },
    );
    expect(other.status).toBe(403);
    const ok = await post({ authorization: `Bearer ${token}` }, target);
    expect(ok.status).toBe(200);
  });
});

interface ExportRun {
  readonly outcome: { status: string; [key: string]: unknown };
  readonly events: { type: string; [key: string]: unknown }[];
}

async function runExport(request: ExportStartRequest): Promise<ExportRun> {
  return page.evaluate(async (choice) => {
    const api = (window as unknown as { reelforge: ExportApi }).reelforge;
    const events: { type: string; [key: string]: unknown }[] = [];
    const stop = api.onExportProgress((event) => events.push(event));
    const outcome = await api.startExport(choice);
    stop();
    return { outcome, events };
  }, request);
}

describe.skipIf(ffmpeg === null)('export through the Electron frame source', () => {
  it('exports a 10 s 1080p MP4 with libx264 and a hardware encoder; frames match', async () => {
    // libx264 (default workers, then 1 worker as in ADR-002), then the best hardware encoder
    // (NVENC > QSV > AMF; libx264 when none works).
    const runs: Record<string, ExportStartRequest> = {
      libx264: { encoder: 'cpu' },
      'libx264-1-worker': { encoder: 'cpu', workers: 1 },
      hardware: { encoder: 'auto' },
      'hardware-1-worker': { encoder: 'auto', workers: 1 },
    };
    for (const [name, request] of Object.entries(runs)) {
      // A full render each time (auto may fall back to libx264, whose segments are cached).
      await rm(path.join(projectDir, '.reelforge', 'cache'), { recursive: true, force: true });
      const { outcome, events } = await runExport(request);
      if (outcome.status !== 'done') throw new Error(JSON.stringify(outcome));
      const sources = events.filter((event) => event.type === 'source');
      expect(sources.length, JSON.stringify(events.slice(0, 3))).toBeGreaterThan(0);
      const lastFrame = events.filter((event) => event.type === 'frame').at(-1);
      expect(lastFrame?.['renderedFrames']).toBe(VIDEO_SECONDS * 30);
      metrics[`export-${name}`] = {
        encoder: outcome['encoder'],
        gpu: outcome['gpu'],
        software: sources.some((event) => event['software'] === true),
        workers: events.find((event) => event.type === 'plan')?.['workers'],
        renderFps: Number((lastFrame?.['fps'] as number).toFixed(1)),
        endToEndFps: Number(
          ((VIDEO_SECONDS * 30) / ((outcome['wallMs'] as number) / 1000)).toFixed(1),
        ),
        wallMs: Math.round(outcome['wallMs'] as number),
      };
      const output = outcome['output'] as string;
      const [video, audio, format] = await ffprobe(output);
      expect(video).toMatchObject({
        codec_name: 'h264',
        width: 1920,
        height: 1080,
        r_frame_rate: '30/1',
        nb_read_frames: String(VIDEO_SECONDS * 30),
        pix_fmt: 'yuv420p',
      });
      expect(audio).toMatchObject({ codec_type: 'audio', codec_name: 'aac' });
      expect(format?.['duration']).toBeCloseTo(VIDEO_SECONDS, 1);
    }
    // MP4 frame 141 = t 4.7 = shot s02 local 2.5: close to the service frame (H.264 + 4:2:0).
    const output = path.join(projectDir, 'out', 'Doom on a calculator.mp4');
    const decoded = await decodeVideoFrame(output, 141);
    const reference = decodePng(
      await readFile(path.join(projectDir, '.reelforge', 'frames', 's02', 's02_t2.500.png')),
    );
    const quality = psnr(decoded, reference);
    metrics['psnrMp4VsRendererDb'] = Number(quality.toFixed(1));
    expect(quality).toBeGreaterThan(25);
  }, 300_000);
});
