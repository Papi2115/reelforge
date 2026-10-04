/**
 * Shot locks and the final review in the built app (`pnpm test:app`; PLAN.md#11.4, #11.5) on the
 * CLI fixture project (two shots, script approved, a git repo): Shift+L locks / unlocks the
 * selected shot, the lock button locks s02 (locks.json + commit); Scenes built then builds only
 * s01 and the quiet final review follows by itself ("Review done: 1 ✓, 1 ⚠; 1 locked" — the
 * locked s02 has a phone-legibility finding it may only report); the Scenes panel and the export
 * dialog list s02 ("Export anyway"); after a relaunch the lock is still there. fake-claude only.
 * Screenshots at 1280×720 in out/test-app/locks-*.png.
 */
import { spawnSync } from 'node:child_process';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fakeClaudeBinPath, type FakeClaudeScript } from '@reelforge/fake-claude';
import type { ElectronApplication, Page } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { logFile, TEST_CLAUDE_LAUNCHER_ENV } from '../src/main/app-paths.js';
import {
  closeApp,
  fixtureProject,
  launchApp,
  screenshotDir,
  stubFolderPicker,
  waitForProjectPreview,
} from './support/electron-app.js';
import { FINAL_REVIEW_CLEAN } from './support/pipeline-film.js';
import { showStage, stageText } from './support/pipeline-rows.js';

const CRITIC_OK = JSON.stringify({
  frames: [{ path: 'sheet.png', verdict: 'ok', note: 'looks right' }],
});

let app: ElectronApplication;
let page: Page;
let userDataDir: string;
let dir: string;
let sidecar: string;

async function shot(name: string): Promise<void> {
  await page.screenshot({ path: path.join(screenshotDir, `locks-1280-${name}.png`) });
}

function git(args: readonly string[]): string {
  const run = spawnSync('git', ['-C', dir, ...args], { encoding: 'utf8' });
  return run.stdout.trim();
}

function subjects(): string[] {
  return git(['log', '--format=%s']).split('\n');
}

function pipeline() {
  return page.getByRole('region', { name: 'Pipeline' });
}

function shots() {
  return page.getByRole('region', { name: 'Shots' });
}

async function rowText(label: string): Promise<string> {
  return stageText(page, label);
}

async function openRow(label: string): Promise<void> {
  await (await showStage(page, label)).click();
  await pipeline()
    .getByRole('group', { name: `${label} actions` })
    .getByRole('button', { name: 'Open' })
    .click();
}

async function lockedIds(): Promise<string[]> {
  try {
    const file = JSON.parse(await readFile(path.join(dir, 'locks.json'), 'utf8')) as {
      shots: { shotId: string }[];
    };
    return file.shots.map((entry) => entry.shotId);
  } catch {
    return [];
  }
}

/** The CLI fixture as a git project with the script approved. */
async function createProject(target: string): Promise<void> {
  await cp(fixtureProject, target, { recursive: true });
  const stamp = '2026-10-03T10:00:00.000Z';
  await mkdir(path.join(target, '.reelforge'), { recursive: true });
  await writeFile(
    path.join(target, '.reelforge', 'pipeline.json'),
    JSON.stringify({
      version: 1,
      updatedAt: stamp,
      stages: { script: { status: 'done', updatedAt: stamp, approvedAt: stamp } },
      queue: [],
    }),
  );
  await writeFile(path.join(target, '.gitignore'), '.reelforge/\naudio/**\nout/\n*.tmp\n');
  const identity = ['-c', 'user.name=Locks Test', '-c', 'user.email=locks@test.local'];
  spawnSync('git', ['init', '--quiet', '--initial-branch=main', target]);
  spawnSync('git', ['-C', target, 'add', '--all']);
  spawnSync('git', ['-C', target, ...identity, 'commit', '--quiet', '-m', 'Fixture']);
}

