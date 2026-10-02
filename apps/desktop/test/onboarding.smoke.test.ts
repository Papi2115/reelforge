/**
 * First run of the built app (`pnpm test:app`, PLAN.md#10.3): skip "Connect Claude" (claude is
 * searched in an empty folder; chat turns would go to fake-claude, never a model) → Welcome → open
 * the example project (copied into the test's projects folder) → Script … Scenes built are done
 * and the preview plays → the guided tour shows, is dismissed with "Don't show again" and stays
 * away after a relaunch → Help (shortcuts, About, Report a problem with the shell stubbed) → Sound
 * design mixed and Video exported with the real ffmpeg pipeline → an MP4 that ffprobe reads.
 * Screenshots at 1280×720 in out/test-app/onboarding-1280-*.png.
 */
import { existsSync } from 'node:fs';
import { cp, mkdtemp, readdir, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fakeClaudeBinPath } from '@reelforge/fake-claude';
import type { ElectronApplication, Page } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  CLAUDE_SEARCH_DIR_ENV,
  logFile,
  settingsFile,
  TEST_CLAUDE_LAUNCHER_ENV,
  TEST_PROJECTS_DIR_ENV,
} from '../src/main/app-paths.js';
import { launchApp, renderedTime, frameStats, screenshotDir } from './support/electron-app.js';
import { ffprobe } from './support/pipeline-film.js';

const DONE_ROWS = [
  'Script written',
  'Voiceover added',
  'Audio cleaned',
  'Words timed',
  'Storyboard',
  'Scenes built',
];

let app: ElectronApplication;
let page: Page;
let userDataDir: string;
let noClaudeDir: string;
let projectsDir: string;
const exampleDir = (): string => path.join(projectsDir, 'Doom on a calculator');

