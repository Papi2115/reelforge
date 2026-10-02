/**
 * Robustness scenarios on the built app (`pnpm test:app`, PLAN.md#10.2), with fake-claude (never a
 * model call):
 * - damaged files: a corrupt settings.json is backed up and the app starts; a truncated
 *   storyboard.json is restored from history (new commit), a broken .reelforge/pipeline.json is
 *   reset; a damaged project.json fails the open with "Restore from history", which opens it;
 * - the app is hard-killed (whole process tree) while the Storyboard stage waits on Claude: the
 *   relaunch shows Interrupted + Resume, no orphan process, no lock, git and pipeline.json sound;
 * - the app is hard-killed mid-export: the relaunch offers Resume, only unfinished shots are
 *   rendered again and the MP4 verifies with ffprobe.
 * Screenshots at 1280×720 in out/test-app/recovery-*.png.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pipelineStateSchema } from '@reelforge/shared';
import type { ElectronApplication, Page } from 'playwright';
import { afterAll, describe, expect, it } from 'vitest';
import { logFile, settingsFile } from '../src/main/app-paths.js';
import {
  alive,
  gitHealth,
  gitSubjects,
  hardKill,
  launchWithScript,
  openFolder,
  seedProfile,
  waitFor,
} from './support/crash-recovery.js';
import { fixtureProject, launchApp, screenshotDir } from './support/electron-app.js';
import { ffprobe, golden, GOLDEN, synthesizeVoiceover } from './support/pipeline-film.js';

const profiles: string[] = [];
const apps: ElectronApplication[] = [];

afterAll(async () => {
  for (const app of apps) await app.close().catch(() => undefined);
  for (const [index, profile] of profiles.entries()) {
    await cp(
      logFile(profile),
      path.join(screenshotDir, `recovery-main-${String(index)}.log`),
    ).catch(() => undefined);
    await rm(profile, { recursive: true, force: true, maxRetries: 5 });
  }
});

async function profile(): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), 'reelforge recovery ż-'));
  profiles.push(dir);
  await mkdir(screenshotDir, { recursive: true });
  return dir;
}

async function launched(
  userDataDir: string,
  name: string,
  script: Parameters<typeof launchWithScript>[2],
  env: Readonly<Record<string, string>> = {},
): Promise<{ readonly app: ElectronApplication; readonly page: Page }> {
  const result = await launchWithScript(userDataDir, name, script, env);
  apps.push(result.app);
  await result.app.evaluate(({ BrowserWindow }) => {
    BrowserWindow.getAllWindows()[0]?.setContentSize(1280, 720);
  });
  return result;
}

function pipeline(page: Page) {
  return page.getByRole('region', { name: 'Pipeline' });
}

async function rowText(page: Page, label: string): Promise<string> {
  return (await pipeline(page).getByRole('button', { name: label }).first().textContent()) ?? '';
}

async function rowAction(page: Page, label: string, action: RegExp): Promise<void> {
  await pipeline(page).getByRole('button', { name: label }).first().click();
  const button = pipeline(page)
    .getByRole('group', { name: `${label} actions` })
    .getByRole('button', { name: action });
  await expect.poll(() => button.getAttribute('aria-disabled')).not.toBe('true');
  await button.click();
}

const APPROVED = (): string => {
  const stamp = '2026-10-02T10:00:00.000Z';
  return JSON.stringify({
    version: 1,
    updatedAt: stamp,
    stages: { script: { status: 'done', updatedAt: stamp, approvedAt: stamp } },
    queue: [],
  });
};

describe('damaged files', () => {
  it('backs up a corrupt settings.json and starts with the defaults (no crash loop)', async () => {
    const userDataDir = await profile();
    await writeFile(settingsFile(userDataDir), '{ "version": 1, "onboard');
    for (let start = 0; start < 2; start += 1) {
      const app = await launchApp(userDataDir, { firstRun: true });
      const page = await app.firstWindow();
      await page.getByRole('region', { name: 'Start' }).waitFor();
      await app.close();
    }
    const backups = readdirSync(userDataDir).filter((name) => name.startsWith('settings.corrupt-'));
    expect(backups).toHaveLength(1);
  }, 120_000);

  it('restores documents from history, resets app state and reopens a damaged project.json', async () => {
    const userDataDir = await profile();
    await seedProfile(userDataDir);
    const dir = path.join(userDataDir, 'Uszkodzony film');
    await cp(fixtureProject, dir, { recursive: true });
    const { app, page } = await launched(userDataDir, 'ok', { version: 1, default: 'ok' });
    await openFolder(app, page, dir);
    await page.locator('.project-title').waitFor();

    const storyboard = path.join(dir, 'storyboard.json');
    const state = path.join(dir, '.reelforge', 'pipeline.json');
    const good = await readFile(storyboard, 'utf8');
    await writeFile(storyboard, good.slice(0, 40));
    await mkdir(path.dirname(state), { recursive: true });
    await writeFile(state, '{ "version": 1, "sta');
    const banner = page.getByRole('region', { name: 'Damaged files' });
    await banner.getByText(/^storyboard\.json is not valid JSON/).waitFor({ timeout: 15_000 });
    await banner.getByText(/^\.reelforge\/pipeline\.json is not valid JSON/).waitFor();
    await page.screenshot({ path: path.join(screenshotDir, 'recovery-1280-damaged-files.png') });

    await banner.getByRole('button', { name: 'Restore from history' }).click();
    await expect.poll(() => readFile(storyboard, 'utf8'), { timeout: 15_000 }).toBe(good);
    await expect
      .poll(() => gitSubjects(dir)[0], { timeout: 15_000 })
      .toMatch(/^Restore storyboard\.json from [0-9a-f]{7}: /);
    await banner.getByRole('button', { name: 'Reset to defaults' }).click();
    await expect.poll(() => existsSync(state), { timeout: 15_000 }).toBe(false);
    const kept = readdirSync(path.dirname(state)).filter((name) => name.includes('.corrupt-'));
    expect(kept).toHaveLength(1);
    await expect.poll(() => banner.locator('.file-problem').count(), { timeout: 15_000 }).toBe(0);

    await page.getByRole('button', { name: 'Close project' }).click();
    const projectJson = path.join(dir, 'project.json');
    const project = await readFile(projectJson, 'utf8');
    await writeFile(projectJson, project.slice(0, 30));
    await openFolder(app, page, dir);
    const recovery = page.getByRole('alert', { name: 'Damaged project file' });
    await recovery.getByText(projectJson).waitFor({ timeout: 15_000 });
    await page.getByText('Restore it from the project history', { exact: false }).first().waitFor();
    await page.screenshot({ path: path.join(screenshotDir, 'recovery-1280-project-json.png') });
    await recovery.getByRole('button', { name: 'Restore from history' }).click();
    await page.locator('.project-title').waitFor({ timeout: 15_000 });
    expect(await readFile(projectJson, 'utf8')).toBe(project);
    expect(gitHealth(dir)).toEqual({ lock: false, status: 0, fsck: 0 });
    await app.close();
  }, 180_000);
});

describe('the app is killed while the Storyboard stage runs', () => {
  it('shows Interrupted + Resume after a relaunch; nothing stuck; Resume finishes the stage', async () => {
    const userDataDir = await profile();
    await seedProfile(userDataDir);
    const dir = path.join(userDataDir, 'Pryzmat po awarii');
    await cp(GOLDEN, dir, { recursive: true });
    await rm(path.join(dir, 'storyboard.json'));
    await mkdir(path.join(dir, '.reelforge'), { recursive: true });
    await writeFile(path.join(dir, '.reelforge', 'pipeline.json'), APPROVED());
    const childPidFile = path.join(userDataDir, 'claude-child.pid');
    const first = await launched(
      userDataDir,
      'hang',
      { version: 1, default: 'hang' },
      { FAKE_CLAUDE_CHILD_PID_FILE: childPidFile },
    );
    await openFolder(first.app, first.page, dir);
    await rowAction(first.page, 'Storyboard', /^Run$/);
    await expect
      .poll(() => rowText(first.page, 'Storyboard'), { timeout: 30_000 })
      .toMatch(/^StoryboardRunning/);
    const sessions = path.join(dir, '.reelforge', 'sessions.json');
    await waitFor(
      () =>
        existsSync(childPidFile) &&
        existsSync(sessions) &&
        readFileSync(sessions, 'utf8').includes('pendingTurn'),
      30_000,
    );
    const claudeChild = Number(readFileSync(childPidFile, 'utf8'));
    await hardKill(first.app);
    // The whole tree went with it: no orphan claude (fake) process.
    await waitFor(() => !alive(claudeChild), 15_000);

    const second = await launched(userDataDir, 'storyboard', {
      version: 1,
      default: {
        scenario: 'tools-write',
        reply: '7 shots. Missing props: none.',
        writes: [{ path: 'storyboard.json', content: golden('storyboard.json') }],
      },
    });
    await openFolder(second.app, second.page, dir);
    await expect
      .poll(() => rowText(second.page, 'Storyboard'), { timeout: 30_000 })
      .toMatch(/^StoryboardInterrupted/);
    expect(gitHealth(dir)).toEqual({ lock: false, status: 0, fsck: 0 });
    const state = pipelineStateSchema.parse(
      JSON.parse(await readFile(path.join(dir, '.reelforge', 'pipeline.json'), 'utf8')),
    );
    expect(state.stages['storyboard']).toMatchObject({ status: 'failed', interrupted: true });
    await second.page.screenshot({
      path: path.join(screenshotDir, 'recovery-1280-interrupted.png'),
    });

    await rowAction(second.page, 'Storyboard', /^Resume$/);
    await expect
      .poll(() => rowText(second.page, 'Storyboard'), { timeout: 90_000, interval: 500 })
      .toMatch(/^StoryboardDone/);
    expect(existsSync(path.join(dir, 'storyboard.json'))).toBe(true);
    expect(gitHealth(dir).lock).toBe(false);
    await second.app.close();
  }, 300_000);
});

const SHOT_SECONDS = 6;
const SHOTS = 3;

/** The CLI fixture as three 6 s shots with a synthetic mix, script approved. */
async function exportProject(target: string): Promise<void> {
  await cp(fixtureProject, target, { recursive: true });
  const file = path.join(target, 'storyboard.json');
  const storyboard = JSON.parse(await readFile(file, 'utf8')) as {
    shots: Record<string, unknown>[];
  };
  const [title, calc] = storyboard.shots;
  storyboard.shots = [
    { ...title, t0: 0, t1: SHOT_SECONDS },
    { ...calc, t0: SHOT_SECONDS, t1: 2 * SHOT_SECONDS },
    { ...calc, id: 's03', t0: 2 * SHOT_SECONDS, t1: SHOTS * SHOT_SECONDS },
  ];
  await writeFile(file, JSON.stringify(storyboard, null, 2));
  await mkdir(path.join(target, 'audio'), { recursive: true });
  synthesizeVoiceover(path.join(target, 'audio', 'mix.wav'), SHOTS * SHOT_SECONDS);
  await mkdir(path.join(target, '.reelforge'), { recursive: true });
  await writeFile(path.join(target, '.reelforge', 'pipeline.json'), APPROVED());
}

