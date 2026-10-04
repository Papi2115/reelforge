/**
 * Deciding about a shot's variants (PLAN.md#11.3). Pick: the variant becomes the shot's scene
 * (the previous one stays in git history), its QA record goes into the scenes report, the other
 * variants are deleted, the stage commits "Shot s03: picked variant 2 (<direction>)" and,
 * opt-in, locks the shot. Keep current / discard all: the set is deleted. Every decision is
 * appended to the taste log and, with taste learning on, becomes a taste signal (PLAN.md#12.13).
 */
import { err, ok, type Result } from '@reelforge/claude-bridge';
import {
  SHOT_LOCKS_FILE,
  type TasteDecision,
  type ShotVariantSet,
  type StoryboardShot,
} from '@reelforge/shared';
import { readProjectText, writeProjectText } from '../files.js';
import { setShotsLocked } from '../locks.js';
import { FILES } from '../paths.js';
import type { SceneJob } from '../scenes/job.js';
import { updateScenesReport } from '../scenes/report.js';
import { stageError, type StageError, type StageSummary } from '../types.js';
import { currentVariantSet, lockedShotError, variantShot } from './current.js';
import { removeVariantSet } from './store.js';
import { variantDecisionSignal } from '../taste/signals.js';
import { appendTasteEntry, tasteEntry } from './taste.js';

async function usableSet(
  job: SceneJob,
  shotId: string | undefined,
): Promise<Result<{ shot: StoryboardShot; set: ShotVariantSet }, StageError>> {
  const shot = variantShot(job, shotId);
  if (!shot.ok) return shot;
  const current = await currentVariantSet(job, shot.value);
  if (!current.ok) return current;
  if (current.value.set === undefined) {
    const why = current.value.stale
      ? 'they were removed because the shot changed since they were built'
      : 'none were generated';
    return err(stageError('invalid-input', `No variants of ${shot.value.id}: ${why}`));
  }
  return ok({ shot: shot.value, set: current.value.set });
}

async function logDecision(
  job: SceneJob,
  set: ShotVariantSet,
  shot: StoryboardShot,
  decision: TasteDecision,
  chosen?: number,
): Promise<void> {
  const written = await appendTasteEntry(
    job.ctx.projectDir,
    tasteEntry(set, shot, decision, job.ctx.now(), chosen),
  );
  if (!written.ok) job.ctx.warn(`taste log not updated: ${written.error.message}`);
  // Taste learning (PLAN.md#12.13): read the variant files before the set is removed.
  const learner = job.ctx.taste;
  if (learner !== undefined) {
    learner.record([await variantDecisionSignal(job.ctx.projectDir, set, shot, decision, chosen)]);
  }
}

export async function pickVariant(
  job: SceneJob,
  shotId: string | undefined,
  index: number,
  lock: boolean,
): Promise<Result<StageSummary, StageError>> {
  const { ctx } = job;
  const found = await usableSet(job, shotId);
  if (!found.ok) return found;
  const { shot, set } = found.value;
  if (job.locked.has(shot.id)) return err(lockedShotError(shot.id));
  const variant = set.variants.find((entry) => entry.index === index);
  if (variant?.status !== 'ready' || variant.file === undefined || variant.record === undefined) {
    return err(stageError('invalid-input', `${shot.id} variant ${String(index)} cannot be picked`));
  }
  const source = await readProjectText(ctx.projectDir, variant.file);
  if (!source.ok) return source;
  if (source.value === undefined) {
    return err(stageError('not-ready', `${variant.file} is missing`));
  }
  const written = await writeProjectText(ctx.projectDir, shot.scene, source.value);
  if (!written.ok) return written;
  const { label } = variant.direction;
  const record = {
    ...variant.record,
    shotId: shot.id,
    scene: shot.scene,
    notes: [...variant.record.notes, `picked variant ${String(index)} (${label})`],
    updatedAt: ctx.now().toISOString(),
  };
  const order = job.shots.map((entry) => entry.id);
  const report = await updateScenesReport(ctx.projectDir, order, ctx.now(), (records) => {
    records.set(shot.id, record);
  });
  if (!report.ok) return report;
  if (lock) {
    const locked = await setShotsLocked(ctx.projectDir, [shot.id], true, ctx.now());
    if (!locked.ok) return locked;
  }
  await logDecision(job, set, shot, 'pick', index);
  const removed = await removeVariantSet(ctx.projectDir, shot.id);
  if (!removed.ok) ctx.warn(removed.error.message);
  ctx.shot(shot.id, 'finished', record.status);
  return ok({
    message: `${shot.id}: picked variant ${String(index)} (${label})${lock ? ', locked' : ''}`,
    outputs: [shot.scene, FILES.scenesReport, ...(lock ? [SHOT_LOCKS_FILE] : [])],
    changed: true,
    warnings: [],
    metrics: { variant: index, locked: lock },
    commitMessage: `Shot ${shot.id}: picked variant ${String(index)} (${label})`,
  });
}

/** Keep the current scene or discard all: the set goes, the decision is logged. */
export async function dismissVariants(
  job: SceneJob,
  shotId: string | undefined,
  decision: 'keep-current' | 'discard',
): Promise<Result<StageSummary, StageError>> {
  const found = await usableSet(job, shotId);
  if (!found.ok) return found;
  const { shot, set } = found.value;
  await logDecision(job, set, shot, decision);
  const removed = await removeVariantSet(job.ctx.projectDir, shot.id);
  if (!removed.ok) return removed;
  return ok({
    message: `${shot.id}: ${decision === 'keep-current' ? 'kept the current scene' : 'discarded all variants'}`,
    outputs: [],
    changed: false,
    keepStatus: true,
    warnings: [],
    metrics: { variants: set.variants.length },
  });
}
