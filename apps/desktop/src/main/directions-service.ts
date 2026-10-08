/**
 * Live co-direction in main (PLAN.md#12.14, ADR-023): applies a parsed command's direction to
 * directions.json (zod, atomic write) and commits it (`Direction s03: darker`, step
 * `direction`), so every command is one step of the project history (undo across sessions =
 * History). A locked shot (PLAN.md#11.4) is refused with a message, never modified. Commands run
 * one at a time. The preview picks the change up through the watcher (directions.json is a preview
 * input) and swaps the direction in without rebuilding the shot.
 */
import path from 'node:path';
import { writeJsonAtomic } from '@reelforge/project';
import {
  DIRECTIONS_FILE,
  directionsFileSchema,
  emptyDirections,
  lockedShotIds,
  shotLocksFileSchema,
  withShotDirection,
  type DirectionsFile,
} from '@reelforge/shared';
import type {
  DirectionApplyRequest,
  DirectionApplyResult,
  DirectionsState,
} from '../shared/directions-contract.js';
import { SNAPSHOT_FILES } from '../shared/snapshot-contract.js';
import { describeError, type Logger } from './logger.js';
import { readProjectJson } from './project-files.js';

/** Commit trailer `ReelForge-Step` of direction commands. */
export const DIRECTION_STEP = 'direction';

export interface DirectionsServiceOptions {
  readonly projectDir: () => string | undefined;
  /** Commits `paths` of the open project; resolves true when a commit was made. */
  readonly commit: (message: string, paths: readonly string[]) => Promise<boolean>;
  readonly log: Logger;
}

/** "Direction s03: darker" (the command as typed, one line, cut to 72 characters). */
export function directionCommitSubject(shotId: string, command: string): string {
  const line = command.replace(/\s+/g, ' ').trim();
  const subject = `Direction ${shotId}: ${line}`;
  return subject.length <= 72 ? subject : `${subject.slice(0, 71)}…`;
}

export function lockedMessage(shotId: string): string {
  return `${shotId} is locked: unlock this shot to direct it`;
}

interface Loaded {
  readonly directions: DirectionsFile;
  readonly locked: ReadonlySet<string>;
}

export class DirectionsService {
  private queue: Promise<unknown> = Promise.resolve();

  constructor(private readonly options: DirectionsServiceOptions) {}

  async state(): Promise<DirectionsState> {
    const dir = this.options.projectDir();
    if (dir === undefined) return { status: 'error', message: 'no project is open' };
    const loaded = await this.load(dir);
    if ('message' in loaded) return { status: 'error', message: loaded.message };
    return { status: 'ok', directions: loaded.directions, locked: [...loaded.locked].sort() };
  }

  apply(request: DirectionApplyRequest): Promise<DirectionApplyResult> {
    const run = this.queue.then(() => this.run(request));
    this.queue = run.catch(() => undefined);
    return run;
  }

  private async run(request: DirectionApplyRequest): Promise<DirectionApplyResult> {
    const dir = this.options.projectDir();
    if (dir === undefined) return { status: 'error', message: 'no project is open' };
    const loaded = await this.load(dir);
    if ('message' in loaded) return { status: 'error', message: loaded.message };
    if (loaded.locked.has(request.shotId)) {
      return { status: 'locked', shotId: request.shotId, message: lockedMessage(request.shotId) };
    }
    const next = withShotDirection(loaded.directions, request.shotId, request.next ?? undefined);
    if (JSON.stringify(next) === JSON.stringify(loaded.directions)) {
      return { status: 'ok', directions: next, committed: false };
    }
    try {
      await writeJsonAtomic(path.join(dir, DIRECTIONS_FILE), next);
    } catch (error) {
      const message = `cannot write ${DIRECTIONS_FILE}: ${describeError(error)}`;
      this.options.log.error(message);
      return { status: 'error', message };
    }
    const subject = directionCommitSubject(request.shotId, request.command);
    const committed = await this.options.commit(subject, [DIRECTIONS_FILE]);
    this.options.log.info(`${subject}${committed ? '' : ' (not committed)'}`);
    return { status: 'ok', directions: next, committed };
  }

  private async load(dir: string): Promise<Loaded | { readonly message: string }> {
    const [stored, locks] = await Promise.all([
      readProjectJson(dir, DIRECTIONS_FILE, directionsFileSchema),
      readProjectJson(dir, SNAPSHOT_FILES.locks, shotLocksFileSchema),
    ]);
    if (stored.status === 'error') {
      return { message: `${DIRECTIONS_FILE} is invalid: ${stored.error.message}` };
    }
    if (locks.status === 'error')
      return { message: `locks.json is invalid: ${locks.error.message}` };
    return {
      directions: stored.status === 'ok' ? stored.data : emptyDirections(),
      locked: lockedShotIds(locks.status === 'ok' ? locks.data : undefined),
    };
  }
}
