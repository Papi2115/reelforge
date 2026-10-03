/**
 * "Variants…" on a shot (PLAN.md#11.3): 2–3 scene-build jobs for the SAME shot in parallel (scene
 * concurrency, capped by the LimitGuard), each from its own creative direction and through the
 * normal QA loop (lint, smoke frames, programmatic checks, critic, ≤ 1 fix), built into a work file
 * and stored under `.reelforge/variants/<shot>/`. The shot's scene is never touched; nothing is
 * committed. A variant that ends ✗ or whose turn fails is dropped with a reason; when none is
 * left the action fails and the set is removed. Stop/limit: finished variants stay, the others
 * are dropped as interrupted.
 */
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { err, ok, type Result } from '@reelforge/claude-bridge';
import {
  SHOT_STATUS_SYMBOLS,
  shotVariantFile,
  shotVariantsFile,
  type ShotBuildRecord,
  type ShotVariant,
  type ShotVariantSet,
  type StoryboardShot,
} from '@reelforge/shared';
import { readProjectText, writeProjectText } from '../files.js';
import { inProject } from '../paths.js';
import { buildStoryboardProps } from '../props/storyboard-props.js';
import { fatalFindings } from '../scenes/checks.js';
import type { SceneJob } from '../scenes/job.js';
import { shotConcurrency } from '../scenes/run-shots.js';
import { buildShot } from '../scenes/shot-job.js';
import { stageError, type StageError, type StageSummary } from '../types.js';
import { directionById, pickDirections, type VariantDirection } from './directions.js';
import {
  excludeVariantWork,
  removeVariantSet,
  removeWorkDir,
  removeWorkFile,
  storeVariantFile,
  updateVariantSet,
  variantBase,
  variantWorkFile,
} from './store.js';
import { decidedRounds } from './taste.js';
import { currentVariantSet, lockedShotError, variantShot } from './current.js';

/** Errors that stop the whole action (not the variant's fault). */
const STOPPING = new Set<StageError['kind']>([
  'cancelled',
  'blocked',
  'limit',
  'missing-tool',
  'tool',
]);

export interface GenerateRequest {
  readonly count: number;
  readonly note?: string | undefined;
  /** Rebuild only this variant of the current set (same direction). */
  readonly only?: number | undefined;
}

interface Target {
  readonly index: number;
  readonly direction: VariantDirection;
}

function droppedReason(record: ShotBuildRecord): string {
  const fatal = fatalFindings(record.findings);
  const messages = (fatal.length > 0 ? fatal : record.findings).map((entry) => entry.message);
  return `failed QA ${SHOT_STATUS_SYMBOLS.failed}: ${messages.join(' | ') || 'no scene'}`;
}

function building(target: Target, stamp: string): ShotVariant {
  const { id, label } = target.direction;
  return { index: target.index, direction: { id, label }, status: 'building', updatedAt: stamp };
}

/** Builds one variant into its work file and stores it: the entry to record. */
async function buildVariant(
  job: SceneJob,
  shot: StoryboardShot,
  target: Target,
  note: string | undefined,
): Promise<Result<ShotVariant, StageError>> {
  const { projectDir } = job.ctx;
  const work = variantWorkFile(shot.id, target.index);
  await removeWorkFile(projectDir, work);
  await mkdir(path.dirname(inProject(projectDir, work)), { recursive: true });
  try {
    const record = await buildShot(job, { ...shot, scene: work }, { ...target, note });
    const stamp = job.ctx.now().toISOString();
    const base = building(target, stamp);
    if (!record.ok) {
      return STOPPING.has(record.error.kind)
        ? record
        : ok({ ...base, status: 'dropped', reason: record.error.message });
    }
    if (record.value.status === 'failed') {
      return ok({ ...base, status: 'dropped', reason: droppedReason(record.value) });
    }
    const file = shotVariantFile(shot.id, target.index);
    const stored = await storeVariantFile(projectDir, work, file);
    if (!stored.ok) return stored;
    if (!stored.value) return ok({ ...base, status: 'dropped', reason: `${work} was not written` });
    const kept: ShotBuildRecord = { ...record.value, scene: file };
    return ok({ ...base, status: 'ready', file, record: kept });
  } finally {
    await removeWorkFile(projectDir, work);
  }
}

