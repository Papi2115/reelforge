/**
 * whisper.cpp setup in the built app (`pnpm test:app`): Settings → Tools installs the engine and
 * the recommended model from a local fake mirror (REELFORGE_TEST_WHISPER_MIRROR: tiny stand-in
 * zips/models re-pinned by hashes.json, slowed down so the progress is visible) into a test root
 * (REELFORGE_TEST_WHISPER_ROOT), then Words timed runs; with the model deleted, Words timed holds
 * the run and offers "Download and continue" (a failed download first: actionable message, Open
 * Settings, Try again) and finishes on its own. The transcription itself is the recorded one
 * (REELFORGE_TEST_TRANSCRIPT); nothing is downloaded from the internet, no model runs.
 * Screenshots at 1280×720 in out/test-app/whisper-1280-*.png.
 */
import { cp, mkdir, mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { WHISPER_MODELS } from '@reelforge/pipeline';
import type { ElectronApplication, Page } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  CLAUDE_SEARCH_DIR_ENV,
  logFile,
  settingsFile,
  TEST_PROJECTS_DIR_ENV,
} from '../src/main/app-paths.js';
import {
  TEST_WHISPER_DELAY_ENV,
  TEST_WHISPER_MIRROR_ENV,
  TEST_WHISPER_ROOT_ENV,
} from '../src/main/whisper/test-hooks.js';
import { writeFakeMirror } from '../src/main/whisper/testing/fake-mirror.js';
import { appRoot, closeApp, launchApp, screenshotDir } from './support/electron-app.js';
import { showStage } from './support/pipeline-rows.js';

let app: ElectronApplication | undefined;
let page: Page;
let dir: string;
let mirror: string;

const MODEL_FILE = WHISPER_MODELS['large-v3-turbo-q5_0'].fileName;

async function shot(name: string): Promise<void> {
  await page.screenshot({ path: path.join(screenshotDir, `whisper-1280-${name}.png`) });
}

const pipeline = () => page.getByRole('region', { name: 'Pipeline' });

async function rowText(label: string): Promise<string> {
  return (await (await showStage(page, label)).textContent()) ?? '';
}

/** `words.raw.json` replayed by the transcription hook: the example's own timing, on the CPU. */
async function exampleTranscript(file: string): Promise<void> {
  const example = path.join(appRoot, '..', '..', 'templates', 'examples', 'doom-on-a-calculator');
  const words = JSON.parse(await readFile(path.join(example, 'timing', 'words.json'), 'utf8')) as {
    words: { text: string; t: number; tEnd: number }[];
  };
  const end = Math.ceil(words.words.at(-1)?.tEnd ?? 1);
  await writeFile(
    file,
    JSON.stringify({
      version: 1,
      engine: 'whisper.cpp',
      model: 'large-v3-turbo-q5_0',
      lang: 'en',
      decodedLang: 'en',
      mode: 'chunk',
      backend: 'blas',
      usedGpu: false,
      fallbacks: [
        {
          backend: 'cuda',
          gpu: true,
          message: 'CUDA unavailable: no CUDA-capable device is detected',
        },
      ],
      dtwLeadS: 0.21,
      audioS: end,
      wallMs: 51_000,
      chunks: [{ start: 0, end }],
      words: words.words.map((word) => ({ ...word, p: 0.95, tDtw: null })),
    }),
  );
}

beforeAll(async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'reelforge whisper app ż-'));
  mirror = path.join(dir, 'mirror');
  // 6 MB models at 15 ms per 64 KB chunk: about 1.5 s per model, long enough to see progress.
  await writeFakeMirror(mirror, { modelBytes: 6 * 1024 * 1024 });
  const transcript = path.join(dir, 'words.raw.json');
  await exampleTranscript(transcript);
  // Onboarding done: no Welcome screen, no guided tour over the workspace.
  const profile = path.join(dir, 'profile');
  await mkdir(profile, { recursive: true });
  await writeFile(
    settingsFile(profile),
    JSON.stringify({
      version: 1,
      onboarding: { connectClaudeDone: true, welcomeDone: true, tourDone: true },
    }),
  );
  app = await launchApp(profile, {
    env: {
      REELFORGE_TEST_HOOKS: '1',
      REELFORGE_TEST_TRANSCRIPT: transcript,
      [TEST_WHISPER_ROOT_ENV]: path.join(dir, 'whisper root'),
      [TEST_WHISPER_MIRROR_ENV]: mirror,
      [TEST_WHISPER_DELAY_ENV]: '15',
      [TEST_PROJECTS_DIR_ENV]: path.join(dir, 'projects'),
      [CLAUDE_SEARCH_DIR_ENV]: path.join(dir, 'no claude'),
    },
  });
  await app.evaluate(({ BrowserWindow }) => {
    BrowserWindow.getAllWindows()[0]?.setContentSize(1280, 720);
  });
  page = await app.firstWindow();
  await page.waitForFunction(() => window.innerWidth === 1280 && window.innerHeight === 720);
  await page.getByRole('button', { name: 'Open the example project' }).click();
  await page.locator('.project-title', { hasText: 'Doom on a calculator' }).waitFor({
    timeout: 60_000,
  });
}, 120_000);

