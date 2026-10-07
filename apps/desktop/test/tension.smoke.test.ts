/**
 * Tension panel in the built app (`pnpm test:app`, PLAN.md#12.22) on the CLI fixture project
 * (no tensionMap = off): the timeline's Tension button opens the curve editor under the
 * timeline; a preset writes tension.json and commits it (`Tension: …`, step `tension`); keyboard
 * edits of a point (ArrowUp, Delete) and Undo are saved and committed; locking the curve disables
 * the presets; the panel says the map is off until Project settings → Direction turns it on. The
 * Director tab sums the curve up ("Drawn by you · 6 points …") and its switch follows Project
 * settings. No Claude involved. Screenshot at 1280x720: out/test-app/tension-1280.png.
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
import { showDirector } from './support/pipeline-rows.js';
import { projectMenu } from './support/project-menu.js';

let app: ElectronApplication | undefined;
let page: Page;
let userDataDir: string;
let dir: string;

interface CurveOnDisk {
  readonly source: string;
  readonly locked?: boolean;
  readonly points: readonly { readonly t: number; readonly v: number }[];
}

function git(args: readonly string[]): string {
  const run = spawnSync('git', ['-C', dir, ...args], { encoding: 'utf8' });
  return run.stdout.trim();
}

async function curve(): Promise<CurveOnDisk> {
  return JSON.parse(await readFile(path.join(dir, 'tension.json'), 'utf8')) as CurveOnDisk;
}

/** Waits until the newest commit has `subject` and the `tension` step trailer. */
async function expectCommit(subject: string): Promise<void> {
  await expect.poll(() => git(['log', '-1', '--format=%s']), { timeout: 15_000 }).toBe(subject);
  expect(git(['log', '-1', '--format=%(trailers:key=ReelForge-Step,valueonly)'])).toBe('tension');
}

function panel(): Locator {
  return page.getByRole('region', { name: 'Tension' });
}

function point(index: number): Locator {
  return panel().getByRole('slider', { name: new RegExp(`^Tension point ${String(index)} of `) });
}

beforeAll(async () => {
  userDataDir = await mkdtemp(path.join(tmpdir(), 'reelforge tension ż-'));
  dir = path.join(userDataDir, 'Projekt ż napięcie');
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

describe('tension panel', () => {
  it('draws, edits, undoes and locks the curve; every change is committed', async () => {
    if (app === undefined) throw new Error('the app is not running');
    await stubFolderPicker(app, dir);
    await page.getByRole('button', { name: 'Open project…' }).click();
    await page.getByRole('button', { name: 'Show the tension curve' }).click({ timeout: 30_000 });
    await panel().waitFor();
    await panel().getByText('No curve yet').waitFor();
    // The fixture predates 2.2: the map is off and the panel says so.
    await panel()
      .getByText(/The tension map is off for this project/)
      .waitFor();

    await panel().getByRole('button', { name: 'Three acts' }).click();
    await expectCommit('Tension: preset three-act');
    const preset = await curve();
    expect(preset.source).toBe('user');
    expect(preset.points).toHaveLength(6);
    await expect.poll(() => point(1).count()).toBe(1);
    await page.screenshot({ path: path.join(screenshotDir, 'tension-1280.png') });
    const director = await showDirector(page);
    const summary = director.getByRole('region', { name: 'Tension curve' });
    await summary.getByText(/^Drawn by you · 6 points · peak /).waitFor({ timeout: 15_000 });
    await summary.getByRole('img', { name: 'Tension curve of the film' }).waitFor();
    const directorSwitch = summary.getByRole('checkbox', {
      name: /^Steer the film by a tension curve/,
    });
    expect(await directorSwitch.isChecked()).toBe(false);

    // Keyboard: ArrowUp raises point 2 by 0.05 (saved once the keys rest).
    const before = preset.points[1]?.v ?? 0;
    await point(2).focus();
    await page.keyboard.press('ArrowUp');
    await expectCommit('Tension: moved a point');
    expect((await curve()).points[1]?.v).toBeCloseTo(before + 0.05, 3);

    await point(2).focus();
    await page.keyboard.press('Delete');
    await expectCommit('Tension: removed a point');
    expect((await curve()).points).toHaveLength(5);

    await panel().getByRole('button', { name: 'Undo' }).click();
    await expectCommit('Tension: undo');
    expect((await curve()).points).toHaveLength(6);

    await panel().getByRole('checkbox', { name: 'Lock curve' }).check();
    await expectCommit('Tension: locked the curve');
    expect((await curve()).locked).toBe(true);
    expect(await panel().getByRole('button', { name: 'Three acts' }).isDisabled()).toBe(true);
    expect(await panel().getByRole('button', { name: 'Propose with Claude' }).isDisabled()).toBe(
      true,
    );

    // Project settings → Direction turns the map on; the panel's note goes away.
    await projectMenu(page, 'Project settings');
    const dialog = page.getByRole('dialog', { name: 'Project settings' });
    await dialog.getByRole('region', { name: 'Direction' }).waitFor();
    await dialog.getByRole('checkbox', { name: /^Steer the film by a tension curve/ }).check();
    await expect
      .poll(() => git(['log', '-1', '--format=%s']), { timeout: 15_000 })
      .toBe('Project settings: tension map on');
    await page.keyboard.press('Escape');
    await expect.poll(() => directorSwitch.isChecked(), { timeout: 15_000 }).toBe(true);
    await expect
      .poll(() =>
        panel()
          .getByText(/The tension map is off for this project/)
          .count(),
      )
      .toBe(0);
  });
});
