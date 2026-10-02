/**
 * Scenes built (PLAN.md#7.4-7.7): one job per storyboard shot (build turn → QA by code → Haiku
 * critic → ≤ 2 fix turns → ✓/⚠/✗ in `.reelforge/scenes-report.json` + "Scene sNN built ✓"
 * autocommit), resumable after a limit/cancel/crash without redoing finished shots. The
 * `action` runs a whole-video review mode instead (the "Whole video" chat chips).
 */
import { err, ok, type Result } from '@reelforge/claude-bridge';
import { SHOT_STATUS_SYMBOLS, type ShotBuildRecord, type ShotBuildStatus } from '@reelforge/shared';
import { FILES } from '../paths.js';
import { loadSceneJob, selectShots, type SceneJob } from '../scenes/job.js';
import { SCENES_QUEUE } from '../scenes/queue.js';
import { readScenesReport } from '../scenes/report.js';
import { reviewVideo, type ReviewOutcome } from '../scenes/review.js';
import { runShotJobs } from '../scenes/run-shots.js';
import { buildShot } from '../scenes/shot-job.js';
import {
  stageError,
  type RequestOf,
  type ReviewMode,
  type StageContext,
  type StageDefinition,
  type StageError,
  type StageSummary,
} from '../types.js';

function shotCount(count: number): string {
  return `${String(count)} ${count === 1 ? 'shot' : 'shots'}`;
}

function countStatuses(records: readonly ShotBuildRecord[]): Record<ShotBuildStatus, number> {
  const counts: Record<ShotBuildStatus, number> = { ok: 0, warning: 0, failed: 0 };
  for (const entry of records) counts[entry.status] += 1;
  return counts;
}

function statusLine(counts: Record<ShotBuildStatus, number>): string {
  return (['ok', 'warning', 'failed'] as const)
    .filter((status) => counts[status] > 0)
    .map((status) => `${String(counts[status])} ${SHOT_STATUS_SYMBOLS[status]}`)
    .join(', ');
}

async function recordsOf(
  ctx: StageContext,
  ids: readonly string[],
): Promise<Result<ShotBuildRecord[], StageError>> {
  const report = await readScenesReport(ctx.projectDir);
  if (!report.ok) return report;
  const wanted = new Set(ids);
  return ok(report.value.shots.filter((entry) => wanted.has(entry.shotId)));
}

function shotWarnings(records: readonly ShotBuildRecord[]): string[] {
  return records
    .filter((entry) => entry.status !== 'ok')
    .map(
      (entry) =>
        `${entry.shotId} ${SHOT_STATUS_SYMBOLS[entry.status]}: ${entry.findings
          .map((finding) => finding.message)
          .join(' | ')}`,
    );
}

async function build(
  job: SceneJob,
  shots: readonly string[] | undefined,
): Promise<Result<StageSummary, StageError>> {
  const { ctx } = job;
  const selected = selectShots(job, shots);
  if (!selected.ok) return selected;
  const ran = await runShotJobs(job, {
    queue: SCENES_QUEUE,
    shots: selected.value,
    resume: shots === undefined,
    verb: 'built',
    work: (shot) => buildShot(job, shot),
  });
  if (!ran.ok) return ran;
  const ids = [...ran.value.skipped, ...ran.value.ran];
  const records = await recordsOf(ctx, ids);
  if (!records.ok) return records;
  const counts = countStatuses(records.value);
  const failed = records.value.filter((entry) => entry.status === 'failed');
  if (failed.length > 0) {
    return err(
      stageError(
        'quality',
        `${String(failed.length)} of ${String(records.value.length)} shots failed QA: ${failed.map((entry) => entry.shotId).join(', ')}`,
        shotWarnings(failed),
      ),
    );
  }
  const missing = [...new Set(records.value.flatMap((entry) => entry.missingProps))];
  return ok({
    message: `${String(records.value.length)} shots: ${statusLine(counts)}${ran.value.resumed ? ` (resumed, ${String(ran.value.skipped.length)} already built)` : ''}`,
    outputs: [...new Set(selected.value.map((shot) => shot.scene)), FILES.scenesReport],
    changed: ran.value.ran.length > 0,
    warnings: shotWarnings(records.value),
    metrics: {
      shots: records.value.length,
      ok: counts.ok,
      warning: counts.warning,
      failed: counts.failed,
      built: ran.value.ran.length,
      skipped: ran.value.skipped.length,
      fixIterations: records.value.reduce((sum, entry) => sum + entry.fixIterations, 0),
      missingProps: missing.length,
    },
  });
}

function reviewSummary(outcome: ReviewOutcome, records: readonly ShotBuildRecord[]): StageSummary {
  const counts = countStatuses(records);
  const fixed = outcome.fixed.length;
  const sync = outcome.sync?.summary;
  return {
    message: `Review (${outcome.mode}): ${shotCount(outcome.suspects.length)} flagged, ${String(fixed)} fixed${fixed > 0 ? ` (${statusLine(counts)})` : ''}${sync === undefined ? '' : `; sync: ${String(sync.problems)} problems left`}`,
    outputs: [
      FILES.scenesReport,
      ...(outcome.sync === undefined ? [] : [FILES.syncReport]),
      ...outcome.sheets,
    ],
    changed: fixed > 0,
    warnings: [...outcome.notes, ...shotWarnings(records)],
    metrics: {
      flagged: outcome.suspects.length,
      fixed,
      ok: counts.ok,
      warning: counts.warning,
      failed: counts.failed,
      syncProblems: sync?.problems ?? null,
    },
  };
}

async function review(
  job: SceneJob,
  mode: ReviewMode,
  shots: readonly string[] | undefined,
): Promise<Result<StageSummary, StageError>> {
  const selected = selectShots(job, shots);
  if (!selected.ok) return selected;
  const outcome = await reviewVideo(job, mode, selected.value);
  if (!outcome.ok) return outcome;
  const records = await recordsOf(job.ctx, outcome.value.fixed);
  if (!records.ok) return records;
  return ok(reviewSummary(outcome.value, records.value));
}

async function run(
  ctx: StageContext,
  request: RequestOf<'scenes'>,
): Promise<Result<StageSummary, StageError>> {
  const action = request.action ?? 'build';
  const needsClaude = action !== 'sync-check';
  if (needsClaude && !ctx.hasClaude) {
    return err(stageError('missing-tool', 'Claude is not connected'));
  }
  const job = await loadSceneJob(ctx);
  if (!job.ok) return job;
  return action === 'build'
    ? build(job.value, request.shots)
    : review(job.value, action, request.shots);
}

export const scenesStage: StageDefinition<'scenes'> = {
  id: 'scenes',
  inputs: [FILES.storyboard, FILES.words, 'project.json (style)', 'kit catalog'],
  outputs: ['scenes/<shot>.js', FILES.scenesReport, FILES.syncReport, `${FILES.qaFramesDir}/…`],
  run,
};
