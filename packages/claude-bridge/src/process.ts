/**
 * Spawning and killing `claude` processes, Windows-first (ADR-001): native exe with shell:false,
 * never a `.cmd`/`.bat` shim, sanitized env, whole-tree kill via `taskkill /T /F`.
 */
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { sanitizeEnv } from './env.js';
import { err, ok, type Result } from './result.js';

/** What to execute: the resolved `claude.exe`, or e.g. `node fake-claude.mjs` in tests. */
export interface ClaudeLauncher {
  readonly command: string;
  /** Placed before the CLI arguments (e.g. the fake script path). */
  readonly args: readonly string[];
}

export interface SpawnOptions {
  readonly cwd: string;
  /** Parent env; always sanitized before reaching the child. */
  readonly env: NodeJS.ProcessEnv;
}

/** `.cmd`/`.bat` need a shell on Windows (EINVAL otherwise, CVE-2024-27980) -> refused. */
export function validateLauncher(launcher: ClaudeLauncher): Result<ClaudeLauncher, string> {
  if (/\.(?:cmd|bat)$/i.test(launcher.command)) {
    return err(`refusing to spawn shell script ${launcher.command}; resolve the native claude.exe`);
  }
  if (launcher.command.trim() === '') return err('empty launcher command');
  return ok(launcher);
}

export function spawnClaude(
  launcher: ClaudeLauncher,
  args: readonly string[],
  options: SpawnOptions,
): Result<ChildProcessWithoutNullStreams, string> {
  const valid = validateLauncher(launcher);
  if (!valid.ok) return valid;
  try {
    const child = spawn(launcher.command, [...launcher.args, ...args], {
      cwd: options.cwd,
      env: sanitizeEnv(options.env),
      shell: false,
      windowsHide: true,
      // POSIX: own process group so the whole tree can be killed with kill(-pid).
      detached: process.platform !== 'win32',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return ok(child);
  } catch (error) {
    return err(`spawn failed: ${String(error)}`);
  }
}

/** Kills `pid` and all descendants. Windows: `taskkill /PID <pid> /T /F`; POSIX: group SIGKILL. */
export function killTree(pid: number): Promise<Result<void, string>> {
  if (process.platform !== 'win32') {
    try {
      process.kill(-pid, 'SIGKILL');
      return Promise.resolve(ok(undefined));
    } catch (error) {
      return Promise.resolve(err(`kill(-${String(pid)}) failed: ${String(error)}`));
    }
  }
  return new Promise((resolve) => {
    const killer = spawn('taskkill', ['/PID', String(pid), '/T', '/F'], {
      windowsHide: true,
      stdio: 'ignore',
      shell: false,
    });
    killer.once('error', (error) => {
      resolve(err(`taskkill failed: ${error.message}`));
    });
    killer.once('close', (code) => {
      // 128 = process not found (already gone): the goal is reached either way.
      resolve(code === 0 || code === 128 ? ok(undefined) : err(`taskkill exited ${String(code)}`));
    });
  });
}

export interface CaptureOutput {
  readonly code: number | null;
  readonly stdout: string;
  readonly stderr: string;
}

export type CaptureError =
  | { readonly kind: 'spawn'; readonly message: string }
  | { readonly kind: 'timeout'; readonly message: string };

/** Runs a short, non-model CLI command (`--version`, `auth status`) and captures its output. */
export function runCapture(
  launcher: ClaudeLauncher,
  args: readonly string[],
  options: SpawnOptions & { readonly timeoutMs: number },
): Promise<Result<CaptureOutput, CaptureError>> {
  const spawned = spawnClaude(launcher, args, options);
  if (!spawned.ok) return Promise.resolve(err({ kind: 'spawn', message: spawned.error }));
  const child = spawned.value;
  child.stdin.end();
  let stdout = '';
  let stderr = '';
  child.stdout.setEncoding('utf8').on('data', (chunk: string) => (stdout += chunk));
  child.stderr.setEncoding('utf8').on('data', (chunk: string) => (stderr += chunk));
  return new Promise((resolve) => {
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      if (child.pid !== undefined) void killTree(child.pid);
    }, options.timeoutMs);
    child.once('error', (error) => {
      clearTimeout(timer);
      resolve(err({ kind: 'spawn', message: error.message }));
    });
    child.once('close', (code) => {
      clearTimeout(timer);
      if (timedOut) {
        resolve(
          err({ kind: 'timeout', message: `no answer within ${String(options.timeoutMs)} ms` }),
        );
      } else {
        resolve(ok({ code, stdout, stderr }));
      }
    });
  });
}