/** Runs `jobs` with at most `limit()` at once; stops starting new ones after a stopping error. */
async function runBounded(
  targets: readonly Target[],
  limit: () => number,
  run: (target: Target) => Promise<StageError | undefined>,
): Promise<StageError | undefined> {
  const waiting = [...targets];
  let stop: StageError | undefined;
  const worker = async (): Promise<void> => {
    for (let next = waiting.shift(); next !== undefined; next = waiting.shift()) {
      if (stop !== undefined) return;
      stop ??= await run(next);
    }
  };
  const workers = Math.max(1, Math.min(limit(), targets.length));
  await Promise.all(Array.from({ length: workers }, () => worker()));
  return stop;
}

async function plan(
  job: SceneJob,
  shot: StoryboardShot,
  request: GenerateRequest,
): Promise<Result<{ targets: Target[]; round: number; note: string | undefined }, StageError>> {
  const current = await currentVariantSet(job, shot);
  if (!current.ok) return current;
  const existing = current.value.set;
  if (request.only !== undefined) {
    const variant = existing?.variants.find((entry) => entry.index === request.only);
    const direction = variant === undefined ? undefined : directionById(variant.direction.id);
    if (existing === undefined || direction === undefined) {
      return err(stageError('invalid-input', `${shot.id} has no variant ${String(request.only)}`));
    }
    const note = request.note ?? existing.note;
    return ok({ targets: [{ index: request.only, direction }], round: existing.round, note });
  }
  let round: number;
  if (existing !== undefined) {
    round = existing.round + 1;
    const removed = await removeVariantSet(job.ctx.projectDir, shot.id);
    if (!removed.ok) return removed;
  } else {
    const decided = await decidedRounds(job.ctx.projectDir, shot.id);
    if (!decided.ok) return decided;
    round = decided.value;
  }
  const directions = pickDirections(request.count, round);
  const targets = directions.map((direction, offset) => ({ index: offset + 1, direction }));
  return ok({ targets, round, note: request.note });
}

function summary(set: ShotVariantSet, built: readonly number[]): StageSummary {
  const ready = set.variants.filter((variant) => variant.status === 'ready');
  const dropped = set.variants.filter(
    (variant) => built.includes(variant.index) && variant.status === 'dropped',
  );
  return {
    message: `${set.shotId}: ${String(ready.length)} ${ready.length === 1 ? 'variant' : 'variants'} ready${dropped.length > 0 ? `, ${String(dropped.length)} dropped` : ''}`,
    outputs: [shotVariantsFile(set.shotId), ...ready.flatMap((variant) => variant.file ?? [])],
    changed: false,
    keepStatus: true,
    warnings: dropped.map(
      (variant) =>
        `${set.shotId} variant ${String(variant.index)} (${variant.direction.label}) dropped: ${variant.reason ?? 'failed'}`,
    ),
    metrics: { variants: set.variants.length, ready: ready.length, dropped: dropped.length },
  };
}

/** Puts the shot's scene back if a variant turn edited it anyway. */
async function protectScene(
  job: SceneJob,
  shot: StoryboardShot,
  before: string | undefined,
): Promise<void> {
  const after = await readProjectText(job.ctx.projectDir, shot.scene);
  if (!after.ok || after.value === before || before === undefined) return;
  const restored = await writeProjectText(job.ctx.projectDir, shot.scene, before);
  job.ctx.warn(
    restored.ok
      ? `a variant turn edited ${shot.scene}: restored (variants never change the current scene)`
      : `a variant turn edited ${shot.scene} and it could not be restored: ${restored.error.message}`,
  );
}

/** Variants get at most one QA fix turn each (they are alternatives, not the final take). */
export const VARIANT_MAX_FIXES = 1;

