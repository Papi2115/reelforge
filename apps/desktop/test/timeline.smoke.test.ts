/**
 * Timeline editor in the built app (PLAN.md#6.5, `pnpm test:app`): drags a shot boundary with
 * real pointer input (snaps to a word start, rewrites storyboard.json, commits), undoes it with
 * Ctrl+Z, seeks from the ruler, adds and deletes a sound; then opens a 10-minute project and checks
 * zoom density, waveform and draw time. Screenshots land in apps/desktop/out/test-app/.
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { cp, mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { ElectronApplication, Page } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  FIRST_FRAME_TIMEOUT_MS,
  fixtureProject,
  closeApp,
  launchApp,
  renderedTime,
  screenshotDir,
  stubFolderPicker,
} from './support/electron-app.js';
import { perfBar } from './support/ci-mode.js';
import { createLongProject, LONG_PROJECT } from './support/timeline-project.js';

/** Vertical centres of the lanes (CSS px from the canvas top; TRACK_ROWS in timeline-model.ts). */
const ROW_Y = { ruler: 10, shots: 34, narration: 60, cues: 83, audio: 109, ambience: 147 };
/** Longest timeline draw: one 60 Hz frame; the CI runner's 4 slow vCPUs get three. */
const DRAW_MS_BAR = perfBar(16, 50);

let app: ElectronApplication;
let page: Page;
let userDataDir: string;

interface Lanes {
  readonly left: number;
  readonly top: number;
  readonly pxPerSecond: number;
  readonly scrollX: number;
  readonly dataset: Record<string, string>;
}

async function lanes(): Promise<Lanes> {
  return page.evaluate(() => {
    const canvas = document.querySelector<HTMLCanvasElement>('canvas.timeline-canvas');
    if (!canvas) throw new Error('timeline canvas missing');
    const rect = canvas.getBoundingClientRect();
    const dataset: Record<string, string> = {};
    for (const [key, value] of Object.entries(canvas.dataset)) {
      if (value !== undefined) dataset[key] = value;
    }
    return {
      left: rect.left,
      top: rect.top,
      pxPerSecond: Number(dataset['pxPerSecond']),
      scrollX: Number(dataset['scrollX']),
      dataset,
    };
  });
}

function xAt(geometry: Lanes, t: number): number {
  return geometry.left + t * geometry.pxPerSecond - geometry.scrollX;
}

async function waitForLanes(key: string, value: string): Promise<void> {
  await page.waitForFunction(
    ([name, expected]) =>
      document.querySelector<HTMLCanvasElement>('canvas.timeline-canvas')?.dataset[name ?? ''] ===
      expected,
    [key, value],
    { timeout: FIRST_FRAME_TIMEOUT_MS },
  );
}

async function openProject(dir: string): Promise<void> {
  const close = page.getByRole('button', { name: 'Close project' });
  if (await close.isVisible()) {
    await close.click();
    await page.getByRole('region', { name: 'Start' }).waitFor();
  }
  await stubFolderPicker(app, dir);
  await page.getByRole('button', { name: 'Open project…' }).click();
}

async function resize(width: number, height: number): Promise<void> {
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
  await page.waitForTimeout(300);
}

async function json(file: string): Promise<unknown> {
  return JSON.parse(await readFile(file, 'utf8'));
}

function lastCommit(dir: string): string {
  const git = spawnSync('git', ['-C', dir, 'log', '-1', '--format=%s'], { encoding: 'utf8' });
  return git.stdout.trim();
}

/** Subject of the newest commit, waiting for `expected` (the commit follows the file write). */
function commitSubject(dir: string, expected: string): Promise<string> {
  return poll(
    () => Promise.resolve(lastCommit(dir)),
    (subject) => subject === expected,
  );
}

async function poll<T>(read: () => Promise<T>, done: (value: T) => boolean): Promise<T> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const value = await read();
    if (done(value)) return value;
    await page.waitForTimeout(100);
  }
  return read();
}

beforeAll(async () => {
  userDataDir = await mkdtemp(path.join(tmpdir(), 'reelforge timeline ż-'));
  app = await launchApp(userDataDir);
  page = await app.firstWindow();
  await resize(1280, 720);
});

