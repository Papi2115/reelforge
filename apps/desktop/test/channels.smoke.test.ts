/**
 * Channels in the built app (`pnpm test:app`, PLAN.md#13.13, ADR-031): Settings → Channels adds
 * two channels, renames them, sets a style, a voice and an API key (the OS's real safeStorage in
 * the test's own app data folder; where the OS cannot encrypt, the plain-words error instead),
 * removes the key, reorders; the start screen then offers the channel (its style preselected),
 * the project is created in channel 2 and the header and Project settings name it; the recent list
 * shows its dot; deleting the channel is refused while it has the project. The key value (a
 * canary) never shows in the page and is in no file under app data or the project. No Claude and
 * no network. Screenshots at 1280x720: out/test-app/channels-*.png.
 */
import { mkdir, mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { ElectronApplication, Locator, Page } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { closeApp, launchApp, screenshotDir, stubFolderPicker } from './support/electron-app.js';
import { projectMenu, projectMenuButton } from './support/project-menu.js';

const CANARY = 'sk_canary_7f3a9b1e_do_not_leak_4c2d';

let app: ElectronApplication | undefined;
let page: Page;
let userDataDir: string;
let parent: string;
/** The OS encrypted the key (false where safeStorage is unavailable, e.g. Linux basic_text). */
let keyStored = false;

beforeAll(async () => {
  userDataDir = await mkdtemp(path.join(tmpdir(), 'reelforge channels ż-'));
  parent = path.join(userDataDir, 'Projekty kanałów');
  await mkdir(parent);
  app = await launchApp(userDataDir);
  await app.evaluate(({ BrowserWindow }) => {
    BrowserWindow.getAllWindows()[0]?.setContentSize(1280, 720);
  });
  page = await app.firstWindow();
  await page.waitForFunction(() => window.innerWidth === 1280 && window.innerHeight === 720);
});

afterAll(async () => {
  await closeApp(app);
  await rm(userDataDir, { recursive: true, force: true });
});

async function shot(name: string): Promise<void> {
  await page.screenshot({ path: path.join(screenshotDir, `channels-${name}.png`) });
}

async function readJson(file: string): Promise<Record<string, unknown>> {
  const raw: unknown = JSON.parse(await readFile(file, 'utf8'));
  if (typeof raw !== 'object' || raw === null) throw new Error(`${file} is not an object`);
  return raw as Record<string, unknown>;
}

async function savedChannels(): Promise<{ id: string; name: string; [key: string]: unknown }[]> {
  const file = await readJson(path.join(userDataDir, 'channels.json'));
  return file['channels'] as { id: string; name: string }[];
}

/** Every file under `root` (recursively) whose bytes contain `needle`. */
async function filesContaining(root: string, needle: string): Promise<string[]> {
  const entries = await readdir(root, { recursive: true, withFileTypes: true });
  const hits: string[] = [];
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const file = path.join(entry.parentPath, entry.name);
    const bytes = await readFile(file).catch(() => Buffer.alloc(0));
    if (bytes.includes(needle) || bytes.includes(Buffer.from(needle, 'utf16le'))) hits.push(file);
  }
  return hits;
}

async function openChannelsSettings(): Promise<Locator> {
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Settings' });
  await dialog.getByRole('tab', { name: 'Channels' }).click();
  await dialog.getByRole('listbox', { name: 'Channels' }).waitFor();
  return dialog;
}

async function addChannel(dialog: Locator, name: string): Promise<void> {
  await dialog.getByRole('button', { name: 'Add channel' }).click();
  const form = dialog.getByRole('form', { name: 'New channel' });
  await form.getByLabel('Name of the new channel').fill(name);
  await form.getByRole('button', { name: 'Add', exact: true }).click();
  await dialog.getByRole('region', { name: `Channel ${name}`, exact: true }).waitFor();
}

async function rename(dialog: Locator, from: string, to: string): Promise<void> {
  const detail = dialog.getByRole('region', { name: `Channel ${from}`, exact: true });
  const name = detail.getByLabel('Name', { exact: true });
  await name.fill(to);
  await name.press('Enter');
  await dialog.getByRole('region', { name: `Channel ${to}`, exact: true }).waitFor();
}

