/**
 * The production line in the built app (`pnpm test:app`, PLAN.md#13.9, ADR-034): the default
 * channel gets an ElevenLabs voice and a (fake) key; two topics go into its queue from the
 * Production line dialog ("Topic | 0.5"); Start writes both briefs and scripts (fake-claude) and
 * the line waits for the approvals; film 1's script is opened from the dialog (its project opens
 * at the script, the inbox lists the line's films), approved back in the dialog, and the line
 * builds it on its own: the voiceover from the fake ElevenLabs server, Audio cleaned (real
 * ffmpeg), Words timed (a recorded transcription), Storyboard, Scenes built with QA, the final
 * review, Sound design, the mix, the export (the line's own render windows) and the publish kit.
 * Film 2 still waits. Never a model call, never the real ElevenLabs; the key (a canary) never shows
 * in the page, a log or a file. Screenshots at 1280x720: out/test-app/production-line-*.png.
 */
import { existsSync } from 'node:fs';
import { cp, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fakeClaudeBinPath } from '@reelforge/fake-claude';
import type { ElectronApplication, Page } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  startFakeElevenLabs,
  type FakeElevenLabs,
} from '../../../packages/pipeline/src/voice/testing/fake-elevenlabs.js';
import {
  logFile,
  settingsFile,
  TEST_CLAUDE_LAUNCHER_ENV,
  TEST_PROJECTS_DIR_ENV,
} from '../src/main/app-paths.js';
import { TEST_ELEVENLABS_URL_ENV } from '../src/main/voice/test-hooks.js';
import { closeApp, launchApp, screenshotDir } from './support/electron-app.js';
import { golden, pipelineScript, recordedTranscript, VO_SECONDS } from './support/pipeline-film.js';
import { projectMenu } from './support/project-menu.js';

const KEY = 'sk_canary_line_smoke_5e0c27_do_not_leak';
const TOPIC_1 = 'Rainbow in a glass';
const TOPIC_2 = 'Why is the sky blue';

const BRIEF_REPLY = JSON.stringify({
  topic:
    'How a glass of water and a flashlight split white light into a rainbow, and why Newton could explain it.',
  hook: 'A glass of water on a desk throws a rainbow on the wall.',
  keyFacts: ['Confirm when Newton published his prism experiments.'],
  tone: 'curious, calm',
  audience: 'Curious viewers with school-level physics.',
});

/** The two calls of `window.reelforge` the setup uses (preload validates them). */
interface ChannelBridge {
  updateChannel(id: string, patch: unknown): Promise<unknown>;
  setChannelSecret(request: { channelId: string; name: string; value: string }): Promise<unknown>;
}

let app: ElectronApplication | undefined;
let page: Page;
let fake: FakeElevenLabs;
let userDataDir: string;
let projectsDir: string;

