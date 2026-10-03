/**
 * Regression test of the P0 "preview loses its sound after ~20-30 s" bug (PLAN.md#11.1) on the
 * built app (`pnpm test:app`). A real-sized mix.wav (48 kHz 16-bit stereo = 192 KB/s) plays in
 * the preview in real time across the 4 MB marks (21.8 s, 43.7 s) where the old capped range
 * answers made Chromium believe the file ended; seeking near the end works; a Render mix that
 * replaces mix.wav while playing (here with a 15-minute file, ≈ 173 MB) reloads the audio and it
 * plays and seeks to its end.
 */
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { renameRetrying } from '@reelforge/pipeline';
import type { ElectronApplication, Page } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { masterAudio, playbackProblems, sampleMasterAudio } from './support/audio-probes.js';
import {
  FIRST_FRAME_TIMEOUT_MS,
  closeApp,
  fixtureProject,
  launchApp,
  screenshotDir,
  stubFolderPicker,
  waitForRenderedT,
} from './support/electron-app.js';
import { stereoToneWav } from './support/player-probes.js';

const FILM_SECONDS = 90;
const LONG_FILM_SECONDS = 15 * 60;

let app: ElectronApplication;
let page: Page;
let userDataDir: string;
let projectDir: string;

/** The fixture storyboard with its last shot stretched to `seconds`. */
async function stretchVideo(seconds: number): Promise<void> {
  const file = path.join(projectDir, 'storyboard.json');
  const storyboard = JSON.parse(await readFile(file, 'utf8')) as {
    shots: { t1: number }[];
  };
  const last = storyboard.shots.at(-1);
  if (!last) throw new Error('fixture storyboard has no shots');
  last.t1 = seconds;
  await writeFile(file, `${JSON.stringify(storyboard, null, 2)}\n`);
}

async function seekWithSlider(t: number): Promise<void> {
  await page.getByRole('slider', { name: 'Scrub' }).fill(String(t));
  await waitForRenderedT(page, t.toFixed(3));
}

async function videoDuration(): Promise<number> {
  return Number(await page.getByRole('slider', { name: 'Scrub' }).getAttribute('max'));
}

async function pause(): Promise<void> {
  await page.keyboard.press('k');
  await page.locator('section.preview[data-playing="false"]').waitFor();
}

beforeAll(async () => {
  userDataDir = await mkdtemp(path.join(tmpdir(), 'reelforge preview audio ż-'));
  projectDir = path.join(userDataDir, 'Nokia ż film');
  await cp(fixtureProject, projectDir, { recursive: true });
  await stretchVideo(FILM_SECONDS);
  await mkdir(path.join(projectDir, 'audio'));
  await writeFile(path.join(projectDir, 'audio', 'mix.wav'), stereoToneWav(FILM_SECONDS));
  app = await launchApp(userDataDir);
  page = await app.firstWindow();
  await page.getByRole('region', { name: 'Start' }).waitFor();
  await stubFolderPicker(app, projectDir);
  await page.getByRole('button', { name: 'Open project…' }).click();
  await page
    .locator('canvas.preview-canvas[data-rendered-t]')
    .waitFor({ timeout: FIRST_FRAME_TIMEOUT_MS });
  await page.locator('section.preview[data-clock="audio"]').waitFor({ timeout: 10_000 });
});

afterAll(async () => {
  await closeApp(app);
  await rm(userDataDir, { recursive: true, force: true });
});