async function start(): Promise<void> {
  app = await launchApp(userDataDir, {
    env: {
      [TEST_CLAUDE_LAUNCHER_ENV]: JSON.stringify({
        command: process.execPath,
        args: [fakeClaudeBinPath],
      }),
      FAKE_CLAUDE_SCRIPT: sidecar,
      REELFORGE_TEST_HOOKS: '1',
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
  await waitForProjectPreview(page);
}

beforeAll(async () => {
  userDataDir = await mkdtemp(path.join(tmpdir(), 'reelforge locks ż-'));
  dir = path.join(userDataDir, 'Zamki i przegląd');
  await createProject(dir);
  // Build turns write nothing (the fixture scenes stay), the critic and the final review's
  // batched critic find nothing.
  const script: FakeClaudeScript = {
    version: 1,
    rules: [{ ...FINAL_REVIEW_CLEAN }],
    default: { scenario: 'tools-write', reply: CRITIC_OK },
  };
  sidecar = path.join(userDataDir, 'fake-claude-script.json');
  await writeFile(sidecar, JSON.stringify(script));
  await mkdir(screenshotDir, { recursive: true });
  await start();
}, 180_000);

afterAll(async () => {
  await closeApp(app);
  await cp(logFile(userDataDir), path.join(screenshotDir, 'locks-main.log')).catch(() => undefined);
  await rm(userDataDir, { recursive: true, force: true, maxRetries: 5 });
});

describe('shot locks and the final review', () => {
  it('locks shots with Shift+L and the lock button (locks.json + commit)', async () => {
    await shots()
      .getByRole('button', { name: /^Shot s01,/ })
      .click();
    await page.keyboard.press('Shift+L');
    await expect.poll(lockedIds, { timeout: 10_000 }).toEqual(['s01']);
    const lockS01 = shots().getByRole('button', { name: /^(Lock|Unlock) s01$/ });
    await expect.poll(() => lockS01.getAttribute('aria-pressed')).toBe('true');
    await page.keyboard.press('Shift+L');
    await expect.poll(lockedIds, { timeout: 10_000 }).toEqual([]);
    await expect.poll(() => subjects()[0], { timeout: 10_000 }).toBe('Unlock shot s01');
    await shots().getByRole('button', { name: 'Lock s02', exact: true }).click();
    await expect.poll(lockedIds, { timeout: 10_000 }).toEqual(['s02']);
    await expect
      .poll(() =>
        shots()
          .getByRole('button', { name: 'Unlock s02', exact: true })
          .getAttribute('aria-pressed'),
      )
      .toBe('true');
    await expect.poll(() => subjects()[0], { timeout: 10_000 }).toBe('Lock shot s02');
    expect(subjects()).toEqual(expect.arrayContaining(['Lock shot s01', 'Unlock shot s01']));
    await shot('locked');
  }, 60_000);

  it('builds only the unlocked shot, then the final review reports the locked one', async () => {
    // The fixture's scene files count as built: "Redo" rebuilds every unlocked shot.
    await (await showStage(page, 'Scenes built')).click();
    const redo = pipeline()
      .getByRole('group', { name: 'Scenes built actions' })
      .getByRole('button', { name: 'Redo' });
    await expect.poll(() => redo.getAttribute('aria-disabled')).toBe('false');
    await redo.click();
    const confirm = page.getByRole('alertdialog', { name: 'Redo Scenes built?' });
    await confirm.getByRole('button', { name: 'Redo' }).click();
    await expect
      .poll(() => rowText('Scenes built'), { timeout: 300_000, interval: 500 })
      .toMatch(/^Scenes builtDone.*Review done: 1 ✓, 1 ⚠; 1 locked/);
    await shot('reviewed');
    // s02 was never built (the fixture has no scenes report): only s01 has a build record.
    const scenes = JSON.parse(
      await readFile(path.join(dir, '.reelforge', 'scenes-report.json'), 'utf8'),
    ) as { shots: { shotId: string }[] };
    expect(scenes.shots.map((entry) => entry.shotId)).toEqual(['s01']);
    const report = JSON.parse(
      await readFile(path.join(dir, '.reelforge', 'final-review.json'), 'utf8'),
    ) as { trigger: string; shots: { shotId: string; status: string; locked: boolean }[] };
    expect(report.trigger).toBe('auto');
    expect(report.shots).toEqual([
      expect.objectContaining({ shotId: 's01', status: 'ok', locked: false }),
      expect.objectContaining({ shotId: 's02', status: 'warning', locked: true }),
    ]);
    await openRow('Scenes built');
    const panel = page.getByRole('region', { name: 'Scenes built' });
    await expect
      .poll(() => panel.getByTestId('final-review-summary').textContent())
      .toBe('Review done: 1 ✓, 1 ⚠ · 1 locked');
    await panel
      .getByRole('list', { name: 'Shots to check' })
      .getByText('s02', { exact: true })
      .waitFor();
    await shot('scenes-panel');
    await panel.getByRole('button', { name: 'Back to preview' }).click();
  }, 360_000);

  it('lists the ⚠ shot before the export and goes to it', async () => {
    await openRow('Video exported');
    const dialog = page.getByRole('dialog', { name: 'Export video' });
    const preflight = dialog.getByRole('region', { name: 'Before you export' });
    await preflight.getByText(/1 shot needs a look/).waitFor();
    await dialog.getByRole('button', { name: 'Export anyway' }).waitFor();
    await shot('export-preflight');
    await preflight.getByRole('button', { name: /s02/ }).click();
    await dialog.waitFor({ state: 'detached' });
    await expect
      .poll(() =>
        shots()
          .getByRole('button', { name: /^Shot s02,/ })
          .getAttribute('aria-pressed'),
      )
      .toBe('true');
  }, 60_000);

  it('keeps the lock after a relaunch', async () => {
    await closeApp(app);
    await start();
    await expect
      .poll(() =>
        shots()
          .getByRole('button', { name: 'Unlock s02', exact: true })
          .getAttribute('aria-pressed'),
      )
      .toBe('true');
    await shot('relaunched');
  }, 180_000);
});