async function shot(name: string): Promise<void> {
  await page.screenshot({ path: path.join(screenshotDir, `production-line-${name}.png`) });
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

function dialog() {
  return page.getByRole('dialog', { name: 'Production line' });
}

function film(topic: string) {
  return dialog().getByRole('listitem', { name: topic, exact: true });
}

async function chipOf(topic: string): Promise<string> {
  return (await film(topic).locator('.line-chip').textContent()) ?? '';
}

interface QueueFile {
  readonly items: readonly {
    readonly topic: string;
    readonly status: string;
    readonly projectPath?: string;
    readonly language: string;
    readonly targetMinutes?: number;
  }[];
}

async function queueFile(): Promise<QueueFile> {
  return JSON.parse(
    await readFile(path.join(userDataDir, 'queues', 'default.json'), 'utf8'),
  ) as QueueFile;
}

async function filmDir(topic: string): Promise<string> {
  const dir = (await queueFile()).items.find((item) => item.topic === topic)?.projectPath;
  if (dir === undefined) throw new Error(`${topic} has no project`);
  return dir;
}

beforeAll(async () => {
  // The fake voice is as long as the recorded transcription (38 s), like a real read.
  const script = golden('script.txt');
  fake = await startFakeElevenLabs({
    apiKey: KEY,
    tier: 'pro',
    characterCount: 1_000,
    characterLimit: 100_000,
    secondsPerChar: VO_SECONDS / script.length,
    delayMs: 50,
  });
  userDataDir = await mkdtemp(path.join(tmpdir(), 'reelforge line ż-'));
  projectsDir = path.join(userDataDir, 'Filmy kanału');
  await mkdir(projectsDir);
  const sidecar = path.join(userDataDir, 'fake-claude-script.json');
  const rules = pipelineScript();
  await writeFile(
    sidecar,
    JSON.stringify({
      ...rules,
      rules: [
        {
          scenario: 'tools-write',
          reply: BRIEF_REPLY,
          promptIncludes: 'production line into the brief',
        },
        ...(rules.rules ?? []),
      ],
    }),
  );
  const transcript = path.join(userDataDir, 'words.raw.json');
  await writeFile(transcript, recordedTranscript());
  await writeFile(
    settingsFile(userDataDir),
    JSON.stringify({
      version: 1,
      onboarding: { connectClaudeDone: true, welcomeDone: true, tourDone: true },
    }),
  );
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
      [TEST_ELEVENLABS_URL_ENV]: fake.url,
      [TEST_PROJECTS_DIR_ENV]: projectsDir,
    },
  });
  await app.evaluate(({ BrowserWindow }) => {
    BrowserWindow.getAllWindows()[0]?.setContentSize(1280, 720);
  });
  page = await app.firstWindow();
  await page.waitForFunction(() => window.innerWidth === 1280 && window.innerHeight === 720);
  await page.getByRole('region', { name: 'Start' }).waitFor();
}, 180_000);

afterAll(async () => {
  await closeApp(app);
  await fake.close();
  await cp(logFile(userDataDir), path.join(screenshotDir, 'production-line-main.log')).catch(
    () => undefined,
  );
  await rm(userDataDir, { recursive: true, force: true, maxRetries: 5 });
});

