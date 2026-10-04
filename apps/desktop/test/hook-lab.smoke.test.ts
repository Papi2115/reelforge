/**
 * Hook lab and Settings → Taste in the built app (`pnpm test:app`; PLAN.md#12.16, #12.13) on the
 * CLI fixture project (script approved, s01 locked, a git repo): Script → "Hook lab…" → Claude
 * (fake-claude, one read-only turn) writes three openings shown next to the current one; key 2
 * asks to replace the opening and lists the locked shot; confirming rewrites script.txt's opening,
 * commits `Hook lab: opening 2 (Question)` (step `script`) and leaves the locked scene and
 * locks.json untouched. Settings → Taste shows the switch (off: the seeded settings predate it),
 * the profile status, turns learning on (saved to settings.json) and offers Forget everything. fake-claude only;
 * screenshots at 1280×720 in out/test-app/hook-lab-*.png.
 */
import { spawnSync } from 'node:child_process';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fakeClaudeBinPath, type FakeClaudeScript } from '@reelforge/fake-claude';
import type { ElectronApplication, Page } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { TEST_CLAUDE_LAUNCHER_ENV } from '../src/main/app-paths.js';
import {
  closeApp,
  fixtureProject,
  launchApp,
  screenshotDir,
  stubFolderPicker,
  waitForProjectPreview,
} from './support/electron-app.js';
import { showStage } from './support/pipeline-rows.js';

const RESEARCH = [
  '# Research: Doom on a calculator',
  '',
  '- Doom shipped in 1993 — https://en.wikipedia.org/wiki/Doom_(1993_video_game)',
  '- The TI-84 Plus CE port fits in 61 KB — https://www.cemetech.net/doom84',
  '',
].join('\n');
const HOOKS = [
  {
    style: 'cold-open',
    text: 'A tiny calculator screen flickers, and a demon from 1993 stares back at you. Somebody just got Doom running on it, again. No graphics card, no fan, no hard drive, just a handful of buttons and a battery. So how does a whole shooter squeeze into a machine built for homework?',
    firstVisual: 'A pixel calculator screen flickering to life with a tiny demon face',
    claimsToSource: true,
  },
  {
    style: 'question',
    text: 'Why can a game that once needed a whole computer now run on the calculator in your school bag? It has a tiny screen, a slow chip and a few buttons, and yet people keep porting the same famous shooter to it. What makes this old game so easy to squeeze into almost anything?',
    firstVisual: 'A school bag opening, a calculator glowing inside it',
    claimsToSource: false,
  },
  {
    style: 'shocking-fact',
    text: 'This calculator has only 61 KB of memory, less than a single photo on your phone. And yet it runs Doom, the shooter from 1993 that once needed a real gaming computer. Squeezing a whole game into that little space sounds impossible, but programmers did it, and they keep doing it.',
    firstVisual: 'A giant pixel counter ticking up to 61 KB next to a tiny chip',
    claimsToSource: true,
  },
];

let app: ElectronApplication;
let page: Page;
let userDataDir: string;
let dir: string;
let lockedScene: string;
let locks: string;

async function shot(name: string): Promise<void> {
  await page.screenshot({ path: path.join(screenshotDir, `hook-lab-1280-${name}.png`) });
}

function git(args: readonly string[]): string {
  return spawnSync('git', ['-C', dir, ...args], { encoding: 'utf8' }).stdout.trim();
}

async function createProject(target: string): Promise<void> {
  await cp(fixtureProject, target, { recursive: true });
  const stamp = '2026-10-04T10:00:00.000Z';
  await writeFile(path.join(target, 'research.md'), RESEARCH);
  await writeFile(
    path.join(target, 'locks.json'),
    `${JSON.stringify({ version: 1, shots: [{ shotId: 's01', lockedAt: stamp }] }, null, 2)}\n`,
  );
  await mkdir(path.join(target, '.reelforge'), { recursive: true });
  await writeFile(
    path.join(target, '.reelforge', 'pipeline.json'),
    JSON.stringify({
      version: 1,
      updatedAt: stamp,
      stages: { script: { status: 'done', updatedAt: stamp, approvedAt: stamp } },
      queue: [],
    }),
  );
  await writeFile(path.join(target, '.gitignore'), '.reelforge/\naudio/**\nout/\n*.tmp\n');
  const identity = ['-c', 'user.name=Hook Lab Test', '-c', 'user.email=hooks@test.local'];
  spawnSync('git', ['init', '--quiet', '--initial-branch=main', target]);
  spawnSync('git', ['-C', target, 'add', '--all']);
  spawnSync('git', ['-C', target, ...identity, 'commit', '--quiet', '-m', 'Fixture']);
}

