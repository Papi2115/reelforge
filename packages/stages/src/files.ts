/** Small file helpers for stages: typed reads, atomic writes (CLAUDE.md §3.5), hashing. */
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { err, ok, type Result } from '@reelforge/claude-bridge';
import { writeJsonAtomic } from '@reelforge/pipeline';
import { writeAtomic } from '@reelforge/project';
import type { z } from 'zod';
import { inProject } from './paths.js';
import { stageError, type StageError } from './types.js';

const describe = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

/** Reads a project-relative text file; `undefined` when it does not exist. */
export async function readProjectText(
  projectDir: string,
  relative: string,
): Promise<Result<string | undefined, StageError>> {
  try {
    return ok(await readFile(inProject(projectDir, relative), 'utf8'));
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return ok(undefined);
    return err(stageError('io', `cannot read ${relative}: ${describe(error)}`));
  }
}

/** Reads a required project-relative text file. */
export async function requireProjectText(
  projectDir: string,
  relative: string,
): Promise<Result<string, StageError>> {
  const text = await readProjectText(projectDir, relative);
  if (!text.ok) return text;
  return text.value === undefined
    ? err(stageError('not-ready', `${relative} is missing`))
    : ok(text.value);
}

/** Reads and validates a required project-relative JSON file. */
export async function requireProjectJson<S extends z.ZodType>(
  projectDir: string,
  relative: string,
  schema: S,
): Promise<Result<z.output<S>, StageError>> {
  const text = await requireProjectText(projectDir, relative);
  if (!text.ok) return text;
  let raw: unknown;
  try {
    raw = JSON.parse(text.value);
  } catch (error) {
    return err(stageError('invalid-input', `${relative} is not valid JSON: ${describe(error)}`));
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues.map(
      (issue) => `${issue.path.map(String).join('.') || '<root>'}: ${issue.message}`,
    );
    return err(stageError('invalid-input', `${relative} is invalid`, issues));
  }
  return ok(parsed.data);
}

export async function writeProjectText(
  projectDir: string,
  relative: string,
  content: string,
): Promise<Result<void, StageError>> {
  try {
    await writeAtomic(inProject(projectDir, relative), content);
    return ok(undefined);
  } catch (error) {
    return err(stageError('io', `cannot write ${relative}: ${describe(error)}`));
  }
}

/** Validates and writes a JSON file atomically. */
export async function writeProjectJson<S extends z.ZodType>(
  projectDir: string,
  relative: string,
  schema: S,
  value: z.input<S>,
): Promise<Result<z.output<S>, StageError>> {
  const written = await writeJsonAtomic(inProject(projectDir, relative), schema, value);
  return written.ok ? written : err(stageError('io', written.error.message));
}

export function sha256File(file: string): Promise<Result<string, StageError>> {
  return new Promise((resolve) => {
    const hash = createHash('sha256');
    createReadStream(file)
      .on('data', (chunk) => hash.update(chunk))
      .on('error', (error) => {
        resolve(err(stageError('io', `cannot read ${file}: ${error.message}`)));
      })
      .on('end', () => {
        resolve(ok(hash.digest('hex')));
      });
  });
}
