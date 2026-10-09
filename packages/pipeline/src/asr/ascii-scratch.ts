/**
 * whisper.cpp tools on Windows read argv through the ANSI code page and open files with narrow
 * APIs, so any path with characters outside it (`Déjà Vu`, `日本`, a non-ASCII user name) cannot
 * be opened (`failed to read audio data`, model load failures). Spawning itself is fine: the
 * executable may live in a non-ASCII folder. When a path handed to a whisper tool is not plain
 * ASCII, the work runs in an ASCII-only scratch folder (models hard-linked or copied in) and the
 * results are copied back; the scratch folder is always removed. ASCII paths keep running in
 * place, untouched.
 */
import { copyFile, link, mkdir, mkdtemp, readdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { systemErrorCode, type WhisperError } from './errors.js';
import { renameRetrying } from '../fs-retry.js';
import { err, ok, type Result } from '../result.js';

export interface AsciiScratchOptions {
  /** Default `process.platform`; staging only happens on Windows. */
  readonly platform?: NodeJS.Platform | undefined;
  /** Candidate parent folders, first ASCII + writable one wins (default `defaultScratchRoots`). */
  readonly roots?: readonly string[] | undefined;
  /** Reports a scratch folder that could not be removed (it is left behind, nothing fails). */
  readonly onCleanupError?: ((dir: string, error: unknown) => void) | undefined;
}

const PRINTABLE_ASCII = /^[\x20-\x7e]*$/;

/** True when every character is printable ASCII (safe for any Windows ANSI code page). */
export function isAsciiPath(file: string): boolean {
  return PRINTABLE_ASCII.test(file);
}

/** True when a whisper tool would be handed one of `paths` it cannot open. */
export function needsAsciiScratch(
  paths: readonly string[],
  platform: NodeJS.Platform = process.platform,
): boolean {
  return platform === 'win32' && paths.some((file) => !isAsciiPath(file));
}

/** `os.tmpdir()`, then `%ProgramData%\ReelForge\scratch`, then `<system drive>\rf-scratch`. */
export function defaultScratchRoots(
  env: Readonly<Record<string, string | undefined>> = process.env,
): string[] {
  const drive = env['SystemDrive'] ?? 'C:';
  const programData = env['ProgramData'] ?? path.win32.join(drive, '\\', 'ProgramData');
  return [
    os.tmpdir(),
    path.win32.join(programData, 'ReelForge', 'scratch'),
    path.win32.join(drive, '\\', 'rf-scratch'),
  ];
}

const describe = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

/** Creates a fresh `rf-asr-*` folder under the first ASCII root that accepts one. */
export async function createAsciiScratch(
  roots: readonly string[],
): Promise<Result<string, WhisperError>> {
  const problems: string[] = [];
  for (const root of roots) {
    if (!isAsciiPath(root)) {
      problems.push(`${root}: not ASCII`);
      continue;
    }
    try {
      await mkdir(root, { recursive: true });
      return ok(await mkdtemp(path.join(root, 'rf-asr-')));
    } catch (error) {
      problems.push(`${root}: ${describe(error)}`);
    }
  }
  return err({
    kind: 'io',
    message: `whisper.cpp cannot open paths with non-ASCII characters and no ASCII-only scratch folder is usable (${problems.join('; ')})`,
    path: roots[0] ?? '',
  });
}

/**
 * The path a whisper tool can open for `file`: itself when ASCII, else a hard link (instant, same
 * volume) or a copy named `name` (+ the original extension when ASCII) inside `dir`.
 */
export async function stageAscii(file: string, dir: string, name: string): Promise<string> {
  if (isAsciiPath(file)) return file;
  const staged = path.join(dir, `${name}${asciiExt(file)}`);
  try {
    await link(file, staged);
  } catch (error) {
    // Other volume / file system without hard links: fall back to a full copy.
    if (systemErrorCode(error) === 'ENOENT') throw error;
    await copyFile(file, staged);
  }
  return staged;
}

function asciiExt(file: string): string {
  const ext = path.extname(file);
  return isAsciiPath(ext) ? ext : '';
}

/**
 * Mirrors the tree `from` into `to` (existing sub-folders of `to` that `from` has are replaced);
 * every file lands via tmp + rename, so readers never see a half-written file.
 */
export async function copyTreeBack(from: string, to: string): Promise<void> {
  await mkdir(to, { recursive: true });
  for (const entry of await readdir(from, { withFileTypes: true })) {
    const source = path.join(from, entry.name);
    const target = path.join(to, entry.name);
    if (entry.isDirectory()) {
      await rm(target, { recursive: true, force: true });
      await copyTreeBack(source, target);
    } else if (entry.isFile()) {
      const partial = `${target}.${String(process.pid)}.partial`;
      await copyFile(source, partial);
      // Antivirus software may still be scanning the fresh copy: retry sharing violations.
      await renameRetrying(partial, target);
    }
  }
}

/**
 * Runs `body` with a fresh ASCII scratch folder and removes it afterwards (also on failure,
 * cancellation or a throw).
 */
export async function withAsciiScratch<T>(
  options: AsciiScratchOptions,
  body: (dir: string) => Promise<Result<T, WhisperError>>,
): Promise<Result<T, WhisperError>> {
  const created = await createAsciiScratch(options.roots ?? defaultScratchRoots());
  if (!created.ok) return created;
  const dir = created.value;
  try {
    return await body(dir);
  } finally {
    // A killed tool may hold a handle for a moment on Windows: retry before giving up.
    await rm(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }).catch(
      (error: unknown) => options.onCleanupError?.(dir, error),
    );
  }
}

