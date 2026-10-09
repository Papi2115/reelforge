/**
 * The final review's verdicts (PLAN.md#11.5): one entry per shot (status, findings, fixed, locked,
 * out of sync), their counts, and the scenes report updated with the verdicts of the unlocked
 * shots the review did not fix.
 */
import { ok, type Result } from '@reelforge/claude-bridge';
import type {
  FinalReview,
  FinalReviewShot,
  QaFinding,
  ShotBuildRecord,
  StoryboardShot,
  SyncReport,
} from '@reelforge/shared';
import type { StageError } from '../types.js';
import { findingsStatus, reviewedFindings } from './final-checks.js';
import type { SceneJob } from './job.js';
import { updateScenesReport } from './report.js';

export function entryOf(
  job: SceneJob,
  shot: StoryboardShot,
  found: readonly QaFinding[],
  record: ShotBuildRecord | undefined,
  fixed: boolean,
  sync: SyncReport | undefined,
): FinalReviewShot {
  const locked = job.locked.has(shot.id);
  const findings = reviewedFindings(found, record, fixed);
  const problems = sync?.shots.find((entry) => entry.shotId === shot.id)?.problems ?? 0;
  return {
    shotId: shot.id,
    status: findingsStatus(findings),
    findings: [...findings],
    autoFixed: fixed,
    locked,
    outOfSync: locked && problems > 0,
  };
}

/** The scenes report gets the review's verdict of the unlocked shots it did not fix. */
export async function mergeIntoReport(
  job: SceneJob,
  entries: readonly FinalReviewShot[],
): Promise<Result<void, StageError>> {
  const { ctx } = job;
  const changed = entries.filter((entry) => !entry.locked && !entry.autoFixed);
  const stamp = ctx.now().toISOString();
  const written = await updateScenesReport(
    ctx.projectDir,
    job.shots.map((shot) => shot.id),
    ctx.now(),
    (records) => {
      for (const entry of changed) {
        const record = records.get(entry.shotId);
        if (record === undefined) continue;
        const same =
          record.status === entry.status &&
          JSON.stringify(record.findings) === JSON.stringify(entry.findings);
        if (!same) {
          records.set(entry.shotId, {
            ...record,
            status: entry.status,
            findings: entry.findings,
            updatedAt: stamp,
          });
        }
      }
    },
  );
  return written.ok ? ok(undefined) : written;
}

export function counts(entries: readonly FinalReviewShot[]): FinalReview['counts'] {
  const count = (test: (entry: FinalReviewShot) => boolean): number => entries.filter(test).length;
  return {
    ok: count((entry) => entry.status === 'ok'),
    warning: count((entry) => entry.status === 'warning'),
    failed: count((entry) => entry.status === 'failed'),
    locked: count((entry) => entry.locked),
    fixed: count((entry) => entry.autoFixed),
  };
}
