/**
 * A child process fed through stdin with back-pressure (raw frames -> ffmpeg). No shell, hidden
 * window, AbortSignal kills the whole process tree (`taskkill /T` on Windows).
 */
import { spawn } from 'node:child_process';
import path from 'node:path';
import { describeError, stderrTail, type FfmpegError } from '../ffmpeg/errors.js';
import { killProcessTree } from '../ffmpeg/process.js';
import { err, ok, type Result } from '../result.js';

const MAX_STDERR_CHARS = 64 * 1024;

export interface StdinProcess {
  /** Resolves once the chunk is accepted (waits for `drain` when the pipe is full). */
  write(chunk: Uint8Array): Promise<Result<void, FfmpegError>>;
  /** Closes stdin and waits for a zero exit. */
  finish(): Promise<Result<void, FfmpegError>>;
  /** Kills the process tree and waits for it to exit. */
  kill(): Promise<void>;
}

interface Exit {
  readonly code: number | null;
  readonly signal: string | null;
  readonly spawnError: string | null;
}

export function spawnStdinProcess(
  command: string,
  args: readonly string[],
  signal?: AbortSignal,
): StdinProcess {
  const label = path.basename(command);
  const child = spawn(command, [...args], {
    shell: false,
    windowsHide: true,
    stdio: ['pipe', 'ignore', 'pipe'],
  });
  let stderr = '';
  let cancelled = false;
  child.stderr.setEncoding('utf8');
  child.stderr.on('data', (chunk: string) => {
    stderr = (stderr + chunk).slice(-MAX_STDERR_CHARS);
  });
  // EPIPE when the process dies mid-write: reported through the exit status instead.
  child.stdin.on('error', () => undefined);
  const exited = new Promise<Exit>((resolve) => {
    child.on('error', (error) => {
      resolve({ code: null, signal: null, spawnError: describeError(error) });
    });
    child.on('close', (code, exitSignal) => {
      resolve({ code, signal: exitSignal, spawnError: null });
    });
  });
  let exit: Exit | null = null;
  void exited.then((value) => {
    exit = value;
  });

  const onAbort = (): void => {
    cancelled = true;
    killProcessTree(child);
  };
  if (signal?.aborted === true) onAbort();
  else signal?.addEventListener('abort', onAbort, { once: true });

  const failure = (value: Exit): FfmpegError => {
    if (cancelled) return { kind: 'cancelled', message: `${label} cancelled` };
    if (value.spawnError !== null) {
      return {
        kind: 'spawn-failed',
        message: `failed to start ${label}: ${value.spawnError}`,
        command,
      };
    }
    const tail = stderrTail(stderr);
    return {
      kind: 'exit-code',
      message: `${label} exited with ${String(value.code ?? value.signal)}${tail === '' ? '' : `: ${tail.split('\n').at(-1) ?? ''}`}`,
      code: value.code,
      signal: value.signal,
      stderrTail: tail,
    };
  };

  const settle = async (): Promise<Result<void, FfmpegError>> => {
    const value = await exited;
    signal?.removeEventListener('abort', onAbort);
    if (!cancelled && value.spawnError === null && value.code === 0) return ok(undefined);
    return err(failure(value));
  };

  return {
    async write(chunk) {
      if (cancelled) return err({ kind: 'cancelled', message: `${label} cancelled` });
      if (exit !== null) return settle();
      const accepted = child.stdin.write(chunk);
      if (accepted) return ok(undefined);
      const drained = new Promise<'drain'>((resolve) =>
        child.stdin.once('drain', () => {
          resolve('drain');
        }),
      );
      const outcome = await Promise.race([drained, exited]);
      if (outcome === 'drain') return ok(undefined);
      return settle();
    },
    async finish() {
      if (!cancelled && exit === null) child.stdin.end();
      return settle();
    },
    async kill() {
      if (exit === null) {
        cancelled = true;
        killProcessTree(child);
      }
      await exited;
      signal?.removeEventListener('abort', onAbort);
    },
  };
}
