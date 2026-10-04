/**
 * Asset research in the built app (`pnpm test:app`; PLAN.md#12.10), fake-claude only, the asset
 * sources on a local server (`REELFORGE_TEST_ASSET_SERVER`, unpackaged test hook):
 * - ask: the storyboard of the CLI fixture asks for a photo; the Assets step appears, its Claude
 *   turn leaves an asset package (the proposal `reelforge assets propose` writes, made with the
 *   real CLI before the test), the step waits for review; the "Asset package" dialog shows the
 *   thumbnails; one item is unticked with the keyboard, "Approve selected (1)" downloads only
 *   that one into assets.json and the step is done;
 * - full-auto: an unverified asset is listed with ⚠ in the export dialog, the credits can be
 *   copied, and the export is not blocked.
 * Screenshots at 1280×720 in out/test-app/assets-*.png.
 */
import { spawnSync } from 'node:child_process';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  runAssetCommand,
  startAssetServer,
  tinyPng,
  type AssetTestServer,
} from '@reelforge/cli/assets-testing';
import { fakeClaudeBinPath, type FakeClaudeScript } from '@reelforge/fake-claude';
import { assetsFileSchema } from '@reelforge/shared';
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
import { showStage, stageText } from './support/pipeline-rows.js';

const STAMP = '2026-10-04T10:00:00.000Z';
const PROPOSED = ['wikimedia:105654713', 'nasa:jsc2007e034221'];

let server: AssetTestServer;
let root: string;
let app: ElectronApplication | undefined;
let page: Page;

function pipeline(): ReturnType<Page['getByRole']> {
  return page.getByRole('region', { name: 'Pipeline' });
}

async function rowAction(label: string, action: RegExp): Promise<void> {
  await (await showStage(page, label)).click();
  const button = pipeline()
    .getByRole('group', { name: `${label} actions` })
    .getByRole('button', { name: action });
  await expect.poll(() => button.getAttribute('aria-disabled')).not.toBe('true');
  await button.click();
}

/** Why Redo of Scenes built is (not) available: the gating reasons are its tooltip. */
async function scenesRedoHint(): Promise<string> {
  await (await showStage(page, 'Scenes built')).click();
  const redo = pipeline()
    .getByRole('group', { name: 'Scenes built actions' })
    .getByRole('button', { name: 'Redo' });
  return (await redo.getAttribute('title')) ?? '';
}

/** The CLI fixture as a git project (script approved), with `project` fields merged in. */
async function createProject(
  dir: string,
  project: Record<string, unknown>,
  withNeeds: boolean,
): Promise<void> {
  await cp(fixtureProject, dir, { recursive: true });
  const projectFile = path.join(dir, 'project.json');
  const base = JSON.parse(await readFile(projectFile, 'utf8')) as Record<string, unknown>;
  await writeFile(projectFile, JSON.stringify({ ...base, ...project }, null, 2));
  if (withNeeds) {
    const file = path.join(dir, 'storyboard.json');
    const storyboard = JSON.parse(await readFile(file, 'utf8')) as {
      shots: Record<string, unknown>[];
    };
    const needs = [{ id: 'calculator-photo', kind: 'image', description: 'a real calculator' }];
    storyboard.shots = storyboard.shots.map((shot) =>
      shot['id'] === 's02' ? { ...shot, assetNeeds: needs } : shot,
    );
    await writeFile(file, JSON.stringify(storyboard, null, 2));
  }
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
  const identity = ['-c', 'user.name=Assets Test', '-c', 'user.email=assets@test.local'];
  spawnSync('git', ['init', '--quiet', '--initial-branch=main', dir]);
  spawnSync('git', ['-C', dir, 'add', '--all']);
  spawnSync('git', ['-C', dir, ...identity, 'commit', '--quiet', '-m', 'Fixture']);
}

/**
 * What `reelforge assets propose` leaves in a project, made with the real CLI in a scratch copy:
 * the proposal JSON (fake-claude writes it during the turn) and the thumbnails (copied now).
 */
async function proposalFor(dir: string): Promise<string> {
  const scratch = path.join(root, 'scratch');
  await createProject(scratch, { researchMode: 'ask' }, false);
  const run = await runAssetCommand(scratch, server.runtime(), [
    'assets',
    'propose',
    '--ids',
    PROPOSED.join(','),
  ]);
  if (run.code !== 0) throw new Error(`propose failed: ${run.text}`);
  await cp(
    path.join(scratch, '.reelforge', 'assets', 'thumbnails'),
    path.join(dir, '.reelforge', 'assets', 'thumbnails'),
    { recursive: true },
  );
  return readFile(path.join(scratch, '.reelforge', 'assets', 'proposals', '1.json'), 'utf8');
}

async function start(dir: string, script: FakeClaudeScript): Promise<void> {
  const sidecar = path.join(root, `fake-claude-${path.basename(dir)}.json`);
  await writeFile(sidecar, JSON.stringify(script));
  app = await launchApp(path.join(root, `profile-${path.basename(dir)}`), {
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
  await pipeline().waitFor({ timeout: 30_000 });
}

function fileRequests(): number {
  return server.requests.filter((request) => request.startsWith('/files/')).length;
}

async function screenshot(name: string): Promise<void> {
  await page.screenshot({ path: path.join(screenshotDir, `assets-1280-${name}.png`) });
}

beforeAll(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'reelforge assets ż-'));
  server = await startAssetServer();
  await mkdir(screenshotDir, { recursive: true });
});

afterEach(async () => {
  if (app !== undefined) {
    const log = logFile(path.join(root, 'profile-ask'));
    await closeApp(app);
    await cp(log, path.join(screenshotDir, 'assets-main.log')).catch(() => undefined);
    app = undefined;
  }
});

