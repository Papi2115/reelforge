/**
 * Scenes per minute and faster checks in the built app (`pnpm test:app`, ADR-027): the New project
 * form starts at Standard (the default estimate), Calm + Faster checks update the estimate and are
 * written to the new project.json; Project settings shows them, a custom range and Standard are
 * saved and committed (Standard removes the field). No Claude involved. Screenshot at 1280x720:
 * out/test-app/scene-count-1280.png.
 */
import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { ElectronApplication, Page } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { closeApp, launchApp, screenshotDir, stubFolderPicker } from './support/electron-app.js';

let app: ElectronApplication | undefined;
let page: Page;
let userDataDir: string;
let dir: string;

async function projectJson(): Promise<Record<string, unknown>> {
  const raw: unknown = JSON.parse(await readFile(path.join(dir, 'project.json'), 'utf8'));
  if (typeof raw !== 'object' || raw === null) throw new Error('project.json is not an object');
  return raw as Record<string, unknown>;
}

function lastCommit(): string {
  return spawnSync('git', ['-C', dir, 'log', '-1', '--format=%s'], {
    encoding: 'utf8',
  }).stdout.trim();
}

beforeAll(async () => {
  userDataDir = await mkdtemp(path.join(tmpdir(), 'reelforge scenes ż-'));
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

describe('scenes per minute and faster checks', () => {
  it('creates a project with Calm and faster checks from the New project form', async () => {
    if (app === undefined) throw new Error('the app is not running');
    const start = page.getByRole('region', { name: 'Start' });
    await start.waitFor();
    const select = start.getByRole('combobox', { name: /^Scenes per minute/ });
    expect(await select.inputValue()).toBe('standard');
    const estimate = start.getByRole('status');
    await estimate.getByText('≈ 100–130 scenes for a 10:00 film (the default)').waitFor();
    await select.selectOption('calm');
    await start.getByRole('checkbox', { name: /^Faster checks/ }).check();
    await estimate
      .getByText('≈ 30–50 scenes for a 10:00 film; roughly 65 % faster build than the default')
      .waitFor();
    await page.screenshot({ path: path.join(screenshotDir, 'scene-count-1280.png') });

    const parent = path.join(userDataDir, 'Projekty');
    await mkdir(parent);
    dir = path.join(parent, 'Calm film');
    await stubFolderPicker(app, parent);
    await start.getByLabel('Video title').fill('Calm film');
    await start.getByRole('button', { name: 'New project…' }).click();
    await page.getByRole('button', { name: 'Project settings' }).waitFor({ timeout: 30_000 });
    expect(await projectJson()).toMatchObject({
      shotsPerMinute: { min: 3, max: 5 },
      fasterChecks: true,
    });
  });

  it('edits the range in Project settings: custom, then Standard', async () => {
    await page.getByRole('button', { name: 'Project settings' }).click();
    const dialog = page.getByRole('dialog', { name: 'Project settings' });
    const region = dialog.getByRole('region', { name: 'Scenes and checks' });
    await region.waitFor();
    const select = region.getByRole('combobox', { name: /^Scenes per minute/ });
    expect(await select.inputValue()).toBe('calm');
    expect(await region.getByRole('checkbox', { name: /^Faster checks/ }).isChecked()).toBe(true);

    await select.selectOption('custom');
    await region.getByLabel('Scenes per minute to').fill('6');
    await expect
      .poll(lastCommit, { timeout: 15_000 })
      .toBe('Project settings: scenes per minute 3–6');
    expect(await projectJson()).toMatchObject({ shotsPerMinute: { min: 3, max: 6 } });

    await select.selectOption('standard');
    await expect
      .poll(lastCommit, { timeout: 15_000 })
      .toBe('Project settings: scenes per minute no limit');
    const project = await projectJson();
    expect(project).not.toHaveProperty('shotsPerMinute');
    expect(project).toMatchObject({ fasterChecks: true });
    await page.keyboard.press('Escape');
    await dialog.waitFor({ state: 'detached' });
  });
});
