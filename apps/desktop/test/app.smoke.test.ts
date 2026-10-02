/**
 * Smoke test of the built app (`pnpm test:app` builds it first): launches Electron through
 * Playwright, waits for the first engine frame in the preview, checks it is not blank, scrubs to
 * the end and checks the frame changed; then creates a project from the start screen and reverts
 * it from the history drawer; then opens a fixture project and checks the main layout (shots,
 * timeline, pipeline, preview, refresh on file changes) at 1280x720 and 1920x1080.
 * Screenshots land in apps/desktop/out/test-app/.
 * Needs a display (not part of `pnpm test`).
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { ElectronApplication, Page } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { logFile } from '../src/main/app-paths.js';
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

const LAYOUT_REGIONS = ['Pipeline', 'Shots', 'Preview', 'Claude', 'Timeline', 'Status'];

interface LayoutReport {
  readonly regions: { name: string; inside: boolean; width: number; height: number }[];
  /** Regions (and the page) whose content is wider/taller than their box: clipped content. */
  readonly overflowing: string[];
  /** Displayed preview width in device pixels (integer multiple of the 640 px frame). */
  readonly canvasDeviceWidth: number;
}

/** Resizes the window's content area, then measures the main layout regions. */
async function layoutAt(page: Page, width: number, height: number): Promise<LayoutReport> {
  await app.evaluate(
    ({ BrowserWindow }, size) => {
      BrowserWindow.getAllWindows()[0]?.setContentSize(size.width, size.height);
    },
    { width, height },
  );
  await page.waitForFunction(
    (size) => window.innerWidth === size.width && window.innerHeight === size.height,
    { width, height },
  );
  // Let the ResizeObservers (pane clamping, integer canvas scale) settle.
  await page.waitForTimeout(300);
  return page.evaluate((names) => {
    const overflowing: string[] = [];
    const root = document.documentElement;
    if (root.scrollWidth > window.innerWidth || root.scrollHeight > window.innerHeight) {
      overflowing.push('page');
    }
    const header = document.querySelector('.app-header');
    if (header && header.scrollWidth > header.clientWidth + 1) overflowing.push('header');
    const regions = names.map((name) => {
      const element = document.querySelector(`[aria-label="${name}"]`);
      const rect = element?.getBoundingClientRect();
      if (element && element.scrollWidth > element.clientWidth + 1) overflowing.push(name);
      return {
        name,
        inside:
          rect !== undefined &&
          rect.left >= 0 &&
          rect.top >= 0 &&
          rect.right <= window.innerWidth + 0.5 &&
          rect.bottom <= window.innerHeight + 0.5,
        width: Math.round(rect?.width ?? 0),
        height: Math.round(rect?.height ?? 0),
      };
    });
    const canvas = document.querySelector('canvas.preview-canvas')?.getBoundingClientRect();
    const canvasDeviceWidth = Math.round((canvas?.width ?? 0) * window.devicePixelRatio);
    return { regions, overflowing, canvasDeviceWidth };
  }, LAYOUT_REGIONS);
}

let app: ElectronApplication;
let userDataDir: string;

beforeAll(async () => {
  // Space + Polish letter: the app must cope with such profile paths on Windows.
  userDataDir = await mkdtemp(path.join(tmpdir(), 'reelforge smoke ż-'));
  await mkdir(screenshotDir, { recursive: true });
  app = await launchApp(userDataDir);
});

afterAll(async () => {
  await closeApp(app);
  await rm(userDataDir, { recursive: true, force: true });
});

