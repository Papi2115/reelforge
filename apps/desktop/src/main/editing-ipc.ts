/**
 * IPC handlers of the Editing section (PLAN.md#12.21, #12.23): the beat-sync report and the
 * repetition list of the open project; Apply / Ignore / Reopen of one repetition through the
 * stages package (`applyRepetition` writes cues.json or storyboard.json, never a locked shot's
 * part; main commits it with `ReelForge-Step: repetition` and queues variant builds). Actions run
 * one at a time.
 */
import { readFile } from 'node:fs/promises';
import {
  BEAT_SYNC_REPORT_FILE,
  beatSyncReportSchema,
  projectBeatSync,
  projectFileSchema,
  projectRepetitionControl,
  REPETITIONS_FILE,
  repetitionsFileSchema,
  type ProjectFile,
} from '@reelforge/shared';
import {
  applyRepetition,
  inProject,
  setRepetitionStatus,
  type StageRequest,
} from '@reelforge/stages';
import type { z } from 'zod';
import type {
  EditingState,
  RepetitionActionRequest,
  RepetitionActionResult,
} from '../shared/editing-contract.js';
import type { StageCommandResult } from '../shared/stages-contract.js';
import type { InvokeHandlers } from './ipc-router.js';
import { describeError, type Logger } from './logger.js';

/** Commit trailer `ReelForge-Step` of an applied repetition. */
export const REPETITION_STEP = 'repetition';

export type EditingHandlers = Pick<InvokeHandlers, 'editingState' | 'repetitionAction'>;

export interface EditingHandlerOptions {
  readonly currentProject: () => string | undefined;
  /** Commits the open project with the given step; true when a commit was made. */
  readonly commit: (dir: string, message: string, step: string) => Promise<boolean>;
  readonly enqueue: (requests: readonly StageRequest[]) => Promise<StageCommandResult>;
  readonly log: Logger;
}

async function readJson<S extends z.ZodType>(
  dir: string,
  relative: string,
  schema: S,
): Promise<z.output<S> | null> {
  try {
    const parsed = schema.safeParse(JSON.parse(await readFile(inProject(dir, relative), 'utf8')));
    return parsed.success ? parsed.data : null;
  } catch {
    return null; // not written yet, or unreadable JSON: the section shows "not yet"
  }
}

async function readProject(dir: string): Promise<ProjectFile | null> {
  return readJson(dir, 'project.json', projectFileSchema);
}

async function editingState(dir: string | undefined): Promise<EditingState> {
  if (dir === undefined) return { status: 'error', message: 'no project is open' };
  const project = await readProject(dir);
  if (project === null) return { status: 'error', message: 'project.json is invalid' };
  const [beatSync, repetitions] = await Promise.all([
    readJson(dir, BEAT_SYNC_REPORT_FILE, beatSyncReportSchema),
    readJson(dir, REPETITIONS_FILE, repetitionsFileSchema),
  ]);
  return {
    status: 'ok',
    switches: {
      beatSync: projectBeatSync(project),
      repetitionControl: projectRepetitionControl(project),
    },
    beatSync,
    repetitions,
  };
}

async function act(
  options: EditingHandlerOptions,
  request: RepetitionActionRequest,
): Promise<RepetitionActionResult> {
  const dir = options.currentProject();
  if (dir === undefined) return { status: 'error', message: 'no project is open' };
  if (request.action !== 'apply') {
    const status = request.action === 'ignore' ? 'ignored' : 'open';
    const marked = await setRepetitionStatus(dir, request.id, status);
    return marked.ok
      ? { status: 'ok', message: `Repetition ${status}`, committed: false, queued: false }
      : { status: 'error', message: marked.error.message };
  }
  const project = await readProject(dir);
  if (project === null) return { status: 'error', message: 'project.json is invalid' };
  const applied = await applyRepetition(dir, project, request.id);
  if (!applied.ok) return { status: 'error', message: applied.error.message };
  const { message, files, requests } = applied.value;
  const committed = files.length > 0 ? await options.commit(dir, message, REPETITION_STEP) : false;
  let queued = false;
  if (requests.length > 0) {
    const result = await options.enqueue(requests);
    queued = result.status === 'queued' || result.status === 'ok';
    if (!queued)
      options.log.warn(`repetition: variants not queued: ${result.message ?? result.status}`);
  }
  options.log.info(`${message}${committed ? '' : ' (not committed)'}`);
  return { status: 'ok', message, committed, queued };
}

export function editingHandlers(options: EditingHandlerOptions): EditingHandlers {
  let queue: Promise<unknown> = Promise.resolve();
  return {
    editingState: () => editingState(options.currentProject()),
    repetitionAction: (request) => {
      const next = queue.then(
        () => act(options, request),
        () => act(options, request),
      );
      queue = next.catch((error: unknown) => {
        options.log.error(`repetition action failed: ${describeError(error)}`);
      });
      return next;
    },
  };
}
