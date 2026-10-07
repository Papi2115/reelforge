/**
 * Own assets and the global asset library in the built app (`pnpm test:app`; PLAN.md#12.12,
 * #12.19), research mode off, fake-claude only, the asset sources on a local server that counts
 * every request (it must see none):
 * - project A: the Pipeline panel's "Assets" button opens the dialog; "Add my assets…" (main's
 *   file picker, stubbed) imports a picture and a clip; a drop of a non-file shows the hint; a
 *   third file comes in through the drop path (`importAssets` with paths); Describe edits the
 *   description; "Save to library" is ticked with the keyboard; the Library tab shows the picture
 *   (served from the library folder) and stars it;
 * - project B (same profile): Library → "Use in project" copies it in, no request at all.
 * Screenshots at 1280×720 in out/test-app/own-assets-*.png; per attempt the window at the end
 * (own-assets-1280-end-<n>.png) and main's log (own-assets-main-<n>.log) for CI failures.
 */
import { spawnSync } from 'node:child_process';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  startAssetServer,
  tinyMp4,
  tinyPng,
  type AssetTestServer,
} from '@reelforge/cli/assets-testing';
import { fakeClaudeBinPath } from '@reelforge/fake-claude';
import { assetLibraryFileSchema, assetsFileSchema } from '@reelforge/shared';
import type { ElectronApplication, Page } from 'playwright';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { logFile, TEST_ASSET_SERVER_ENV, TEST_CLAUDE_LAUNCHER_ENV } from '../src/main/app-paths.js';
import {
  closeApp,
  fixtureProject,
  launchApp,
  screenshotDir,
  stubFolderPicker,
} from './support/electron-app.js';

const STAMP = '2026-10-04T10:00:00.000Z';

let server: AssetTestServer;
let root: string;
/** Folder of the running attempt (profile, projects, the user's files) and its number. */
let attemptDir: string | undefined;
let attempt = 0;
let app: ElectronApplication | undefined;
let page: Page;

/** The CLI fixture as a git project in research mode off (script approved). */
async function createProject(dir: string): Promise<void> {
  await cp(fixtureProject, dir, { recursive: true });
  const projectFile = path.join(dir, 'project.json');
  const base = JSON.parse(await readFile(projectFile, 'utf8')) as Record<string, unknown>;
  await writeFile(projectFile, JSON.stringify({ ...base, researchMode: 'off' }, null, 2));
  await mkdir(path.join(dir, '.reelforge'), { recursive: true });
  await writeFile(
    path.join(dir, '.reelforge', 'pipeline.json'),
    JSON.stringify({
      version: 1,
      updatedAt: STAMP,
      stages: { script: { status: 'done', updatedAt: STAMP, approvedAt: STAMP } },
      queue: [],
    }),
  );
  await writeFile(path.join(dir, '.gitignore'), '.reelforge/\naudio/**\nout/\n*.tmp\n');
  const identity = ['-c', 'user.name=Own Assets Test', '-c', 'user.email=own@test.local'];
  spawnSync('git', ['init', '--quiet', '--initial-branch=main', dir]);
  spawnSync('git', ['-C', dir, 'add', '--all']);
  spawnSync('git', ['-C', dir, ...identity, 'commit', '--quiet', '-m', 'Fixture']);
}

async function start(profile: string, dir: string): Promise<void> {
  const sidecar = path.join(root, 'fake-claude.json');
  await writeFile(
    sidecar,
    JSON.stringify({ version: 1, default: { scenario: 'tools-write', reply: 'Done.' } }),
  );
  app = await launchApp(profile, {
    env: {
      [TEST_CLAUDE_LAUNCHER_ENV]: JSON.stringify({
        command: process.execPath,
        args: [fakeClaudeBinPath],
      }),
      FAKE_CLAUDE_SCRIPT: sidecar,
      REELFORGE_TEST_HOOKS: '1',
      [TEST_ASSET_SERVER_ENV]: server.base,
    },
  });
  page = await app.firstWindow();
  await page.getByRole('region', { name: 'Start' }).waitFor();
  await app.evaluate(({ BrowserWindow }) => {
    BrowserWindow.getAllWindows()[0]?.setContentSize(1280, 720);
  });
  await page.waitForFunction(() => window.innerWidth === 1280 && window.innerHeight === 720);
  await stubFolderPicker(app, dir);
  await page.getByRole('button', { name: 'Open project…' }).click();
  await page.getByRole('region', { name: 'Pipeline' }).waitFor({ timeout: 30_000 });
}

