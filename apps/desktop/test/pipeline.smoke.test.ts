/**
 * The whole pipeline in the built app (`pnpm test:app`; PLAN.md#7.2-7.7, the E2E skeleton of
 * #10.1): brief -> script (fake-claude) -> approve -> record a 2 s take with Chromium's fake
 * microphone -> replace it with a file (archived, later stages stale) -> Audio cleaned (real
 * ffmpeg) -> Words timed (a recorded transcription through REELFORGE_TEST_TRANSCRIPT; no whisper
 * model) -> Storyboard -> Scenes built (QA on the app's render windows, ✓ badges, the automatic
 * final review) -> the "Check every visual lands on its spoken word" chip (sync report in the chat
 * and the Scenes panel) ->
 * Sound design mixed (real ffmpeg) -> Video exported -> an MP4 that ffprobe reads. Never a model
 * call. Screenshots at 1280x720 in out/test-app/pipeline-*.png.
 */
import { existsSync } from 'node:fs';
import { cp, mkdir, mkdtemp, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fakeClaudeBinPath } from '@reelforge/fake-claude';
import type { ElectronApplication, Page } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { logFile, TEST_CLAUDE_LAUNCHER_ENV } from '../src/main/app-paths.js';
import { closeApp, launchApp, screenshotDir, stubFolderPicker } from './support/electron-app.js';
import { showChat, showStage, stageText } from './support/pipeline-rows.js';
import {
  ffprobe,
  golden,
  pipelineScript,
  recordedTranscript,
  synthesizeVoiceover,
} from './support/pipeline-film.js';

let app: ElectronApplication;
let page: Page;
let userDataDir: string;
let projectDir: string;

async function shot(name: string): Promise<void> {
  await page.screenshot({ path: path.join(screenshotDir, `pipeline-1280-${name}.png`) });
}

function pipeline() {
  return page.getByRole('region', { name: 'Pipeline' });
}

async function rowText(label: string): Promise<string> {
  return stageText(page, label);
}

async function waitDone(label: string, timeout: number): Promise<void> {
  await expect
    .poll(() => rowText(label), { timeout, interval: 500 })
    .toMatch(new RegExp(`^${label}Done`));
}

/** Selects a sidebar row and presses its Run (Retry / Resume) button. */
async function runRow(label: string): Promise<void> {
  await (await showStage(page, label)).click();
  const run = pipeline()
    .getByRole('group', { name: `${label} actions` })
    .getByRole('button', { name: /^(Run|Retry|Resume)$/ });
  await expect.poll(() => run.getAttribute('aria-disabled')).toBe('false');
  await run.click();
}

async function openRow(label: string): Promise<void> {
  await (await showStage(page, label)).click();
  await pipeline()
    .getByRole('group', { name: `${label} actions` })
    .getByRole('button', { name: 'Open' })
    .click();
}

beforeAll(async () => {
  userDataDir = await mkdtemp(path.join(tmpdir(), 'reelforge pipeline ż-'));
  const sidecar = path.join(userDataDir, 'fake-claude-script.json');
  await writeFile(sidecar, JSON.stringify(pipelineScript()));
  const transcript = path.join(userDataDir, 'words.raw.json');
  await writeFile(transcript, recordedTranscript());
  await mkdir(screenshotDir, { recursive: true });
  app = await launchApp(userDataDir, {
    env: {
      [TEST_CLAUDE_LAUNCHER_ENV]: JSON.stringify({
        command: process.execPath,
        args: [fakeClaudeBinPath],
      }),
      FAKE_CLAUDE_SCRIPT: sidecar,
      REELFORGE_TEST_HOOKS: '1',
      REELFORGE_TEST_TRANSCRIPT: transcript,
      REELFORGE_TEST_FAKE_MEDIA: '1',
    },
  });
  page = await app.firstWindow();
  await page.getByRole('region', { name: 'Start' }).waitFor();
  await app.evaluate(({ BrowserWindow }) => {
    BrowserWindow.getAllWindows()[0]?.setContentSize(1280, 720);
  });
  await page.waitForFunction(() => window.innerWidth === 1280 && window.innerHeight === 720);
}, 180_000);

afterAll(async () => {
  await closeApp(app);
  await cp(logFile(userDataDir), path.join(screenshotDir, 'pipeline-main.log')).catch(
    () => undefined,
  );
  await rm(userDataDir, { recursive: true, force: true });
});

