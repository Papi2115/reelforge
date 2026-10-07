/**
 * Genre presets in the built app (`pnpm test:app`, PLAN.md#13.8, ADR-035): the New project form's
 * "Genre" fills in the style and scenes per minute with a plain preview line (and says which
 * preferred world is not offered yet); project.json records the preset and its fields; a style the
 * user picks by hand wins; Project settings shows the genre read-only; Settings → Channels sets the
 * channel's genre, which the form then preselects ("None" still creates a project without one).
 * No Claude and no network. Screenshots at 1280x720: out/test-app/genre-*.png.
 */
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { ElectronApplication, Locator, Page } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { closeApp, launchApp, screenshotDir, stubFolderPicker } from './support/electron-app.js';
import { projectMenu, projectMenuButton, projectSettingsTab } from './support/project-menu.js';

let app: ElectronApplication | undefined;
let page: Page;
let userDataDir: string;
let parent: string;

beforeAll(async () => {
  userDataDir = await mkdtemp(path.join(tmpdir(), 'reelforge genre ż-'));
  parent = path.join(userDataDir, 'Filmy gatunków');
  await mkdir(parent);
  app = await launchApp(userDataDir);
  await app.evaluate(({ BrowserWindow }) => {
    BrowserWindow.getAllWindows()[0]?.setContentSize(1280, 720);
  });
  page = await app.firstWindow();
  await page.waitForFunction(() => window.innerWidth === 1280 && window.innerHeight === 720);
});

afterAll(async () => {
  await closeApp(app);
  await rm(userDataDir, { recursive: true, force: true });
});

async function shot(name: string): Promise<void> {
  await page.screenshot({ path: path.join(screenshotDir, `genre-${name}.png`) });
}

async function projectJson(title: string): Promise<Record<string, unknown>> {
  const raw: unknown = JSON.parse(await readFile(path.join(parent, title, 'project.json'), 'utf8'));
  if (typeof raw !== 'object' || raw === null) throw new Error('project.json is not an object');
  return raw as Record<string, unknown>;
}

function startForm(): Locator {
  return page.getByRole('region', { name: 'Start' });
}

async function createProject(title: string): Promise<void> {
  if (app === undefined) throw new Error('the app is not running');
  const start = startForm();
  await start.getByLabel('Video title').fill(title);
  await stubFolderPicker(app, parent);
  await start.getByRole('button', { name: 'New project…' }).click();
  await projectMenuButton(page).waitFor({ timeout: 30_000 });
}

async function closeProject(): Promise<void> {
  await projectMenu(page, 'Close project');
  await startForm().waitFor();
}

describe('genre presets', () => {
  it('fills in the form from the genre and records it in project.json', async () => {
    const start = startForm();
    await start.waitFor();
    const genre = start.getByLabel('Genre', { exact: true });
    expect(await genre.inputValue()).toBe('');
    await genre.selectOption('history');
    const preview = start.getByRole('status', { name: 'What the genre sets' });
    // Sketchbook (and Comic) need the experimental switch, which is off: Soft 480.
    expect(await preview.textContent()).toBe(
      'Warm, friendly voxel 3D with bigger pixels · mixed looks · calm pace · 3–5 scenes a minute · continuity links · no surprise moments',
    );
    await start.getByText(/^Sketchbook.*Comic.*, using Soft 480\.$/).waitFor();
    expect(await start.locator('input[type="radio"][value="soft-480"]').isChecked()).toBe(true);
    expect(await start.getByLabel('Scenes per minute').inputValue()).toBe('calm');
    await start.getByLabel('Video title').fill('Fall of Rome');
    await shot('new-project');

    await createProject('Fall of Rome');
    expect(await projectJson('Fall of Rome')).toMatchObject({
      genrePreset: 'history',
      style: 'soft-480',
      shotsPerMinute: { min: 3, max: 5 },
      lookMode: 'mixed',
      continuityLinks: true,
      patternInterrupts: 'off',
      researchMode: 'ask',
    });

    await projectMenu(page, 'Project settings');
    const settings = page.getByRole('dialog', { name: 'Project settings' });
    await projectSettingsTab(settings, 'Channel & genre');
    const row = settings.getByRole('region', { name: 'Genre', exact: true });
    await row.getByText('History', { exact: true }).waitFor();
    expect(await row.locator('.project-genre-row').getAttribute('title')).toMatch(
      /^Recipe: Hand-drawn notebook first/,
    );
    await shot('project-settings');
    await settings.getByRole('button', { name: 'Close' }).click();
    await closeProject();
  });

  it('keeps a style the user picks by hand', async () => {
    const start = startForm();
    await start.getByLabel('Genre', { exact: true }).selectOption('true-crime');
    expect(await start.locator('input[type="radio"][value="noir-voxel"]').isChecked()).toBe(true);
    await start.locator('input[type="radio"][value="soft-480"]').check();
    const preview = start.getByRole('status', { name: 'What the genre sets' });
    expect(await preview.textContent()).toMatch(/^your style · /);
    await createProject('Cold case');
    expect(await projectJson('Cold case')).toMatchObject({
      genrePreset: 'true-crime',
      style: 'soft-480',
      shotsPerMinute: { min: 5, max: 8 },
    });
    await closeProject();
  });

  it('preselects the channel’s genre; None creates a project without one', async () => {
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Settings' });
    await dialog.getByRole('tab', { name: 'Channels' }).click();
    const channelGenre = dialog.getByLabel('Genre of new projects');
    await channelGenre.selectOption('finance');
    await expect
      .poll(async () => {
        const raw = JSON.parse(await readFile(path.join(userDataDir, 'channels.json'), 'utf8')) as {
          channels: { genrePreset?: string | null }[];
        };
        return raw.channels[0]?.genrePreset;
      })
      .toBe('finance');
    await shot('channel');
    await page.keyboard.press('Escape');
    await dialog.waitFor({ state: 'detached' });

    const start = startForm();
    const genre = start.getByLabel('Genre', { exact: true });
    await expect.poll(() => genre.inputValue()).toBe('finance');
    await genre.selectOption('');
    await createProject('Plain film');
    const plain = await projectJson('Plain film');
    expect(plain).not.toHaveProperty('genrePreset');
    expect(plain).toMatchObject({ style: 'voxel-pixel-crisp640' });
    await closeProject();
    // The channel's genre applies again on the next form.
    await expect.poll(() => genre.inputValue()).toBe('finance');
  });
});
