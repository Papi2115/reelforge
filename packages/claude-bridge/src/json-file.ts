/**
 * Versioned JSON files under `<project>/.reelforge/` (CLAUDE.md §3.5): zod-validated reads,
 * atomic writes (tmp + rename, retried on transient Windows locks), and read-modify-write cycles
 * serialized per file within this process.
 */
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { err, ok, type Result } from './result.js';

export interface JsonFileError {
  readonly kind: 'io' | 'corrupt';
  readonly path: string;
  readonly message: string;
}

export function errorCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null || !('code' in error)) return undefined;
  return typeof error.code === 'string' ? error.code : undefined;
}

const RENAME_RETRIES = 5;

/** tmp + rename; retries rename briefly (Windows: EPERM/EBUSY while a scanner holds the file). */
export async function writeAtomic(file: string, content: string): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.${randomUUID()}.tmp`;
  await writeFile(tmp, content, 'utf8');
  for (let attempt = 1; ; attempt += 1) {
    try {
      await rename(tmp, file);
      return;
    } catch (error) {
      const code = errorCode(error);
      if (
        attempt >= RENAME_RETRIES ||
        (code !== 'EPERM' && code !== 'EBUSY' && code !== 'EACCES')
      ) {
        await rm(tmp, { force: true });
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, 20 * attempt));
    }
  }
}

/** Reads + validates `file`; a missing file yields `empty()`. */
export async function readJsonFile<T>(
  file: string,
  schema: z.ZodType<T>,
  empty: () => T,
): Promise<Result<T, JsonFileError>> {
  let text: string;
  try {
    text = await readFile(file, 'utf8');
  } catch (error) {
    if (errorCode(error) === 'ENOENT') return ok(empty());
    return err({ kind: 'io', path: file, message: String(error) });
  }
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch (error) {
    return err({ kind: 'corrupt', path: file, message: String(error) });
  }
  const parsed = schema.safeParse(json);
  return parsed.success
    ? ok(parsed.data)
    : err({ kind: 'corrupt', path: file, message: z.prettifyError(parsed.error) });
}

/** Validates and writes `value` atomically (pretty JSON + trailing newline). */
export async function writeJsonFile<T>(
  file: string,
  schema: z.ZodType<T>,
  value: T,
): Promise<Result<T, JsonFileError>> {
  const validated = schema.safeParse(value);
  if (!validated.success) {
    return err({ kind: 'corrupt', path: file, message: z.prettifyError(validated.error) });
  }
  try {
    await writeAtomic(file, `${JSON.stringify(validated.data, null, 2)}\n`);
  } catch (error) {
    return err({ kind: 'io', path: file, message: String(error) });
  }
  return ok(validated.data);
}

/** One schema, many files (one per project): serialized read-modify-write per file. */
export class JsonFileStore<T> {
  private readonly chains = new Map<string, Promise<unknown>>();

  constructor(
    private readonly schema: z.ZodType<T>,
    private readonly empty: () => T,
  ) {}

  read(file: string): Promise<Result<T, JsonFileError>> {
    return readJsonFile(file, this.schema, this.empty);
  }

  /** Applies `mutate` to the current content (or `empty()`) and writes the result atomically. */
  update(file: string, mutate: (current: T) => T): Promise<Result<T, JsonFileError>> {
    const previous = this.chains.get(file) ?? Promise.resolve();
    const next = previous.then(async () => {
      const current = await this.read(file);
      return current.ok ? writeJsonFile(file, this.schema, mutate(current.value)) : current;
    });
    this.chains.set(file, next);
    return next;
  }
}
