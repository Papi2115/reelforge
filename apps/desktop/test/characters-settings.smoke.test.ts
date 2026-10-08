/**
 * Characters and mascot in the built app (`pnpm test:app`, PLAN.md#12.20): Project settings on the
 * CLI fixture project (no `characters` / `mascot` = classic, no mascot) shows the mascot cards
 * disabled with their explanation; choosing "Pack style (new)" and then Fox (click, then arrow keys)
 * writes project.json and commits each change; the preview sheet loads; the choices persist when
 * the dialog and the project are opened again. No Claude involved. Screenshot at 1280x720:
 * out/test-app/characters-settings-1280.png.
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
} from './support/electron-app.js';
import { projectMenu, projectMenuButton, projectSettingsTab } from './support/project-menu.js';

let app: ElectronApplication | undefined;
let page: Page;
let userDataDir: string;
let dir: string;

function git(args: readonly string[]): string {
  const run = spawnSync('git', ['-C', dir, ...args], { encoding: 'utf8' });
  return run.stdout.trim();
}

async function projectJson(): Promise<Record<string, unknown>> {
  const raw: unknown = JSON.parse(await readFile(path.join(dir, 'project.json'), 'utf8'));
  if (typeof raw !== 'object' || raw === null) throw new Error('project.json is not an object');
  return raw as Record<string, unknown>;
}

async function expectCommit(subject: string): Promise<void> {
  await expect.poll(() => git(['log', '-1', '--format=%s']), { timeout: 15_000 }).toBe(subject);
  expect(git(['log', '-1', '--format=%(trailers:key=ReelForge-Step,valueonly)'])).toBe(
    'project-settings',
  );
}

async function openProject(): Promise<void> {
  if (app === undefined) throw new Error('the app is not running');
  await stubFolderPicker(app, dir);
  await page.getByRole('button', { name: 'Open project…' }).click();
  await projectMenuButton(page).waitFor({ timeout: 30_000 });
}

async function openDialog(): Promise<Locator> {
  await projectMenu(page, 'Project settings');
  const dialog = page.getByRole('dialog', { name: 'Project settings' });
  await projectSettingsTab(dialog, 'Characters');
  await dialog.getByRole('region', { name: 'Characters' }).waitFor();
  return dialog;
}

const people = (dialog: Locator, name: RegExp): Locator =>
  dialog.getByRole('region', { name: 'Characters' }).getByRole('radio', { name });

const mascot = (dialog: Locator, name: RegExp): Locator =>
  dialog.getByRole('region', { name: 'Mascot' }).getByRole('radio', { name });

/** The mascot preview sheet loads (a 640x360 PNG) and the Fox card shows a crop of it. */
async function expectPreviews(): Promise<void> {
  const loaded = await page.evaluate(async () => {
    const preview = document.querySelector<HTMLElement>(
      '.mascot-preview:not(.mascot-preview-none)',
    );
    const url = /url\("?([^")]+)"?\)/.exec(preview?.style.backgroundImage ?? '')?.[1];
    if (preview === null || url === undefined) return { width: 0, height: 0, box: 0 };
    const image = new Image();
    image.src = url;
    await image.decode();
    const box = preview.getBoundingClientRect();
    return { width: image.naturalWidth, height: image.naturalHeight, box: Math.round(box.height) };
  });
  expect(loaded).toEqual({ width: 640, height: 360, box: 158 });
}

beforeAll(async () => {
  userDataDir = await mkdtemp(path.join(tmpdir(), 'reelforge characters ż-'));
  dir = path.join(userDataDir, 'Projekt ż maskotka');
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

describe('characters and mascot settings', () => {
  it('chooses the pack and Fox, saves and commits them', async () => {
    await openProject();
    const dialog = await openDialog();
    // The fixture predates 2.3.5: no fields = the classic hero, mascots off.
    expect(await people(dialog, /^Classic \(hoodie guy\)/).isChecked()).toBe(true);
    expect(await mascot(dialog, /^No mascot/).isChecked()).toBe(true);
    expect(await mascot(dialog, /^Fox/).isDisabled()).toBe(true);
    await dialog.getByText('Mascots belong to the character pack').waitFor();

    await people(dialog, /^Pack style \(new\)/).click();
    await expectCommit('Project settings: characters pack style');
    expect(await mascot(dialog, /^Fox/).isDisabled()).toBe(false);
    expect(await dialog.getByText('Mascots belong to the character pack').count()).toBe(0);

    await mascot(dialog, /^Fox/).click();
    await expectCommit('Project settings: mascot Fox');
    expect(await projectJson()).toMatchObject({ characters: 'pack', mascot: 'fox' });
    await expectPreviews();
    const fox = dialog.getByRole('region', { name: 'Mascot' }).locator('.mascot-card', {
      hasText: 'Fox',
    });
    await fox.scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(screenshotDir, 'characters-settings-1280.png') });

    // Keyboard: the cards are one radio group; arrows move the choice (Left/Right seek the player).
    await mascot(dialog, /^Fox/).focus();
    await page.keyboard.press('ArrowDown');
    await expectCommit('Project settings: mascot Bean');
    await page.keyboard.press('ArrowUp');
    await expectCommit('Project settings: mascot Fox');
    await page.keyboard.press('Escape');
    await dialog.waitFor({ state: 'detached' });
    expect(await projectJson()).toMatchObject({
      title: 'Doom on a calculator',
      characters: 'pack',
      mascot: 'fox',
    });
  });

  it('keeps the choices when the dialog and the project are opened again', async () => {
    await projectMenu(page, 'Close project');
    await page.getByRole('region', { name: 'Start' }).waitFor();
    await openProject();
    const dialog = await openDialog();
    expect(await people(dialog, /^Pack style \(new\)/).isChecked()).toBe(true);
    expect(await mascot(dialog, /^Fox/).isChecked()).toBe(true);
    // Back to classic: the cards are disabled, the stored Fox stays.
    await people(dialog, /^Classic \(hoodie guy\)/).click();
    await expectCommit('Project settings: characters classic');
    expect(await mascot(dialog, /^Fox/).isDisabled()).toBe(true);
    expect(await projectJson()).toMatchObject({ characters: 'classic', mascot: 'fox' });
    await page.keyboard.press('Escape');
    await dialog.waitFor({ state: 'detached' });
  });
});