/** Main's file picker returns `files` next time (the native dialog cannot be driven). */
async function stubFilePicker(files: readonly string[]): Promise<void> {
  await app?.evaluate(({ dialog }, picked) => {
    dialog.showOpenDialog = () => Promise.resolve({ canceled: false, filePaths: [...picked] });
  }, files);
}

async function openAssets(): Promise<ReturnType<Page['getByRole']>> {
  await page
    .getByRole('region', { name: 'Pipeline' })
    .getByRole('button', { name: 'Assets', exact: true })
    .click();
  const dialog = page.getByRole('dialog', { name: 'Assets' });
  await dialog.waitFor();
  return dialog;
}

async function catalogueIds(dir: string): Promise<string[]> {
  try {
    const file = assetsFileSchema.parse(
      JSON.parse(await readFile(path.join(dir, 'assets.json'), 'utf8')),
    );
    return file.assets.map((asset) => `${asset.id}:${asset.description ?? ''}`);
  } catch {
    return [];
  }
}

async function libraryCount(profile: string): Promise<number> {
  try {
    const index = assetLibraryFileSchema.parse(
      JSON.parse(await readFile(path.join(profile, 'library', 'library.json'), 'utf8')),
    );
    return index.entries.length;
  } catch {
    return 0;
  }
}

async function screenshot(name: string): Promise<void> {
  await page.screenshot({ path: path.join(screenshotDir, `own-assets-1280-${name}.png`) });
}

beforeAll(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'reelforge own assets ż-'));
  server = await startAssetServer();
  await mkdir(screenshotDir, { recursive: true });
});

/**
 * Evidence for CI (the artifact upload takes out/test-app/): the window as the test left it and
 * main's log. A test failing mid-way leaves its app open, so the screenshot shows the failure.
 */
afterEach(async () => {
  if (app !== undefined) {
    await screenshot(`end-${String(attempt)}`).catch((error: unknown) => {
      process.stderr.write(`own-assets: no end screenshot: ${String(error)}\n`);
    });
  }
  await closeApp(app);
  app = undefined;
  if (attemptDir !== undefined) {
    const log = logFile(path.join(attemptDir, 'profile'));
    await cp(log, path.join(screenshotDir, `own-assets-main-${String(attempt)}.log`)).catch(
      (error: unknown) => {
        process.stderr.write(`own-assets: no main log: ${String(error)}\n`);
      },
    );
  }
});

afterAll(async () => {
  await server.close();
  await rm(root, { recursive: true, force: true, maxRetries: 5 });
});

