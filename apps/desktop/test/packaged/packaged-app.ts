/**
 * Helpers of the packaged-app smoke tests (`pnpm test:packaged`): launching a packaged
 * ReelForge.exe through Playwright with a temporary profile (`--user-data-dir`, so the real
 * %APPDATA%/ReelForge is never touched), and running the shipped hook / CLI the way Claude Code
 * does: on the app binary as Node (ELECTRON_RUN_AS_NODE=1), directly or through the PATH shims.
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { _electron, type ElectronApplication } from 'playwright';
import { settingsFile } from '../../src/main/app-paths.js';
import { appRoot } from '../support/electron-app.js';

export const releaseDir = path.join(appRoot, 'release');
export const unpackedExe = path.join(releaseDir, 'win-unpacked', 'ReelForge.exe');
/** Screenshots, frames and logs of the packaged runs (for a look after the run). */
export const packagedOutDir = path.join(appRoot, 'out', 'test-packaged');

/** resources/ next to the exe: app.asar plus the files other processes run. */
export function resourcesOf(exe: string): string {
  return path.join(path.dirname(exe), 'resources');
}

/** The parent env without anything that would change how Electron or the app starts. */
export function cleanEnv(extra: Readonly<Record<string, string>> = {}): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [name, value] of Object.entries(process.env)) {
    if (value === undefined || name === 'ELECTRON_RUN_AS_NODE') continue;
    if (name.startsWith('REELFORGE_')) continue;
    env[name] = value;
  }
  return { ...env, ...extra };
}

/** Launches the packaged app on a fresh profile (first-run gate done, render test hook on). */
export async function launchPackaged(
  exe: string,
  userDataDir: string,
): Promise<ElectronApplication> {
  if (!existsSync(exe)) throw new Error(`${exe} is missing; run \`pnpm package\` first`);
  await mkdir(userDataDir, { recursive: true });
  await writeFile(
    settingsFile(userDataDir),
    JSON.stringify({ version: 1, onboarding: { connectClaudeDone: true } }),
  );
  const app = await _electron.launch({
    executablePath: exe,
    args: [`--user-data-dir=${userDataDir}`],
    cwd: userDataDir,
    env: cleanEnv({ REELFORGE_TEST_HOOKS: '1' }),
  });
  await app.firstWindow();
  // As in the dev smoke tests: never take the OS keyboard focus of the machine running them.
  await app.evaluate(({ BrowserWindow }) => {
    for (const window of BrowserWindow.getAllWindows()) {
      window.setFocusable(false);
      window.blur();
    }
  });
  return app;
}

export interface ProcessRun {
  readonly status: number | null;
  readonly stdout: string;
  readonly stderr: string;
}

interface RunOptions {
  readonly cwd: string;
  readonly env: Record<string, string>;
  readonly input?: string;
  /** Pass `args` to the command line unquoted (cmd.exe, NSIS). */
  readonly verbatim?: boolean;
  /** First command-line token (with `verbatim`: quote paths with spaces yourself). */
  readonly argv0?: string;
}

/**
 * Runs a process asynchronously: Playwright must keep serving the app meanwhile (it resumes every
 * window the app opens, like the hidden render windows of the render service).
 */
export function runProcess(
  command: string,
  args: readonly string[],
  options: RunOptions,
): Promise<ProcessRun> {
  const child = spawn(command, args, {
    cwd: options.cwd,
    env: options.env,
    windowsHide: true,
    windowsVerbatimArguments: options.verbatim === true,
    ...(options.argv0 === undefined ? {} : { argv0: options.argv0 }),
  });
  let stdout = '';
  let stderr = '';
  child.stdout.setEncoding('utf8').on('data', (chunk: string) => (stdout += chunk));
  child.stderr.setEncoding('utf8').on('data', (chunk: string) => (stderr += chunk));
  child.stdin.end(options.input ?? '');
  return new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('close', (status) => {
      resolve({ status, stdout, stderr });
    });
  });
}

/** A script on the app binary as Node, as Claude Code runs the bash guard hook. */
export function runAsNode(
  exe: string,
  script: string,
  args: readonly string[],
  options: Omit<RunOptions, 'verbatim'>,
): Promise<ProcessRun> {
  return runProcess(exe, [script, ...args], {
    ...options,
    env: { ...options.env, ELECTRON_RUN_AS_NODE: '1' },
  });
}

/** `reelforge.cmd <args>` through cmd.exe (paths with spaces and non-ASCII letters). */
export function runCmdShim(
  cmdFile: string,
  args: readonly string[],
  options: Omit<RunOptions, 'verbatim'>,
): Promise<ProcessRun> {
  // `/s /c ""<file>" args"`: cmd strips the outer quotes and keeps the quoted path.
  const line = `""${cmdFile}" ${args.join(' ')}"`;
  return runProcess('cmd.exe', ['/d', '/s', '/c', line], { ...options, verbatim: true });
}

/** Git Bash (what Claude Code's Bash tool runs on Windows), if installed in the usual place. */
export function gitBash(): string | undefined {
  const programFiles = process.env['ProgramFiles'] ?? 'C:\\Program Files';
  const candidate = path.join(programFiles, 'Git', 'bin', 'bash.exe');
  return existsSync(candidate) ? candidate : undefined;
}

/** PATH with `dir` first, whatever the case of the variable on Windows. */
export function withPathFirst(env: Record<string, string>, dir: string): Record<string, string> {
  const key = Object.keys(env).find((name) => name.toUpperCase() === 'PATH') ?? 'PATH';
  const current = env[key];
  return {
    ...env,
    [key]: current === undefined || current === '' ? dir : `${dir}${path.delimiter}${current}`,
  };
}
