/**
 * Chat panel smoke test on the built app (`pnpm test:app`, PLAN.md#6.6) with tools/fake-claude as
 * the claude executable (test hook REELFORGE_TEST_CLAUDE_LAUNCHER; never a model call):
 * - click the calculator in the preview -> "Selected: calculator (s02)", scope Selection;
 * - "make the calculator bigger" -> fake claude "renders frames", looks at one and writes a bigger
 *   scene: the preview hot-reloads within 1 s, the step log shows the steps with a thumbnail and a
 *   "Claude turn: …" commit appears;
 * - queue two messages (+ remove a third); Esc in the message box does not stop the turn, Ctrl+.
 *   stops it mid-stream: the partial file stays and is committed as "Claude turn (stopped): …",
 *   the queued one runs afterwards;
 * - History tab lists the turns. Screenshots at 1280x720 in out/test-app/.
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fakeClaudeBinPath, type FakeClaudeScript } from '@reelforge/fake-claude';
import type { ElectronApplication, Page } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { logFile, TEST_CLAUDE_LAUNCHER_ENV } from '../src/main/app-paths.js';
import {
  fixtureProject,
  frameStats,
  closeApp,
  launchApp,
  screenshotDir,
  stubFolderPicker,
  waitForProjectPreview,
} from './support/electron-app.js';
import { showChat } from './support/pipeline-rows.js';

const repoRoot = path.resolve(import.meta.dirname, '..', '..', '..');
const SAMPLE_FRAME = path.join(
  repoRoot,
  'packages',
  'engine',
  'test',
  'goldens',
  'swiftshader',
  'hello-t2.5.png',
);
const FRAME = '.reelforge/frames/s02/s02_t0.000.png';

/** A kit calculator filling the middle of the frame; `scale` is what Claude changes. */
function calculatorScene(scale: number): string {
  return `// Chat smoke test scene: a kit calculator in the middle of the frame.
export const meta = { id: 's02', title: 'Calculator', treatment: 'metaphor-object' };

export function build(ctx) {
  const { three, scene, kit, palette } = ctx;
  scene.background = new three.Color(palette.sky);
  scene.add(new three.HemisphereLight(palette.fillLight, palette.shadow, 2.5));
  const sun = new three.DirectionalLight(palette.keyLight, 2);
  sun.position.set(3, 6, 5);
  scene.add(sun);
  const calculator = kit.props.calculator({ screen: 'text', text: '61 KB' });
  calculator.scale.setScalar(${String(scale)});
  const centre = new three.Box3().setFromObject(calculator).getCenter(new three.Vector3());
  calculator.position.sub(centre);
  scene.add(calculator);
  return { calculator };
}

export function update(t, state, ctx) {
  ctx.camera.set({ position: [0, 4, 4], target: [0, 0, 0], fov: 50 });
  state.calculator.update(t);
}
`;
}

const SCRIPT: FakeClaudeScript = {
  version: 1,
  rules: [
    {
      promptIncludes: 'make the calculator bigger',
      scenario: 'tools-write',
      delayMs: 120,
      reply: 'Scaled the **calculator** to `1.9x` and checked the frame.',
      toolCalls: [
        {
          name: 'Bash',
          input: { command: 'reelforge frames --shot s02 --at 0' },
          output: `frames (t = local shot time; Read these PNG files):\n  t=0       {cwd}/${FRAME}`,
        },
        { name: 'Read', input: { file_path: `{cwd}/${FRAME}` }, output: 'image' },
      ],
      writes: [{ path: 'scenes/s02_calc.js', content: calculatorScene(1.9) }],
    },
    {
      promptIncludes: 'slow change one',
      scenario: 'tools-write',
      delayMs: 1_500,
      writes: [{ path: 'notes/partial.md', content: 'half done\n' }],
    },
  ],
  default: { scenario: 'ok', reply: 'Done.' },
};

let app: ElectronApplication;
let page: Page;
let userDataDir: string;
let projectDir: string;