beforeAll(async () => {
  userDataDir = await mkdtemp(path.join(tmpdir(), 'reelforge hook lab ż-'));
  dir = path.join(userDataDir, 'Haczyk filmu');
  await createProject(dir);
  lockedScene = await readFile(path.join(dir, 'scenes', 's01_title.js'), 'utf8');
  locks = await readFile(path.join(dir, 'locks.json'), 'utf8');
  const script: FakeClaudeScript = {
    version: 1,
    rules: [
      {
        scenario: 'ok',
        reply: JSON.stringify({ hooks: HOOKS }),
        promptIncludes: 'Write THREE alternative openings',
      },
    ],
    default: 'ok',
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
      REELFORGE_TEST_HOOKS: '1',
    },
  });
  page = await app.firstWindow();
  await page.getByRole('region', { name: 'Start' }).waitFor();
  await app.evaluate(({ BrowserWindow }) => {
    BrowserWindow.getAllWindows()[0]?.setContentSize(1280, 720);
  });
  await page.waitForFunction(() => window.innerWidth === 1280 && window.innerHeight === 720);
  await stubFolderPicker(app, dir);
  await page.getByRole('button', { name: 'Open project…' }).click();
  await waitForProjectPreview(page);
}, 180_000);

afterAll(async () => {
  await closeApp(app);
  await rm(userDataDir, { recursive: true, force: true, maxRetries: 5 });
});

describe('Hook lab', () => {
  it('writes three openings, compares them and replaces the opening on confirm', async () => {
    await (await showStage(page, 'Script written')).click();
    await page
      .getByRole('region', { name: 'Pipeline' })
      .getByRole('group', { name: 'Script written actions' })
      .getByRole('button', { name: 'Open' })
      .click();
    const view = page.getByRole('region', { name: 'Script' });
    await view.getByRole('button', { name: 'Hook lab…' }).click();
    const lab = page.getByRole('dialog', { name: 'Hook lab' });
    await lab.getByRole('button', { name: 'Write three openings' }).click();
    await lab.getByRole('article', { name: '2 · Question' }).waitFor({ timeout: 30_000 });
    await lab.getByRole('article', { name: 'Current opening' }).waitFor();
    expect(await lab.getByRole('article', { name: '3 · Shocking fact' }).textContent()).toContain(
      'check its source',
    );
    expect(await lab.getByRole('button', { name: 'Use this opening' }).count()).toBe(3);
    await shot('compare');

    await page.keyboard.press('2');
    const confirm = lab.getByRole('group', { name: 'Replace the opening' });
    await confirm.waitFor();
    expect(await confirm.textContent()).toContain(
      'Locked shots stay exactly as they are and are never rebuilt automatically: s01.',
    );
    await shot('confirm');
    await confirm.getByRole('button', { name: 'Replace the opening' }).click();
    await lab.getByText("Opening 2 (Question) is now the script's opening.").waitFor();

    const updated = await readFile(path.join(dir, 'script.txt'), 'utf8');
    expect(updated.startsWith(HOOKS[1]?.text ?? '')).toBe(true);
    await expect
      .poll(() => git(['log', '-1', '--format=%s']), { timeout: 15_000 })
      .toBe('Hook lab: opening 2 (Question)');
    expect(git(['log', '-1', '--format=%(trailers:key=ReelForge-Step,valueonly)'])).toBe('script');
    expect(git(['show', '--name-only', '--format=', 'HEAD'])).toBe('script.txt');
    expect(await readFile(path.join(dir, 'scenes', 's01_title.js'), 'utf8')).toBe(lockedScene);
    expect(await readFile(path.join(dir, 'locks.json'), 'utf8')).toBe(locks);
    const stored = JSON.parse(
      await readFile(path.join(dir, '.reelforge', 'hooks', '1.json'), 'utf8'),
    ) as { decision?: { kind: string; index: number } };
    expect(stored.decision).toMatchObject({ kind: 'pick', index: 2 });
    await shot('picked');
    await lab.getByRole('button', { name: 'Close' }).click();
    await lab.waitFor({ state: 'detached' });
  });
});

describe('Settings → Taste', () => {
  it('shows the profile status, turns learning on and offers Forget everything', async () => {
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Settings' });
    await dialog.getByRole('tab', { name: 'Taste' }).click();
    const toggle = dialog.getByRole('checkbox', { name: /Learn my taste/ });
    // The seeded settings file has no taste field (an install from before 2.3): learning is off.
    expect(await toggle.isChecked()).toBe(false);
    await dialog.getByText(/Taste learning is off/).waitFor();
    expect(await dialog.getByRole('button', { name: 'Forget everything…' }).isDisabled()).toBe(
      true,
    );
    await dialog.getByRole('button', { name: 'Export profile…' }).waitFor();
    await page.screenshot({ path: path.join(screenshotDir, 'hook-lab-1280-taste.png') });
    await toggle.check();
    await dialog.getByText(/the profile is used from 3 on/).waitFor();
    await expect
      .poll(
        async () =>
          (
            JSON.parse(await readFile(path.join(userDataDir, 'settings.json'), 'utf8')) as {
              taste?: { learning?: string };
            }
          ).taste?.learning,
        { timeout: 10_000 },
      )
      .toBe('auto');
    await dialog.getByRole('button', { name: 'Close' }).click();
  });
});
