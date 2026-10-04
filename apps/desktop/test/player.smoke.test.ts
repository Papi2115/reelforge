/**
 * Player smoke test (PLAN.md#6.4) on the built app (`pnpm test:app`): a copy of the CLI fixture
 * project with a generated voice-over plays with the `<audio>` element as master clock, at 1x and
 * 2x; the timeline ruler and the slider scrub (p95 latency measured); snapshots land in
 * out/snapshots and on the clipboard; editing a scene hot-reloads just that shot in < 1 s, and a
 * broken scene keeps the last frame; adding or editing a project prop (kit-ext/props, PLAN.md#7.4)
 * reloads the video. Measured numbers go to out/test-app/player-metrics.json.
 */
import { existsSync } from 'node:fs';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { ElectronApplication, Page } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  FIRST_FRAME_TIMEOUT_MS,
  fixtureProject,
  frameStats,
  closeApp,
  launchApp,
  screenshotDir,
  stubFolderPicker,
  waitForRenderedT,
} from './support/electron-app.js';
import {
  measurePlayback,
  measureScrubLatency,
  pngSizeInMain,
  toneWav,
} from './support/player-probes.js';
import { perfBar } from './support/ci-mode.js';

const repoRoot = path.resolve(import.meta.dirname, '..', '..', '..');
/**
 * Preview frames per second while playing (counted over the measured window, see
 * measurePlayback): 30 fps content on a real GPU. ANGLE on WARP (the GPU-less CI runner) renders
 * 24-31 fps, so CI checks that playback runs, not the machine's speed.
 */
const PLAYBACK_FPS_BAR = perfBar(28, 15);
const metrics: Record<string, unknown> = {};

let app: ElectronApplication;
let page: Page;
let userDataDir: string;
let projectDir: string;
let sceneFile: string;
let originalScene: string;

async function useSpeed(rate: string): Promise<void> {
  await page.getByLabel('Playback speed').selectOption(rate);
  // Shortcuts are ignored while a <select> has the focus.
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  });
}

async function seekWithSlider(t: string): Promise<void> {
  await page.getByRole('slider', { name: 'Scrub' }).fill(t);
  await waitForRenderedT(page, Number(t).toFixed(3));
}

/** Waits until the preview shows a frame different from `hash` (after a reload). */
async function waitForNewFrame(hash: string): Promise<string> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const stats = await frameStats(page);
    if (stats.hash !== hash) return stats.hash;
    await page.waitForTimeout(100);
  }
  throw new Error('the preview frame did not change');
}

/** Writes the scene of s02 and waits for the preview to report the hot reload. */
async function editScene(source: string): Promise<number> {
  // The notice of an earlier reload must be gone first (it stays up for a few seconds).
  await page.getByTestId('preview-reload').waitFor({ state: 'detached', timeout: 10_000 });
  const started = Date.now();
  await writeFile(sceneFile, source);
  await page
    .getByTestId('preview-reload')
    .filter({ hasText: 'Reloaded s02' })
    .waitFor({ timeout: 10_000 });
  return Date.now() - started;
}

beforeAll(async () => {
  userDataDir = await mkdtemp(path.join(tmpdir(), 'reelforge player ż-'));
  projectDir = path.join(userDataDir, 'Odtwarzacz ż projekt');
  await cp(fixtureProject, projectDir, { recursive: true });
  await mkdir(path.join(projectDir, 'audio'));
  // 8 s, longer than the 7.5 s video; a very quiet tone (about -60 dBFS).
  await writeFile(path.join(projectDir, 'audio', 'vo.clean.wav'), toneWav(8));
  sceneFile = path.join(projectDir, 'scenes', 's02_calc.js');
  originalScene = await readFile(sceneFile, 'utf8');
  await mkdir(screenshotDir, { recursive: true });
  app = await launchApp(userDataDir);
  page = await app.firstWindow();
  await page.getByRole('region', { name: 'Start' }).waitFor();
  await stubFolderPicker(app, projectDir);
  await page.getByRole('button', { name: 'Open project…' }).click();
  await page
    .locator('canvas.preview-canvas[data-rendered-t]')
    .waitFor({ timeout: FIRST_FRAME_TIMEOUT_MS });
});

afterAll(async () => {
  await writeFile(
    path.join(screenshotDir, 'player-metrics.json'),
    `${JSON.stringify(metrics, null, 2)}\n`,
  );
  await closeApp(app);
  await rm(userDataDir, { recursive: true, force: true });
});