function gitSubjects(): string[] {
  const run = spawnSync('git', ['log', '--format=%s'], { cwd: projectDir, encoding: 'utf8' });
  return run.stdout.split('\n').filter((line) => line !== '');
}

async function resize(width: number, height: number): Promise<void> {
  await app.evaluate(
    ({ BrowserWindow }, size) => {
      BrowserWindow.getAllWindows()[0]?.setContentSize(size.width, size.height);
    },
    { width, height },
  );
  await page.waitForFunction(
    (size) => window.innerWidth === size.width && window.innerHeight === size.height,
    { width, height },
  );
  await page.waitForTimeout(300);
}

async function send(text: string): Promise<void> {
  const box = page.getByRole('textbox', { name: 'Message to Claude' });
  await box.fill(text);
  await box.press('Enter');
}

beforeAll(async () => {
  userDataDir = await mkdtemp(path.join(tmpdir(), 'reelforge chat ż-'));
  projectDir = path.join(userDataDir, 'Chat ż projekt');
  await cp(fixtureProject, projectDir, { recursive: true });
  const storyboardFile = path.join(projectDir, 'storyboard.json');
  const storyboard = JSON.parse(await readFile(storyboardFile, 'utf8')) as {
    shots: Record<string, unknown>[];
  };
  // No transition into s02: its first frame shows only the calculator.
  for (const shot of storyboard.shots) delete shot['transitionIn'];
  await writeFile(storyboardFile, JSON.stringify(storyboard, null, 2));
  await writeFile(path.join(projectDir, 'scenes', 's02_calc.js'), calculatorScene(1.2));
  await mkdir(path.join(projectDir, '.reelforge', 'frames', 's02'), { recursive: true });
  await cp(SAMPLE_FRAME, path.join(projectDir, ...FRAME.split('/')));
  const script = path.join(userDataDir, 'fake-claude-script.json');
  await writeFile(script, JSON.stringify(SCRIPT));
  await mkdir(screenshotDir, { recursive: true });
  app = await launchApp(userDataDir, {
    env: {
      [TEST_CLAUDE_LAUNCHER_ENV]: JSON.stringify({
        command: process.execPath,
        args: [fakeClaudeBinPath],
      }),
      FAKE_CLAUDE_SCRIPT: script,
    },
  });
  page = await app.firstWindow();
  await page.getByRole('region', { name: 'Start' }).waitFor();
  await stubFolderPicker(app, projectDir);
  await page.getByRole('button', { name: 'Open project…' }).click();
  await waitForProjectPreview(page);
  await resize(1280, 720);
}, 180_000);

afterAll(async () => {
  await closeApp(app);
  await cp(logFile(userDataDir), path.join(screenshotDir, 'chat-main.log')).catch(() => undefined);
  await rm(userDataDir, { recursive: true, force: true });
});

