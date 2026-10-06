/**
 * The smoke checks every packaged ReelForge.exe must pass (unpacked build and installed app):
 * window + demo preview, shipped hook and CLI (direct, cmd shim, Git Bash shim), Claude detection
 * in Settings (`claude --version` / `auth status`, never a model call), a new project with
 * CLAUDE.md and the style bibles, and frames of that project rendered by the app's render service
 * through the packaged CLI.
 */
import { existsSync } from 'node:fs';
import { cp, mkdir, mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { writeCliShims } from '@reelforge/cli/shims';
import { checkConnection, type ConnectionState } from '@reelforge/claude-bridge';
import { computeFrameStats, decodePng } from '@reelforge/engine/raster';
import type { ElectronApplication, Page } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { logFile } from '../../src/main/app-paths.js';
import {
  FIRST_FRAME_TIMEOUT_MS,
  fixtureProject,
  frameStats,
  stubFolderPicker,
} from '../support/electron-app.js';
import {
  cleanEnv,
  gitBash,
  launchPackaged,
  packagedOutDir,
  resourcesOf,
  runAsNode,
  runCmdShim,
  runProcess,
  withPathFirst,
} from './packaged-app.js';

const PROJECT_TITLE = 'Paczka ż test';
const SERVICE_WAIT_MS = 20_000;

function expectedClaudeChip(state: ConnectionState): string {
  switch (state.state) {
    case 'ok':
      return 'Claude: connected';
    case 'not-installed':
      return 'Claude: not installed';
    case 'not-logged-in':
      return 'Claude: not logged in';
    case 'error':
      return 'Claude: not connected';
  }
}

interface FramesReport {
  readonly frames: readonly { t: number; file: string; blank: string | null }[];
  readonly issues: readonly unknown[];
}

/** Waits until the app's render service serves the open project (env Claude's children get). */
async function serviceEnvOf(app: ElectronApplication, page: Page): Promise<Record<string, string>> {
  const deadline = Date.now() + SERVICE_WAIT_MS;
  while (Date.now() < deadline) {
    const env = await app.evaluate(
      (_electron, name) =>
        (
          Reflect.get(globalThis, name) as
            { serviceEnv(): Record<string, string> | undefined } | undefined
        )?.serviceEnv(),
      '__reelforgeRenderTest',
    );
    if (env !== undefined) return env;
    await page.waitForTimeout(100);
  }
  throw new Error('the render service did not start for the created project');
}

export function definePackagedSmokeTests(label: string, exe: () => string): void {
  let app: ElectronApplication;
  let page: Page;
  let userDataDir: string;
  let projectDir: string;
  let shimDir: string;

  const resources = (): string => resourcesOf(exe());
  const cliBundle = (): string => path.join(resources(), 'cli', 'reelforge.mjs');
  const hook = (): string => path.join(resources(), 'hooks', 'bash-guard.mjs');

  describe(`packaged app (${label})`, () => {
    beforeAll(async () => {
      // Space + Polish letter: profile and project paths like real Windows users have.
      userDataDir = await mkdtemp(path.join(tmpdir(), `reelforge ${label} ż-`));
      shimDir = path.join(userDataDir, 'bin');
      await mkdir(packagedOutDir, { recursive: true });
      app = await launchPackaged(exe(), userDataDir);
      page = await app.firstWindow();
    }, 120_000);

    afterAll(async () => {
      await app.close();
      await cp(logFile(userDataDir), path.join(packagedOutDir, `${label}-main.log`)).catch(
        () => undefined,
      );
      await rm(userDataDir, { recursive: true, force: true });
    });

    it('runs from the packaged files with the temporary profile', async () => {
      expect(await app.evaluate(({ app: electronApp }) => electronApp.isPackaged)).toBe(true);
      const userData = await app.evaluate(({ app: electronApp }) =>
        electronApp.getPath('userData'),
      );
      expect(path.resolve(userData)).toBe(path.resolve(userDataDir));
      expect(existsSync(logFile(userDataDir))).toBe(true);
      expect(page.url()).toBe('reelforge://app/index.html');
    });

    it('previews the demo scene (non-blank frame)', async () => {
      await page
        .locator('canvas.preview-canvas[data-rendered-t]')
        .waitFor({ timeout: FIRST_FRAME_TIMEOUT_MS });
      const stats = await frameStats(page);
      expect([stats.width, stats.height]).toEqual([640, 360]);
      expect(stats.distinctColours).toBeGreaterThan(4);
      await page.screenshot({ path: path.join(packagedOutDir, `${label}-window.png`) });
    });

    it('ships the bash guard and the CLI as real files that run on the app binary', async () => {
      const env = cleanEnv();
      const cwd = userDataDir;
      const run = (command: string) =>
        runAsNode(exe(), hook(), ['reelforge'], {
          cwd,
          env,
          input: JSON.stringify({ tool_name: 'Bash', tool_input: { command } }),
        });
      expect((await run('reelforge status')).status).toBe(0);
      const blocked = await run('curl https://example.invalid');
      expect(blocked.status).toBe(2);
      expect(blocked.stderr).toContain('ReelForge bash guard:');

      const docs = await runAsNode(exe(), cliBundle(), ['kit-docs', 'calculator'], { cwd, env });
      expect(docs.stderr).toBe('');
      expect(docs.status).toBe(0);
      expect(docs.stdout).toContain('calculator');

      // The launchers the app writes into <userData>/bin for Claude's PATH (same function).
      await writeCliShims({
        dir: shimDir,
        runtime: exe(),
        script: cliBundle(),
        env: { ELECTRON_RUN_AS_NODE: '1' },
        platform: 'win32',
      });
      const viaCmd = await runCmdShim(path.join(shimDir, 'reelforge.cmd'), ['kit-docs'], {
        cwd,
        env,
      });
      expect(viaCmd.status, viaCmd.stderr).toBe(0);
      expect(viaCmd.stdout).toContain('kit.voxel.fromGrid');
      const bash = gitBash();
      if (bash !== undefined) {
        const viaBash = await runProcess(bash, ['-c', 'reelforge kit-docs calculator'], {
          cwd,
          env: withPathFirst(env, shimDir),
        });
        expect(viaBash.status, viaBash.stderr).toBe(0);
        expect(viaBash.stdout).toContain('calculator');
      }
    });

    it('shows the Claude Code detection in the status bar and Settings', async () => {
      const state = await checkConnection({ timeoutMs: 20_000 });
      await page
        .getByRole('contentinfo', { name: 'Status' })
        .getByRole('button', { name: expectedClaudeChip(state) })
        .waitFor({ timeout: 30_000 });
      await page.getByRole('button', { name: 'Settings', exact: true }).click();
      const dialog = page.getByRole('dialog', { name: 'Settings' });
      await dialog.waitFor();
      expect(await dialog.textContent()).not.toMatch(/@/);
      await page.screenshot({ path: path.join(packagedOutDir, `${label}-settings.png`) });
      await dialog.getByRole('button', { name: 'Close', exact: true }).click();
      await dialog.waitFor({ state: 'detached' });
    });

    it('creates a project with CLAUDE.md and the style bibles', async () => {
      const parent = path.join(userDataDir, 'Moje projekty');
      await mkdir(parent);
      await stubFolderPicker(app, parent);
      await page.getByLabel('Video title').fill(PROJECT_TITLE);
      await page.getByRole('button', { name: 'New project…' }).click();
      await page.getByRole('button', { name: 'History', exact: true }).waitFor();
      projectDir = path.join(parent, PROJECT_TITLE);
      const template = path.join(resources(), 'template');
      expect(await readFile(path.join(projectDir, 'CLAUDE.md'))).toEqual(
        await readFile(path.join(template, 'project', 'CLAUDE.md')),
      );
      const project = JSON.parse(await readFile(path.join(projectDir, 'project.json'), 'utf8')) as {
        style: string;
      };
      const bible = path.join('styles', project.style, 'STYLE.md');
      expect(await readFile(path.join(projectDir, bible))).toEqual(
        await readFile(path.join(template, bible)),
      );
      expect((await readdir(path.join(projectDir, 'styles'))).sort()).toEqual(
        (await readdir(path.join(template, 'styles'))).sort(),
      );
    });

    it('renders a frame of the project through the render service and the packaged CLI', async () => {
      // The fixture's scenes, storyboard and timing go into the created project.
      for (const entry of await readdir(fixtureProject)) {
        if (entry === 'project.json') continue;
        await cp(path.join(fixtureProject, entry), path.join(projectDir, entry), {
          recursive: true,
        });
      }
      const serviceEnv = await serviceEnvOf(app, page);
      expect(serviceEnv['REELFORGE_RENDER_URL']).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);
      const run = await runCmdShim(
        path.join(shimDir, 'reelforge.cmd'),
        ['frames', '--shot', 's02', '--at', '2.5', '--json'],
        { cwd: projectDir, env: cleanEnv(serviceEnv) },
      );
      expect(run.stderr).toBe('');
      expect(run.status, run.stdout).toBe(0);
      const report = JSON.parse(run.stdout) as FramesReport;
      expect(report.issues).toEqual([]);
      const frame = report.frames[0];
      expect(frame?.blank).toBeNull();
      const image = decodePng(await readFile(frame?.file ?? ''));
      expect([image.width, image.height]).toEqual([640, 360]);
      expect(computeFrameStats(image.data).dominantColorShare).toBeLessThan(0.9);
      await cp(frame?.file ?? '', path.join(packagedOutDir, `${label}-s02_t2.500.png`));
    });
  });
}
