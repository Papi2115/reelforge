/**
 * Worlds smoke test of the built app (`pnpm test:app`, PLAN.md#13.6): Settings → Projects →
 * "Experimental worlds (preview)" is saved and rewrites the `reelforge` launchers with
 * REELFORGE_EXPERIMENTAL_WORLDS=1; the New project form then offers Sketchbook (tagged preview)
 * and creates a Sketchbook project with the world's defaults; the header names the world and
 * Project settings shows the read-only style and the world's looks instead of look mode,
 * characters and mascot. Claude is fake-claude (no turn runs; never the real CLI). Screenshots at
 * 1280x720: out/test-app/worlds-*.png.
 */
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fakeClaudeBinPath } from '@reelforge/fake-claude';
import type { ElectronApplication, Page } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  CLAUDE_SEARCH_DIR_ENV,
  cliShimDir,
  settingsFile,
  TEST_CLAUDE_LAUNCHER_ENV,
} from '../src/main/app-paths.js';
import { closeApp, launchApp, screenshotDir, stubFolderPicker } from './support/electron-app.js';
import { projectMenu, projectMenuButton, projectSettingsTab } from './support/project-menu.js';

let app: ElectronApplication | undefined;
let page: Page;
let userDataDir: string;
let dir: string;

async function jsonFile(file: string): Promise<Record<string, unknown>> {
  const raw: unknown = JSON.parse(await readFile(file, 'utf8'));
  if (typeof raw !== 'object' || raw === null) throw new Error(`${file} is not an object`);
  return raw as Record<string, unknown>;
}

async function shimText(): Promise<string> {
  const file = path.join(cliShimDir(userDataDir), 'reelforge');
  return existsSync(file) ? readFile(file, 'utf8') : '';
}

beforeAll(async () => {
  userDataDir = await mkdtemp(path.join(tmpdir(), 'reelforge worlds ż-'));
  const noClaudeDir = path.join(userDataDir, 'no claude');
  await mkdir(noClaudeDir);
  await mkdir(screenshotDir, { recursive: true });
  app = await launchApp(userDataDir, {
    env: {
      [CLAUDE_SEARCH_DIR_ENV]: noClaudeDir,
      [TEST_CLAUDE_LAUNCHER_ENV]: JSON.stringify({
        command: process.execPath,
        args: [fakeClaudeBinPath],
      }),
    },
  });
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

describe('experimental worlds', () => {
  it('offers no world until Settings turns the switch on', async () => {
    const start = page.getByRole('region', { name: 'Start' });
    const styles = start.getByRole('group', { name: 'Style' });
    await styles.getByRole('radio', { name: /^Voxel Pixel · Crisp 640/ }).waitFor();
    expect(await styles.getByRole('radio').count()).toBe(3);
    expect(await styles.getByRole('radio', { name: /^Voxel Pixel · Crisp 640/ }).isChecked()).toBe(
      true,
    );

    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Settings' });
    await dialog.getByRole('tab', { name: 'Projects' }).click();
    const worlds = dialog.getByRole('checkbox', { name: /^Experimental worlds \(preview\)/ });
    expect(await worlds.isChecked()).toBe(false);
    await dialog.getByText('Preview worlds are unfinished and may change.').waitFor();
    await worlds.check();
    await expect
      .poll(async () => (await jsonFile(settingsFile(userDataDir)))['experimental'])
      .toEqual({ worlds: true });
    // The `reelforge` launchers of Claude's turns carry the switch (only this one app var).
    await expect.poll(shimText, { timeout: 15_000 }).toContain('REELFORGE_EXPERIMENTAL_WORLDS="1"');
    await worlds.scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(screenshotDir, 'worlds-settings-1280.png') });
    await page.keyboard.press('Escape');
    await dialog.waitFor({ state: 'detached' });
  });

  it('creates a Sketchbook project with the world defaults', async () => {
    if (app === undefined) throw new Error('the app is not running');
    const start = page.getByRole('region', { name: 'Start' });
    const styles = start.getByRole('group', { name: 'Style' });
    const sketchbook = styles.getByRole('radio', { name: /^Sketchbook\s*preview/ });
    await sketchbook.waitFor();
    expect(await styles.getByRole('radio').count()).toBe(7);
    await start.getByLabel('Video title').fill('Leap years');
    await sketchbook.check();
    await styles.getByText('Hand-drawn notebook: felt-tip pages, graph paper').waitFor();
    await styles.scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(screenshotDir, 'worlds-new-project-1280.png') });

    const parent = path.join(userDataDir, 'Projekty');
    await mkdir(parent);
    dir = path.join(parent, 'Leap years');
    await stubFolderPicker(app, parent);
    await start.getByRole('button', { name: 'New project…' }).click();
    await projectMenuButton(page).waitFor({ timeout: 30_000 });
    expect(await jsonFile(path.join(dir, 'project.json'))).toMatchObject({
      title: 'Leap years',
      style: 'sketchbook',
      lookMode: 'mixed',
      continuityLinks: true,
      characters: 'classic',
      mascot: 'none',
    });
    await page.getByText('EN · Sketchbook · 30 fps').waitFor();
  });

  it("shows the world's style and looks in Project settings", async () => {
    await projectMenu(page, 'Project settings');
    const dialog = page.getByRole('dialog', { name: 'Project settings' });
    const visuals = dialog.getByRole('region', { name: 'Visuals' });
    await visuals.getByText('Hand-drawn notebook: felt-tip pages, graph paper').waitFor();
    const looks = visuals.getByRole('list', { name: 'Looks of this world' });
    await looks.getByText('A · Sketch story').waitFor();
    expect(await looks.getByRole('listitem').count()).toBe(3);
    expect(await dialog.getByRole('radio', { name: /^Voxel only/ }).count()).toBe(0);
    await page.screenshot({ path: path.join(screenshotDir, 'worlds-project-settings-1280.png') });
    await projectSettingsTab(dialog, 'Characters');
    await dialog.getByText('Sketchbook draws its own heroes: no mascot appears').waitFor();
    expect(await dialog.getByRole('radio', { name: /^Pack style/ }).count()).toBe(0);
    await page.keyboard.press('Escape');
    await dialog.waitFor({ state: 'detached' });
  });
});
