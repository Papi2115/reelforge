/**
 * Runs a per-shot job (build or review fix) for a set of shots through the persistent queue:
 * bounded concurrency (settings, capped by the LimitGuard), shot events for the UI, and every
 * finished shot stored in the scenes report + autocommitted. Locked shots (PLAN.md#11.4) never
 * run: they are left out of the queue and returned as `locked`.
 */
import { ok, type Result } from '@reelforge/claude-bridge';
import type { ShotBuildRecord, StoryboardShot } from '@reelforge/shared';
import type { StageError } from '../types.js';
import type { SceneJob } from './job.js';
import { prepareShotQueue, runShotQueue } from './queue.js';
import { saveShotRecord } from './report.js';

export interface ShotJobs {
  /** Work-item stage in pipeline.json (`scenes`, `scenes-review`). */
  readonly queue: string;
  readonly shots: readonly StoryboardShot[];
  /** Continue an interrupted run of this queue (finished shots are not redone). */
  readonly resume: boolean;
  /** Commit subject verb: "Scene s03 <verb> ✓". */
  readonly verb: string;
  /** Autocommit every finished shot (default true; the final review commits once at the end). */
  readonly commit?: boolean;
  readonly work: (shot: StoryboardShot) => Promise<Result<ShotBuildRecord, StageError>>;
}

export interface ShotJobsResult {
  /** Shots processed by this run. */
  readonly ran: readonly string[];
  /** Shots an interrupted earlier run had finished (skipped now). */
  readonly skipped: readonly string[];
  readonly resumed: boolean;
  /** Requested shots that are locked (not run). */
  readonly locked: readonly string[];
}

/** Shots built at once: the setting, capped by the account-wide Claude concurrency. */
export function shotConcurrency(job: SceneJob): number {
  return Math.max(1, Math.min(job.settings.concurrency, job.ctx.claudeConcurrency()));
}

export async function runShotJobs(
  job: SceneJob,
  jobs: ShotJobs,
): Promise<Result<ShotJobsResult, StageError>> {
  const { ctx } = job;
  const unlocked = (shot: StoryboardShot): boolean => !job.locked.has(shot.id);
  const prepared = await prepareShotQueue({
    store: ctx.store,
    projectDir: ctx.projectDir,
    queue: jobs.queue,
    storyboardIds: job.shots.filter(unlocked).map((shot) => shot.id),
    targets: jobs.shots.filter(unlocked).map((shot) => shot.id),
    resume: jobs.resume,
    now: ctx.now(),
  });
  if (!prepared.ok) return prepared;
  const byId = new Map(job.shots.map((shot) => [shot.id, shot]));
  const ran: string[] = [];
  const result = await runShotQueue({
    store: ctx.store,
    projectDir: ctx.projectDir,
    queue: jobs.queue,
    ids: prepared.value.pending,
    signal: ctx.signal,
    concurrency: () => shotConcurrency(job),
    now: () => ctx.now(),
    job: async (id) => {
      const shot = byId.get(id);
      if (shot === undefined) return ok(undefined);
      const done = await jobs.work(shot);
      if (!done.ok) return done;
      ran.push(id);
      return saveShotRecord(job, shot, done.value, jobs.verb, jobs.commit ?? true);
    },
    onStart: (id) => {
      ctx.shot(id, 'started');
    },
    onRequeue: (id) => {
      ctx.shot(id, 'requeued');
    },
    onWarning: (message) => {
      ctx.warn(message);
    },
  });
  if (!result.ok) return result;
  return ok({
    ran,
    skipped: prepared.value.finished,
    resumed: prepared.value.resumed,
    locked: jobs.shots.filter((shot) => !unlocked(shot)).map((shot) => shot.id),
  });
}