describe('desktop app', () => {
  it('previews the demo scene in the sandboxed engine and scrubs', async () => {
    const page = await app.firstWindow();
    await page.locator('canvas.preview-canvas[data-rendered-t]').waitFor({
      timeout: FIRST_FRAME_TIMEOUT_MS,
    });
    const first = await frameStats(page);
    expect(first.renderedT).toBe('0.000');
    expect([first.width, first.height]).toEqual([640, 360]);
    expect(first.distinctColours).toBeGreaterThan(4);
    await page.screenshot({ path: path.join(screenshotDir, 'window-t0.png') });

    const slider = page.getByRole('slider', { name: 'Scrub' });
    await slider.focus();
    await page.keyboard.press('End');
    await waitForRenderedT(page, '5.000');
    const last = await frameStats(page);
    expect(last.distinctColours).toBeGreaterThan(4);
    expect(last.hash).not.toBe(first.hash);
    await page.screenshot({ path: path.join(screenshotDir, 'window-t5.png') });
  });

  it('exposes only the typed bridge to the page (no Node)', async () => {
    const page = await app.firstWindow();
    const exposed = await page.evaluate(() => {
      const api: unknown = Reflect.get(window, 'reelforge');
      return {
        api: typeof api === 'object' && api !== null ? Object.keys(api).sort() : [],
        process: typeof Reflect.get(globalThis, 'process'),
        require: typeof Reflect.get(globalThis, 'require'),
      };
    });
    expect(exposed).toEqual({
      api: [
        'approveScript',
        'armMicrophone',
        'browseToolPath',
        'cancelExport',
        'cancelExportJob',
        'cancelWhisperInstall',
        'closeProject',
        'copySnapshot',
        'copyText',
        'deleteWhisperModel',
        'editTimeline',
        'enqueueExport',
        'generateYoutubeMeta',
        'getAppInfo',
        'getBrief',
        'getChatState',
        'getClaudeStatus',
        'getCurrentProject',
        'getDemoManifest',
        'getExportOptions',
        'getExportQueue',
        'getProjectHistory',
        'getProjectManifest',
        'getProjectSnapshot',
        'getRecentProjects',
        'getScript',
        'getSettings',
        'getSoundState',
        'getStageReports',
        'getStagesState',
        'getToolsStatus',
        'getWaveform',
        'getWhisperState',
        'getYoutubeMeta',
        'importSounds',
        'importVoiceover',
        'installWhisper',
        'log',
        'newProject',
        'onChatChanged',
        'onExportProgress',
        'onExportQueueChanged',
        'onProjectChanged',
        'onProjectOpenFailed',
        'onStagesChanged',
        'onWhisperProgress',
        'openClaudeLogin',
        'openExampleProject',
        'openExportFolder',
        'openHelpTarget',
        'openProject',
        'openRecentProject',
        'openStageArtifact',
        'pickExportFolder',
        'previewSound',
        'removeQueuedChat',
        'renderMixPreview',
        'repairProjectFile',
        'replaceStage',
        'resetToolPath',
        'restoreFailedOpen',
        'resumeChat',
        'resumeChatTurn',
        'resumeExportJob',
        'resumeInterruptedExport',
        'retryWords',
        'revertProject',
        'runScenes',
        'runSound',
        'runStages',
        'saveBrief',
        'saveRecording',
        'saveScript',
        'saveSnapshot',
        'sendChat',
        'setMix',
        'startExport',
        'stopChat',
        'stopStage',
        'testEncoder',
        'updateSettings',
        'useExistingWhisper',
      ],
      process: 'undefined',
      require: 'undefined',
    });
    expect(page.url()).toBe('reelforge://app/index.html');
  });

  it('creates a project from the start screen and reverts it from the history drawer', async () => {
    const page = await app.firstWindow();
    await page.getByRole('region', { name: 'Start' }).waitFor();
    const parent = path.join(userDataDir, 'Moje projekty');
    await mkdir(parent);
    await stubFolderPicker(app, parent);
    await page.getByLabel('Video title').fill('Smoke ż test');
    await page.getByRole('button', { name: 'New project…' }).click();
    const badge = page.getByRole('button', { name: 'Saved locally · git history' });
    await badge.waitFor();
    const dir = path.join(parent, 'Smoke ż test');
    for (const file of ['.git', 'CLAUDE.md', 'project.json', '.gitignore']) {
      expect(existsSync(path.join(dir, file))).toBe(true);
    }
    const recent: unknown = JSON.parse(
      await readFile(path.join(userDataDir, 'recent-projects.json'), 'utf8'),
    );
    expect(recent).toMatchObject({ version: 1, projects: [{ dir, title: 'Smoke ż test' }] });

    await badge.click();
    const drawer = page.getByRole('complementary', { name: 'History' });
    await drawer.getByText('Create project "Smoke ż test"').waitFor();
    expect(await drawer.locator('.history-entry').count()).toBe(1);

    // A change committed outside the app; reverting to the first commit must remove it again.
    const scene = path.join(dir, 'scenes', 's01_intro.js');
    await writeFile(scene, ['// added by hand', ''].join('\n'));
    for (const args of [
      ['add', '--all'],
      ['commit', '-q', '-m', 'Add a scene by hand'],
    ]) {
      const git = spawnSync(
        'git',
        ['-C', dir, '-c', 'user.name=Smoke', '-c', 'user.email=smoke@local', ...args],
        { encoding: 'utf8' },
      );
      expect(git.status, git.stderr).toBe(0);
    }
    await page.getByRole('button', { name: 'Close', exact: true }).click();
    await badge.click();
    await drawer.getByText('Add a scene by hand').waitFor();
    await page.screenshot({ path: path.join(screenshotDir, 'history-drawer.png') });
    await drawer.getByRole('button', { name: 'Revert' }).click();
    const confirm = page.getByRole('alertdialog', { name: 'Revert project?' });
    await confirm.waitFor();
    await page.screenshot({ path: path.join(screenshotDir, 'revert-confirm.png') });
    await confirm.getByRole('button', { name: 'Revert' }).click();
    await drawer.getByText(/^Revert to [0-9a-f]{7}: Create project/).waitFor();
    expect(await drawer.locator('.history-entry').count()).toBe(3);
    expect(existsSync(scene)).toBe(false);
    await page.screenshot({ path: path.join(screenshotDir, 'history-after-revert.png') });
    await page.getByRole('button', { name: 'Close', exact: true }).click();
    // A fresh project has no storyboard: the preview falls back to the demo with a note.
    await page.getByRole('status').filter({ hasText: 'No storyboard yet' }).waitFor();
  });

  it('shows the open project in the main layout and follows the preview time', async () => {
    const page = await app.firstWindow();
    const dir = path.join(userDataDir, 'Fixture ż projekt');
    await cp(fixtureProject, dir, { recursive: true });
    await page.getByRole('button', { name: 'Close project' }).click();
    await page.getByRole('region', { name: 'Start' }).waitFor();
    await stubFolderPicker(app, dir);
    await page.getByRole('button', { name: 'Open project…' }).click();

    const shots = page.getByRole('region', { name: 'Shots' });
    const shotButtons = shots.locator('.shot-item');
    await shotButtons.first().waitFor();
    expect(await shotButtons.allTextContents()).toEqual([
      's010:00.00–0:02.20title-cardDoom runs on almost anything.scenes/s01_title.js',
      's020:02.20–0:07.50metaphor-objectA calculator with only 61 KB of memory still runs Doom.scenes/s02_calc.js',
    ]);
    await page
      .locator('canvas.preview-canvas[data-rendered-t]')
      .waitFor({ timeout: FIRST_FRAME_TIMEOUT_MS });
    expect(await page.locator('.preview-note').count()).toBe(0);
    const frame = await frameStats(page);
    expect([frame.width, frame.height]).toEqual([640, 360]);
    expect(frame.distinctColours).toBeGreaterThan(4);

    const pipeline = page.getByRole('region', { name: 'Pipeline' });
    for (const [label, status] of [
      ['Script written', 'Review'],
      ['Voiceover added', 'Waiting'],
      ['Storyboard', 'Done'],
      ['Video exported', 'Waiting'],
    ] as const) {
      expect(await pipeline.getByRole('button', { name: label }).textContent()).toBe(
        `${label}${status}`,
      );
    }
    const lanes = page.getByTestId('timeline-canvas');
    await page.waitForFunction(
      () =>
        document.querySelector<HTMLCanvasElement>('canvas.timeline-canvas')?.dataset['shots'] ===
        '2',
    );
    expect(await lanes.getAttribute('data-sfx')).toBe('1');

    await shotButtons.nth(1).click();
    await waitForRenderedT(page, '2.200');
    expect(await shotButtons.nth(1).getAttribute('aria-pressed')).toBe('true');
    await page.waitForFunction(
      () =>
        document.querySelector<HTMLCanvasElement>('canvas.timeline-canvas')?.dataset['playhead'] ===
        '2.200',
    );
    expect(await page.getByLabel('Current time').textContent()).toContain('0:02.20');

    for (const [width, height] of [
      [1280, 720],
      [1920, 1080],
    ] as const) {
      const layout = await layoutAt(page, width, height);
      for (const region of layout.regions) {
        expect(region, `${region.name} at ${String(width)}x${String(height)}`).toMatchObject({
          inside: true,
        });
        expect(region.width).toBeGreaterThan(100);
        expect(region.height).toBeGreaterThan(20);
      }
      expect(layout.overflowing, `overflowing at ${String(width)}x${String(height)}`).toEqual([]);
      expect(layout.canvasDeviceWidth % 640, `canvas ${String(layout.canvasDeviceWidth)} px`).toBe(
        0,
      );
      expect(layout.canvasDeviceWidth).toBeGreaterThanOrEqual(640);
      await page.screenshot({
        path: path.join(screenshotDir, `layout-${String(width)}x${String(height)}.png`),
      });
    }

    // An edit on disk (pipeline step, Claude turn, another editor) refreshes the panels.
    const storyboardFile = path.join(dir, 'storyboard.json');
    const edited = (await readFile(storyboardFile, 'utf8')).replace(
      'Doom runs on almost anything.',
      'Doom runs on a calculator, edited on disk.',
    );
    await writeFile(storyboardFile, edited);
    await shots
      .getByText('Doom runs on a calculator, edited on disk.')
      .waitFor({ timeout: 10_000 });
  });

  // Last: the page is left with a (blocked) pending navigation.
  it('denies new windows, navigation away and remote requests', async () => {
    const page = await app.firstWindow();
    const opened = await page.evaluate(() => window.open('https://example.com/') === null);
    expect(opened).toBe(true);
    await page.evaluate(() => {
      window.location.assign('https://example.com/');
    });
    await page.waitForTimeout(500);
    expect(page.url()).toBe('reelforge://app/index.html');
    expect(app.windows()).toHaveLength(1);
    const log = await readFile(logFile(userDataDir), 'utf8');
    expect(log).toContain('blocked window.open(https://example.com/)');
    expect(log).toContain('blocked navigation to https://example.com/');
  });
});
