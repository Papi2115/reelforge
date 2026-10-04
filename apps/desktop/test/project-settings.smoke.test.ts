/**
 * Project settings in the built app (`pnpm test:app`): the header's "Project settings" opens the
 * dialog on the CLI fixture project (no lookMode / ambientVariation = voxel only, off); changing
 * the look mode (click and arrow keys) and ambient variation writes project.json and commits it
 * (`Project settings: …`); research assets (2.1: no researchMode = Off) shows the full-auto ⚠
 * warning and the allowlist sources; the choices persist when the dialog and the project are
 * opened again. No Claude involved. Screenshots at 1280x720: out/test-app/project-settings-*.png.
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

/** Waits until the newest commit has `subject` (the commit follows the file write). */
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
  await page.getByRole('button', { name: 'Project settings' }).waitFor({ timeout: 30_000 });
}

async function openDialog(): Promise<Locator> {
  await page.getByRole('button', { name: 'Project settings' }).click();
  const dialog = page.getByRole('dialog', { name: 'Project settings' });
  await dialog.getByRole('region', { name: 'Visuals' }).waitFor();
  return dialog;
}

function voxelOnly(dialog: Locator): Locator {
  return dialog.getByRole('radio', { name: /^Voxel only — the classic look/ });
}

function mixed(dialog: Locator): Locator {
  return dialog.getByRole('radio', { name: /^Mixed looks — voxel \+ / });
}

function research(dialog: Locator, name: RegExp): Locator {
  return dialog.getByRole('radio', { name });
}

function ambient(dialog: Locator): Locator {
  return dialog.getByRole('checkbox', { name: /^Vary backgrounds subtly between shots/ });
}

/** The dialog fits the window and nothing inside it is cut off horizontally. */
async function expectFits(): Promise<void> {
  const report = await page.evaluate(() => {
    const dialog = document.querySelector('[role="dialog"][aria-label="Project settings"]');
    const rect = dialog?.getBoundingClientRect();
    const clipped = [...(dialog?.querySelectorAll('*') ?? [])].filter(
      (element) =>
        element.scrollWidth > element.clientWidth + 1 &&
        getComputedStyle(element).overflowX !== 'hidden',
    ).length;
    return {
      inside:
        rect !== undefined &&
        rect.left >= 0 &&
        rect.top >= 0 &&
        rect.right <= window.innerWidth &&
        rect.bottom <= window.innerHeight,
      clipped,
    };
  });
  expect(report).toEqual({ inside: true, clipped: 0 });
}

beforeAll(async () => {
  userDataDir = await mkdtemp(path.join(tmpdir(), 'reelforge project settings ż-'));
  dir = path.join(userDataDir, 'Projekt ż ustawienia');
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

describe('project settings', () => {
  it('changes look mode and ambient variation, saves and commits them', async () => {
    await openProject();
    const dialog = await openDialog();
    // The fixture predates 2.0: no fields = voxel only, no ambient variation.
    expect(await voxelOnly(dialog).isChecked()).toBe(true);
    expect(await mixed(dialog).isChecked()).toBe(false);
    expect(await ambient(dialog).isChecked()).toBe(false);
    const looks = dialog.getByRole('list', { name: 'Available looks' });
    await looks.getByText('Voxel 3D', { exact: true }).waitFor();
    expect(await looks.getByRole('listitem').count()).toBeGreaterThanOrEqual(2);
    await dialog.getByText('Applies to the next Storyboard and Scenes build.').first().waitFor();
    // Research (2.1): no researchMode in the fixture = Off. Reserved sections are not rendered.
    await dialog.getByRole('region', { name: 'Research' }).waitFor();
    expect(await research(dialog, /^Off/).isChecked()).toBe(true);
    // Direction (2.2): the tension map, off without the field (tension.smoke.test.ts turns it on).
    const direction = dialog.getByRole('region', { name: 'Direction' });
    await direction.waitFor();
    expect(
      await direction
        .getByRole('checkbox', { name: /^Steer the film by a tension curve/ })
        .isChecked(),
    ).toBe(false);
    expect(await dialog.getByRole('region', { name: 'Taste' }).count()).toBe(0);

    await mixed(dialog).click();
    await expectCommit('Project settings: look mode mixed looks');
    expect(await projectJson()).toMatchObject({ lookMode: 'mixed' });
    expect(await projectJson()).not.toHaveProperty('ambientVariation');

    await ambient(dialog).check();
    await expectCommit('Project settings: ambient variation on');
    expect(await projectJson()).toMatchObject({ lookMode: 'mixed', ambientVariation: true });
    await expectFits();
    await page.screenshot({ path: path.join(screenshotDir, 'project-settings-1280.png') });

    // Research assets: full auto shows the red licence warning; the allowlist its sources.
    await research(dialog, /^Full auto/).click();
    await expectCommit('Project settings: research assets full auto (unverified licences)');
    expect(await dialog.getByRole('alert').textContent()).toContain(
      'You are responsible for checking every licence',
    );
    await research(dialog, /^Automatic from selected sources/).click();
    await expectCommit(
      'Project settings: research assets auto from selected sources, research sources wikimedia, nasa',
    );
    const sources = dialog.getByRole('group', { name: 'Sources Claude may download from' });
    expect(await sources.getByRole('checkbox', { name: /^Wikimedia Commons/ }).isChecked()).toBe(
      true,
    );
    expect(await sources.getByRole('checkbox', { name: /^Library of Congress/ }).isChecked()).toBe(
      false,
    );
    await expectFits();
    await page.screenshot({ path: path.join(screenshotDir, 'project-settings-research-1280.png') });
    await research(dialog, /^Off/).click();
    await expectCommit('Project settings: research assets off');

    // Keyboard: arrow keys move the radio choice, Escape closes the dialog.
    await mixed(dialog).focus();
    await page.keyboard.press('ArrowUp');
    await expectCommit('Project settings: look mode voxel only');
    expect(await voxelOnly(dialog).isChecked()).toBe(true);
    await page.keyboard.press('ArrowDown');
    await expectCommit('Project settings: look mode mixed looks');
    await page.keyboard.press('Escape');
    await dialog.waitFor({ state: 'detached' });
    // The rest of project.json is untouched.
    expect(await projectJson()).toEqual({
      version: 1,
      title: 'Doom on a calculator',
      language: 'en',
      style: 'voxel-pixel-crisp640',
      fps: 30,
      seed: 2115,
      lookMode: 'mixed',
      ambientVariation: true,
      researchMode: 'off',
      researchSources: ['wikimedia', 'nasa'],
    });
  });

  it('keeps the choices when the dialog and the project are opened again', async () => {
    let dialog = await openDialog();
    expect(await mixed(dialog).isChecked()).toBe(true);
    expect(await ambient(dialog).isChecked()).toBe(true);
    await dialog.getByRole('button', { name: 'Close' }).click();
    await dialog.waitFor({ state: 'detached' });

    await page.getByRole('button', { name: 'Close project' }).click();
    await page.getByRole('region', { name: 'Start' }).waitFor();
    await openProject();
    dialog = await openDialog();
    expect(await mixed(dialog).isChecked()).toBe(true);
    expect(await ambient(dialog).isChecked()).toBe(true);
    await ambient(dialog).uncheck();
    await expectCommit('Project settings: ambient variation off');
    expect(await projectJson()).toMatchObject({ lookMode: 'mixed', ambientVariation: false });
    await page.keyboard.press('Escape');
    await dialog.waitFor({ state: 'detached' });
  });
});
