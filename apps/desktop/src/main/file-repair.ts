/**
 * Damaged project files (PLAN.md#10.2): which files the app checks, how a damage is described
 * (file + parser/schema error) and the fix it offers. Tracked documents are restored from their
 * last good commit as a new commit (the damaged content is auto-saved first); app state under
 * `.reelforge/` is not in git, so it is moved aside as `<name>.corrupt-<time>.json` and the app
 * starts it afresh (a missing state file means "nothing recorded yet"). Never deletes anything.
 */
import { rename } from 'node:fs/promises';
import path from 'node:path';
import { CuesFileSchema } from '@reelforge/pipeline';
import {
  migrateProjectJson,
  parseProjectFile,
  restoreFileFromHistory,
  type GitOptions,
} from '@reelforge/project';
import {
  pipelineStateSchema,
  sessionsFileSchema,
  storyboardFileSchema,
  wordsFileSchema,
} from '@reelforge/shared';
import type { z } from 'zod';
import type { ProjectErrorInfo } from '../shared/project-contract.js';
import {
  type FileFix,
  type FileProblem,
  type RepairableFile,
  type RepairFileResult,
} from '../shared/snapshot-contract.js';
import { describeIssues, readProjectText } from './project-files.js';
import { settingsBackupFile } from './settings-service.js';

/** Undefined when `raw` (parsed JSON) is a valid file, else what is wrong. */
type Validator = (raw: unknown) => string | undefined;

function schemaValidator(schema: z.ZodType): Validator {
  return (raw) => {
    const parsed = schema.safeParse(raw);
    return parsed.success ? undefined : describeIssues(parsed.error);
  };
}

function validateProjectJson(raw: unknown): string | undefined {
  const migrated = migrateProjectJson(raw);
  if (!migrated.ok) return migrated.error.message;
  const parsed = parseProjectFile(migrated.value.value);
  return parsed.ok ? undefined : parsed.error.message;
}

interface RepairSpec {
  readonly fix: FileFix;
  readonly validate: Validator;
}

export const REPAIR_SPECS: Readonly<Record<RepairableFile, RepairSpec>> = {
  'project.json': { fix: 'restore', validate: validateProjectJson },
  'storyboard.json': { fix: 'restore', validate: schemaValidator(storyboardFileSchema) },
  'timing/words.json': { fix: 'restore', validate: schemaValidator(wordsFileSchema) },
  'cues.json': { fix: 'restore', validate: schemaValidator(CuesFileSchema) },
  '.reelforge/pipeline.json': { fix: 'reset', validate: schemaValidator(pipelineStateSchema) },
  '.reelforge/sessions.json': { fix: 'reset', validate: schemaValidator(sessionsFileSchema) },
};

const BYTE_ORDER_MARK = String.fromCharCode(0xfeff);

/** What is wrong with `text` as `file` (undefined: it is fine). Empty files are damage too. */
export function checkFileText(file: RepairableFile, text: string): string | undefined {
  let raw: unknown;
  try {
    raw = JSON.parse(text.startsWith(BYTE_ORDER_MARK) ? text.slice(1) : text);
  } catch (error) {
    const reason = text.trim() === '' ? 'the file is empty' : describe(error);
    return `${file} is not valid JSON (${reason})`;
  }
  const issue = REPAIR_SPECS[file].validate(raw);
  return issue === undefined ? undefined : `${file} does not match its format: ${issue}`;
}

/** The damage of one file; undefined when it is fine or missing. */
export async function fileProblem(
  dir: string,
  file: RepairableFile,
): Promise<FileProblem | undefined> {
  const text = await readProjectText(dir, file);
  if (text.status === 'missing') return undefined;
  const fix = REPAIR_SPECS[file].fix;
  if (text.status === 'error') return { file, message: text.error.message, fix };
  const message = checkFileText(file, text.data);
  return message === undefined ? undefined : { file, message, fix };
}

function failure(kind: string, message: string): RepairFileResult {
  const error: ProjectErrorInfo = { kind, message };
  return { status: 'error', error };
}

/**
 * Applies the fix of `file` if it is damaged right now: restore (a new commit) or reset (backup).
 * `now` names the backup.
 */
export async function repairFile(
  dir: string,
  file: RepairableFile,
  options: { readonly git?: GitOptions; readonly now?: () => Date } = {},
): Promise<RepairFileResult> {
  const problem = await fileProblem(dir, file);
  if (problem === undefined) return failure('invalid-argument', `${file} is not damaged.`);
  if (problem.fix === 'reset') return resetStateFile(dir, file, options.now?.() ?? new Date());
  const restored = await restoreFileFromHistory(dir, file, {
    isValid: (text) => checkFileText(file, text) === undefined,
    ...(options.git === undefined ? {} : { git: options.git }),
  });
  if (!restored.ok) return failure(restored.error.kind, restored.error.message);
  const short = restored.value.target.slice(0, 7);
  return {
    status: 'repaired',
    message: `Restored ${file} from commit ${short} (saved as a new commit; the damaged version is kept in the history).`,
  };
}

async function resetStateFile(
  dir: string,
  file: RepairableFile,
  now: Date,
): Promise<RepairFileResult> {
  const absolute = path.join(dir, ...file.split('/'));
  const backup = settingsBackupFile(absolute, 'corrupt', now);
  try {
    await rename(absolute, backup);
  } catch (error) {
    return failure('io', `could not move ${file} aside: ${describe(error)}`);
  }
  return {
    status: 'repaired',
    message: `Reset ${file} to defaults; the damaged file was kept as ${path.basename(backup)}.`,
  };
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
