/**
 * One production line per app (PLAN.md#13.9): `<queuesDir>/runner.lock` holds the owner's pid and
 * a random token, created exclusively (`wx`). A lock whose process is gone (crash) is taken over;
 * a live one — another app instance, or a second runner in this process — is refused.
 */
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { err, errorCode, ok, type Result } from '@reelforge/claude-bridge';
import { LINE_LOCK_FILE } from '@reelforge/shared';
import { z } from 'zod';

const lockFileSchema = z.object({ pid: z.int(), token: z.string(), since: z.string() });

export interface LineLockOptions {
  readonly pid?: number;
  /** Is a process alive (tests); default `process.kill(pid, 0)`. */
  readonly isAlive?: (pid: number) => boolean;
  readonly now?: () => Date;
}

export interface LineLock {
  readonly file: string;
  release(): Promise<void>;
}

export function processAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    // EPERM: the process exists but belongs to someone else.
    return errorCode(error) === 'EPERM';
  }
}

async function readOwner(file: string): Promise<z.infer<typeof lockFileSchema> | undefined> {
  try {
    const parsed = lockFileSchema.safeParse(JSON.parse(await readFile(file, 'utf8')));
    return parsed.success ? parsed.data : undefined;
  } catch (error) {
    if (errorCode(error) === 'ENOENT') return undefined;
    // Half-written by a crashed owner: treated as stale (an owner without a pid cannot be alive).
    if (error instanceof SyntaxError) return undefined;
    throw error;
  }
}

async function tryCreate(file: string, content: string): Promise<boolean> {
  try {
    await writeFile(file, content, { encoding: 'utf8', flag: 'wx' });
    return true;
  } catch (error) {
    if (errorCode(error) === 'EEXIST') return false;
    throw error;
  }
}

export async function acquireLineLock(
  queuesDir: string,
  options: LineLockOptions = {},
): Promise<Result<LineLock, string>> {
  const file = path.join(queuesDir, LINE_LOCK_FILE);
  const pid = options.pid ?? process.pid;
  const isAlive = options.isAlive ?? processAlive;
  const token = randomUUID();
  const content = JSON.stringify({
    pid,
    token,
    since: (options.now?.() ?? new Date()).toISOString(),
  });
  try {
    await mkdir(queuesDir, { recursive: true });
    for (let attempt = 0; attempt < 2; attempt += 1) {
      if (await tryCreate(file, content)) {
        return ok({
          file,
          release: async () => {
            const owner = await readOwner(file);
            if (owner?.token === token) await rm(file, { force: true });
          },
        });
      }
      const owner = await readOwner(file);
      if (owner !== undefined && isAlive(owner.pid)) {
        return err(`the production line already runs (process ${String(owner.pid)})`);
      }
      await rm(file, { force: true });
    }
    return err('the production line lock is contended; try again');
  } catch (error) {
    return err(`cannot lock the production line: ${String(error)}`);
  }
}