describe('own assets and the asset library (research off)', () => {
  it('adds, describes and shares own files between projects without any request', async () => {
    // Every attempt (CI retries) starts from fresh projects and a fresh profile.
    attempt += 1;
    attemptDir = await mkdtemp(path.join(root, 'attempt-'));
    const profile = path.join(attemptDir, 'profile');
    const projectA = path.join(attemptDir, 'Project A');
    const projectB = path.join(attemptDir, 'Project B');
    await createProject(projectA);
    await createProject(projectB);
    const inbox = path.join(attemptDir, 'my files');
    await mkdir(inbox, { recursive: true });
    const photo = path.join(inbox, 'nokia_front.png');
    const clip = path.join(inbox, 'unboxing.mp4');
    const logo = path.join(inbox, 'channel logo.png');
    await writeFile(photo, tinyPng(64, 48));
    await writeFile(clip, tinyMp4());
    await writeFile(logo, tinyPng(16, 16));

    await start(profile, projectA);
    const dialog = await openAssets();
    const yours = dialog.getByRole('region', { name: 'Your files' });
    await stubFilePicker([photo, clip]);
    await yours.getByRole('button', { name: 'Add my assets…' }).click();
    await dialog.getByRole('status').getByText('Added 2 files.').waitFor({ timeout: 30_000 });
    const list = yours.getByRole('list', { name: 'Your files in this project' });
    await expect.poll(() => list.getByRole('listitem').count(), { timeout: 30_000 }).toBe(2);

    // A drop without a file on disk only explains what can be dropped.
    await yours.evaluate((zone) => {
      const transfer = new DataTransfer();
      transfer.items.add(new File(['x'], 'note.txt', { type: 'text/plain' }));
      zone.dispatchEvent(new DragEvent('drop', { dataTransfer: transfer, bubbles: true }));
    });
    await dialog
      .getByRole('status')
      .getByText(/Drop images or videos/)
      .waitFor();
    // The drop path: paths of dropped files go to the same import.
    await page.evaluate(async (file) => {
      const api = (
        window as unknown as {
          reelforge: { importAssets(request: { paths: string[] }): Promise<unknown> };
        }
      ).reelforge;
      await api.importAssets({ paths: [file] });
    }, logo);
    await expect
      .poll(() => catalogueIds(projectA), { timeout: 30_000 })
      .toEqual([
        'own-nokia-front:nokia front',
        'own-unboxing:unboxing',
        'own-channel-logo:channel logo',
      ]);

    // Describe the photo.
    await dialog.getByRole('button', { name: 'This project', exact: true }).click();
    await yours.getByRole('button', { name: 'Describe nokia_front' }).click();
    const form = yours.getByRole('form', { name: 'Describe nokia_front' });
    const description = form.getByLabel('What it shows (Claude reads this)');
    await description.fill('my Nokia 3310, front');
    // Each step is checked on its own, so a CI failure says which one did not happen.
    expect(await description.inputValue()).toBe('my Nokia 3310, front');
    await form.getByRole('button', { name: 'Save' }).click();
    await form.waitFor({ state: 'detached', timeout: 30_000 });
    await expect
      .poll(() => catalogueIds(projectA), {
        timeout: 30_000,
        message: 'the description is saved to assets.json (see own-assets-1280-end-<attempt>.png)',
      })
      .toContain('own-nokia-front:my Nokia 3310, front');

    // Save to library with the keyboard.
    const save = list
      .getByRole('listitem')
      .first()
      .getByRole('checkbox', { name: 'Save to library' });
    // Enabled again once the description is saved and committed.
    await expect.poll(() => save.isDisabled(), { timeout: 30_000 }).toBe(false);
    await save.focus();
    await page.keyboard.press('Space');
    await expect.poll(() => libraryCount(profile), { timeout: 30_000 }).toBe(1);
    await expect.poll(() => save.isChecked(), { timeout: 30_000 }).toBe(true);
    await screenshot('your-files');

    await dialog.getByRole('button', { name: 'Library', exact: true }).click();
    const grid = dialog.getByRole('list', { name: 'Library assets' });
    await grid.waitFor();
    await expect
      .poll(() =>
        grid
          .locator('img.asset-thumb')
          .evaluateAll((images) =>
            images.every((image) => image instanceof HTMLImageElement && image.naturalWidth > 0),
          ),
      )
      .toBe(true);
    const star = grid.getByRole('button', { name: 'Favourite: nokia_front' });
    await star.click();
    await expect.poll(() => star.getAttribute('aria-pressed'), { timeout: 30_000 }).toBe('true');
    await grid.getByRole('button', { name: 'In this project: nokia_front' }).waitFor();
    await screenshot('library');
    await closeApp(app);
    app = undefined;

    // Project B uses the library copy.
    await start(profile, projectB);
    const other = await openAssets();
    await other.getByRole('button', { name: 'Library', exact: true }).click();
    await other
      .getByRole('list', { name: 'Library assets' })
      .getByRole('button', { name: 'Use in project: nokia_front' })
      .click();
    await other
      .getByRole('status')
      .getByText('Added to this project as own-nokia-front.')
      .waitFor();
    await expect
      .poll(() => catalogueIds(projectB), { timeout: 30_000 })
      .toEqual(['own-nokia-front:my Nokia 3310, front']);
    const copied = assetsFileSchema.parse(
      JSON.parse(await readFile(path.join(projectB, 'assets.json'), 'utf8')),
    ).assets[0];
    expect(copied).toMatchObject({ source: 'own', fromLibrary: true });
    expect(server.requests).toEqual([]);
    await other.getByRole('button', { name: 'This project', exact: true }).click();
    await other
      .getByRole('list', { name: 'Your files in this project' })
      .getByText('nokia_front')
      .waitFor();
    await screenshot('project-b');
  }, 240_000);
});
