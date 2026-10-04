/**
 * Shot variants in the built app (`pnpm test:app`; PLAN.md#11.3) on the CLI fixture project (two
 * shots, script approved, a git repo): V on s01 opens the Variants view with the estimate, three
 * variants are built (fake-claude writes them; v3 keeps a lint error and is dropped), the cards show
 * their QA badge and a looping clip rendered by the app's engine, "Play in preview" plays variant 2
 * in the main player, "Use this one" makes it the scene (commit + taste log) and the view closes.
 * The right-click menu of a shot offers Variants…. fake-claude only; screenshots at 1280×720 in
 * out/test-app/variants-*.png.
 */
import { spawnSync } from 'node:child_process';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fakeClaudeBinPath, type FakeClaudeScript } from '@reelforge/fake-claude';
import type { ElectronApplication, Page } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { logFile, TEST_CLAUDE_LAUNCHER_ENV } from '../src/main/app-paths.js';
import {
  closeApp,
  fixtureProject,
  launchApp,
  screenshotDir,
  stubFolderPicker,
  waitForProjectPreview,
} from './support/electron-app.js';

const CRITIC_OK = JSON.stringify({
  frames: [{ path: 'sheet.png', verdict: 'ok', note: 'looks right' }],
});
const SCENE = 'scenes/s01_title.js';

let app: ElectronApplication;
let page: Page;
let userDataDir: string;
let dir: string;
let original: string;

async function shot(name: string): Promise<void> {
  await page.screenshot({ path: path.join(screenshotDir, `variants-1280-${name}.png`) });
}

function git(args: readonly string[]): string {
  return spawnSync('git', ['-C', dir, ...args], { encoding: 'utf8' }).stdout.trim();
}

function shots() {
  return page.getByRole('region', { name: 'Shots' });
}

function dock() {
  return page.getByRole('region', { name: 'Variants of s01' });
}

/** The fixture title scene with another sky: visibly different variants. */
function variantSource(sky: string, label: string): string {
  return original
    .replace(
      'scene.background = new three.Color(palette.sky);',
      `scene.background = new three.Color(palette.${sky});`,
    )
    .replace("'Doom runs on anything'", `'${label}'`);
}

function work(index: number): string {
  return `.variants/s01/v${String(index)}.js`;
}

function writesRule(index: number, content: string, needle: string) {
  return {
    scenario: 'tools-write' as const,
    reply: 'Built the variant.',
    writes: [{ path: work(index), content }],
    promptIncludes: needle,
  };
}

async function createProject(target: string): Promise<void> {
  await cp(fixtureProject, target, { recursive: true });
  const stamp = '2026-10-03T10:00:00.000Z';
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
  const identity = ['-c', 'user.name=Variants Test', '-c', 'user.email=variants@test.local'];
  spawnSync('git', ['init', '--quiet', '--initial-branch=main', target]);
  spawnSync('git', ['-C', target, 'add', '--all']);
  spawnSync('git', ['-C', target, ...identity, 'commit', '--quiet', '-m', 'Fixture']);
}