describe('Claude chat panel', () => {
  it('picks the calculator, makes it bigger end-to-end, hot-reloads and commits', async () => {
    // 1280 px wide: the chat starts as the rail (PLAN.md#11.2).
    expect(await page.getByRole('button', { name: 'Show chat' }).count()).toBe(1);
    const chat = await showChat(page);
    await page.getByRole('button', { name: /^Shot s02,/ }).click();
    await page.waitForFunction(
      () =>
        document.querySelector<HTMLCanvasElement>('canvas.preview-canvas')?.dataset['renderedT'] ===
        '2.200',
    );
    await page.locator('canvas.preview-canvas').click();
    await chat.getByText('Selected: calculator (s02)').waitFor();
    expect(await chat.getByRole('radio', { name: 'Selection' }).isChecked()).toBe(true);
    await page.screenshot({ path: path.join(screenshotDir, 'chat-1280-selected.png') });

    const before = (await frameStats(page)).hash;
    const scene = path.join(projectDir, 'scenes', 's02_calc.js');
    await send('make the calculator bigger');
    // The fake writes the scene before its first line: from then on the preview must follow.
    const deadline = Date.now() + 30_000;
    while (!(await readFile(scene, 'utf8')).includes('setScalar(1.9)')) {
      if (Date.now() > deadline) throw new Error('fake claude did not write the scene');
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    const written = performance.now();
    await page.waitForFunction(
      (hash) => {
        const canvas = document.querySelector<HTMLCanvasElement>('canvas.preview-canvas');
        const context = canvas?.getContext('2d');
        if (!canvas || !context) return false;
        const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
        let value = 0x811c9dc5;
        for (const byte of data) value = Math.imul(value ^ byte, 0x01000193) >>> 0;
        return value.toString(16) !== hash;
      },
      before,
      { timeout: 10_000, polling: 20 },
    );
    const reloadMs = performance.now() - written;
    expect(reloadMs).toBeLessThan(1_000);

    const turn = chat.locator('[data-turn-status="done"]');
    await turn.waitFor({ timeout: 30_000 });
    await expect
      .poll(gitSubjects, { timeout: 10_000 })
      .toContain('Claude turn: make the calculator bigger');
    const steps = turn.locator('.step-tool');
    expect(await steps.allTextContents()).toEqual([
      expect.stringContaining('Rendered frames at 0s') as string,
      expect.stringContaining('Looked at a frame') as string,
      expect.stringContaining('Wrote') as string,
    ]);
    expect(await steps.nth(2).textContent()).toContain('s02_calc.js');
    const thumbnails = turn.locator('.step-thumbnails img');
    expect(await thumbnails.count()).toBe(2);
    await expect
      .poll(() => thumbnails.first().evaluate((image: HTMLImageElement) => image.naturalWidth))
      .toBe(240);
    expect(await turn.locator('.step-text strong').textContent()).toBe('calculator');
    await expect.poll(() => turn.getByText(/^Saved · [0-9a-f]{7}$/).count()).toBe(1);
    await page.screenshot({ path: path.join(screenshotDir, 'chat-1280-done.png') });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      1280,
    );
  });

  it('queues messages, removes one, stops mid-stream and keeps the partial work', async () => {
    const chat = page.getByRole('region', { name: 'Claude' });
    await chat.locator('.scope-option', { hasText: 'Whole video' }).click();
    await send('slow change one');
    const stop = chat.getByRole('button', { name: 'Stop Claude' });
    await expect.poll(() => stop.isEnabled()).toBe(true);
    await send('second message');
    await send('third message');
    await chat.getByText('Queue 2').waitFor();
    await chat.getByRole('button', { name: 'Remove queued message 2' }).click();
    await chat.getByText('Queue 1').waitFor();
    await page.screenshot({ path: path.join(screenshotDir, 'chat-1280-queue.png') });

    const partial = path.join(projectDir, 'notes', 'partial.md');
    await expect.poll(() => existsSync(partial), { timeout: 15_000 }).toBe(true);
    // Esc in the message box never stops Claude; Ctrl+. does (docs/ui-copy.md "Keys").
    await chat.getByRole('textbox', { name: 'Message to Claude' }).focus();
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    expect(await chat.locator('[data-turn-status="stopped"]').count()).toBe(0);
    expect(await stop.isEnabled()).toBe(true);
    await page.keyboard.press('Control+.');
    await chat.locator('[data-turn-status="stopped"]').waitFor({ timeout: 15_000 });
    await expect
      .poll(() => chat.locator('[data-turn-status="done"]').count(), { timeout: 30_000 })
      .toBe(2);
    await chat.getByText('Queue 0').waitFor();
    expect(await readFile(partial, 'utf8')).toBe('half done\n');
    await expect
      .poll(gitSubjects, { timeout: 10_000 })
      .toContain('Claude turn (stopped): slow change one');
    expect(await chat.getByText('third message').count()).toBe(0);
    await page.screenshot({ path: path.join(screenshotDir, 'chat-1280-stopped.png') });

    await chat.getByRole('tab', { name: 'History' }).click();
    await chat.getByText('make the calculator bigger').waitFor();
    await chat.getByText('Claude turn (stopped): slow change one').waitFor();
    await page.screenshot({ path: path.join(screenshotDir, 'chat-1280-history.png') });
    await chat.getByRole('tab', { name: 'Chat' }).click();
  });
});
