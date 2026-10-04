/**
 * The Tension panel's edits (PLAN.md#12.22, ADR-017): a saved curve becomes `tension.json`
 * (zod-validated, atomic, committed with `ReelForge-Step: tension`), Reset brings back Claude's
 * last proposal (or removes the curve when there is none). Locks (PLAN.md#11.4): a locked shot
 * keeps the tension it had (a pin), so editing the curve never changes a locked shot; unlocked
 * shots follow the new curve right away in the preview (background tone, ambient budget) and at
 * the next Storyboard run (cut tempo, looks). Edits run one at a time.
 */
import { rm } from 'node:fs/promises';
import path from 'node:path';
import { writeJsonAtomic } from '@reelforge/project';
import {
  lockedShotIds,
  lockedShotPins,
  normalizeTensionPoints,
  shotLocksFileSchema,
  storyboardFileSchema,
  TENSION_FILE,
  TENSION_FILE_VERSION,
  tensionFileSchema,
  tensionForShot,
  wordsFileSchema,
  type StoryboardShot,
  type TensionFile,
} from '@reelforge/shared';
import { SNAPSHOT_FILES } from '../shared/snapshot-contract.js';
import type { TensionSaveRequest, TensionSaveResult } from '../shared/tension-contract.js';
import { describeError, type Logger } from './logger.js';
import { describeIssues, readProjectJson } from './project-files.js';

/** Commit trailer `ReelForge-Step` of curve edits. */
export const TENSION_STEP = 'tension';
/** A shot whose tension moved at least this much counts as changed. */
export const SHOT_CHANGE_THRESHOLD = 0.05;

export interface TensionContext {
  readonly shots: readonly StoryboardShot[];
  readonly locked: ReadonlySet<string>;
  /** Length of the film (s): the narration, else the storyboard. */
  readonly durationS: number;
  /** The current curve (undefined: none, or an invalid file that the edit replaces). */
  readonly previous: TensionFile | undefined;
}

/** The curve after a panel edit: cleaned points, labels kept, locked shots pinned. */
export function editedTension(request: TensionSaveRequest, context: TensionContext): TensionFile {
  const { previous, durationS } = context;
  const lastT = Math.max(durationS, ...request.points.map((point) => point.t));
  const points = normalizeTensionPoints(request.points, lastT);
  const proposal =
    previous?.source === 'claude'
      ? {
          points: previous.points,
          ...(previous.segments === undefined ? {} : { segments: previous.segments }),
        }
      : previous?.proposal;
  const segments = request.segments ?? previous?.segments;
  const pins = lockedShotPins(previous, context.shots, context.locked);
  const locked = request.locked ?? previous?.locked;
  return {
    version: TENSION_FILE_VERSION,
    source: previous === undefined || previous.source === 'user' ? 'user' : 'edited',
    ...(locked === true ? { locked: true } : {}),
    points,
    ...(segments === undefined || segments.length === 0 ? {} : { segments }),
    ...(pins.length === 0 ? {} : { pins }),
    ...(previous?.note === undefined ? {} : { note: previous.note }),
    ...(proposal === undefined ? {} : { proposal }),
  };
}

/** Reset: Claude's last proposal again (locked shots stay pinned), or null = no curve. */
export function resetTension(context: TensionContext): TensionFile | null {
  const { previous } = context;
  if (previous === undefined) return null;
  if (previous.source === 'claude') return previous;
  if (previous.proposal === undefined) return null;
  const pins = lockedShotPins(previous, context.shots, context.locked);
  return {
    version: TENSION_FILE_VERSION,
    source: 'claude',
    points: previous.proposal.points,
    ...(previous.proposal.segments === undefined ? {} : { segments: previous.proposal.segments }),
    ...(pins.length === 0 ? {} : { pins }),
    ...(previous.note === undefined ? {} : { note: previous.note }),
  };
}

/** Which unlocked shots the edit changes (by SHOT_CHANGE_THRESHOLD) and which locked ones it keeps. */
export function shotChanges(
  before: TensionFile | undefined,
  after: TensionFile | null,
  context: Pick<TensionContext, 'shots' | 'locked'>,
): { changedShots: string[]; keptLocked: string[] } {
  const keptLocked = context.shots.filter((shot) => context.locked.has(shot.id)).map((s) => s.id);
  const changedShots = context.shots
    .filter((shot) => !context.locked.has(shot.id))
    .filter((shot) => {
      const old = before === undefined ? undefined : tensionForShot(before, shot);
      const next = after === null ? undefined : tensionForShot(after, shot);
      if (old === undefined || next === undefined) return old !== next;
      return Math.abs(old - next) >= SHOT_CHANGE_THRESHOLD;
    })
    .map((shot) => shot.id);
  return { changedShots, keptLocked };
}