afterAll(async () => {
  await server.close();
  await rm(root, { recursive: true, force: true, maxRetries: 5 });
});

describe('asset research', () => {
  it('ask: reviews the asset package and downloads only the approved item', async () => {
    const dir = path.join(root, 'ask');
    await createProject(dir, { researchMode: 'ask' }, true);
    const proposal = await proposalFor(dir);
    await start(dir, {
      version: 1,
      rules: [
        {
          scenario: 'tools-write',
          promptIncludes: 'Find real photos and footage for the shots below.',
          reply: 'calculator-photo: proposed 2 candidates (assets propose).',
          writes: [{ path: '.reelforge/assets/proposals/1.json', content: proposal }],
        },
      ],
      default: { scenario: 'tools-write', reply: 'Done.' },
    });
    await expect.poll(() => stageText(page, 'Assets'), { timeout: 30_000 }).toMatch(/^AssetsReady/);
    await rowAction('Assets', /^Run$/);
    await expect
      .poll(() => stageText(page, 'Assets'), { timeout: 60_000, interval: 500 })
      .toMatch(/^AssetsReview/);
    expect(await scenesRedoHint()).toContain('An asset package is waiting for your review');

    await (await showStage(page, 'Assets')).click();
    await pipeline()
      .getByRole('group', { name: 'Assets actions' })
      .getByRole('button', { name: 'Open' })
      .click();
    const dialog = page.getByRole('dialog', { name: 'Assets' });
    const grid = dialog.getByRole('list', { name: 'Asset package 1' });
    await grid.waitFor();
    const boxes = grid.getByRole('checkbox');
    await expect.poll(() => boxes.count()).toBe(2);
    await expect
      .poll(() =>
        grid
          .locator('img.asset-thumb')
          .evaluateAll((images) =>
            images.every((image) => image instanceof HTMLImageElement && image.naturalWidth > 0),
          ),
      )
      .toBe(true);
    expect(await boxes.nth(0).isChecked()).toBe(true);
    expect(await boxes.nth(1).isChecked()).toBe(true);
    // Keyboard: untick the NASA candidate.
    await boxes.nth(1).focus();
    await page.keyboard.press('Space');
    expect(await boxes.nth(1).isChecked()).toBe(false);
    await screenshot('review');
    const filesBefore = fileRequests();
    await dialog.getByRole('button', { name: 'Approve selected (1)' }).click();

    const catalogue = path.join(dir, 'assets.json');
    await expect
      .poll(
        async () => {
          try {
            const file = assetsFileSchema.parse(JSON.parse(await readFile(catalogue, 'utf8')));
            return file.assets.map((asset) => [asset.id, asset.approved]);
          } catch {
            return [];
          }
        },
        { timeout: 60_000, interval: 500 },
      )
      .toEqual([['wm-105654713', true]]);
    await dialog
      .getByRole('list', { name: 'Downloaded assets' })
      .getByText('wm-105654713')
      .waitFor({ timeout: 30_000 });
    // Only the approved file was downloaded.
    expect(fileRequests()).toBe(filesBefore + 1);
    await screenshot('approved');
    await dialog.getByRole('button', { name: 'Close' }).click();
    await expect.poll(() => stageText(page, 'Assets'), { timeout: 30_000 }).toMatch(/^AssetsDone/);
    expect(await scenesRedoHint()).not.toContain('asset package');
  }, 240_000);

  it('full-auto: the export dialog lists unverified assets with ⚠ and the credits', async () => {
    const dir = path.join(root, 'full-auto');
    await createProject(dir, { researchMode: 'full-auto' }, false);
    await mkdir(path.join(dir, '.reelforge', 'assets'), { recursive: true });
    await writeFile(path.join(dir, '.reelforge', 'assets', 'web-calc.png'), tinyPng(8, 6));
    await writeFile(
      path.join(dir, 'assets.json'),
      JSON.stringify({
        version: 1,
        assets: [
          {
            id: 'web-calc',
            kind: 'image',
            source: 'web',
            sourceItemId: null,
            sourceUrl: 'https://example.org/calc.png',
            downloadUrl: 'https://example.org/calc.png',
            title: 'calc.png',
            author: 'unknown',
            licence: { id: 'unverified', url: null, verified: false },
            file: '.reelforge/assets/web-calc.png',
            sha256: 'b'.repeat(64),
            bytes: 100,
            mime: 'image/png',
            width: 8,
            height: 6,
            mode: 'full-auto',
            approved: false,
            fetchedAt: STAMP,
          },
        ],
      }),
    );
    await start(dir, { version: 1, default: { scenario: 'tools-write', reply: 'Done.' } });
    await (await showStage(page, 'Video exported')).click();
    await pipeline()
      .getByRole('group', { name: 'Video exported actions' })
      .getByRole('button', { name: 'Open' })
      .click();
    const dialog = page.getByRole('dialog', { name: 'Export video' });
    const section = dialog.getByRole('region', { name: 'Assets and credits' });
    await section.waitFor({ timeout: 30_000 });
    expect(await section.getByRole('alert').textContent()).toContain(
      '⚠ 1 asset has an unverified licence',
    );
    await section.getByRole('list', { name: 'Unverified assets' }).getByText('web-calc').waitFor();
    expect(await section.getByLabel('Credits', { exact: true }).textContent()).toContain(
      '[check licence]',
    );
    await section.getByRole('button', { name: 'Copy credits' }).waitFor();
    // Not blocked by the assets: the submit button says nothing about them.
    const submit = dialog.getByRole('button', { name: /^(Add to queue|Export anyway)$/ });
    expect((await submit.getAttribute('title')) ?? '').not.toContain('asset');
    await screenshot('export');
  }, 180_000);
});
