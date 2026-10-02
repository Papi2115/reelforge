/**
 * Settings smoke test of the built app (PLAN.md#6.7; `pnpm test:app` builds it first): the
 * first-run "Connect Claude" gate in the not-installed state (test hook: claude is searched in an
 * empty folder), Settings changes persisted across a relaunch, and — only when the locally
 * installed Claude Code is logged in — the connected state (`claude --version` / `auth status`,
 * no model call). Screenshots at 1280x720 land in apps/desktop/out/test-app/.
 */
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { checkConnection } from '@reelforge/claude-bridge';
import type { ElectronApplication, Page } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CLAUDE_SEARCH_DIR_ENV, settingsFile } from '../src/main/app-paths.js';
import { launchApp, screenshotDir } from './support/electron-app.js';

const realClaude = await checkConnection({ timeoutMs: 20_000 });

let userDataDir: string;
let noClaudeDir: string;
let app: ElectronApplication | undefined;

beforeAll(async () => {
  userDataDir = await mkdtemp(path.join(tmpdir(), 'reelforge settings ż-'));
  noClaudeDir = await mkdtemp(path.join(tmpdir(), 'reelforge no claude '));
});

afterAll(async () => {
  await app?.close();
  await rm(userDataDir, { recursive: true, force: true });
  await rm(noClaudeDir, { recursive: true, force: true });
});

async function open(options: { firstRun?: boolean; hook: boolean }): Promise<Page> {
  await app?.close();
  app = await launchApp(userDataDir, {
    firstRun: options.firstRun ?? false,
    env: options.hook ? { [CLAUDE_SEARCH_DIR_ENV]: noClaudeDir } : {},
  });
  await app.evaluate(({ BrowserWindow }) => {
    BrowserWindow.getAllWindows()[0]?.setContentSize(1280, 720);
  });
  const page = await app.firstWindow();
  await page.waitForFunction(() => window.innerWidth === 1280 && window.innerHeight === 720);
  return page;
}

async function savedSettings(): Promise<Record<string, unknown>> {
  const raw: unknown = JSON.parse(await readFile(settingsFile(userDataDir), 'utf8'));
  if (typeof raw !== 'object' || raw === null) throw new Error('settings.json is not an object');
  return raw as Record<string, unknown>;
}

/** The dialog fits the 1280x720 window and nothing inside it is cut off horizontally. */
async function expectFits(page: Page, name: string): Promise<void> {
  const report = await page.evaluate((label) => {
    const dialog = document.querySelector(`[role="dialog"][aria-label="${label}"]`);
    const rect = dialog?.getBoundingClientRect();
    const clipped = [...(dialog?.querySelectorAll('*') ?? [])].filter(
      (element) =>
        element.scrollWidth > element.clientWidth + 1 &&
        getComputedStyle(element).overflowX !== 'hidden' &&
        !['INPUT', 'SELECT'].includes(element.tagName),
    ).length;
    return {
      inside:
        rect !== undefined &&
        rect.left >= 0 &&
        rect.top >= 0 &&
        rect.right <= window.innerWidth &&
        rect.bottom <= window.innerHeight,
      clipped,
    };
  }, name);
  expect(report, name).toEqual({ inside: true, clipped: 0 });
}

