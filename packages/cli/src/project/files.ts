/**
 * Reads and zod-validates the project's JSON files, turning parse and schema failures into
 * problems with a precise location (`storyboard.json shots[1].t1`) and a fix.
 */
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import {
  CuesFileSchema,
  WordsFileSchema,
  type CuesFile,
  type WordsFile,
} from '@reelforge/pipeline';
import {
  briefFileSchema,
  projectFileSchema,
  storyboardFileSchema,
  tensionFileSchema,
  type BriefFile,
  type ProjectFile,
  type StoryboardFile,
  type TensionFile,
} from '@reelforge/shared';
import type { z } from 'zod';
import { describeUnknown } from '../errors.js';
import { readCastRoles, type CastRoleFiles } from './cast-roles.js';
import { readKitExtensions, type KitExtensionFiles } from './kit-ext.js';
import { PROJECT_PATHS, projectPath } from './paths.js';

export type Severity = 'error' | 'warning';

export interface Problem {
  readonly severity: Severity;
  /** Project-relative file the problem is in. */
  readonly file: string;
  /** Location inside the file, e.g. `shots[1].t1`; empty for the whole file. */
  readonly at: string;
  readonly message: string;
  readonly fix: string;
}

export type FileCheck<T> =
  | { readonly status: 'missing'; readonly file: string }
  | { readonly status: 'invalid'; readonly file: string; readonly problems: readonly Problem[] }
  | { readonly status: 'ok'; readonly file: string; readonly data: T };

/** `['shots', 1, 't1']` -> `shots[1].t1`. */
export function formatIssuePath(segments: readonly PropertyKey[]): string {
  return segments
    .map((segment, index) => {
      if (typeof segment === 'number') return `[${String(segment)}]`;
      const name = String(segment);
      return index === 0 ? name : `.${name}`;
    })
    .join('');
}

type ZodIssue = z.ZodError['issues'][number];

function issueFix(issue: ZodIssue, file: string): string {
  const last = issue.path.at(-1);
  if (issue.path.length === 1 && last === 'version') {
    return `set "version" to the version this app writes (see the other files or the template); do not bump it by hand`;
  }
  if (issue.code === 'unrecognized_keys') return 'remove the key or fix its spelling';
  if (issue.code === 'invalid_type' && issue.message.endsWith('received undefined')) {
    return 'add the missing field';
  }
  return `correct this value in ${file}`;
}

export function zodProblems(file: string, error: z.ZodError): Problem[] {
  return error.issues.map((issue) => ({
    severity: 'error',
    file,
    at: formatIssuePath(issue.path),
    message: issue.message,
    fix: issueFix(issue, file),
  }));
}

export async function checkJsonFile<Schema extends z.ZodType>(
  root: string,
  file: string,
  schema: Schema,
): Promise<FileCheck<z.output<Schema>>> {
  const absolute = projectPath(root, file);
  if (!existsSync(absolute)) return { status: 'missing', file };
  let input: unknown;
  try {
    input = JSON.parse(await readFile(absolute, 'utf8'));
  } catch (error) {
    const problem: Problem = {
      severity: 'error',
      file,
      at: '',
      message: `not valid JSON: ${describeUnknown(error)}`,
      fix: 'fix the JSON syntax at the reported position (no comments, no trailing commas)',
    };
    return { status: 'invalid', file, problems: [problem] };
  }
  const parsed = schema.safeParse(input);
  if (!parsed.success)
    return { status: 'invalid', file, problems: zodProblems(file, parsed.error) };
  return { status: 'ok', file, data: parsed.data };
}

/** Every versioned JSON file of a project, each read and validated once. */
export interface ProjectFiles {
  readonly root: string;
  readonly project: FileCheck<ProjectFile>;
  readonly brief: FileCheck<BriefFile>;
  readonly storyboard: FileCheck<StoryboardFile>;
  readonly words: FileCheck<WordsFile>;
  readonly cues: FileCheck<CuesFile>;
  /** `tension.json` (PLAN.md#12.22); absent in hand-made file sets = not read. */
  readonly tension?: FileCheck<TensionFile> | undefined;
  /** Project props (`kit-ext/props/*.js`). */
  readonly kitExtensions: KitExtensionFiles;
  /** Project roles (`characters/`, ADR-026); absent in hand-made file sets = none. */
  readonly castRoles?: CastRoleFiles | undefined;
}

export async function readProjectFiles(root: string): Promise<ProjectFiles> {
  const [project, brief, storyboard, words, cues, tension, kitExtensions, castRoles] =
    await Promise.all([
      checkJsonFile(root, PROJECT_PATHS.project, projectFileSchema),
      checkJsonFile(root, PROJECT_PATHS.brief, briefFileSchema),
      checkJsonFile(root, PROJECT_PATHS.storyboard, storyboardFileSchema),
      checkJsonFile(root, PROJECT_PATHS.words, WordsFileSchema),
      checkJsonFile(root, PROJECT_PATHS.cues, CuesFileSchema),
      checkJsonFile(root, PROJECT_PATHS.tension, tensionFileSchema),
      readKitExtensions(root),
      readCastRoles(root),
    ]);
  return { root, project, brief, storyboard, words, cues, tension, kitExtensions, castRoles };
}

/** Problems of the files that exist but do not validate. */
export function fileProblems(files: ProjectFiles): Problem[] {
  const checks: FileCheck<unknown>[] = [
    files.project,
    files.brief,
    files.storyboard,
    files.words,
    files.cues,
  ];
  if (files.tension !== undefined) checks.push(files.tension);
  return checks.flatMap((check) => (check.status === 'invalid' ? check.problems : []));
}
