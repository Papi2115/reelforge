/** Versioned JSON files on disk: zod-validated reads and atomic (tmp + rename) writes (§3.5). */
import { randomBytes } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { z } from 'zod';
import { err, ok, type Result } from '../result.js';

export type JsonFileError =
  | { readonly kind: 'io'; readonly message: string; readonly path: string }
  | { readonly kind: 'invalid-json'; readonly message: string; readonly path: string }
  | {
      readonly kind: 'schema';
      readonly message: string;
      readonly path: string;
      readonly issues: readonly string[];
    };

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function issueLines(error: z.ZodError): string[] {
  return error.issues.map(
    (issue) => `${issue.path.map(String).join('.') || '<root>'}: ${issue.message}`,
  );
}

/** Validates `value`, then writes it as pretty UTF-8 JSON via a temp file + rename. */
export async function writeJsonAtomic<S extends z.ZodType>(
  filePath: string,
  schema: S,
  value: z.input<S>,
): Promise<Result<z.output<S>, JsonFileError>> {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    const issues = issueLines(parsed.error);
    return err({
      kind: 'schema',
      message: `refusing to write invalid ${path.basename(filePath)}: ${issues.slice(0, 3).join('; ')}`,
      path: filePath,
      issues,
    });
  }
  const tmp = `${filePath}.${randomBytes(4).toString('hex')}.tmp`;
  try {
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(tmp, `${JSON.stringify(parsed.data, null, 2)}\n`, 'utf8');
    await rename(tmp, filePath);
    return ok(parsed.data);
  } catch (error) {
    await rm(tmp, { force: true });
    return err({
      kind: 'io',
      message: `cannot write ${filePath}: ${describe(error)}`,
      path: filePath,
    });
  }
}

/** Reads and validates a JSON file. */
export async function readJsonFile<S extends z.ZodType>(
  filePath: string,
  schema: S,
): Promise<Result<z.output<S>, JsonFileError>> {
  let text: string;
  try {
    text = await readFile(filePath, 'utf8');
  } catch (error) {
    return err({
      kind: 'io',
      message: `cannot read ${filePath}: ${describe(error)}`,
      path: filePath,
    });
  }
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch (error) {
    return err({
      kind: 'invalid-json',
      message: `${filePath} is not valid JSON: ${describe(error)}`,
      path: filePath,
    });
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    const issues = issueLines(parsed.error);
    return err({
      kind: 'schema',
      message: `${path.basename(filePath)} does not match its schema: ${issues.slice(0, 3).join('; ')}`,
      path: filePath,
      issues,
    });
  }
  return ok(parsed.data);
}
