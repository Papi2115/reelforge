/**
 * ElevenLabs voice generation in the built app (`pnpm test:app`, PLAN.md#13.14, ADR-033), against
 * the pipeline's local fake ElevenLabs server (test hook REELFORGE_TEST_ELEVENLABS_URL; no real
 * network, no real key): the example project's Voiceover panel first points to Settings → Channels;
 * with a voice and a (fake) key on the default channel it offers "Generate with ElevenLabs", shows
 * the estimate and asks before spending, generates the example script paragraph by paragraph, and
 * the Voiceover step imports the result like a manual file — takes, API word times and the import
 * record appear and the later steps become out of date. One sentence is redone. The key (a canary)
 * never shows in the page, a log or a project file. Screenshots at 1280x720:
 * out/test-app/voice-*.png.
 */
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { ElectronApplication, Page } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  startFakeElevenLabs,
  type FakeElevenLabs,
} from '../../../packages/pipeline/src/voice/testing/fake-elevenlabs.js';
import { logFile, settingsFile, TEST_PROJECTS_DIR_ENV } from '../src/main/app-paths.js';
import { TEST_ELEVENLABS_URL_ENV } from '../src/main/voice/test-hooks.js';
import { closeApp, launchApp, screenshotDir } from './support/electron-app.js';
import { openStage, stageText } from './support/pipeline-rows.js';

const KEY = 'sk_canary_voice_smoke_2b7e91_do_not_leak';

/** The two channel calls of `window.reelforge` the test uses (preload validates them). */
interface ChannelBridge {
  updateChannel(id: string, patch: unknown): Promise<unknown>;
  setChannelSecret(request: { channelId: string; name: string; value: string }): Promise<unknown>;
}

let app: ElectronApplication | undefined;
let page: Page;
let fake: FakeElevenLabs;
let userDataDir: string;
let projectsDir: string;
const exampleDir = (): string => path.join(projectsDir, 'Doom on a calculator');

async function shot(name: string): Promise<void> {
  await page.screenshot({ path: path.join(screenshotDir, `voice-${name}.png`) });
}

async function readJson(file: string): Promise<Record<string, unknown>> {
  return JSON.parse(await readFile(file, 'utf8')) as Record<string, unknown>;
}

/** Every file under `root` whose bytes contain `needle` (utf8 or utf16). */
async function filesContaining(root: string, needle: string): Promise<string[]> {
  const entries = await readdir(root, { recursive: true, withFileTypes: true });
  const hits: string[] = [];
  for (const entry of entries.filter((item) => item.isFile())) {
    const file = path.join(entry.parentPath, entry.name);
    const bytes = await readFile(file).catch(() => Buffer.alloc(0));
    if (bytes.includes(needle) || bytes.includes(Buffer.from(needle, 'utf16le'))) hits.push(file);
  }
  return hits;
}

function voiceover() {
  return page.getByRole('region', { name: 'Voiceover' });
}

async function reopenVoiceover(): Promise<void> {
  const panel = voiceover();
  if ((await panel.count()) > 0) {
    await panel.getByRole('button', { name: 'Back to preview' }).click();
  }
  await openStage(page, 'Voiceover added');
  await voiceover().waitFor();
}

beforeAll(async () => {
  fake = await startFakeElevenLabs({
    apiKey: KEY,
    tier: 'pro',
    characterCount: 1_000,
    characterLimit: 16_000,
    secondsPerChar: 0.02,
    delayMs: 150,
  });
  userDataDir = await mkdtemp(path.join(tmpdir(), 'reelforge voice ż-'));
  projectsDir = path.join(userDataDir, 'Projekty');
  await mkdir(projectsDir);
  await writeFile(
    settingsFile(userDataDir),
    JSON.stringify({
      version: 1,
      onboarding: { connectClaudeDone: true, welcomeDone: true, tourDone: true },
    }),
  );
  app = await launchApp(userDataDir, {
    env: {
      REELFORGE_TEST_HOOKS: '1',
      [TEST_ELEVENLABS_URL_ENV]: fake.url,
      [TEST_PROJECTS_DIR_ENV]: projectsDir,
    },
  });
  await app.evaluate(({ BrowserWindow }) => {
    BrowserWindow.getAllWindows()[0]?.setContentSize(1280, 720);
  });
  page = await app.firstWindow();
  await page.waitForFunction(() => window.innerWidth === 1280 && window.innerHeight === 720);
});

afterAll(async () => {
  await closeApp(app);
  await fake.close();
  await rm(userDataDir, { recursive: true, force: true, maxRetries: 5 });
});