async function launch(): Promise<void> {
  app = await launchApp(userDataDir, {
    firstRun: true,
    env: {
      [CLAUDE_SEARCH_DIR_ENV]: noClaudeDir,
      [TEST_PROJECTS_DIR_ENV]: projectsDir,
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
}

async function shot(name: string): Promise<void> {
  await page.screenshot({ path: path.join(screenshotDir, `onboarding-1280-${name}.png`) });
}

async function onboardingSettings(): Promise<Record<string, unknown>> {
  const raw = JSON.parse(await readFile(settingsFile(userDataDir), 'utf8')) as {
    onboarding?: Record<string, unknown>;
  };
  return raw.onboarding ?? {};
}

function pipeline() {
  return page.getByRole('region', { name: 'Pipeline' });
}

async function rowText(label: string): Promise<string> {
  return (await pipeline().getByRole('button', { name: label }).first().textContent()) ?? '';
}

async function waitDone(label: string, timeout: number): Promise<void> {
  await expect
    .poll(() => rowText(label), { timeout, interval: 500 })
    .toMatch(new RegExp(`^${label}Done`));
}

async function runRow(label: string): Promise<void> {
  await pipeline().getByRole('button', { name: label }).first().click();
  const run = pipeline()
    .getByRole('group', { name: `${label} actions` })
    .getByRole('button', { name: /^(Run|Retry|Resume)$/ });
  await expect.poll(() => run.getAttribute('aria-disabled')).toBe('false');
  await run.click();
}

async function openedPaths(): Promise<string[]> {
  return app.evaluate(() => (globalThis as unknown as { __opened?: string[] }).__opened ?? []);
}

async function helpItem(name: string): Promise<void> {
  await page.getByRole('button', { name: 'Help', exact: true }).click();
  await page.getByRole('menu', { name: 'Help' }).getByRole('menuitem', { name }).click();
}

beforeAll(async () => {
  userDataDir = await mkdtemp(path.join(tmpdir(), 'reelforge onboarding ż-'));
  noClaudeDir = await mkdtemp(path.join(tmpdir(), 'reelforge no claude '));
  projectsDir = path.join(userDataDir, 'Documents', 'ReelForge Projects');
  await launch();
}, 120_000);

afterAll(async () => {
  await app.close();
  await cp(logFile(userDataDir), path.join(screenshotDir, 'onboarding-main.log')).catch(
    () => undefined,
  );
  await rm(userDataDir, { recursive: true, force: true });
  await rm(noClaudeDir, { recursive: true, force: true });
});

describe('first run', () => {
  it('skips Connect Claude, opens the example from Welcome and plays it', async () => {
    const gate = page.getByRole('dialog', { name: 'Connect Claude' });
    await gate.getByRole('button', { name: 'Skip for now' }).click();
    const welcome = page.getByRole('region', { name: 'Welcome to ReelForge' });
    await welcome.getByRole('button', { name: /Open the example project/ }).waitFor();
    await shot('welcome');
    await welcome.getByRole('button', { name: /Open the example project/ }).click();
    await page.locator('.project-title', { hasText: 'Doom on a calculator' }).waitFor({
      timeout: 60_000,
    });
    expect(existsSync(path.join(exampleDir(), 'scenes', 's03_exam_bench.js'))).toBe(true);
    expect(await onboardingSettings()).toMatchObject({ welcomeDone: true, tourDone: false });

    const tour = page.getByRole('dialog', { name: 'The pipeline' });
    await tour.waitFor({ timeout: 30_000 });
    await page.locator('canvas.preview-canvas[data-rendered-t]').waitFor({ timeout: 60_000 });
    await shot('tour-pipeline');
    await tour.getByRole('button', { name: 'Next' }).click();
    await page.getByRole('dialog', { name: 'Preview' }).waitFor();
    await shot('tour-preview');

    for (const label of DONE_ROWS) await waitDone(label, 30_000);
    expect(await rowText('Sound design mixed')).toMatch(/^Sound design mixedReady/);
    expect(await page.getByTestId('next-step').textContent()).toContain('Sound design mixed');

    const preview = page.getByRole('dialog', { name: 'Preview' });
    await preview.getByRole('checkbox', { name: "Don't show again" }).check();
    await preview.getByRole('button', { name: 'Skip tour' }).click();
    await preview.waitFor({ state: 'detached' });
    await expect.poll(async () => (await onboardingSettings())['tourDone']).toBe(true);

    const previewPanel = page.getByRole('region', { name: 'Preview' });
    await previewPanel.getByRole('button', { name: 'Play', exact: true }).click();
    await expect.poll(() => renderedTime(page), { timeout: 30_000 }).toBeGreaterThan(1.5);
    await previewPanel.getByRole('button', { name: 'Pause', exact: true }).click();
    expect((await frameStats(page)).distinctColours).toBeGreaterThan(16);
    await shot('example-opened');
  }, 180_000);

  it('Help: shortcuts, About with the licences, Report a problem opens the logs folder', async () => {
    await app.evaluate(({ shell }) => {
      const opened: string[] = [];
      (globalThis as unknown as { __opened: string[] }).__opened = opened;
      shell.openPath = (target: string) => {
        opened.push(target);
        return Promise.resolve('');
      };
    });
    await helpItem('Keyboard shortcuts');
    const shortcuts = page.getByRole('dialog', { name: 'Keyboard shortcuts' });
    await shortcuts.getByText('Play / pause').waitFor();
    await shot('shortcuts');
    await shortcuts.getByRole('button', { name: 'Close' }).click();

    await helpItem('About ReelForge');
    const about = page.getByRole('dialog', { name: 'About ReelForge' });
    await about.getByText(/personal use/).waitFor();
    await about.getByRole('button', { name: 'Open licences' }).click();
    await expect.poll(openedPaths).toEqual([expect.stringMatching(/licenses\.md$/)]);
    await about.getByRole('button', { name: 'Close' }).click();

    await helpItem('Report a problem…');
    const report = page.getByRole('dialog', { name: 'Report a problem' });
    await report.getByRole('button', { name: 'Open logs folder' }).click();
    await expect
      .poll(async () => (await openedPaths()).at(-1))
      .toBe(path.dirname(logFile(userDataDir)));
    await report.getByRole('button', { name: 'Close' }).click();

    await helpItem('Take the tour');
    await page.getByRole('dialog', { name: 'The pipeline' }).waitFor();
    await page.keyboard.press('Escape');
    await page.getByRole('dialog', { name: 'The pipeline' }).waitFor({ state: 'detached' });
  }, 60_000);

  it('does not show the tour again after a relaunch', async () => {
    await app.close();
    await launch();
    const recent = page.getByRole('region', { name: 'Start' }).getByRole('button', {
      name: /Doom on a calculator/,
    });
    await recent.click();
    await page.locator('canvas.preview-canvas[data-rendered-t]').waitFor({ timeout: 60_000 });
    await page.waitForTimeout(1_500);
    expect(await page.getByRole('dialog', { name: 'The pipeline' }).count()).toBe(0);
  }, 120_000);

  it('mixes the sound and exports the example to an MP4', async () => {
    await runRow('Sound design mixed');
    await waitDone('Sound design mixed', 180_000);
    expect(existsSync(path.join(exampleDir(), 'audio', 'mix.wav'))).toBe(true);
    await runRow('Video exported');
    await waitDone('Video exported', 600_000);
    const out = path.join(exampleDir(), 'out');
    const videos = (await readdir(out)).filter((name) => name.endsWith('.mp4'));
    expect(videos).toHaveLength(1);
    const file = path.join(out, videos[0] ?? '');
    expect((await stat(file)).size).toBeGreaterThan(10_000);
    const info = ffprobe(file);
    expect(info.durationS).toBeGreaterThan(30);
    expect(info.durationS).toBeLessThan(31.2);
    expect(info.streams.find((stream) => stream.codec_type === 'video')).toMatchObject({
      width: 1920,
      height: 1080,
    });
    expect(info.streams.some((stream) => stream.codec_type === 'audio')).toBe(true);
    expect(await page.getByTestId('next-step').textContent()).toContain('Done');
    await shot('exported');
  }, 720_000);
});