beforeAll(async () => {
  userDataDir = await mkdtemp(path.join(tmpdir(), 'reelforge variants ż-'));
  dir = path.join(userDataDir, 'Warianty ujęć');
  await createProject(dir);
  original = await readFile(path.join(dir, ...SCENE.split('/')), 'utf8');
  const lint = variantSource('accent1', 'NOISE').replace(
    'const doom = anchor',
    'const noise = Math.random();\n  scene.userData.noise = noise;\n  const doom = anchor',
  );
  const script: FakeClaudeScript = {
    version: 1,
    rules: [
      writesRule(1, variantSource('hero', 'HERO PUSH'), `Write \`${work(1)}\``),
      writesRule(2, variantSource('accent2', 'ORBIT DEPTH'), `Write \`${work(2)}\``),
      writesRule(3, lint, `Write \`${work(3)}\``),
      writesRule(3, lint, `(\`${work(3)}\`)`),
    ],
    default: { scenario: 'tools-write', reply: CRITIC_OK },
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
  await cp(logFile(userDataDir), path.join(screenshotDir, 'variants-main.log')).catch(
    () => undefined,
  );
  await rm(userDataDir, { recursive: true, force: true, maxRetries: 5 });
});

describe('shot variants', () => {
  it('offers Variants… in the right-click menu of a shot', async () => {
    await shots()
      .getByRole('button', { name: /^Shot s02,/ })
      .click({ button: 'right' });
    const menu = page.getByRole('menu', { name: 'Shot s02' });
    await menu.getByRole('menuitem', { name: /Variants…/ }).waitFor();
    await shot('menu');
    await page.keyboard.press('Escape');
    await menu.waitFor({ state: 'detached' });
  });

  it('opens the Variants view with V, estimates and builds 3 variants', async () => {
    await shots()
      .getByRole('button', { name: /^Shot s01,/ })
      .click();
    await page.keyboard.press('v');
    await dock().getByRole('form', { name: 'New variants of s01' }).waitFor();
    await expect
      .poll(() => dock().getByTestId('variant-estimate').textContent())
      .toMatch(/^≈ 3 Opus turns, about \d+–\d+ min$/);
    await dock().getByLabel('Note for every variant (optional)').fill('make it calmer');
    await shot('setup');
    await dock().getByRole('button', { name: 'Generate 3 variants' }).click();
    const badge = (key: string) => dock().getByTestId(`variant-badge-${key}`).textContent();
    await expect.poll(() => badge('v1'), { timeout: 300_000, interval: 500 }).toBe('✓');
    await expect.poll(() => badge('v2'), { timeout: 300_000, interval: 500 }).toBe('✓');
    await expect.poll(() => badge('v3'), { timeout: 300_000, interval: 500 }).toBe('Dropped');
    await expect.poll(() => badge('current')).toBe('○');
    // Each ready card loops its own clip rendered by the app's engine.
    for (const key of ['current', 'v1', 'v2']) {
      await expect
        .poll(() => dock().getByTestId(`variant-clip-${key}`).getAttribute('data-frames'), {
          timeout: 120_000,
        })
        .toBe('13');
    }
    expect(await readFile(path.join(dir, ...SCENE.split('/')), 'utf8')).toBe(original);
    expect(git(['status', '--porcelain'])).toBe('');
    await shot('cards');
  }, 420_000);

  it('plays a variant in the main preview', async () => {
    await dock()
      .getByTestId('variant-card-v2')
      .getByRole('button', { name: 'Play in preview' })
      .click();
    await page.getByText('Previewing variant 2 of s01').waitFor();
    await expect
      .poll(() => page.locator('section.preview').getAttribute('data-playing'))
      .toBe('true');
    await shot('playing');
  }, 60_000);

  it('picks variant 2: scene, commit, taste log, and the view closes', async () => {
    await dock().getByTestId('variant-card-v2').click();
    await page.keyboard.press('2');
    await page.keyboard.press('Enter');
    await dock().waitFor({ state: 'detached', timeout: 60_000 });
    await expect
      .poll(() => git(['log', '-1', '--format=%s']), { timeout: 30_000 })
      .toBe('Shot s01: picked variant 2 (Orbit, layered depth)');
    expect(await readFile(path.join(dir, ...SCENE.split('/')), 'utf8')).toBe(
      variantSource('accent2', 'ORBIT DEPTH'),
    );
    const taste = JSON.parse(
      await readFile(path.join(dir, '.reelforge', 'taste.json'), 'utf8'),
    ) as {
      entries: { shotId: string; decision: string; chosen: string; note?: string }[];
    };
    expect(taste.entries).toEqual([
      expect.objectContaining({
        shotId: 's01',
        decision: 'pick',
        chosen: 'orbit-depth',
        note: 'make it calmer',
      }),
    ]);
    await page.getByText('Previewing variant 2 of s01').waitFor({ state: 'detached' });
    await shot('picked');
  }, 120_000);
});