afterAll(async () => {
  await closeApp(app);
  await rm(userDataDir, { recursive: true, force: true, maxRetries: 5 });
});

describe('timeline editor', () => {
  it('drags a shot boundary onto a word start, commits it, undoes it and seeks', async () => {
    const dir = path.join(userDataDir, 'Fixture ż projekt');
    await cp(fixtureProject, dir, { recursive: true });
    await openProject(dir);
    await waitForLanes('shots', '2');
    await page.locator('canvas.preview-canvas[data-rendered-t]').waitFor({
      timeout: FIRST_FRAME_TIMEOUT_MS,
    });
    const geometry = await lanes();
    const y = geometry.top + ROW_Y.shots;

    // Drop 60 ms after the word "only" starts (3.30 s): the boundary snaps onto it.
    await page.mouse.move(xAt(geometry, 2.2), y);
    await page.mouse.down();
    await page.mouse.move(xAt(geometry, 2.8), y, { steps: 4 });
    await page.mouse.move(xAt(geometry, 3.36), y, { steps: 4 });
    await page.screenshot({ path: path.join(screenshotDir, 'timeline-drag.png') });
    await page.mouse.up();

    const storyboardFile = path.join(dir, 'storyboard.json');
    const moved = await poll(
      () => json(storyboardFile),
      (value) => JSON.stringify(value).includes('"t1":3.3'),
    );
    expect(moved).toMatchObject({
      shots: [
        { id: 's01', t1: 3.3 },
        { id: 's02', t0: 3.3 },
      ],
    });
    const words = (await json(path.join(dir, 'timing', 'words.json'))) as {
      words: { text: string; t: number }[];
    };
    expect(words.words.find((word) => word.t === 3.3)?.text).toBe('only');
    expect(await commitSubject(dir, 'Move boundary s01/s02 to 3.30 s')).toBe(
      'Move boundary s01/s02 to 3.30 s',
    );
    await page.getByRole('status').filter({ hasText: 'Move boundary s01/s02' }).waitFor();

    await page.getByTestId('timeline-canvas').focus();
    await page.keyboard.press('Control+z');
    await poll(
      () => json(storyboardFile),
      (value) => JSON.stringify(value).includes('"t1":2.2'),
    );
    expect(await commitSubject(dir, 'Undo: Move boundary s01/s02 to 2.20 s')).toBe(
      'Undo: Move boundary s01/s02 to 2.20 s',
    );

    // Clicking the ruler moves the player.
    await page.mouse.click(xAt(geometry, 5), geometry.top + ROW_Y.ruler);
    await page.waitForFunction(
      () =>
        Math.abs(
          Number(
            document.querySelector<HTMLCanvasElement>('canvas.preview-canvas')?.dataset[
              'renderedT'
            ],
          ) - 5,
        ) < 0.05,
    );
    expect(Math.abs((await renderedTime(page)) - 5)).toBeLessThan(0.05);
  });

  it('adds a sound by double-clicking the Cues track and deletes it with Delete', async () => {
    const geometry = await lanes();
    const dir = path.join(userDataDir, 'Fixture ż projekt');
    await page.mouse.dblclick(xAt(geometry, 6), geometry.top + ROW_Y.cues);
    const picker = page.getByRole('dialog', { name: 'Add a sound effect' });
    await picker.waitFor();
    await page.screenshot({ path: path.join(screenshotDir, 'timeline-sfx-picker.png') });
    await picker.getByRole('button', { name: 'whoosh', exact: true }).click();
    await waitForLanes('sfx', '2');
    const cuesFile = path.join(dir, 'cues.json');
    const added = await poll(
      () => json(cuesFile),
      (value) => JSON.stringify(value).includes('whoosh'),
    );
    expect(added).toMatchObject({ sfx: [{ name: 'hit' }, { name: 'whoosh' }] });
    expect(await commitSubject(dir, 'Add sfx cue whoosh')).toBe('Add sfx cue whoosh');

    const sfx = (added as { sfx: { t: number }[] }).sfx[1]?.t ?? 0;
    expect(Math.abs(sfx - 6)).toBeLessThan(0.16);
    await page.mouse.click(xAt(geometry, sfx), geometry.top + ROW_Y.cues);
    await page.keyboard.press('Delete');
    await waitForLanes('sfx', '1');
    await poll(
      () => json(cuesFile),
      (value) => !JSON.stringify(value).includes('whoosh'),
    );
    expect(await commitSubject(dir, 'Delete sfx cue whoosh')).toBe('Delete sfx cue whoosh');
  });

  it('keeps a 10-minute project smooth: zoom density, waveform, draw time', async () => {
    const dir = path.join(userDataDir, 'Długi projekt');
    await createLongProject(fixtureProject, dir);
    await openProject(dir);
    await waitForLanes('shots', String(LONG_PROJECT.shots));
    await page.getByRole('button', { name: 'Fit to project' }).click();
    await waitForLanes('narration', 'sentences');
    await waitForLanes('waveform', 'ok');
    await page
      .locator('canvas.preview-canvas[data-rendered-t]')
      .waitFor({ timeout: FIRST_FRAME_TIMEOUT_MS });
    expect(await page.locator('.preview-note').count()).toBe(0);
    expect(
      (await readdir(path.join(dir, '.reelforge', 'cache'))).some((file) =>
        file.startsWith('peaks-'),
      ),
    ).toBe(true);
    const fit = await lanes();
    await page.screenshot({ path: path.join(screenshotDir, 'timeline-long-fit-1280x720.png') });

    // Ctrl+wheel zooms in around the pointer: words appear, fewer items are drawn.
    await page.mouse.move(fit.left + 300, fit.top + ROW_Y.narration);
    await page.keyboard.down('Control');
    for (let step = 0; step < 12; step += 1) await page.mouse.wheel(0, -240);
    await page.keyboard.up('Control');
    await waitForLanes('narration', 'words');
    const zoomed = await lanes();
    expect(zoomed.pxPerSecond).toBeGreaterThan(fit.pxPerSecond * 20);
    expect(Number(zoomed.dataset['items'])).toBeLessThan(Number(fit.dataset['items']));

    // Plain wheel scrolls horizontally.
    for (let step = 0; step < 20; step += 1) await page.mouse.wheel(0, 200);
    await page.waitForFunction(
      (before) =>
        Number(
          document.querySelector<HTMLCanvasElement>('canvas.timeline-canvas')?.dataset['scrollX'],
        ) >
        before + 1000,
      zoomed.scrollX,
    );
    const scrolled = await lanes();
    expect(Number(scrolled.dataset['drawMaxMs'])).toBeLessThan(DRAW_MS_BAR);
    await page.screenshot({ path: path.join(screenshotDir, 'timeline-long-zoomed-1280x720.png') });

    await resize(1920, 1080);
    await page.getByRole('button', { name: 'Fit to project' }).click();
    await page.screenshot({ path: path.join(screenshotDir, 'timeline-long-fit-1920x1080.png') });
    await page.getByRole('button', { name: 'Zoom in' }).click();
    await page.getByRole('button', { name: 'Zoom in' }).click();
    expect((await lanes()).pxPerSecond).toBeGreaterThan(fit.pxPerSecond);
    await page.screenshot({ path: path.join(screenshotDir, 'timeline-long-zoom-1920x1080.png') });

    // The Tracks menu hides rows (PLAN.md#11.2); the choice is kept.
    await page.getByRole('button', { name: /^Tracks/ }).click();
    await page.getByRole('checkbox', { name: 'Narration' }).uncheck();
    await page.getByRole('checkbox', { name: 'Cards' }).uncheck();
    await waitForLanes('tracks', 'ruler,shots,cues,audio,ambience');
    await page.screenshot({ path: path.join(screenshotDir, 'timeline-tracks-1920x1080.png') });
    await page.getByRole('checkbox', { name: 'Narration' }).check();
    await page.getByRole('checkbox', { name: 'Cards' }).check();
    await page.keyboard.press('Escape');
    await waitForLanes('tracks', 'ruler,shots,narration,cues,audio,cards,ambience');
    expect(existsSync(path.join(dir, '.git'))).toBe(true);
  });
});