describe('player', () => {
  it('plays in real time with the project audio as master clock', async () => {
    await page.locator('section.preview[data-clock="audio"]').waitFor({ timeout: 10_000 });
    const shot = page
      .getByRole('region', { name: 'Shots' })
      .getByRole('button', { name: /^Shot s02/ });
    await shot.click();
    await waitForRenderedT(page, '2.200');
    await page.getByRole('button', { name: 'FPS' }).click();
    // Space on the focused shot button plays (it does not click the button).
    await shot.focus();
    await page.keyboard.press('Space');
    const run = await measurePlayback(page, 1000);
    await page.keyboard.press('Space');
    await page.locator('section.preview[data-playing="false"]').waitFor();
    metrics['playback1x'] = run;
    expect(run.clock).toBe('audio');
    expect(Math.abs(run.advanced - run.elapsed / 1000)).toBeLessThan(0.15);
    expect(run.fps).toBeGreaterThanOrEqual(PLAYBACK_FPS_BAR);
    // The fps overlay shows live numbers (its reading lags by up to a refresh, so no bar).
    expect(run.overlayFps).toBeGreaterThan(0);
    await page.screenshot({ path: path.join(screenshotDir, 'player-playing.png') });
    // Space again continues from the pause point (no jump back to the shot start).
    const paused = Number((await frameStats(page)).renderedT);
    expect(paused).toBeGreaterThan(3);
    await page.keyboard.press('Space');
    await page.waitForTimeout(300);
    await page.keyboard.press('Space');
    expect(Number((await frameStats(page)).renderedT)).toBeGreaterThan(paused);
  });

  it('plays twice as fast at 2x', async () => {
    await useSpeed('2');
    await page.keyboard.press('Home');
    await waitForRenderedT(page, '0.000');
    await page.keyboard.press('Space');
    const run = await measurePlayback(page, 1000);
    await page.keyboard.press('k');
    metrics['playback2x'] = run;
    expect(Math.abs(run.advanced - (2 * run.elapsed) / 1000)).toBeLessThan(0.3);
    await useSpeed('1');
  });

  it('scrubs from the timeline ruler and the slider, frame by frame and fast', async () => {
    await seekWithSlider('1');
    const before = await frameStats(page);
    // The ruler is the top 20 px of the timeline canvas. Positions come from its scale (the
    // default window size depends on the screen: 1024x768 on the CI runner).
    const lanes = page.getByTestId('timeline-canvas');
    const box = await lanes.boundingBox();
    if (!box) throw new Error('timeline lanes not visible');
    const pxPerSecond = Number(await lanes.getAttribute('data-px-per-second'));
    const scrollX = Number(await lanes.getAttribute('data-scroll-x'));
    const xAt = (t: number): number => box.x + t * pxPerSecond - scrollX;
    const y = box.y + 10;
    await page.mouse.move(xAt(0.75), y);
    await page.mouse.down();
    await page.mouse.move(xAt(4.5), y, { steps: 12 });
    await page.mouse.up();
    await page.waitForFunction(() => {
      const t = Number(
        document.querySelector<HTMLCanvasElement>('canvas.preview-canvas')?.dataset['renderedT'],
      );
      return Math.abs(t - 4.5) < 0.1;
    });
    expect((await frameStats(page)).hash).not.toBe(before.hash);

    const dragged = Number((await frameStats(page)).renderedT);
    const nextFrame = (Math.round(dragged * 30) + 1) / 30;
    await page.keyboard.press('ArrowRight');
    await waitForRenderedT(page, nextFrame.toFixed(3));
    await page.keyboard.press('Shift+ArrowLeft');
    await waitForRenderedT(page, (nextFrame - 1).toFixed(3));

    const latency = await measureScrubLatency(page, 50);
    metrics['scrubLatencyFixture'] = latency;
    expect(latency.p95).toBeLessThan(100);
  });

  it('saves snapshots into out/snapshots and copies them to the clipboard', async () => {
    await seekWithSlider('4');
    await page.getByRole('button', { name: 'Snapshot frame' }).click();
    const notice = page.getByTestId('preview-snapshot');
    await notice.getByText('Saved out/snapshots/s02_t004.000_640x360.png').waitFor();
    const native = path.join(projectDir, 'out', 'snapshots', 's02_t004.000_640x360.png');
    expect(await pngSizeInMain(app, native)).toEqual({ width: 640, height: 360 });

    await page.getByLabel('Snapshot size').selectOption('hd');
    await page.getByRole('button', { name: 'Snapshot frame' }).click();
    await notice.getByText('Saved out/snapshots/s02_t004.000_1920x1080.png').waitFor();
    const hd = path.join(projectDir, 'out', 'snapshots', 's02_t004.000_1920x1080.png');
    expect(await pngSizeInMain(app, hd)).toEqual({ width: 1920, height: 1080 });
    await cp(hd, path.join(screenshotDir, 'player-snapshot-1080p.png'));
    await page.screenshot({ path: path.join(screenshotDir, 'player-snapshot.png') });

    await notice.getByRole('button', { name: 'Copy to clipboard' }).click();
    await notice.getByRole('button', { name: 'Copied' }).waitFor();
    expect(await app.evaluate(({ clipboard }) => clipboard.has('image/png'))).toBe(true);
    await notice.getByRole('button', { name: 'Dismiss snapshot notice' }).click();
  });

  it('hot-reloads only the edited shot in under a second, keeping time and frame on errors', async () => {
    await seekWithSlider('4');
    const before = await frameStats(page);
    const edited = originalScene.replace(
      'scene.background = new three.Color(palette.sky);',
      'scene.background = new three.Color(palette.shadow);',
    );
    expect(edited).not.toBe(originalScene);
    const reloadMs = await editScene(edited);
    const after = await frameStats(page);
    metrics['hotReloadEditToFrameMs'] = reloadMs;
    metrics['hotReloadNotice'] = await page.getByTestId('preview-reload').textContent();
    expect(reloadMs).toBeLessThan(perfBar(1000, 5000));
    expect(after.renderedT).toBe('4.000');
    expect(after.hash).not.toBe(before.hash);
    await page.screenshot({ path: path.join(screenshotDir, 'player-hot-reload.png') });

    // Broken scenes: the lint / build error is shown, the last working frame stays.
    const problem = page.getByTestId('preview-problem');
    await writeFile(
      sceneFile,
      edited.replace('return { screenOn, hit };', 'return { screenOn, hit, r: Math.random() };'),
    );
    await problem.getByText(/no-random/).waitFor({ timeout: 10_000 });
    expect((await frameStats(page)).hash).toBe(after.hash);
    await page.screenshot({ path: path.join(screenshotDir, 'player-scene-error.png') });
    await writeFile(
      sceneFile,
      edited.replace('const { three, scene', "throw new Error('boom');\n  const { three, scene"),
    );
    await problem.getByText(/build\(\) threw Error: boom/).waitFor({ timeout: 10_000 });
    expect((await frameStats(page)).hash).toBe(after.hash);

    await editScene(originalScene);
    expect(await problem.count()).toBe(0);
    expect((await frameStats(page)).hash).toBe(before.hash);
  });

  it('reloads the video when a project prop (kit-ext) appears or changes', async () => {
    await seekWithSlider('4');
    const before = await frameStats(page);
    const problem = page.getByTestId('preview-problem');
    const withFridge = originalScene.replace(
      'scene.background = new three.Color(palette.sky);',
      'scene.background = new three.Color(palette.sky);\n  const fridge = ctx.kit.props.fridge({ scale: 1.2 });\n  fridge.position.set(-2.4, 0, 0.5);\n  scene.add(fridge);',
    );
    expect(withFridge).not.toBe(originalScene);
    // The scene asks for a prop that does not exist yet: the build error is shown.
    await writeFile(sceneFile, withFridge);
    await problem.getByText(/fridge is not a function/).waitFor({ timeout: 10_000 });
    const fridge = await readFile(
      path.join(repoRoot, 'packages', 'kit', 'examples', 'kit-ext', 'fridge.js'),
      'utf8',
    );
    await mkdir(path.join(projectDir, 'kit-ext', 'props'), { recursive: true });
    const propFile = path.join(projectDir, 'kit-ext', 'props', 'fridge.js');
    await writeFile(propFile, fridge);
    await problem.waitFor({ state: 'detached', timeout: 10_000 });
    const withProp = await waitForNewFrame(before.hash);
    await page.screenshot({ path: path.join(screenshotDir, 'player-kit-ext-prop.png') });
    // Editing the prop module reloads the shots that use it (the whole video, same time).
    const recoloured = fridge.replace("default: 'heroTrim'", "default: 'accent2'");
    expect(recoloured).not.toBe(fridge);
    await writeFile(propFile, recoloured);
    await waitForNewFrame(withProp);
    expect((await frameStats(page)).renderedT).toBe('4.000');
    await editScene(originalScene);
    expect((await frameStats(page)).hash).toBe(before.hash);
  });

  it('keeps preview speed with a heavier kit scene', async () => {
    const kitScene = await readFile(
      path.join(repoRoot, 'packages', 'kit', 'examples', 'k04_props.js'),
      'utf8',
    );
    const gallery = kitScene.replace("const PROP = 'calculator';", "const PROP = 'gallery';");
    expect(gallery).not.toBe(kitScene);
    await editScene(gallery);
    await seekWithSlider('2.8');
    const run = await (async () => {
      await page.keyboard.press('Space');
      const measured = await measurePlayback(page, 1500);
      await page.keyboard.press('k');
      return measured;
    })();
    await useSpeed('2');
    await seekWithSlider('2.8');
    await page.keyboard.press('Space');
    const fast = await measurePlayback(page, 1000);
    await page.keyboard.press('k');
    await useSpeed('1');
    const latency = await measureScrubLatency(page, 50, { from: 2.6, to: 7.4 });
    metrics['kitGallery'] = { playback1x: run, playback2x: fast, scrubLatency: latency };
    await page.screenshot({ path: path.join(screenshotDir, 'player-kit-gallery.png') });
    expect(run.fps).toBeGreaterThanOrEqual(PLAYBACK_FPS_BAR);
    expect(latency.p95).toBeLessThan(perfBar(100, 600));
    expect(existsSync(path.join(projectDir, 'out', 'snapshots'))).toBe(true);
  });
});