describe('voice generation', () => {
  it('points to Settings → Channels until the channel has a voice and a key', async () => {
    const start = page.getByRole('region', { name: 'Start' });
    await start.getByRole('button', { name: 'Open the example project' }).click();
    await page.locator('.project-title', { hasText: 'Doom on a calculator' }).waitFor({
      timeout: 60_000,
    });
    await reopenVoiceover();
    await voiceover()
      .getByText('add a voice and key for this channel in Settings → Channels.', { exact: false })
      .waitFor();
    expect(
      await voiceover()
        .getByRole('button', { name: /Generate/ })
        .count(),
    ).toBe(0);
    expect(fake.requests).toHaveLength(0);
  }, 120_000);

  it('estimates, asks, generates and hands the voice-over to the Voiceover step', async () => {
    const stored = await page.evaluate(async (key) => {
      const bridge = (window as unknown as { reelforge: ChannelBridge }).reelforge;
      await bridge.updateChannel('default', {
        voice: { provider: 'elevenlabs', voiceId: 'voice-a', settings: { similarity: 0.75 } },
      });
      return bridge.setChannelSecret({
        channelId: 'default',
        name: 'elevenlabs-api-key',
        value: key,
      });
    }, KEY);
    expect(stored).toEqual({ status: 'ok', present: true });
    await reopenVoiceover();
    const panel = voiceover();
    await panel.getByRole('button', { name: 'Generate with ElevenLabs' }).click();
    const confirm = panel.getByRole('group', { name: 'Confirm voice generation' });
    await confirm.waitFor();
    const script = await readFile(path.join(exampleDir(), 'script.txt'), 'utf8');
    const characters = script
      .split(/\n\s*\n/)
      .map((paragraph) => paragraph.trim())
      .join('').length;
    expect(await confirm.getByTestId('voice-estimate').textContent()).toBe(
      `About ${characters.toLocaleString('en-US')} characters · ${String(Math.round((characters / 15_000) * 100))}% of your remaining 15,000`,
    );
    // Only the quota was read: nothing spent before the confirm.
    expect(fake.requests.filter((request) => request.method === 'POST')).toHaveLength(0);
    await shot('confirm');

    await confirm.getByRole('button', { name: /^Generate \(/ }).click();
    await panel.getByRole('region', { name: 'Voice generation progress' }).waitFor();
    await shot('progress');
    const sentences = panel.getByRole('region', { name: 'Generated sentences' });
    await sentences.waitFor({ timeout: 60_000 });
    expect(await sentences.locator('li').count()).toBe(8);
    await panel.getByText('Generated with ElevenLabs', { exact: true }).waitFor();
    await expect
      .poll(() => stageText(page, 'Audio cleaned'), { timeout: 30_000 })
      .toContain('Out of date');
    await shot('sentences');

    const dir = exampleDir();
    const takes = await readJson(path.join(dir, 'audio', 'takes', 'takes.json'));
    const output = takes['output'] as { sha256: string };
    const record = await readJson(path.join(dir, '.reelforge', 'voiceover.json'));
    expect(record['sha256']).toBe(output.sha256);
    expect(record['sourceName']).toBe('elevenlabs-voiceover.wav');
    const wav = await readFile(path.join(dir, 'audio', 'vo.original.wav'));
    expect(createHash('sha256').update(wav).digest('hex')).toBe(output.sha256);
    expect(existsSync(path.join(dir, 'timing', 'words.elevenlabs.json'))).toBe(true);
    const tts = fake.requests.filter((request) => request.method === 'POST');
    expect(tts).toHaveLength(6);
    expect(tts[0]?.body).toMatchObject({ voice_settings: { similarity_boost: 0.75 } });
  }, 180_000);

  it('redoes one sentence and names the shots under it', async () => {
    const panel = voiceover();
    const first = panel.locator('.voice-sentence').nth(2);
    await first.getByRole('button', { name: 'Redo this sentence' }).click();
    await first
      .getByRole('group', { name: /^Redo p01-s00/ })
      .getByRole('button', { name: 'Redo' })
      .click();
    await panel
      .getByRole('status')
      .filter({ hasText: /^Redone/ })
      .waitFor({ timeout: 60_000 });
    expect(
      await panel
        .getByRole('status')
        .filter({ hasText: /^Redone/ })
        .textContent(),
    ).toMatch(/Shots that changed: s\d\d/);
    expect(fake.requests.filter((request) => request.method === 'POST')).toHaveLength(7);
    await panel.locator('.voice-sentence').nth(2).getByText('2 takes').waitFor({ timeout: 30_000 });
    await shot('retake');
  }, 120_000);

  it('never shows or stores the key in plain text', async () => {
    expect(await page.content()).not.toContain(KEY);
    expect(await filesContaining(exampleDir(), KEY)).toEqual([]);
    const log = await readFile(logFile(userDataDir), 'utf8');
    expect(log).not.toContain(KEY);
    expect(await filesContaining(userDataDir, KEY)).toEqual([]);
  });
});
