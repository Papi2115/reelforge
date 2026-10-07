/**
 * Scenes built (PLAN.md#7.4-7.7): the storyboard's new roles are built as project roles
 * (characters/roles, PLAN.md#12.20, "Role <id> built ✓") and its missing props as project props
 * (kit-ext, "Prop <name> built ✓") first, then one job per storyboard shot (build turn → missing
 * props built → QA by code → Haiku critic → ≤ 2 fix turns → ✓/⚠/✗ in
 * `.reelforge/scenes-report.json` + "Scene sNN built ✓" autocommit), resumable after a
 * limit/cancel/crash without redoing finished shots. Locked shots (`locks.json`) are never built
 * or fixed. The `action` runs a whole-video review mode instead (the "Whole video" chat chips) or
 * the final review (PLAN.md#11.5), or works on one shot's variants (PLAN.md#11.3).
 */
import { err, ok, type Result } from '@reelforge/claude-bridge';
import {
  SHOT_STATUS_SYMBOLS,
  type ShotBuildRecord,
  type ShotBuildStatus,
  type StoryboardShot,
  type SyncReport,
  castRoleFile,
} from '@reelforge/shared';
import { FILES } from '../paths.js';
import { buildStoryboardProps } from '../props/storyboard-props.js';
import type { RoleOutcome } from '../roles/builder.js';
import { buildStoryboardRoles } from '../roles/storyboard-roles.js';
import { loadSceneJob, selectShots, type SceneJob } from '../scenes/job.js';
import { SCENES_QUEUE } from '../scenes/queue.js';
import { readScenesReport } from '../scenes/report.js';
import { finalReview, finalReviewWarnings } from '../scenes/final-review.js';
import { reviewVideo, type ReviewOutcome } from '../scenes/review.js';
import { runShotJobs } from '../scenes/run-shots.js';
import { buildShot } from '../scenes/shot-job.js';
import { dismissVariants, pickVariant } from '../variants/decide.js';
import { generateVariants } from '../variants/generate.js';
import { ensureWorldAssets } from '../world-assets/builder.js';
import { worldAssetsAction } from '../world-assets/stage.js';
import {
  stageError,
  type RequestOf,
  type ReviewMode,
  type SceneAction,
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

/** Selected shots split into the ones to work on and the locked ids (PLAN.md#11.4). */
function splitLocked(
  job: SceneJob,
  shots: readonly StoryboardShot[],
): { unlocked: StoryboardShot[]; locked: string[] } {
  return {
    unlocked: shots.filter((shot) => !job.locked.has(shot.id)),
    locked: shots.filter((shot) => job.locked.has(shot.id)).map((shot) => shot.id),
  };
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

/** The storyboard roles in the stage summary; nothing when the storyboard asked for none. */
function rolesNote(outcomes: readonly RoleOutcome[]): {
  text: string;
  outputs: string[];
  metrics: Record<string, number>;
} {
  if (outcomes.length === 0) return { text: '', outputs: [], metrics: {} };
  const usable = outcomes.filter((outcome) => outcome.status !== 'failed');
  const failed = outcomes.filter((outcome) => outcome.status === 'failed');
  const text = [
    usable.length === 0
      ? ''
      : `; roles: ${usable.map((outcome) => `${outcome.id}${outcome.status === 'warning' ? ' ⚠' : ''}`).join(', ')}`,
    failed.length === 0
      ? ''
      : `; roles not built: ${failed.map((outcome) => outcome.id).join(', ')}`,
  ].join('');
  return {
    text,
    outputs: [...usable.map((outcome) => castRoleFile(outcome.id)), FILES.rolesReport],
    metrics: { builtRoles: usable.length, failedRoles: failed.length },
  };
}

async function build(
  job: SceneJob,
  shots: readonly string[] | undefined,
): Promise<Result<StageSummary, StageError>> {
  const { ctx } = job;
  const selected = selectShots(job, shots);
  if (!selected.ok) return selected;
  const { unlocked, locked } = splitLocked(job, selected.value);
  // Asked for by name ("Rebuild this shot"): say why nothing happens to a locked shot.
  const lockWarnings =
    shots === undefined ? [] : locked.map((id) => `${id} is locked: not rebuilt`);
  if (unlocked.length === 0 && locked.length > 0) {
    return ok({
      message: `Nothing to build: ${locked.length === 1 ? `${locked.join('')} is locked` : `${shotCount(locked.length)} are locked`}`,
      outputs: [],
      changed: false,
      warnings: lockWarnings,
      metrics: { shots: 0, built: 0, locked: locked.length },
    });
  }
  // World films (PLAN.md#13.15): the film's own assets exist before the first scene.
  const worldAssets = await ensureWorldAssets(job, { force: false });
  if (!worldAssets.ok) return worldAssets;
  ctx.step('roles the storyboard needs');
  const roles = await buildStoryboardRoles(job.roles, ctx.projectDir, unlocked);
  if (!roles.ok) return roles;
  if (job.onMissingProps === undefined) {
    ctx.step('props flagged by the storyboard');
    const props = await buildStoryboardProps(job.props, ctx.projectDir, unlocked);
    if (!props.ok) return props;
  }
  const ran = await runShotJobs(job, {
    queue: SCENES_QUEUE,
    shots: unlocked,
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
  const newProps = [...new Set(records.value.flatMap((entry) => entry.builtProps ?? []))];
  const propsNote = newProps.length === 0 ? '' : `; props built: ${newProps.join(', ')}`;
  const lockNote = locked.length === 0 ? '' : `; ${String(locked.length)} locked (kept)`;
  const roleNote = rolesNote(roles.value);
  return ok({
    message: `${String(records.value.length)} shots: ${statusLine(counts)}${ran.value.resumed ? ` (resumed, ${String(ran.value.skipped.length)} already built)` : ''}${propsNote}${roleNote.text}${lockNote}`,
    outputs: [
      ...new Set(unlocked.map((shot) => shot.scene)),
      ...newProps.map((name) => `kit-ext/props/${name}.js`),
      ...roleNote.outputs,
      ...worldAssets.value.outputs,
      FILES.scenesReport,
    ],
    changed: ran.value.ran.length > 0,
    warnings: [...lockWarnings, ...worldAssets.value.warnings, ...shotWarnings(records.value)],
    metrics: {
      ...(locked.length === 0 ? {} : { locked: locked.length }),
      shots: records.value.length,
      ok: counts.ok,
      warning: counts.warning,
      failed: counts.failed,
      built: ran.value.ran.length,
      skipped: ran.value.skipped.length,
      fixIterations: records.value.reduce((sum, entry) => sum + entry.fixIterations, 0),
      missingProps: missing.length,
      builtProps: newProps.length,
      ...roleNote.metrics,
    },
  });
}

/** What a review did not touch because of locks (and locked shots whose words moved). */
export function lockedReviewNotes(
  locked: readonly string[],
  sync: SyncReport | undefined,
): string[] {
  if (locked.length === 0) return [];
  const wanted = new Set(locked);
  const offSync = (sync?.shots ?? []).filter(
    (shot) => wanted.has(shot.shotId) && shot.problems > 0,
  );
  return [
    `Locked shots not changed: ${locked.join(', ')}`,
    ...offSync.map(
      (shot) =>
        `${shot.shotId} is locked and may be out of sync (${String(shot.problems)} ${shot.problems === 1 ? 'event' : 'events'} off ${shot.problems === 1 ? 'its word' : 'their words'}): unlock and fix it`,
    ),
  ];
}

function reviewSummary(
  outcome: ReviewOutcome,
  records: readonly ShotBuildRecord[],
  lockNotes: readonly string[],
): StageSummary {
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
    warnings: [...outcome.notes, ...lockNotes, ...shotWarnings(records)],
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
  const { unlocked, locked } = splitLocked(job, selected.value);
  // The sync check reports locked shots too (never fixes them); the other modes skip them.
  const outcome = await reviewVideo(job, mode, mode === 'sync-check' ? selected.value : unlocked);
  if (!outcome.ok) return outcome;
  const records = await recordsOf(job.ctx, outcome.value.fixed);
  if (!records.ok) return records;
  return ok(
    reviewSummary(outcome.value, records.value, lockedReviewNotes(locked, outcome.value.sync)),
  );
}

async function final(
  job: SceneJob,
  trigger: 'auto' | 'manual',
): Promise<Result<StageSummary, StageError>> {
  const outcome = await finalReview(job, trigger);
  if (!outcome.ok) return outcome;
  const { review: result, sheets, sync } = outcome.value;
  const { fixed, locked } = result.counts;
  const statuses = statusLine({
    ok: result.counts.ok,
    warning: result.counts.warning,
    failed: result.counts.failed,
  });
  return ok({
    message: `Review done: ${statuses || 'no shots'}${fixed > 0 ? `; fixed ${shotCount(fixed)}` : ''}${locked > 0 ? `; ${String(locked)} locked` : ''}`,
    outputs: [
      FILES.scenesReport,
      FILES.finalReview,
      ...(sync === undefined ? [] : [FILES.syncReport]),
      ...sheets,
    ],
    changed: fixed > 0,
    warnings: [...result.notes, ...finalReviewWarnings(result)],
    metrics: { ...result.counts, syncProblems: sync?.summary.problems ?? null },
    commitMessage: `Final review: fixed ${shotCount(fixed)}`,
  });
}

/** Actions that work without Claude (code checks only). */
const WITHOUT_CLAUDE = new Set<SceneAction>(['sync-check', 'final-review']);

function needsClaude(request: RequestOf<'scenes'>): boolean {
  const action = request.action ?? 'build';
  if (action === 'variants') return request.variants?.kind === 'generate';
  return !WITHOUT_CLAUDE.has(action);
}

/** Shot variants (PLAN.md#11.3): one shot, `request.variants` says what to do. */
function variants(
  job: SceneJob,
  request: RequestOf<'scenes'>,
): Promise<Result<StageSummary, StageError>> {
  const op = request.variants;
  const shots = request.shots ?? [];
  const shotId = shots.length === 1 ? shots[0] : undefined;
  if (op === undefined) {
    return Promise.resolve(err(stageError('invalid-input', 'variants: no operation given')));
  }
  switch (op.kind) {
    case 'generate':
      return generateVariants(job, shotId, op);
    case 'pick':
      return pickVariant(job, shotId, op.index, op.lock === true);
    default:
      return dismissVariants(job, shotId, op.kind);
  }
}

async function run(
  ctx: StageContext,
  request: RequestOf<'scenes'>,
): Promise<Result<StageSummary, StageError>> {
  const action = request.action ?? 'build';
  if (needsClaude(request) && !ctx.hasClaude) {
    return err(stageError('missing-tool', 'Claude is not connected'));
  }
  const job = await loadSceneJob(ctx);
  if (!job.ok) return job;
  switch (action) {
    case 'build':
      return build(job.value, request.shots);
    case 'final-review':
      return final(job.value, request.trigger ?? 'manual');
    case 'variants':
      return variants(job.value, request);
    case 'world-assets':
      return worldAssetsAction(job.value);
    default:
      return review(job.value, action, request.shots);
  }
}

export const scenesStage: StageDefinition<'scenes'> = {
  id: 'scenes',
  inputs: [FILES.storyboard, FILES.words, 'project.json (style)', 'kit catalog'],
  outputs: [
    'scenes/<shot>.js',
    'kit-ext/props/<name>.js',
    'characters/roles/<id>.json',
    FILES.scenesReport,
    FILES.propsReport,
    FILES.rolesReport,
    FILES.syncReport,
    FILES.finalReview,
    `${FILES.qaFramesDir}/…`,
    '.reelforge/variants/<shot>/…',
    '.reelforge/taste.json',
    'assets/<world>/*.json',
    'assets/cast.json',
  ],
  run,
};