describe('preview audio of a whole film', () => {
  it('plays the 90 s mix with sound past 40 s, across the 4 MB marks', async () => {
    expect(await videoDuration()).toBe(FILM_SECONDS);
    await seekWithSlider(16);
    await page.keyboard.press('Space');
    const samples = await sampleMasterAudio(page, { untilT: 45, timeoutMs: 40_000 });
    await pause();
    const last = samples.at(-1);
    expect(last?.renderedT).toBeGreaterThanOrEqual(45);
    // The audio knows the real length of the file (the bug: 21.8 s, the first 4 MB).
    expect(last?.duration).toBeCloseTo(FILM_SECONDS, 1);
    expect(last?.currentTime).toBeGreaterThan(44);
    expect(last?.bufferedEnd).toBeGreaterThan(44);
    expect(last?.decodedBytes).toBeGreaterThan(4 * 1024 * 1024);
    // Steady, in real time: the picture follows the audio clock the whole way.
    expect(playbackProblems(samples.slice(2))).toEqual([]);
    expect(await page.getByTestId('preview-audio-problem').count()).toBe(0);
  });

  it('seeks near the end of the 90 s mix and plays it to the end', async () => {
    await seekWithSlider(85);
    expect((await masterAudio(page)).currentTime).toBeCloseTo(85, 1);
    await page.keyboard.press('Space');
    const samples = await sampleMasterAudio(page, { untilT: 88, timeoutMs: 10_000 });
    expect(playbackProblems(samples.slice(1))).toEqual([]);
    // Plays to the end of the video and stops there.
    await page.locator('section.preview[data-playing="false"]').waitFor({ timeout: 10_000 });
    await waitForRenderedT(page, FILM_SECONDS.toFixed(3));
    expect((await masterAudio(page)).error).toBeNull();
  });

  it('reloads and plays a 15-minute mix that replaced mix.wav during playback', async () => {
    await seekWithSlider(20);
    await page.keyboard.press('Space');
    await sampleMasterAudio(page, { untilT: 22, timeoutMs: 10_000 });
    // Like Render mix: tmp + rename over the file the player is reading (Windows: no open handle).
    const tmp = path.join(projectDir, 'audio', 'mix.wav.tmp');
    await writeFile(tmp, stereoToneWav(LONG_FILM_SECONDS));
    await renameRetrying(tmp, path.join(projectDir, 'audio', 'mix.wav'));
    await stretchVideo(LONG_FILM_SECONDS);
    await page.waitForFunction(
      (seconds) =>
        Math.abs(
          (document.querySelector<HTMLAudioElement>('audio[data-testid="player-audio"]')
            ?.duration ?? 0) - seconds,
        ) < 0.1,
      LONG_FILM_SECONDS,
      { timeout: 20_000 },
    );
    await page.waitForFunction(
      (seconds) =>
        document.querySelector<HTMLInputElement>('input[aria-label="Scrub"]')?.max ===
        String(seconds),
      LONG_FILM_SECONDS,
      { timeout: 20_000 },
    );
    const resumed = await sampleMasterAudio(page, { untilT: 30, timeoutMs: 15_000 });
    expect(playbackProblems(resumed.slice(2))).toEqual([]);

    // Seeks deep into the 173 MB file stream from there and play on.
    await seekWithSlider(600);
    const middle = await sampleMasterAudio(page, { untilT: 603, timeoutMs: 10_000 });
    expect(playbackProblems(middle.slice(1))).toEqual([]);
    await seekWithSlider(LONG_FILM_SECONDS - 3);
    const end = await sampleMasterAudio(page, {
      untilT: LONG_FILM_SECONDS - 1,
      timeoutMs: 10_000,
    });
    expect(playbackProblems(end.slice(1))).toEqual([]);
    await page.locator('section.preview[data-playing="false"]').waitFor({ timeout: 10_000 });
    expect((await masterAudio(page)).error).toBeNull();
  });

  it('says so when the audio cannot be played, instead of going silent', async () => {
    const mix = path.join(projectDir, 'audio', 'mix.wav');
    const tmp = `${mix}.tmp`;
    await writeFile(tmp, Buffer.from('RIFF....WAVE this is not audio'.repeat(100)));
    await renameRetrying(tmp, mix);
    // One reload of the source, then the warning; the picture runs on the system clock.
    const warning = page.getByTestId('preview-audio-problem');
    await warning
      .getByText(/^Preview audio failed: .+ The preview plays on without sound\.$/)
      .waitFor({
        timeout: 20_000,
      });
    await page.locator('section.preview[data-clock="system"]').waitFor();
    await page.screenshot({ path: path.join(screenshotDir, 'preview-audio-warning.png') });
    await seekWithSlider(10);
    await page.keyboard.press('Space');
    const run = await sampleMasterAudio(page, { untilT: 11, timeoutMs: 5000 });
    await pause();
    expect(run.at(-1)?.renderedT).toBeGreaterThanOrEqual(11);
    // A playable mix (e.g. the next Render mix) clears the warning and is the clock again.
    await writeFile(tmp, stereoToneWav(LONG_FILM_SECONDS));
    await renameRetrying(tmp, mix);
    await page.locator('section.preview[data-clock="audio"]').waitFor({ timeout: 20_000 });
    expect(await warning.count()).toBe(0);
  });
});