describe('the production line', () => {
  it('queues two English topics and scripts both, then waits for the approvals', async () => {
    const stored = await page.evaluate(async (key) => {
      const bridge = (window as unknown as { reelforge: ChannelBridge }).reelforge;
      await bridge.updateChannel('default', {
        voice: { provider: 'elevenlabs', voiceId: 'voice-line' },
      });
      return bridge.setChannelSecret({
        channelId: 'default',
        name: 'elevenlabs-api-key',
        value: key,
      });
    }, KEY);
    expect(stored).toEqual({ status: 'ok', present: true });

    await page.keyboard.press('Control+Shift+L');
    await dialog().waitFor();
    await dialog().getByText('No films in this channel yet.', { exact: false }).waitFor();
    await dialog().getByText('Voice: ElevenLabs ✓').waitFor();
    const topics = dialog().getByLabel('Add topics (one per line)');
    await topics.fill(`${TOPIC_1} | 0.5\n${TOPIC_2} | ten`);
    await dialog().getByText('Line 2: “ten” is not a length in minutes').waitFor();
    await topics.fill(`${TOPIC_1} | 0.5\n${TOPIC_2} | 0.5`);
    await dialog().getByRole('button', { name: 'Add 2 topics' }).click();
    await film(TOPIC_2).waitFor();
    expect(await chipOf(TOPIC_1)).toBe('Queued');
    const queued = await queueFile();
    expect(queued.items.map((item) => [item.topic, item.language, item.targetMinutes])).toEqual([
      [TOPIC_1, 'en', 0.5],
      [TOPIC_2, 'en', 0.5],
    ]);
    await shot('queued');

    await dialog().getByRole('button', { name: 'Start', exact: true }).click();
    await expect.poll(() => chipOf(TOPIC_2), { timeout: 90_000 }).toBe('Needs you');
    expect(await chipOf(TOPIC_1)).toBe('Needs you');
    await dialog().getByText('Waiting for your approval (2 scripts)').waitFor({ timeout: 10_000 });
    const approve = film(TOPIC_1).getByRole('button', { name: 'Approve script' });
    expect(await approve.isDisabled()).toBe(true);
    expect(await page.getByRole('button', { name: /^Production line: 2 waiting/ }).count()).toBe(1);
    const brief = JSON.parse(
      await readFile(path.join(await filmDir(TOPIC_1), 'brief.json'), 'utf8'),
    ) as {
      topic: string;
      language: string;
      targetMinutes: number;
    };
    expect(brief).toMatchObject({ language: 'en', targetMinutes: 0.5 });
    expect(brief.topic).toContain('flashlight');
    expect(await readFile(path.join(await filmDir(TOPIC_1), 'script.txt'), 'utf8')).toBe(
      golden('script.txt'),
    );
    await shot('needs-approval');
  }, 150_000);

  it('opens film 1 at its script; the inbox lists the films of the line', async () => {
    await film(TOPIC_1).getByRole('button', { name: 'Open script' }).click();
    await dialog().waitFor({ state: 'detached', timeout: 30_000 });
    const editor = page.getByRole('textbox', { name: 'Script' });
    await expect.poll(() => editor.inputValue(), { timeout: 30_000 }).toBe(golden('script.txt'));
    // The golden storyboard predates looks: this film is made in voxel-only (as pipeline.smoke).
    await projectMenu(page, 'Project settings');
    const settings = page.getByRole('dialog', { name: 'Project settings' });
    await settings.getByRole('radio', { name: /^Voxel only — the classic look/ }).click();
    await expect
      .poll(
        async () =>
          (
            JSON.parse(
              await readFile(path.join(await filmDir(TOPIC_1), 'project.json'), 'utf8'),
            ) as {
              lookMode?: string;
            }
          ).lookMode,
      )
      .toBe('voxel-only');
    await settings.getByRole('button', { name: 'Close' }).click();
    await settings.waitFor({ state: 'detached' });

    await page.getByRole('button', { name: /^Needs you/ }).click();
    const inbox = page.getByRole('dialog', { name: 'Needs you' });
    const lineItem = inbox.getByRole('listitem').filter({ hasText: `“${TOPIC_2}”` });
    await lineItem.waitFor();
    expect(await lineItem.textContent()).toContain('Production line · Default');
    await shot('inbox');
    await lineItem.getByRole('button', { name: 'Show in Production line' }).click();
    await dialog().waitFor();
    expect(await film(TOPIC_2).getAttribute('aria-current')).toBe('true');
  }, 90_000);

  it('approves film 1 and builds it to the export and the publish kit', async () => {
    await film(TOPIC_1).getByRole('button', { name: 'Approve script' }).click();
    await expect
      .poll(() => chipOf(TOPIC_1), { timeout: 60_000 })
      .toMatch(/^(Building|Exporting|Done)$/);
    await dialog()
      .getByText(/^Running · (Building|Exporting) film 1 of 2/)
      .waitFor({ timeout: 60_000 });
    await shot('building');
    await expect.poll(() => chipOf(TOPIC_1), { timeout: 600_000, interval: 2_000 }).toBe('Done');
    expect(await chipOf(TOPIC_2)).toBe('Needs you');
    await dialog().getByText('Waiting for your approval (1 script)').waitFor({ timeout: 30_000 });
    await shot('done');

    const dir = await filmDir(TOPIC_1);
    const out = await readdir(path.join(dir, 'out'));
    expect(out.some((name) => name.endsWith('.mp4'))).toBe(true);
    expect(existsSync(path.join(dir, 'publish'))).toBe(true);
    expect(existsSync(path.join(dir, 'audio', 'vo.original.wav'))).toBe(true);
    expect(fake.requests.some((request) => request.path.includes('text-to-speech'))).toBe(true);
    const log = await readFile(logFile(userDataDir), 'utf8');
    expect(log).toContain('notification: Script to approve');
    expect(log).toContain('notification: Film ready');
  }, 720_000);

  it('never shows or stores the key in plain text', async () => {
    expect(await page.content()).not.toContain(KEY);
    expect(await filesContaining(projectsDir, KEY)).toEqual([]);
    expect(await readFile(logFile(userDataDir), 'utf8')).not.toContain(KEY);
    expect(await filesContaining(userDataDir, KEY)).toEqual([]);
  });
});