export interface TensionServiceOptions {
  /** Folder of the open project (undefined: none open). */
  readonly projectDir: () => string | undefined;
  /** Commits the open project; resolves true when a commit was made. */
  readonly commit: (message: string) => Promise<boolean>;
  readonly log: Logger;
}

type Loaded =
  | { readonly ok: true; readonly context: TensionContext }
  | { readonly ok: false; readonly message: string };

const sameCurve = (left: TensionFile | null | undefined, right: TensionFile | null): boolean =>
  JSON.stringify(left ?? null) === JSON.stringify(right);

export class TensionService {
  private queue: Promise<unknown> = Promise.resolve();

  constructor(private readonly options: TensionServiceOptions) {}

  save(request: TensionSaveRequest): Promise<TensionSaveResult> {
    return this.enqueue((context) => ({
      file: editedTension(request, context),
      subject: `Tension: ${request.change}`,
    }));
  }

  reset(): Promise<TensionSaveResult> {
    return this.enqueue((context) => {
      const file = resetTension(context);
      return {
        file,
        subject:
          file === null ? 'Tension: reset (no curve)' : "Tension: reset to Claude's proposal",
      };
    });
  }

  private enqueue(
    change: (context: TensionContext) => { file: TensionFile | null; subject: string },
  ): Promise<TensionSaveResult> {
    const run = this.queue.then(() => this.run(change));
    this.queue = run.catch(() => undefined);
    return run;
  }

  private async run(
    change: (context: TensionContext) => { file: TensionFile | null; subject: string },
  ): Promise<TensionSaveResult> {
    const dir = this.options.projectDir();
    if (dir === undefined) return { status: 'error', message: 'no project is open' };
    const loaded = await this.load(dir);
    if (!loaded.ok) return { status: 'error', message: loaded.message };
    const { context } = loaded;
    const { file, subject } = change(context);
    if (file !== null) {
      const valid = tensionFileSchema.safeParse(file);
      if (!valid.success) {
        return { status: 'error', message: `${TENSION_FILE}: ${describeIssues(valid.error)}` };
      }
    }
    const changes = shotChanges(context.previous, file, context);
    if (sameCurve(context.previous, file)) {
      return { status: 'ok', file, committed: false, ...changes };
    }
    try {
      const target = path.join(dir, TENSION_FILE);
      if (file === null) await rm(target, { force: true });
      else await writeJsonAtomic(target, file);
    } catch (error) {
      this.options.log.error(`cannot write ${TENSION_FILE}: ${describeError(error)}`);
      return { status: 'error', message: `cannot write ${TENSION_FILE}: ${describeError(error)}` };
    }
    const committed = await this.options.commit(subject);
    this.options.log.info(`${subject}${committed ? '' : ' (not committed)'}`);
    return { status: 'ok', file, committed, ...changes };
  }

  private async load(dir: string): Promise<Loaded> {
    const [storyboard, words, locks, tension] = await Promise.all([
      readProjectJson(dir, SNAPSHOT_FILES.storyboard, storyboardFileSchema),
      readProjectJson(dir, SNAPSHOT_FILES.words, wordsFileSchema),
      readProjectJson(dir, SNAPSHOT_FILES.locks, shotLocksFileSchema),
      readProjectJson(dir, TENSION_FILE, tensionFileSchema),
    ]);
    if (locks.status === 'error') return { ok: false, message: locks.error.message };
    const shots = storyboard.status === 'ok' ? storyboard.data.shots : [];
    const durationS =
      (words.status === 'ok' ? words.data.words.at(-1)?.tEnd : undefined) ?? shots.at(-1)?.t1 ?? 0;
    return {
      ok: true,
      context: {
        shots,
        locked: lockedShotIds(locks.status === 'ok' ? locks.data : undefined),
        durationS,
        previous: tension.status === 'ok' ? tension.data : undefined,
      },
    };
  }
}
