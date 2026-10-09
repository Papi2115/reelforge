/**
 * Small edits of project.json from Home (PLAN.md#13.16, #13.18): the card menu's Rename (the
 * folder keeps its name, so nothing that points at it breaks) and a Short's captions switch. Key
 * order and unknown keys are kept, the result is validated with the shared schema, written
 * atomically and committed.
 */
import path from 'node:path';
import { writeJsonAtomic } from '@reelforge/project';
import { projectFileSchema } from '@reelforge/shared';
import { z } from 'zod';
import type { HomeActionResult } from '../../shared/home-contract.js';
import { describeError } from '../logger.js';
import { describeIssues, readProjectText } from '../project-files.js';

const PROJECT_FILE = 'project.json';
/** Commit subjects stay short (the history shows one line). */
const MAX_TITLE_IN_SUBJECT = 80;

const rawObjectSchema = z.record(z.string(), z.unknown());
type RawProject = z.infer<typeof rawObjectSchema>;

/** Commits `paths` of `dir`; false when the commit failed. */
export type RenameCommit = (
  dir: string,
  message: string,
  paths: readonly string[],
) => Promise<boolean>;

function failure(message: string): HomeActionResult {
  return { status: 'error', message };
}

export function renameSubject(title: string): string {
  const short =
    title.length > MAX_TITLE_IN_SUBJECT ? `${title.slice(0, MAX_TITLE_IN_SUBJECT - 1)}…` : title;
  return `Project renamed: ${short}`;
}

export interface ProjectJsonEdit {
  /** The next project.json, or a refusal in plain words. */
  readonly change: (raw: RawProject) => RawProject | string;
  /** Prefix of a schema problem ("The title cannot be saved"). */
  readonly invalid: string;
  readonly subject: string;
}

/** Applies `edit` to project.json (no write when nothing changes) and commits it. */
export async function editProjectJson(
  dir: string,
  edit: ProjectJsonEdit,
  commit: RenameCommit,
): Promise<HomeActionResult> {
  const text = await readProjectText(dir, PROJECT_FILE);
  if (text.status === 'missing') return failure('The project folder is gone.');
  if (text.status === 'error') return failure(text.error.message);
  let json: unknown;
  try {
    json = JSON.parse(text.data);
  } catch (error) {
    return failure(`The project file is damaged: ${describeError(error)}`);
  }
  const raw = rawObjectSchema.safeParse(json);
  if (!raw.success) return failure('The project file is damaged.');
  const next = edit.change(raw.data);
  if (typeof next === 'string') return failure(next);
  const valid = projectFileSchema.safeParse(next);
  if (!valid.success) return failure(`${edit.invalid}: ${describeIssues(valid.error)}`);
  if (JSON.stringify(next) === JSON.stringify(raw.data)) return { status: 'ok' };
  try {
    await writeJsonAtomic(path.join(dir, PROJECT_FILE), next);
  } catch (error) {
    return failure(`The project file could not be saved: ${describeError(error)}`);
  }
  // The change is saved even when the commit fails (the next commit takes it along).
  await commit(dir, edit.subject, [PROJECT_FILE]);
  return { status: 'ok' };
}

export function renameProject(
  dir: string,
  title: string,
  commit: RenameCommit,
): Promise<HomeActionResult> {
  return editProjectJson(
    dir,
    {
      change: (raw) => ({ ...raw, title }),
      invalid: 'The title cannot be saved',
      subject: renameSubject(title),
    },
    commit,
  );
}

/** A Short's word-by-word captions on / off (`short.captions`); refused for a film. */
export function setShortCaptions(
  dir: string,
  captions: boolean,
  commit: RenameCommit,
): Promise<HomeActionResult> {
  return editProjectJson(
    dir,
    {
      change: (raw) => {
        const short = rawObjectSchema.safeParse(raw['short']);
        if (raw['kind'] !== 'short' || !short.success) return 'This project is not a Short.';
        return { ...raw, short: { ...short.data, captions } };
      },
      invalid: 'The captions setting cannot be saved',
      subject: `Short captions ${captions ? 'on' : 'off'}`,
    },
    commit,
  );
}
