/**
 * Brief -> Script and the pipeline sidebar on the built app (`pnpm test:app`, PLAN.md#6.8, #7.1)
 * with tools/fake-claude as the claude executable (test hook REELFORGE_TEST_CLAUDE_LAUNCHER;
 * never a model call):
 * - a new project opens on the brief; "Write script" runs the Script stage: live steps, then
 *   fake claude's research.md / beats.md / script.txt; the editor shows the script with the word
 *   counter and duration estimate against the target;
 * - an edit is autosaved to script.txt and committed ("Edit script"); "Approve script" opens the
 *   gate; the sidebar shows Done, a blocked stage explains itself, Redo asks first.
 * Screenshots at 1280x720 in out/test-app/.
 */
import { spawnSync } from 'node:child_process';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fakeClaudeBinPath, type FakeClaudeScript } from '@reelforge/fake-claude';
import type { ElectronApplication, Page } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { logFile, TEST_CLAUDE_LAUNCHER_ENV } from '../src/main/app-paths.js';
import { launchApp, screenshotDir, stubFolderPicker } from './support/electron-app.js';

const repoRoot = path.resolve(import.meta.dirname, '..', '..', '..');
const GOLDEN = path.join(
  repoRoot,
  'packages',
  'prompts',
  'evals',
  'cases',
  'en-short-prism',
  'project',
);

let app: ElectronApplication;
let page: Page;
let userDataDir: string;
let projectDir: string;
let golden: Record<'research' | 'beats' | 'script', string>;

function gitSubjects(): string[] {
  const run = spawnSync('git', ['log', '--format=%s'], { cwd: projectDir, encoding: 'utf8' });
  return run.stdout.split('\n').filter((line) => line !== '');
}

async function shot(name: string): Promise<void> {
  await page.screenshot({ path: path.join(screenshotDir, `stages-1280-${name}.png`) });
}