export async function generateVariants(
  sceneJob: SceneJob,
  shotId: string | undefined,
  request: GenerateRequest,
): Promise<Result<StageSummary, StageError>> {
  const maxFixIterations = Math.min(VARIANT_MAX_FIXES, sceneJob.settings.maxFixIterations);
  const job: SceneJob = { ...sceneJob, settings: { ...sceneJob.settings, maxFixIterations } };
  const { ctx } = job;
  const selected = variantShot(job, shotId);
  if (!selected.ok) return selected;
  const shot = selected.value;
  if (job.locked.has(shot.id)) return err(lockedShotError(shot.id));
  const planned = await plan(job, shot, request);
  if (!planned.ok) return planned;
  const { targets, round, note } = planned.value;
  const excluded = await excludeVariantWork(ctx.projectDir);
  if (!excluded.ok) return excluded;
  const base = await variantBase(ctx.projectDir, shot);
  if (!base.ok) return base;
  const before = await readProjectText(ctx.projectDir, shot.scene);
  if (!before.ok) return before;
  const stamp = ctx.now().toISOString();
  const started = await updateVariantSet(ctx.projectDir, shot.id, (current) => {
    const kept = (current?.variants ?? []).filter(
      (variant) => !targets.some((target) => target.index === variant.index),
    );
    const variants = [...kept, ...targets.map((target) => building(target, stamp))];
    return {
      version: 1,
      shotId: shot.id,
      round,
      ...(note === undefined || note === '' ? {} : { note }),
      base: base.value,
      variants: variants.sort((first, second) => first.index - second.index),
      createdAt: current?.createdAt ?? stamp,
      updatedAt: stamp,
    };
  });
  if (!started.ok) return started;
  if (job.onMissingProps === undefined) {
    ctx.step(`${shot.id}: props flagged by the storyboard`);
    const props = await buildStoryboardProps(job.props, ctx.projectDir, [shot]);
    if (!props.ok) return props;
  }
  const stop = await runBounded(
    targets,
    () => shotConcurrency(job),
    async (target) => {
      const built = await buildVariant(job, shot, target, note);
      if (!built.ok) return built.error;
      const saved = await updateVariantSet(ctx.projectDir, shot.id, (current) => ({
        ...(current ?? started.value),
        variants: (current ?? started.value).variants.map((variant) =>
          variant.index === target.index ? built.value : variant,
        ),
        updatedAt: ctx.now().toISOString(),
      }));
      return saved.ok ? undefined : saved.error;
    },
  );
  await protectScene(job, shot, before.value);
  await removeWorkDir(ctx.projectDir, shot.id);
  return finishSet(job, shot, targets, stop, started.value);
}

/** Drops unfinished variants; fails (and removes the set) when no variant is ready. */
async function finishSet(
  job: SceneJob,
  shot: StoryboardShot,
  targets: readonly Target[],
  stop: StageError | undefined,
  started: ShotVariantSet,
): Promise<Result<StageSummary, StageError>> {
  const { ctx } = job;
  const reason = stop === undefined ? 'interrupted' : `interrupted: ${stop.message}`;
  const settled = await updateVariantSet(ctx.projectDir, shot.id, (current) => {
    const set = current ?? started;
    return {
      ...set,
      variants: set.variants.map((variant) =>
        variant.status === 'building'
          ? { ...variant, status: 'dropped' as const, reason, updatedAt: ctx.now().toISOString() }
          : variant,
      ),
    };
  });
  if (!settled.ok) return settled;
  const set = settled.value;
  const ready = set.variants.filter((variant) => variant.status === 'ready');
  if (ready.length === 0) {
    const removed = await removeVariantSet(ctx.projectDir, shot.id);
    if (!removed.ok) return removed;
    if (stop !== undefined) return err(stop);
    const reasons = set.variants.map(
      (variant) =>
        `v${String(variant.index)} (${variant.direction.label}): ${variant.reason ?? 'dropped'}`,
    );
    return err(
      stageError(
        'quality',
        `No variant of ${shot.id} passed QA; the current scene is kept`,
        reasons,
      ),
    );
  }
  if (stop !== undefined) return err(stop);
  return ok(
    summary(
      set,
      targets.map((target) => target.index),
    ),
  );
}
