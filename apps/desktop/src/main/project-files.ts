/**
 * Read-only access to the open project's files for the layout (PLAN.md#6.3). Every path is
 * resolved inside the project folder, lexically and again after following links, so a storyboard
 * entry like `../../secret.js` or a junction pointing out of the project is refused. Failures are
 * values (`FileState`), never exceptions, except for the folder itself being unreadable.
 */
import type { Dirent } from 'node:fs';
import { readdir, readFile, realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import type { z } from 'zod';
import type { FileErrorInfo, FileState } from '../shared/snapshot-contract.js';

/** Larger JSON/scene files are refused (they would also be far too big to preview). */
export const MAX_PROJECT_FILE_BYTES = 32 * 1024 * 1024;
/** Folders listed by `listProjectFiles` ('' = project root); not recursive. */
export const LISTED_FOLDERS = ['', 'audio', 'timing', 'scenes', 'out'] as const;
export const MAX_LISTED_FILES = 2_000;
const MAX_REPORTED_ISSUES = 3;
const BYTE_ORDER_MARK = String.fromCharCode(0xfeff);

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function errorCode(error: unknown): unknown {
  return error instanceof Error && 'code' in error ? error.code : undefined;
}

function isMissing(error: unknown): boolean {
  const code = errorCode(error);
  return code === 'ENOENT' || code === 'ENOTDIR';
}

/** True when `candidate` is strictly inside `root` (case-insensitive on Windows via path). */
export function isInsideFolder(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return (
    relative !== '' &&
    relative !== '..' &&
    !relative.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relative)
  );
}

function failed(kind: FileErrorInfo['kind'], message: string): FileState<never> {
  return { status: 'error', error: { kind, message } };
}

/** `shots.1.t1: t1 must be > t0; …` (first few issues). */
export function describeIssues(error: z.ZodError): string {
  const lines = error.issues
    .slice(0, MAX_REPORTED_ISSUES)
    .map((issue) => `${issue.path.map(String).join('.') || '<root>'}: ${issue.message}`);
  const more = error.issues.length - MAX_REPORTED_ISSUES;
  return more > 0 ? `${lines.join('; ')} (+${String(more)} more)` : lines.join('; ');
}

/** Reads a UTF-8 text file (BOM stripped) given by a project-relative path. */
export async function readProjectText(root: string, relative: string): Promise<FileState<string>> {
  const absolute = path.resolve(root, relative);
  if (!isInsideFolder(path.resolve(root), absolute)) {
    return failed('outside-project', `${relative} is outside the project folder`);
  }
  try {
    const [realRoot, real] = await Promise.all([realpath(root), realpath(absolute)]);
    if (!isInsideFolder(realRoot, real)) {
      return failed('outside-project', `${relative} links outside the project folder`);
    }
    const info = await stat(real);
    if (!info.isFile()) return failed('unreadable', `${relative} is not a file`);
    if (info.size > MAX_PROJECT_FILE_BYTES) {
      return failed(
        'too-large',
        `${relative} is larger than ${String(MAX_PROJECT_FILE_BYTES)} bytes`,
      );
    }
    const text = await readFile(real, 'utf8');
    return { status: 'ok', data: text.startsWith(BYTE_ORDER_MARK) ? text.slice(1) : text };
  } catch (error) {
    if (isMissing(error)) return { status: 'missing' };
    return failed('unreadable', `cannot read ${relative}: ${errorText(error)}`);
  }
}

/** Reads and validates a project JSON file with `schema`. */
export async function readProjectJson<Schema extends z.ZodType>(
  root: string,
  relative: string,
  schema: Schema,
): Promise<FileState<z.output<Schema>>> {
  const text = await readProjectText(root, relative);
  if (text.status !== 'ok') return text;
  let input: unknown;
  try {
    input = JSON.parse(text.data);
  } catch (error) {
    return failed('invalid-json', `${relative} is not valid JSON: ${errorText(error)}`);
  }
  const parsed = schema.safeParse(input);
  if (!parsed.success) return failed('invalid', `${relative}: ${describeIssues(parsed.error)}`);
  return { status: 'ok', data: parsed.data };
}

async function folderEntries(realRoot: string, folder: string): Promise<Dirent[]> {
  try {
    const real = await realpath(folder);
    if (real !== realRoot && !isInsideFolder(realRoot, real)) return [];
    return await readdir(real, { withFileTypes: true });
  } catch (error) {
    if (isMissing(error)) return [];
    throw error;
  }
}

export interface ProjectListing {
  /** Project-relative paths with forward slashes, sorted. */
  readonly files: string[];
  readonly truncated: boolean;
}

/**
 * Regular files (no links) of the project root and its pipeline folders. Throws only when the
 * project folder itself cannot be read.
 */
export async function listProjectFiles(root: string): Promise<ProjectListing> {
  const realRoot = await realpath(root);
  const perFolder = await Promise.all(
    LISTED_FOLDERS.map(async (folder) => {
      const entries = await folderEntries(realRoot, path.join(realRoot, folder));
      return entries
        .filter((entry) => entry.isFile())
        .map((entry) => (folder === '' ? entry.name : `${folder}/${entry.name}`));
    }),
  );
  const files = perFolder.flat().sort();
  return {
    files: files.slice(0, MAX_LISTED_FILES),
    truncated: files.length > MAX_LISTED_FILES,
  };
}
