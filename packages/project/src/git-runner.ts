/**
 * Runs the `git` binary (spawn, no shell: arguments are never parsed by a shell, so spaces and
 * Polish letters in paths are safe on Windows). Every command runs with `-C <project>` and an env
 * without variables that would point git at another repository.
 */
import { spawn } from 'node:child_process';
import { err, errorCode, ok, projectError, type ProjectError, type Result } from './result.js';

export interface GitOptions {
  /** `git` by default (resolved from PATH; `.exe` is found by the OS on Windows). */
  readonly gitBinary?: string;
  /** Base environment (default `process.env`); repo-location variables are always removed. */
  readonly env?: NodeJS.ProcessEnv;
  readonly timeoutMs?: number;
  /** A `.git/index.lock` older than this is considered left behind by a crashed git. */
  readonly staleLockMs?: number;
  /** How long to wait for a fresh `index.lock` to go away before failing with `locked`. */
  readonly lockWaitMs?: number;
}

export interface GitOutput {
  readonly code: number;
  readonly stdout: string;
  readonly stderr: string;
}

const DEFAULT_TIMEOUT_MS = 60_000;

/** Variables that redirect git to another repository / index (set e.g. inside git hooks). */
const REPO_LOCATION_VARIABLES = [
  'GIT_DIR',
  'GIT_WORK_TREE',
  'GIT_INDEX_FILE',
  'GIT_OBJECT_DIRECTORY',
  'GIT_ALTERNATE_OBJECT_DIRECTORIES',
  'GIT_COMMON_DIR',
  'GIT_NAMESPACE',
  'GIT_PREFIX',
  'GIT_CEILING_DIRECTORIES',
  'GIT_DISCOVERY_ACROSS_FILESYSTEM',
];

/**
 * Per-command settings: byte-exact content (no CRLF conversion, so a revert restores the exact
 * bytes), UTF-8 paths, no signing prompts, long Windows paths. Nothing is written to any config.
 */
const COMMAND_CONFIG = [
  'core.autocrlf=false',
  'core.safecrlf=false',
  'core.quotepath=false',
  'core.longpaths=true',
  'commit.gpgsign=false',
];

export function gitEnv(base: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...base };
  for (const name of Object.keys(env)) {
    if (REPO_LOCATION_VARIABLES.includes(name.toUpperCase())) Reflect.deleteProperty(env, name);
  }
  env['GIT_TERMINAL_PROMPT'] = '0';
  // Read-only commands (status, log) must not take index.lock behind our back.
  env['GIT_OPTIONAL_LOCKS'] = '0';
  return env;
}

export function gitArgs(dir: string, args: readonly string[]): string[] {
  return ['-C', dir, ...COMMAND_CONFIG.flatMap((setting) => ['-c', setting]), ...args];
}

/** Runs git; a non-zero exit is still `ok` (callers decide), spawn failures are errors. */
export function runGit(
  dir: string,
  args: readonly string[],
  options: GitOptions = {},
  input?: string,
): Promise<Result<GitOutput>> {
  const binary = options.gitBinary ?? 'git';
  return new Promise((resolve) => {
    const child = spawn(binary, gitArgs(dir, args), {
      env: gitEnv(options.env ?? process.env),
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
      shell: false,
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill();
    }, options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
    child.stdout.on('data', (chunk: Buffer) => stdout.push(chunk));
    child.stderr.on('data', (chunk: Buffer) => stderr.push(chunk));
    child.stdin.on('error', () => {
      // EPIPE when git exits without reading stdin; the exit code reports the real failure.
    });
    child.on('error', (error) => {
      clearTimeout(timer);
      const missing = errorCode(error) === 'ENOENT';
      resolve(
        err(
          projectError(
            missing ? 'git-missing' : 'git-failed',
            missing
              ? `git was not found (${binary}). Install Git (https://git-scm.com) and restart ReelForge.`
              : `could not start git: ${error.message}`,
          ),
        ),
      );
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      const output: GitOutput = {
        code: code ?? -1,
        stdout: Buffer.concat(stdout).toString('utf8'),
        stderr: Buffer.concat(stderr).toString('utf8'),
      };
      if (timedOut) {
        resolve(err(failure(args, output, `git ${args[0] ?? ''} timed out`)));
        return;
      }
      resolve(ok(output));
    });
    child.stdin.end(input ?? '');
  });
}

function failure(args: readonly string[], output: GitOutput, message?: string): ProjectError {
  const stderr = output.stderr.trim();
  const locked = /index\.lock/.test(stderr);
  return projectError(
    locked ? 'locked' : 'git-failed',
    message ??
      (locked
        ? 'another git process is using this project (.git/index.lock); try again in a moment'
        : `git ${args[0] ?? ''} failed (exit ${String(output.code)}): ${stderr.split('\n')[0] ?? ''}`),
    { details: stderr === '' ? [] : stderr.split('\n') },
  );
}

/** Runs git and turns a non-zero exit into a `git-failed` / `locked` error. */
export async function gitChecked(
  dir: string,
  args: readonly string[],
  options: GitOptions = {},
  input?: string,
): Promise<Result<string>> {
  const result = await runGit(dir, args, options, input);
  if (!result.ok) return result;
  if (result.value.code !== 0) return err(failure(args, result.value));
  return ok(result.value.stdout);
}