afterAll(async () => {
  await closeApp(app);
  await cp(logFile(path.join(dir, 'profile')), path.join(screenshotDir, 'whisper-main.log')).catch(
    () => undefined,
  );
  await rm(dir, { recursive: true, force: true });
});

async function openTools(): Promise<ReturnType<Page['getByRole']>> {
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Settings' });
  await dialog.getByRole('tab', { name: 'Tools' }).click();
  return dialog;
}

async function redoWords(): Promise<void> {
  await (await showStage(page, 'Words timed')).click();
  await pipeline()
    .getByRole('group', { name: 'Words timed actions' })
    .getByRole('button', { name: 'Redo' })
    .click();
  await page
    .getByRole('alertdialog', { name: 'Redo Words timed?' })
    .getByRole('button', {
      name: 'Redo',
    })
    .click();
}

describe('whisper.cpp setup', () => {
  it('installs the engine and the recommended model from Settings, then times the words', async () => {
    const dialog = await openTools();
    const engine = dialog.getByRole('region', { name: 'Whisper engine' });
    await engine.getByText('Not installed', { exact: true }).waitFor({ timeout: 30_000 });
    const install = engine.getByRole('button', { name: /^Install \(\d+ kB\)$/ });
    await shot('settings-not-installed');
    await install.click();
    await engine.getByText(/^Installed: .*CPU \(OpenBLAS\)/).waitFor({ timeout: 30_000 });
    expect(await engine.textContent()).toContain('installed by ReelForge');

    const models = dialog.getByRole('region', { name: 'Whisper models' });
    await models.getByRole('button', { name: /^Install recommended model \(6 MB\)$/ }).click();
    await models.getByRole('progressbar', { name: 'whisper.cpp download' }).waitFor();
    await models.getByText(/ of 6 MB/).waitFor();
    await shot('settings-model-progress');
    await models
      .getByRole('row', { name: /large-v3-turbo-q5_0/ })
      .getByText('Installed', { exact: true })
      .waitFor({ timeout: 30_000 });
    await shot('settings-installed');
    await page.keyboard.press('Escape');
    await dialog.waitFor({ state: 'detached' });

    await redoWords();
    await expect
      .poll(() => rowText('Words timed'), { timeout: 60_000, interval: 500 })
      .toMatch(/^Words timedDone/);
    expect(await page.getByRole('region', { name: 'Transcription engine' }).count()).toBe(0);
    await pipeline()
      .getByRole('group', { name: 'Words timed actions' })
      .getByRole('button', { name: 'Open' })
      .click();
    const words = page.getByRole('region', { name: 'Words timed' });
    await words
      .getByRole('note')
      .getByText(/^Transcription ran on the CPU \(slow: 51 s/)
      .waitFor();
    await shot('words-cpu-hint');
    await page.getByRole('button', { name: 'Back to preview' }).click();
  }, 120_000);

  it('Words timed without the model: Download and continue (after a failed try) runs it', async () => {
    const dialog = await openTools();
    const models = dialog.getByRole('region', { name: 'Whisper models' });
    await models
      .getByRole('row', { name: /large-v3-turbo-q5_0/ })
      .getByRole('button', { name: 'Delete' })
      .click();
    await models
      .getByRole('row', { name: /large-v3-turbo-q5_0/ })
      .getByText('Not downloaded')
      .waitFor();
    await page.keyboard.press('Escape');
    await dialog.waitFor({ state: 'detached' });

    // The mirror loses the model: the first download fails like a server without the file.
    await rename(path.join(mirror, MODEL_FILE), path.join(mirror, `${MODEL_FILE}.away`));
    await redoWords();
    const notice = page.getByRole('region', { name: 'Transcription engine' });
    await notice
      .getByText('Words timed needs the transcription engine (≈ 6 MB, one-time)')
      .waitFor({ timeout: 20_000 });
    await shot('sidebar-needed');
    await notice.getByRole('button', { name: 'Download and continue' }).click();
    await notice.getByText('The download server answered HTTP 404. Try again later.').waitFor({
      timeout: 20_000,
    });
    await shot('sidebar-failed');
    await notice.getByRole('button', { name: 'Open Settings' }).click();
    const settings = page.getByRole('dialog', { name: 'Settings' });
    await settings.getByRole('region', { name: 'Whisper engine' }).waitFor();
    await page.keyboard.press('Escape');
    await settings.waitFor({ state: 'detached' });

    await rename(path.join(mirror, `${MODEL_FILE}.away`), path.join(mirror, MODEL_FILE));
    await notice.getByRole('button', { name: 'Try again' }).click();
    await notice.getByRole('progressbar', { name: 'Transcription engine download' }).waitFor();
    await shot('sidebar-progress');
    await expect
      .poll(() => rowText('Words timed'), { timeout: 60_000, interval: 500 })
      .toMatch(/^Words timedDone/);
    await notice.waitFor({ state: 'detached' });
    await shot('sidebar-done');
  }, 120_000);
});
