/**
 * Writes a generated file so that a concurrent reader never sees it half-written: the content goes
 * to a temp file in the same folder and is renamed over the target. Several processes may build
 * the same file at once (parallel `reelforge frames` runs rebuilding the harness), so:
 * - identical content already on disk -> no write at all;
 * - Windows refuses a rename over a file another process holds (EPERM/EBUSY/EACCES) -> retried
 *   with a growing, jittered pause (same budget as packages/project atomic.ts: 10 x 25 ms * n, so
 *   parallel writers do not retry in lockstep); still refused but the target now has our content
 *   (another writer won) -> fine.
 */
import { randomInt, randomUUID } from 'node:crypto';
import { readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

const TRANSIENT_CODES = new Set(['EPERM', 'EBUSY', 'EACCES']);

export type AtomicWriteOutcome = 'written' | 'unchanged';

export interface AtomicWriteOptions {
  /** Rename attempts before giving up (default 10). */
  readonly attempts?: number;
  /** Base delay between attempts, ms (default 25): attempt n waits n x delayMs plus a jitter. */
  readonly delayMs?: number;
  /** Test seam: the rename used to publish the temp file. */
  readonly rename?: (from: string, to: string) => Promise<void>;
}

function errorCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null || !('code' in error)) return undefined;
  return typeof error.code === 'string' ? error.code : undefined;
}

async function currentContent(file: string): Promise<Buffer | undefined> {
  try {
    return await readFile(file);
  } catch (error) {
    if (errorCode(error) === 'ENOENT') return undefined;
    throw error;
  }
}

async function sameContent(file: string, contents: Buffer): Promise<boolean> {
  const current = await currentContent(file);
  return current !== undefined && current.equals(contents);
}

const pause = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

async function publish(
  temporary: string,
  target: string,
  contents: Buffer,
  options: AtomicWriteOptions,
): Promise<AtomicWriteOutcome> {
  const attempts = Math.max(1, options.attempts ?? 10);
  const delayMs = Math.max(0, options.delayMs ?? 25);
  const move = options.rename ?? rename;
  for (let attempt = 1; ; attempt += 1) {
    try {
      await move(temporary, target);
      return 'written';
    } catch (error) {
      if (!TRANSIENT_CODES.has(errorCode(error) ?? '')) throw error;
      // Another writer may have published the same content meanwhile: nothing left to do.
      if (await sameContent(target, contents)) return 'unchanged';
      if (attempt >= attempts) throw error;
      await pause(delayMs * attempt + randomInt(0, delayMs + 1));
    }
  }
}

/** Atomically writes `contents` to `target` unless it already holds exactly that content. */
export async function writeFileAtomicIfChanged(
  target: string,
  contents: Buffer | string,
  options: AtomicWriteOptions = {},
): Promise<AtomicWriteOutcome> {
  const bytes = typeof contents === 'string' ? Buffer.from(contents, 'utf8') : contents;
  if (await sameContent(target, bytes)) return 'unchanged';
  const temporary = path.join(
    path.dirname(target),
    `.${path.basename(target)}.${String(process.pid)}-${randomUUID()}.tmp`,
  );
  try {
    await writeFile(temporary, bytes);
    return await publish(temporary, target, bytes, options);
  } finally {
    // After a successful rename the temp file is gone; `force` makes this a no-op then.
    await rm(temporary, { force: true });
  }
}