describe('channels', () => {
  it('adds, edits and reorders channels and stores a key without showing it', async () => {
    const start = page.getByRole('region', { name: 'Start' });
    await start.waitFor();
    // One channel: the New project form does not ask.
    expect(await start.getByLabel('Channel', { exact: true }).count()).toBe(0);

    const dialog = await openChannelsSettings();
    const list = dialog.getByRole('listbox', { name: 'Channels' });
    await list.getByRole('option', { name: /Default/ }).waitFor();
    await dialog.getByText('The default channel cannot be deleted.').waitFor();

    await addChannel(dialog, 'Voxplain');
    // A second channel with the same name is refused in plain words.
    await dialog.getByRole('button', { name: 'Add channel' }).click();
    const form = dialog.getByRole('form', { name: 'New channel' });
    await form.getByLabel('Name of the new channel').fill('voxplain');
    await form.getByRole('button', { name: 'Add', exact: true }).click();
    await form.getByText('Another channel already has this name.').waitFor();
    await form.getByRole('button', { name: 'Cancel' }).click();
    await addChannel(dialog, 'Crime');
    // Renaming keeps the id made from the first name.
    await rename(dialog, 'Crime', 'Crime Desk');

    const crime = dialog.getByRole('region', { name: 'Channel Crime Desk', exact: true });
    await crime.getByLabel('Style of new projects').selectOption('noir-voxel');
    const voiceId = crime.getByLabel('Voice ID');
    await voiceId.fill('crimeVoice01');
    await voiceId.press('Tab');
    const speed = crime.getByRole('slider', { name: 'Speed' });
    await speed.focus();
    for (let step = 0; step < 5; step += 1) await speed.press('ArrowRight');
    await crime.getByText('1.05×').waitFor();
    await expect
      .poll(async () => (await savedChannels()).find((channel) => channel.id === 'crime'))
      .toMatchObject({
        name: 'Crime Desk',
        defaultStyle: 'noir-voxel',
        voice: { provider: 'elevenlabs', voiceId: 'crimeVoice01', settings: { speed: 1.05 } },
      });

    const key = crime.getByRole('form', { name: 'ElevenLabs API key' });
    await key.getByText('No key').waitFor();
    await key.getByLabel('API key', { exact: true }).fill(CANARY);
    await key.getByRole('button', { name: 'Save key' }).click();
    await key.getByText(/^Key saved ✓$|cannot encrypt the key/).waitFor();
    keyStored = (await key.getByText('Key saved ✓').count()) === 1;
    expect(await key.locator('input[type="password"]').inputValue()).toBe('');
    expect(await page.content()).not.toContain(CANARY);
    if (keyStored) {
      await list.getByRole('option', { name: /Crime Desk.*key ✓/ }).waitFor();
      await key.getByRole('button', { name: 'Remove key' }).click();
      await key.getByText('No key').waitFor();
      await key.getByLabel('API key', { exact: true }).fill(CANARY);
      await key.getByRole('button', { name: 'Save key' }).click();
      await key.getByText('Key saved ✓').waitFor();
    }
    expect(await page.content()).not.toContain(CANARY);
    await shot('settings-voice');
    await dialog.locator('.settings-panel').evaluate((panel) => {
      panel.scrollTo(0, 0);
    });
    await shot('settings');

    // Voxplain one place up: Default, Voxplain, Crime Desk → Voxplain, Default, Crime Desk.
    await list.getByRole('option', { name: /Voxplain/ }).click();
    await dialog.getByRole('button', { name: 'Move up' }).click();
    await expect
      .poll(async () => (await savedChannels()).map((channel) => channel.id))
      .toEqual(['voxplain', 'default', 'crime']);
    expect(await list.getByRole('option').first().textContent()).toContain('Voxplain');
    await page.keyboard.press('Escape');
    await dialog.waitFor({ state: 'detached' });
  });

  it('creates a project in the chosen channel; header, Project settings and recent name it', async () => {
    if (app === undefined) throw new Error('the app is not running');
    const start = page.getByRole('region', { name: 'Start' });
    const channel = start.getByLabel('Channel', { exact: true });
    expect(await channel.inputValue()).toBe('default');
    await channel.selectOption('crime');
    expect(await start.locator('input[type="radio"][value="noir-voxel"]').isChecked()).toBe(true);
    await start.getByLabel('Video title').fill('Heist night');
    await shot('new-project');

    await stubFolderPicker(app, parent);
    await start.getByRole('button', { name: 'New project…' }).click();
    await projectMenuButton(page).waitFor({ timeout: 30_000 });
    expect(await page.locator('header .project-channel').textContent()).toBe('Crime Desk');
    const project = await readJson(path.join(parent, 'Heist night', 'project.json'));
    expect(project).toMatchObject({ channelId: 'crime', style: 'noir-voxel' });
    await shot('header');

    await projectMenu(page, 'Project settings');
    const settings = page.getByRole('dialog', { name: 'Project settings' });
    const row = settings.getByRole('region', { name: 'Channel', exact: true });
    expect(await row.textContent()).toContain('Crime Desk');
    await settings.getByRole('button', { name: 'Close' }).click();
    await projectMenu(page, 'Close project');

    await start.waitFor();
    await start.getByRole('img', { name: 'Channel: Crime Desk' }).waitFor();
    // The last used channel comes first next time.
    await expect
      .poll(() => start.getByLabel('Channel', { exact: true }).inputValue())
      .toBe('crime');

    const dialog = await openChannelsSettings();
    await dialog.getByRole('option', { name: /Crime Desk/ }).click();
    const crime = dialog.getByRole('region', { name: 'Channel Crime Desk', exact: true });
    await crime.getByRole('button', { name: 'Delete channel…' }).click();
    await crime.getByRole('button', { name: 'Delete channel', exact: true }).click();
    await crime
      .getByRole('alert')
      .filter({
        hasText: '“Crime Desk” still has 1 project (Heist night), so it cannot be deleted.',
      })
      .waitFor();
    expect((await savedChannels()).map((entry) => entry.id)).toContain('crime');
    await page.keyboard.press('Escape');
  });

  it('never writes the key value to a file or the page', async () => {
    expect(await page.content()).not.toContain(CANARY);
    // The ciphertext is base64 of an encrypted blob: never the plain text.
    expect(await filesContaining(userDataDir, CANARY)).toEqual([]);
    if (keyStored) {
      const secrets = await readJson(path.join(userDataDir, 'channel-secrets.bin.json'));
      expect(Object.keys(secrets['secrets'] as object)).toEqual(['crime']);
    }
  });
});
