/**
 * Pixel titles in the built app (PLAN.md#13.12, U13; `pnpm test:app` builds it first): the pixel
 * face loads from the app's own origin and draws the header name, panel and dialog titles; turning
 * Settings → Performance → "Pixel titles" off switches them to system text without moving the
 * layout (title boxes within 2 px), and the choice survives a relaunch. Screenshots at 1280x720,
 * on and off: out/test-app/pixel-titles-{on,off}-{workspace,project-settings,production-line}.png.
 */
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { ElectronApplication, Page } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { settingsFile } from '../src/main/app-paths.js';
import {
  closeApp,
  fixtureProject,
  launchApp,
  screenshotDir,
  stubFolderPicker,
} from './support/electron-app.js';
import { openStage } from './support/pipeline-rows.js';
import { projectMenu, projectMenuButton } from './support/project-menu.js';

type Mode = 'on' | 'off';
type Heights = Record<string, number>;

let app: ElectronApplication | undefined;
let page: Page;
let userDataDir: string;
let dir: string;

async function launch(): Promise<void> {
  await closeApp(app);
  app = await launchApp(userDataDir);
  await app.evaluate(({ BrowserWindow }) => {
    BrowserWindow.getAllWindows()[0]?.setContentSize(1280, 720);
  });
  page = await app.firstWindow();
  await page.waitForFunction(() => window.innerWidth === 1280 && window.innerHeight === 720);
  await page.getByRole('region', { name: 'Start' }).waitFor();
  await stubFolderPicker(app, dir);
  await page.getByRole('button', { name: 'Open project…' }).click();
  await projectMenuButton(page).waitFor({ timeout: 60_000 });
  await page.getByRole('region', { name: 'Pipeline' }).waitFor();
}

function titleFont(): Promise<string | null> {
  return page.evaluate(() => document.documentElement.getAttribute('data-title-font'));
}

/** Rounded box heights of the titles matched by `selector` (keyed `selector#index`). */
function heights(selector: string): Promise<Heights> {
  return page.evaluate((query) => {
    const result: Record<string, number> = {};
    document.querySelectorAll(query).forEach((element, index) => {
      result[`${query}#${String(index)}`] = element.getBoundingClientRect().height;
    });
    return result;
  }, selector);
}

async function shot(mode: Mode, name: string): Promise<void> {
  await page.screenshot({ path: path.join(screenshotDir, `pixel-titles-${mode}-${name}.png`) });
}

/** Opens the dialogs Papi judges, screenshots them, and returns their title heights. */
async function tour(mode: Mode): Promise<Heights> {
  const measured: Heights = {};
  // Export first: it selects its step, so both workspace screenshots show the same rows.
  await openStage(page, 'Video exported');
  const exportDialog = page.getByRole('dialog', { name: 'Export video' });
  await exportDialog.waitFor();
  Object.assign(measured, { exportVideo: (await heights('.modal-title'))['.modal-title#0'] });
  await page.keyboard.press('Escape');
  await exportDialog.waitFor({ state: 'detached' });
  Object.assign(measured, await heights('.app-title'), await heights('.panel-heading'));
  await shot(mode, 'workspace');

  await projectMenu(page, 'Project settings');
  const projectSettings = page.getByRole('dialog', { name: 'Project settings' });
  await projectSettings.getByRole('region', { name: 'Visuals' }).waitFor();
  Object.assign(measured, { projectSettings: (await heights('.modal-title'))['.modal-title#0'] });
  await shot(mode, 'project-settings');
  await page.keyboard.press('Escape');
  await projectSettings.waitFor({ state: 'detached' });

  await page.keyboard.press('Control+Shift+L');
  const line = page.getByRole('dialog', { name: 'Production line' });
  await line.waitFor();
  Object.assign(measured, { productionLine: (await heights('.modal-title'))['.modal-title#0'] });
  await shot(mode, 'production-line');
  await page.keyboard.press('Escape');
  await line.waitFor({ state: 'detached' });

  return measured;
}

async function openSettingsAppearance(): Promise<void> {
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Settings' });
  await dialog.getByRole('tab', { name: 'Performance' }).click();
  await dialog.getByRole('checkbox', { name: /^Pixel titles/ }).waitFor();
}

beforeAll(async () => {
  userDataDir = await mkdtemp(path.join(tmpdir(), 'reelforge pixel titles ż-'));
  dir = path.join(userDataDir, 'Tytuły pikselowe');
  await cp(fixtureProject, dir, { recursive: true });
  await mkdir(screenshotDir, { recursive: true });
  await writeFile(
    settingsFile(userDataDir),
    JSON.stringify({
      version: 1,
      onboarding: { connectClaudeDone: true, welcomeDone: true, tourDone: true },
    }),
  );
  await launch();
}, 120_000);

afterAll(async () => {
  await closeApp(app);
  await rm(userDataDir, { recursive: true, force: true, maxRetries: 5 });
});

describe('pixel titles', () => {
  it('loads the face, switches it off without moving titles, and keeps the choice', async () => {
    // On by default: the face is in use (loaded from the app, not a fallback).
    await expect.poll(titleFont).toBe('pixel');
    const face = await page.evaluate(async () => {
      await document.fonts.ready;
      const family = getComputedStyle(document.querySelector('.app-title') ?? document.body);
      return {
        family: family.fontFamily,
        loaded: [...document.fonts].some(
          (font) => font.family.includes('ReelForge Pixel') && font.status === 'loaded',
        ),
        check: document.fonts.check('10px "ReelForge Pixel"', 'PIPELINE'),
      };
    });
    expect(face).toMatchObject({ loaded: true, check: true });
    expect(face.family).toMatch(/^"?ReelForge Pixel"?,/);
    const on = await tour('on');

    await openSettingsAppearance();
    const settingsOn = (await heights('.modal-title'))['.modal-title#0'];
    const pixelTitles = page.getByRole('checkbox', { name: /^Pixel titles/ });
    expect(await pixelTitles.isChecked()).toBe(true);
    await pixelTitles.uncheck();
    await expect.poll(titleFont).toBe('system');
    const settingsOff = (await heights('.modal-title'))['.modal-title#0'];
    expect(Math.abs((settingsOn ?? 0) - (settingsOff ?? 99))).toBeLessThan(3);
    await page.keyboard.press('Escape');

    const off = await tour('off');
    expect(Object.keys(off).sort()).toEqual(Object.keys(on).sort());
    for (const [title, height] of Object.entries(on)) {
      expect(Math.abs(height - (off[title] ?? 99)), title).toBeLessThan(3);
    }

    // Settings round trip: saved, and applied again after a relaunch.
    await expect
      .poll(async () => {
        const saved = JSON.parse(await readFile(settingsFile(userDataDir), 'utf8')) as {
          ui?: unknown;
        };
        return saved.ui;
      })
      .toEqual({ pixelTitles: false });
    await launch();
    await expect.poll(titleFont).toBe('system');
    await openSettingsAppearance();
    expect(await page.getByRole('checkbox', { name: /^Pixel titles/ }).isChecked()).toBe(false);
  }, 240_000);
});