describe('settings', () => {
  it('first run: the Connect Claude gate shows "not installed" and can be skipped', async () => {
    const page = await open({ firstRun: true, hook: true });
    const gate = page.getByRole('dialog', { name: 'Connect Claude' });
    await gate.getByText('Claude Code is not installed').waitFor({ timeout: 20_000 });
    expect(await gate.getByLabel('Install command (run it in a terminal)').inputValue()).toBe(
      'npm install -g @anthropic-ai/claude-code',
    );
    await gate.getByText('it never reads or stores your credentials').waitFor();
    expect(await gate.getByRole('button', { name: 'Continue' }).isDisabled()).toBe(true);
    expect(await gate.getByRole('button', { name: 'Open terminal and log in' }).count()).toBe(0);
    const chip = page.getByRole('contentinfo', { name: 'Status' }).getByRole('button', {
      name: 'Claude: not installed',
    });
    await chip.waitFor();
    await expectFits(page, 'Connect Claude');
    await page.screenshot({ path: path.join(screenshotDir, 'settings-first-run.png') });

    await gate.getByRole('button', { name: 'Check again' }).click();
    await gate.getByRole('button', { name: 'Check again' }).waitFor();
    await gate.getByText('Claude Code is not installed').waitFor();
    await gate.getByRole('button', { name: 'Skip for now' }).click();
    await gate.waitFor({ state: 'detached' });
    await expect
      .poll(async () => (await savedSettings())['onboarding'])
      .toEqual({ connectClaudeDone: true });
  });

  it('changes language and Economy mode; both persist after a relaunch', async () => {
    let page = await open({ hook: true });
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Settings' });
    await dialog.getByText('Claude Code is not installed').waitFor();
    await expectFits(page, 'Settings');
    await page.screenshot({ path: path.join(screenshotDir, 'settings-claude.png') });

    await dialog.getByRole('tab', { name: 'Projects' }).click();
    await dialog.getByLabel('Video language').selectOption('pl');
    await page.screenshot({ path: path.join(screenshotDir, 'settings-projects.png') });

    await dialog.getByRole('tab', { name: 'Models' }).click();
    const economy = dialog.getByRole('checkbox', { name: /Economy mode/ });
    await economy.check();
    await dialog.getByText('Economy mode is on: all stages use Sonnet.').waitFor();
    expect(await dialog.getByLabel('Scene code').isDisabled()).toBe(true);
    await expectFits(page, 'Settings');
    await page.screenshot({ path: path.join(screenshotDir, 'settings-models.png') });

    await dialog.getByRole('tab', { name: 'Performance' }).click();
    await dialog.getByLabel('Export render workers').waitFor();
    await page.screenshot({ path: path.join(screenshotDir, 'settings-performance.png') });

    await dialog.getByRole('tab', { name: 'Tools' }).click();
    await dialog.getByRole('region', { name: 'ffmpeg' }).waitFor({ timeout: 30_000 });
    await dialog.getByRole('region', { name: 'Whisper models' }).getByRole('row').nth(4).waitFor();
    await expectFits(page, 'Settings');
    await page.screenshot({ path: path.join(screenshotDir, 'settings-tools.png') });
    await page.keyboard.press('Escape');
    await dialog.waitFor({ state: 'detached' });

    await expect.poll(async () => (await savedSettings())['language']).toBe('pl');
    expect((await savedSettings())['economy']).toBe(true);

    page = await open({ hook: true });
    await page.getByRole('region', { name: 'Start' }).waitFor();
    expect(await page.getByRole('dialog', { name: 'Connect Claude' }).count()).toBe(0);
    await page.getByText('Economy mode · Usage').waitFor();
    await expect
      .poll(() => page.getByRole('region', { name: 'Start' }).getByLabel('Language').inputValue())
      .toBe('pl');
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    const reopened = page.getByRole('dialog', { name: 'Settings' });
    await reopened.getByRole('tab', { name: 'Models' }).click();
    expect(await reopened.getByRole('checkbox', { name: /Economy mode/ }).isChecked()).toBe(true);
    await reopened.getByRole('tab', { name: 'Projects' }).click();
    expect(await reopened.getByLabel('Video language').inputValue()).toBe('pl');
  });

  it.skipIf(realClaude.state !== 'ok')(
    'shows Connected for the locally installed, logged-in Claude Code',
    async () => {
      const page = await open({ hook: false });
      const version = realClaude.state === 'ok' ? realClaude.version : '';
      await page
        .getByRole('contentinfo', { name: 'Status' })
        .getByRole('button', { name: `Claude: connected · ${version}` })
        .waitFor({ timeout: 30_000 });
      await page.getByRole('button', { name: 'Settings', exact: true }).click();
      const dialog = page.getByRole('dialog', { name: 'Settings' });
      await dialog.getByText('Connected', { exact: true }).waitFor();
      await dialog.getByText(`Claude Code ${version}`).waitFor();
      const text = await dialog.textContent();
      expect(text).not.toMatch(/@/);
      await page.screenshot({ path: path.join(screenshotDir, 'settings-connected.png') });
    },
  );
});
