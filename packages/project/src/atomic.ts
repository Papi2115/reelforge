/** Atomic file writes (CLAUDE.md §3.5): tmp + rename, retried on transient Windows locks. */
import { randomUUID } from 'node:crypto';
import { mkdir, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { errorCode } from './result.js';

const RENAME_RETRIES = 10;
const TRANSIENT_CODES = new Set(['EPERM', 'EBUSY', 'EACCES']);

export async function writeAtomic(file: string, content: string | Uint8Array): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  // `.tmp` is git-ignored in projects (templates/project/.gitignore).
  const tmp = `${file}.${randomUUID()}.tmp`;
  await writeFile(tmp, content);
  for (let attempt = 1; ; attempt += 1) {
    try {
      await rename(tmp, file);
      return;
    } catch (error) {
      const code = errorCode(error);
      if (attempt >= RENAME_RETRIES || code === undefined || !TRANSIENT_CODES.has(code)) {
        await rm(tmp, { force: true });
        throw error;
      }
      await sleep(25 * attempt);
    }
  }
}

/** Pretty JSON + trailing newline. */
export function writeJsonAtomic(file: string, value: unknown): Promise<void> {
  return writeAtomic(file, `${JSON.stringify(value, null, 2)}\n`);
}