describe('the pipeline in the app', () => {
  it('writes and approves the script', async () => {
    const parent = path.join(userDataDir, 'Filmy');
    await mkdir(parent);
    await stubFolderPicker(app, parent);
    await page.getByLabel('Video title').fill('Rainbow in a glass');
    await page.getByRole('button', { name: 'New project…' }).click();
    projectDir = path.join(parent, 'Rainbow in a glass');
    const brief = page.getByRole('form', { name: 'Brief' });
    await brief.waitFor();
    await brief
      .getByLabel('What is the video about?')
      .fill('Make a rainbow with a glass of water and a flashlight. Newton explained it in 1672.');
    await brief.getByLabel('Target length (minutes)').fill('0.5');
    await brief.getByRole('button', { name: 'Write script' }).click();
    const editor = page.getByRole('textbox', { name: 'Script' });
    await expect.poll(() => editor.inputValue(), { timeout: 30_000 }).toBe(golden('script.txt'));
    await page.getByRole('button', { name: 'Approve script' }).click();
    await page.getByText('Approved ✓').waitFor();
    await page.getByRole('button', { name: 'Back to preview' }).click();
    await waitDone('Script written', 10_000);
  }, 90_000);

  it('records a 2 s take with the microphone and imports it', async () => {
    await openRow('Voiceover added');
    const panel = page.getByRole('region', { name: 'Voiceover' });
    await panel.getByRole('button', { name: 'Record…' }).click();
    const booth = panel.getByRole('region', { name: 'Record a voice-over' });
    await booth.getByRole('button', { name: 'Record', exact: true }).click();
    await booth.getByText(/^Recording 0:0[2-9]$/).waitFor({ timeout: 15_000 });
    await shot('recording');
    await booth.getByRole('button', { name: 'Stop' }).click();
    await booth.getByRole('button', { name: 'Use this take' }).click();
    const original = path.join(projectDir, 'audio', 'vo.original.wav');
    await expect.poll(() => existsSync(original), { timeout: 20_000 }).toBe(true);
    await waitDone('Voiceover added', 20_000);
    const wav = await readFile(original);
    expect(wav.subarray(0, 4).toString('latin1')).toBe('RIFF');
    expect(wav.readUInt32LE(24)).toBe(48_000);
    const seconds = wav.readUInt32LE(40) / 2 / 48_000;
    expect(seconds).toBeGreaterThan(1.8);
    expect(seconds).toBeLessThan(4);
    await panel.getByText(/^Recording 0:0\d: shorter than the script needs\.$/).waitFor();
    await shot('take');
  }, 90_000);

  it('replaces the take with a file, then cleans and times the words', async () => {
    const take = path.join(userDataDir, 'voice take.wav');
    synthesizeVoiceover(take);
    await stubFolderPicker(app, take);
    const panel = page.getByRole('region', { name: 'Voiceover' });
    await panel.getByRole('button', { name: 'Replace with a file…' }).click();
    const previous = path.join(projectDir, 'audio', 'vo.original.prev.wav');
    await expect.poll(() => existsSync(previous), { timeout: 20_000 }).toBe(true);
    await panel.getByText('Recording 0:38: fits the script.').waitFor({ timeout: 20_000 });
    await page.getByRole('button', { name: 'Back to preview' }).click();

    await runRow('Audio cleaned');
    await waitDone('Audio cleaned', 120_000);
    await runRow('Words timed');
    await waitDone('Words timed', 60_000);
    await openRow('Words timed');
    const words = page.getByRole('region', { name: 'Words timed' });
    await words.getByText(/^Alignment good: 100 % of the script was heard/).waitFor();
    await shot('words');
    await page.getByRole('button', { name: 'Back to preview' }).click();
  }, 240_000);

  it('builds the storyboard and every scene with QA badges', async () => {
    await runRow('Storyboard');
    await waitDone('Storyboard', 60_000);
    await runRow('Scenes built');
    await page.locator('.shots-progress').waitFor({ timeout: 30_000 });
    await shot('scenes-running');
    // Regression (PLAN.md#11.2): the progress block of the docked panel used to shrink and draw
    // "Building shot n/m · <step>" and "<step>" over the lines under it.
    await openRow('Scenes built');
    const scenesPanel = page.getByRole('region', { name: 'Scenes built' });
    await scenesPanel.locator('.stage-run').waitFor({ timeout: 30_000 });
    const progress = await scenesPanel.evaluate((panel) => {
      const body = panel.querySelector('.doc-body');
      const children = [...(body?.children ?? [])].map((child) => child.getBoundingClientRect());
      const overlaps = children
        .slice(1)
        .filter((rect, index) => rect.top < (children[index]?.bottom ?? 0) - 1).length;
      return {
        overlaps,
        title: panel.querySelector('.stage-run-title')?.textContent ?? '',
        step: panel.querySelector('.stage-run-step')?.textContent ?? '',
      };
    });
    expect(progress.overlaps).toBe(0);
    expect(progress.title).toMatch(/^Shot \d+ of 7$/);
    expect(progress.step).not.toContain(progress.title);
    await scenesPanel.getByRole('button', { name: /^Stop building$/ }).waitFor();
    await shot('scenes-running-panel');
    await scenesPanel.getByRole('button', { name: 'Back to preview' }).click();
    await waitDone('Scenes built', 420_000);
    // The quiet final review follows by itself (PLAN.md#11.5).
    await expect
      .poll(() => rowText('Scenes built'), { timeout: 180_000, interval: 500 })
      .toMatch(/^Scenes builtDone.*Review done: 7 ✓/);
    const shots = page.getByRole('region', { name: 'Shots' });
    await expect.poll(() => shots.locator('.shot-badge.qa-ok').count()).toBe(7);
    await shots.getByRole('button', { name: /^QA of s04_rainbow/ }).click();
    await shots.getByRole('button', { name: 'Rebuild this shot' }).waitFor();
    await shot('scenes-badges');
    const report = JSON.parse(
      await readFile(path.join(projectDir, '.reelforge', 'scenes-report.json'), 'utf8'),
    ) as { shots: { status: string }[] };
    expect(report.shots.map((entry) => entry.status)).toEqual(Array(7).fill('ok'));
  }, 480_000);

  it('runs the sync check from the Whole-video chip and shows the report', async () => {
    const chat = await showChat(page);
    await chat.getByRole('button', { name: 'Check every visual lands on its spoken word' }).click();
    await chat.locator('[data-turn-status="done"]').waitFor({ timeout: 120_000 });
    await chat.getByText(/^Review \(sync-check\)/).waitFor();
    expect(existsSync(path.join(projectDir, '.reelforge', 'sync-report.json'))).toBe(true);
    await openRow('Scenes built');
    const panel = page.getByRole('region', { name: 'Scenes built' });
    const rows = panel.locator('.sync-row');
    await expect.poll(() => rows.count()).toBeGreaterThan(3);
    await panel.locator('.sync-row', { hasText: 's05_spectrum' }).first().click();
    await expect
      .poll(() =>
        page
          .getByRole('region', { name: 'Shots' })
          .getByRole('button', { name: /^Shot s05_spectrum/ })
          .getAttribute('aria-pressed'),
      )
      .toBe('true');
    await shot('sync');
    await panel.getByRole('button', { name: 'Back to preview' }).click();
  }, 180_000);

  it('mixes the sound and exports an MP4', async () => {
    await runRow('Sound design mixed');
    await waitDone('Sound design mixed', 180_000);
    await runRow('Video exported');
    await expect
      .poll(() => rowText('Video exported'), { timeout: 60_000 })
      .toMatch(/Rendering|Planning|Encoding|Done/);
    await shot('export-running');
    await waitDone('Video exported', 600_000);
    const out = path.join(projectDir, 'out');
    const videos = (await readdir(out)).filter((name) => name.endsWith('.mp4'));
    expect(videos).toHaveLength(1);
    const file = path.join(out, videos[0] ?? '');
    expect((await stat(file)).size).toBeGreaterThan(10_000);
    const info = ffprobe(file);
    expect(info.durationS).toBeGreaterThan(36);
    expect(info.durationS).toBeLessThan(39);
    expect(info.streams.find((stream) => stream.codec_type === 'video')).toMatchObject({
      width: 1920,
      height: 1080,
    });
    expect(info.streams.some((stream) => stream.codec_type === 'audio')).toBe(true);
    expect(await rowText('Video exported')).toContain('out/');
    await shot('exported');
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      1280,
    );
  }, 720_000);
});
