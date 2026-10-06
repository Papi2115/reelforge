/**
 * Live co-direction in the built app (`pnpm test:app`, PLAN.md#12.14) on the CLI fixture project:
 * `/` focuses the command bar under the preview; "darker" and "arrow on the word doom" change shot
 * s01 at once (directions.json written, each command committed with step `direction`, the frame
 * on screen changes without a shot reload), the Shots panel shows the "directions" chip, the
 * bar's "History (2)" opens the Director tab on its Directions section (the session list, Undo /
 * Redo there), typed undo reverts the last command, and a locked shot is refused with "Unlock this
 * shot". No Claude.
 * Screenshot at 1280x720: out/test-app/direction-1280.png.
 */
import { spawnSync } from 'node:child_process';
import { cp, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { ElectronApplication, Locator, Page } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  closeApp,
  fixtureProject,
  launchApp,
  screenshotDir,
  stubFolderPicker,
  waitForProjectPreview,
} from './support/electron-app.js';
import { showChat } from './support/pipeline-rows.js';

let app: ElectronApplication | undefined;
let page: Page;
let userDataDir: string;
let dir: string;

interface DirectionsOnDisk {
  readonly shots: Readonly<
    Record<string, { readonly dim?: number; readonly overlays?: unknown[] }>
  >;
}

function git(args: readonly string[]): string {
  const run = spawnSync('git', ['-C', dir, ...args], { encoding: 'utf8' });
  return run.stdout.trim();
}

async function directions(): Promise<DirectionsOnDisk> {
  return JSON.parse(await readFile(path.join(dir, 'directions.json'), 'utf8')) as DirectionsOnDisk;
}

function bar(): Locator {
  return page.getByRole('region', { name: 'Direct the shot' });
}

/** Pixels of the preview canvas as a short fingerprint. */
function canvasPixels(): Promise<string> {
  return page.evaluate(() => {
    const canvas = document.querySelector<HTMLCanvasElement>('canvas.preview-canvas');
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return '';
    const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let hash = 0;
    for (let index = 0; index < data.length; index += 97)
      hash = (hash * 31 + (data[index] ?? 0)) | 0;
    return String(hash);
  });
}

async function command(text: string): Promise<void> {
  await page.keyboard.press('/');
  const input = bar().getByRole('textbox', { name: 'Direction command' });
  await expect
    .poll(() => input.evaluate((element) => element === document.activeElement))
    .toBe(true);
  await input.fill(text);
  await input.press('Enter');
}

beforeAll(async () => {
  userDataDir = await mkdtemp(path.join(tmpdir(), 'reelforge direction ż-'));
  dir = path.join(userDataDir, 'Projekt ż reżyseria');
  await cp(fixtureProject, dir, { recursive: true });
  app = await launchApp(userDataDir);
  await app.evaluate(({ BrowserWindow }) => {
    BrowserWindow.getAllWindows()[0]?.setContentSize(1280, 720);
  });
  page = await app.firstWindow();
  await page.waitForFunction(() => window.innerWidth === 1280 && window.innerHeight === 720);
});

afterAll(async () => {
  await closeApp(app);
  await rm(userDataDir, { recursive: true, force: true, maxRetries: 5 });
});

describe('live co-direction', () => {
  it('directs the shot under the playhead, commits each command, undoes, refuses a locked shot', async () => {
    if (app === undefined) throw new Error('the app is not running');
    await stubFolderPicker(app, dir);
    await page.getByRole('button', { name: 'Open project…' }).click();
    await waitForProjectPreview(page);
    const before = await canvasPixels();

    await command('darker');
    await bar()
      .getByText(/^Darker: tone -0\.25/)
      .waitFor({ timeout: 15_000 });
    await expect
      .poll(() => git(['log', '-1', '--format=%s']), { timeout: 15_000 })
      .toBe('Direction s01: darker');
    expect(git(['log', '-1', '--format=%(trailers:key=ReelForge-Step,valueonly)'])).toBe(
      'direction',
    );
    expect((await directions()).shots['s01']?.dim).toBe(-0.25);
    await expect.poll(() => canvasPixels(), { timeout: 5_000 }).not.toBe(before);
    // Swapped in, not rebuilt: no "Reloaded s01" notice.
    expect(await page.getByText(/^Reloaded s01/).count()).toBe(0);

    await command('arrow on the word doom');
    await bar()
      .getByText(/^Arrow on "Doom"/)
      .waitFor({ timeout: 15_000 });
    expect((await directions()).shots['s01']?.overlays).toHaveLength(1);
    // The "directions" chip; one-line (compact) rows show a dot named "directions" instead.
    const shotsPanel = page.getByRole('region', { name: 'Shots' });
    await shotsPanel
      .getByText('directions', { exact: true })
      .or(shotsPanel.getByRole('img', { name: 'directions', exact: true }))
      .waitFor();
    await page.screenshot({ path: path.join(screenshotDir, 'direction-1280.png') });

    // The session history lives in the Director: Undo / Redo there, typed undo in the bar.
    await bar().getByRole('button', { name: 'History (2)' }).click();
    await page.getByRole('tab', { name: 'Director', selected: true }).waitFor();
    const history = page.getByRole('region', { name: 'Directions', exact: true });
    const rows = history
      .getByRole('list', { name: 'Directions this session' })
      .getByRole('listitem');
    await expect.poll(() => rows.count()).toBe(2);
    expect(await rows.first().textContent()).toContain('arrow on the word doom');
    await history.getByRole('button', { name: 'Undo' }).click();
    await bar()
      .getByText(/^Undid "arrow on the word doom"/)
      .waitFor({ timeout: 15_000 });
    expect((await directions()).shots['s01']?.overlays).toBeUndefined();
    await history.getByRole('button', { name: 'Redo' }).click();
    await bar()
      .getByText(/^Arrow on "Doom"/)
      .waitFor({ timeout: 15_000 });
    expect((await directions()).shots['s01']?.overlays).toHaveLength(1);
    await page.screenshot({ path: path.join(screenshotDir, 'direction-1280-director.png') });
    // Back to Chat: the column stays open, the bar keeps working.
    await (await showChat(page)).getByRole('tab', { name: 'Chat' }).click();

    await command('cofnij');
    await bar()
      .getByText(/^Undid "arrow on the word doom"/)
      .waitFor({ timeout: 15_000 });
    expect((await directions()).shots['s01']?.overlays).toBeUndefined();

    await page.getByRole('button', { name: 'Lock s01' }).click();
    await expect
      .poll(() => git(['log', '-1', '--format=%s']), { timeout: 15_000 })
      .toBe('Lock shot s01');
    await command('slower');
    await bar().getByText('s01 is locked: unlock this shot to direct it').waitFor();
    await bar().getByRole('button', { name: 'Unlock this shot' }).waitFor();
    expect((await directions()).shots['s01']).toEqual({ dim: -0.25 });

    await command('make it a terminal');
    await bar().getByRole('alert').waitFor();
  });
});
