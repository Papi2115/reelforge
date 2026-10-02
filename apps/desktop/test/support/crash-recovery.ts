/**
 * Helpers of the crash-recovery app test (PLAN.md#10.2): launching the app with fake-claude,
 * hard-killing its whole process tree (as a crash / Task Manager "End task" would), checking that
 * nothing survived and that the project's git repository is still sound.
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { killTree } from '@reelforge/claude-bridge';
import { fakeClaudeBinPath, type FakeClaudeScript } from '@reelforge/fake-claude';
import type { ElectronApplication, Page } from 'playwright';
import { settingsFile, TEST_CLAUDE_LAUNCHER_ENV } from '../../src/main/app-paths.js';
import { launchApp, stubFolderPicker } from './electron-app.js';

export function alive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false; // ESRCH: gone
  }
}

export async function waitFor(check: () => boolean, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!check()) {
    if (Date.now() > deadline) throw new Error('timed out waiting');
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

/** Settings of a profile past the first-run gate, with one export worker (shots in order). */
export async function seedProfile(userDataDir: string): Promise<void> {
  await mkdir(userDataDir, { recursive: true });
  await writeFile(
    settingsFile(userDataDir),
    JSON.stringify({
      version: 1,
      onboarding: { connectClaudeDone: true },
      performance: { exportWorkers: 1 },
    }),
  );
}

/** Launches the app with fake-claude playing `script` (written next to the profile). */
export async function launchWithScript(
  userDataDir: string,
  name: string,
  script: FakeClaudeScript,
  env: Readonly<Record<string, string>> = {},
): Promise<{ readonly app: ElectronApplication; readonly page: Page }> {
  const sidecar = path.join(userDataDir, `${name}.json`);
  await writeFile(sidecar, JSON.stringify(script));
  const app = await launchApp(userDataDir, {
    env: {
      [TEST_CLAUDE_LAUNCHER_ENV]: JSON.stringify({
        command: process.execPath,
        args: [fakeClaudeBinPath],
      }),
      FAKE_CLAUDE_SCRIPT: sidecar,
      REELFORGE_TEST_HOOKS: '1',
      ...env,
    },
  });
  const page = await app.firstWindow();
  await page.getByRole('region', { name: 'Start' }).waitFor();
  return { app, page };
}

export async function openFolder(app: ElectronApplication, page: Page, dir: string): Promise<void> {
  await stubFolderPicker(app, dir);
  await page.getByRole('button', { name: 'Open project…' }).click();
}

/** Kills the app's main process and every descendant (`taskkill /T /F`), no shutdown hooks. */
export async function hardKill(app: ElectronApplication): Promise<void> {
  const pid = app.process().pid;
  if (pid === undefined) throw new Error('the app has no pid');
  const killed = await killTree(pid);
  if (!killed.ok) throw new Error(killed.error);
  await waitFor(() => !alive(pid), 15_000);
}

/** The repository is usable: no lock left, `git status` and `git fsck` succeed. */
export function gitHealth(dir: string): {
  lock: boolean;
  status: number | null;
  fsck: number | null;
} {
  const run = (args: string[]): number | null =>
    spawnSync('git', ['-C', dir, ...args], { encoding: 'utf8' }).status;
  return {
    lock: existsSync(path.join(dir, '.git', 'index.lock')),
    status: run(['status', '--porcelain']),
    fsck: run(['fsck', '--no-progress', '--connectivity-only']),
  };
}

export function gitSubjects(dir: string): string[] {
  const run = spawnSync('git', ['-C', dir, 'log', '--format=%s'], { encoding: 'utf8' });
  return run.stdout.split('\n').filter((line) => line !== '');
}
