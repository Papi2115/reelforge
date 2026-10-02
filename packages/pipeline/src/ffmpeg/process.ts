/**
 * Spawning ffmpeg-like binaries: no shell (argv array, safe for spaces / non-ASCII paths),
 * hidden console window, cancellation via AbortSignal that kills the whole process tree.
 */
import { spawn, type ChildProcess } from 'node:child_process';
import path from 'node:path';
import { describeError, stderrTail, type FfmpegError } from './errors.js';
import { err, ok, type Result } from '../result.js';

/** Upper bound for retained stdout/stderr text; older output is dropped from the front. */
const MAX_CAPTURE_CHARS = 4 * 1024 * 1024;

export interface ProcessRunOptions {
  readonly cwd?: string | undefined;
  readonly signal?: AbortSignal | undefined;
  readonly timeoutMs?: number | undefined;
  readonly onStdout?: ((chunk: string) => void) | undefined;
  readonly env?: NodeJS.ProcessEnv | undefined;
}

export interface ProcessOutput {
  readonly stdout: string;
  readonly stderr: string;
  readonly durationMs: number;
}

/** Kills `pid` and all of its descendants (`taskkill /T /F` on Windows). */
export function killProcessTree(child: ChildProcess): void {
  const pid = child.pid;
  if (pid === undefined) return;
  if (process.platform !== 'win32') {
    child.kill('SIGKILL');
    return;
  }
  const killer = spawn('taskkill', ['/PID', String(pid), '/T', '/F'], {
    windowsHide: true,
    stdio: 'ignore',
  });
  killer.on('error', () => {
    // taskkill unavailable: fall back to killing the direct child only.
    child.kill('SIGKILL');
  });
}

function appendCapped(current: string, chunk: string): string {
  const next = current + chunk;
  return next.length > MAX_CAPTURE_CHARS ? next.slice(next.length - MAX_CAPTURE_CHARS) : next;
}

/**
 * Runs `command args` to completion. Resolves with a typed error for spawn failures, non-zero
 * exits, cancellation and timeouts; never rejects.
 */
export function runProcess(
  command: string,
  args: readonly string[],
  options: ProcessRunOptions = {},
): Promise<Result<ProcessOutput, FfmpegError>> {
  const label = path.basename(command);
  if (options.signal?.aborted === true) {
    return Promise.resolve(err({ kind: 'cancelled', message: `${label} cancelled before start` }));
  }
  const started = process.hrtime.bigint();
  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let stopReason: 'cancelled' | 'timeout' | null = null;
    let settled = false;
    const child = spawn(command, [...args], {
      cwd: options.cwd,
      env: options.env ?? process.env,
      shell: false,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const stop = (reason: 'cancelled' | 'timeout'): void => {
      if (stopReason !== null || settled) return;
      stopReason = reason;
      killProcessTree(child);
    };
    const onAbort = (): void => {
      stop('cancelled');
    };
    options.signal?.addEventListener('abort', onAbort, { once: true });
    const timer =
      options.timeoutMs === undefined
        ? undefined
        : setTimeout(() => {
            stop('timeout');
          }, options.timeoutMs);

    const finish = (result: Result<ProcessOutput, FfmpegError>): void => {
      if (settled) return;
      settled = true;
      if (timer !== undefined) clearTimeout(timer);
      options.signal?.removeEventListener('abort', onAbort);
      resolve(result);
    };

    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => {
      stdout = appendCapped(stdout, chunk);
      options.onStdout?.(chunk);
    });
    child.stderr.on('data', (chunk: string) => {
      stderr = appendCapped(stderr, chunk);
    });
    child.on('error', (error) => {
      finish(
        err({
          kind: 'spawn-failed',
          message: `failed to start ${label}: ${describeError(error)}`,
          command,
        }),
      );
    });
    child.on('close', (code, signal) => {
      const durationMs = Number(process.hrtime.bigint() - started) / 1e6;
      if (stopReason === 'cancelled') {
        finish(err({ kind: 'cancelled', message: `${label} cancelled` }));
      } else if (stopReason === 'timeout') {
        finish(
          err({
            kind: 'timeout',
            message: `${label} timed out after ${String(options.timeoutMs)} ms`,
            timeoutMs: options.timeoutMs ?? 0,
          }),
        );
      } else if (code === 0) {
        finish(ok({ stdout, stderr, durationMs }));
      } else {
        const tail = stderrTail(stderr);
        finish(
          err({
            kind: 'exit-code',
            message: `${label} exited with ${String(code ?? signal)}${tail === '' ? '' : `: ${tail.split('\n').at(-1) ?? ''}`}`,
            code,
            signal,
            stderrTail: tail,
          }),
        );
      }
    });
  });
}