export interface WhisperModelPaths {
  readonly modelPath: string;
  readonly vadModelPath: string;
  readonly asciiScratch?: AsciiScratchOptions | undefined;
}

/**
 * Runs `body(ctx, options)` in place when the work dir and models are ASCII (or not on Windows);
 * otherwise in an ASCII scratch folder with staged models, copying the work dir back on success.
 * Files written by Node itself (`outPath`) stay where they are: Node handles Unicode paths.
 */
export async function runAsciiSafe<C extends WhisperModelPaths, O extends { workDir: string }, T>(
  ctx: C,
  options: O,
  body: (ctx: C, options: O) => Promise<Result<T, WhisperError>>,
): Promise<Result<T, WhisperError>> {
  const scratch = ctx.asciiScratch ?? {};
  const paths = [options.workDir, ctx.modelPath, ctx.vadModelPath];
  if (!needsAsciiScratch(paths, scratch.platform)) return body(ctx, options);
  return withAsciiScratch(scratch, async (dir) => {
    const staged: C = {
      ...ctx,
      modelPath: await stageAscii(ctx.modelPath, dir, 'model'),
      vadModelPath: await stageAscii(ctx.vadModelPath, dir, 'vad-model'),
    };
    const workDir = path.join(dir, 'work');
    const result = await body(staged, { ...options, workDir });
    if (!result.ok) return result;
    try {
      await copyTreeBack(workDir, options.workDir);
    } catch (error) {
      return err({
        kind: 'io',
        message: `cannot copy whisper results back: ${describe(error)}`,
        path: options.workDir,
        code: systemErrorCode(error),
      });
    }
    return result;
  });
}

const OPEN_FAILURE = /failed to (read|open|load)|could not open|no such file/i;

/**
 * `message` plus the likely cause when a whisper tool failed to open a file and one of its
 * arguments contains non-ASCII characters (only reachable when staging was skipped).
 */
export function explainNonAsciiFailure(message: string, args: readonly string[]): string {
  const culprit = args.find((arg) => !isAsciiPath(arg));
  if (culprit === undefined || !OPEN_FAILURE.test(message)) return message;
  return `${message} (whisper.cpp cannot open paths with non-ASCII characters on Windows: ${culprit})`;
}