beforeAll(async () => {
  userDataDir = await mkdtemp(path.join(tmpdir(), 'reelforge stages ż-'));
  golden = {
    research: await readFile(path.join(GOLDEN, 'research.md'), 'utf8'),
    beats: await readFile(path.join(GOLDEN, 'beats.md'), 'utf8'),
    script: await readFile(path.join(GOLDEN, 'script.txt'), 'utf8'),
  };
  const script: FakeClaudeScript = {
    version: 1,
    rules: [
      {
        promptIncludes: 'You are the researcher',
        scenario: 'tools-write',
        delayMs: 250,
        reply: 'Saved research.md with 6 sources.',
        toolCalls: [
          {
            name: 'WebSearch',
            input: { query: 'rainbow glass of water dispersion' },
            output: 'Dispersion (optics) - Wikipedia',
          },
        ],
        writes: [{ path: 'research.md', content: golden.research }],
      },
      {
        promptIncludes: 'about 75 words',
        scenario: 'tools-write',
        delayMs: 150,
        reply: 'Word count: 84.',
        writes: [
          { path: 'beats.md', content: golden.beats },
          { path: 'script.txt', content: golden.script },
        ],
      },
    ],
    default: { scenario: 'ok', reply: 'Done.' },
  };
  const sidecar = path.join(userDataDir, 'fake-claude-script.json');
  await writeFile(sidecar, JSON.stringify(script));
  await mkdir(screenshotDir, { recursive: true });
  app = await launchApp(userDataDir, {
    env: {
      [TEST_CLAUDE_LAUNCHER_ENV]: JSON.stringify({
        command: process.execPath,
        args: [fakeClaudeBinPath],
      }),
      FAKE_CLAUDE_SCRIPT: sidecar,
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
  await app.close();
  await cp(logFile(userDataDir), path.join(screenshotDir, 'stages-main.log')).catch(
    () => undefined,
  );
  await rm(userDataDir, { recursive: true, force: true });
});

describe('Brief -> Script and the pipeline sidebar', () => {
  it('writes the script from a three-sentence brief with live steps', async () => {
    const parent = path.join(userDataDir, 'Filmy');
    await mkdir(parent);
    await stubFolderPicker(app, parent);
    await page.getByLabel('Video title').fill('Rainbow in a glass');
    await page.getByRole('button', { name: 'New project…' }).click();
    projectDir = path.join(parent, 'Rainbow in a glass');

    const brief = page.getByRole('form', { name: 'Brief' });
    await brief.waitFor();
    const pipeline = page.getByRole('region', { name: 'Pipeline' });
    await expect
      .poll(() => pipeline.getByRole('button', { name: 'Script written' }).textContent())
      .toBe('Script writtenWaiting');
    await brief
      .getByLabel('What is the video about?')
      .fill(
        'You can make a rainbow with a glass of water and a flashlight. Water bends each colour of light by a different amount. Newton explained it with a prism in 1672.',
      );
    await brief.getByLabel('Target length (minutes)').fill('0.5');
    await brief.getByLabel('Tone').fill('friendly, hands-on');
    await brief.getByLabel('Audience').fill('curious kids and parents');
    await shot('brief');
    await brief.getByRole('button', { name: 'Write script' }).click();

    const progress = page.getByRole('region', { name: 'Writing the script progress' });
    await progress.waitFor({ timeout: 15_000 });
    await progress.locator('.step-tool').first().waitFor({ timeout: 15_000 });
    await expect
      .poll(() => pipeline.getByRole('button', { name: 'Script written' }).textContent())
      .toBe('Script writtenRunning');
    await shot('progress');

    const editor = page.getByRole('textbox', { name: 'Script' });
    await editor.waitFor({ timeout: 30_000 });
    await expect.poll(() => editor.inputValue(), { timeout: 15_000 }).toBe(golden.script);
    const estimate = page.getByTestId('script-estimate');
    expect(await estimate.textContent()).toBe('84 words · ~0:34 · target 0:30 (+12 %)');
    expect(await estimate.getAttribute('class')).toContain('verdict-ok');
    expect(JSON.parse(await readFile(path.join(projectDir, 'brief.json'), 'utf8'))).toMatchObject({
      targetMinutes: 0.5,
      tone: 'friendly, hands-on',
    });
    await expect
      .poll(gitSubjects)
      .toEqual(expect.arrayContaining(['Claude turn: research', 'Claude turn: script']));
    await expect
      .poll(() => pipeline.getByRole('button', { name: 'Script written' }).textContent())
      .toBe('Script writtenReview');
    await shot('script');

    const view = page.getByRole('region', { name: 'Script' });
    await view.getByRole('tab', { name: 'Research' }).click();
    await view.getByText("Water's refractive index is higher", { exact: false }).waitFor();
    await view.getByRole('tab', { name: /^Sources/ }).click();
    await view.getByText('https://en.wikipedia.org/wiki/Isaac_Newton').waitFor();
    await shot('sources');
    await view.getByRole('tab', { name: 'Script' }).click();
  });

  it('autosaves and commits an edit, then approves the script', async () => {
    const editor = page.getByRole('textbox', { name: 'Script' });
    const edited = `${golden.script.trimEnd()} Try it tonight with a torch.\n`;
    await editor.fill(edited);
    const estimate = page.getByTestId('script-estimate');
    expect(await estimate.textContent()).toBe('90 words · ~0:36 · target 0:30 (+20 %)');
    expect(await estimate.getAttribute('class')).toContain('verdict-warn');
    await expect
      .poll(() => readFile(path.join(projectDir, 'script.txt'), 'utf8'), { timeout: 10_000 })
      .toBe(edited);
    await expect.poll(gitSubjects, { timeout: 15_000 }).toContain('Edit script');

    await page.getByRole('button', { name: 'Approve script' }).click();
    await page.getByText('Approved ✓').waitFor();
    const pipeline = page.getByRole('region', { name: 'Pipeline' });
    await expect
      .poll(() => pipeline.getByRole('button', { name: 'Script written' }).textContent())
      .toBe('Script writtenDone');
    await shot('approved');
  });

  it('explains a blocked stage and asks before Redo', async () => {
    const pipeline = page.getByRole('region', { name: 'Pipeline' });
    await page.getByRole('button', { name: 'Back to preview' }).click();
    await pipeline.getByRole('button', { name: 'Storyboard' }).click();
    const actions = pipeline.getByRole('group', { name: 'Storyboard actions' });
    const run = actions.getByRole('button', { name: 'Run' });
    expect(await run.getAttribute('aria-disabled')).toBe('true');
    expect(await run.getAttribute('title')).toContain('run Words timed first');
    await pipeline.getByText('timing/words.json is missing: run Words timed first.').waitFor();
    await run.hover();
    await shot('gating');

    await pipeline.getByRole('button', { name: 'Script written' }).click();
    await pipeline
      .getByRole('group', { name: 'Script written actions' })
      .getByRole('button', { name: 'Redo' })
      .click();
    const confirm = page.getByRole('alertdialog', { name: 'Redo Script written?' });
    await confirm.waitFor();
    expect(await confirm.textContent()).toContain('replaces its output');
    await shot('redo-confirm');
    await confirm.getByRole('button', { name: 'Cancel' }).click();
    await confirm.waitFor({ state: 'detached' });
    expect(gitSubjects().filter((subject) => subject === 'Claude turn: script')).toHaveLength(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      1280,
    );
  });
});