function exportState(dir: string): { finished: unknown[]; status: string } | undefined {
  const file = path.join(dir, '.reelforge', 'cache', 'export', 'export-state.json');
  if (!existsSync(file)) return undefined;
  try {
    return JSON.parse(readFileSync(file, 'utf8')) as { finished: unknown[]; status: string };
  } catch {
    return undefined; // being replaced right now (atomic rename): read again
  }
}

describe('the app is killed during an export', () => {
  it('offers Resume after a relaunch and renders only the unfinished shots', async () => {
    const userDataDir = await profile();
    await seedProfile(userDataDir);
    const dir = path.join(userDataDir, 'Eksport po awarii');
    await exportProject(dir);
    const first = await launched(userDataDir, 'ok', { version: 1, default: 'ok' });
    await openFolder(first.app, first.page, dir);
    await rowAction(first.page, 'Video exported', /^Open$/);
    const dialog = first.page.getByRole('dialog', { name: 'Export video' });
    await dialog.waitFor();
    await dialog.getByRole('combobox', { name: 'Encoder' }).selectOption('cpu');
    await dialog.getByRole('radio', { name: 'Draft (fast)' }).check();
    await dialog.getByRole('textbox', { name: 'File name' }).fill('Crash test');
    await dialog.getByRole('button', { name: 'Add to queue' }).click();
    await waitFor(() => (exportState(dir)?.finished.length ?? 0) >= 1, 240_000);
    await hardKill(first.app);
    const finished = exportState(dir)?.finished.length ?? 0;
    expect(exportState(dir)?.status).toBe('running');
    expect(finished).toBeLessThan(SHOTS);

    const second = await launched(userDataDir, 'ok-again', { version: 1, default: 'ok' });
    await openFolder(second.app, second.page, dir);
    await rowAction(second.page, 'Video exported', /^Open$/);
    const resumed = second.page.getByRole('dialog', { name: 'Export video' });
    const notice = resumed.locator('.export-interrupted');
    await notice
      .getByText(`An export did not finish (${String(finished)} of ${String(SHOTS)} shots done)`, {
        exact: false,
      })
      .waitFor({ timeout: 30_000 });
    await second.page.screenshot({ path: path.join(screenshotDir, 'recovery-1280-export.png') });
    await notice.getByRole('button', { name: 'Resume' }).click();
    const job = resumed.getByRole('listitem', { name: 'Export Crash test.mp4' });
    await job.getByTestId('export-report').waitFor({ timeout: 300_000 });
    const report = (await job.textContent()) ?? '';
    const rendered = /Re-rendered (\d+) of (\d+) shots/.exec(report);
    expect(rendered?.[2]).toBe(String(SHOTS));
    expect(Number(rendered?.[1])).toBeLessThanOrEqual(SHOTS - finished);
    const info = ffprobe(path.join(dir, 'out', 'Crash test.mp4'));
    expect(Math.abs(info.durationS - SHOTS * SHOT_SECONDS)).toBeLessThan(0.5);
    expect(info.streams.find((stream) => stream.codec_type === 'video')).toMatchObject({
      width: 1920,
      height: 1080,
    });
    expect(gitHealth(dir).lock).toBe(false);
    await second.app.close();
  }, 600_000);
});
