/**
 * `.reelforge/scenes-report.json` (schema in @reelforge/shared): one record per shot in
 * storyboard order, updated as each shot finishes (serialized read-modify-write, atomic).
 */
import { JsonFileStore, err, ok, type Result } from '@reelforge/claude-bridge';
import {
  SCENES_REPORT_VERSION,
  scenesReportSchema,
  type ScenesReport,
  type ShotBuildRecord,
  type StoryboardShot,
} from '@reelforge/shared';
import { FILES, inProject } from '../paths.js';
import { stageError, type StageError } from '../types.js';
import type { SceneJob } from './job.js';
import { commitSubject } from './shot-job.js';

const EPOCH = new Date(0).toISOString();

const reports = new JsonFileStore<ScenesReport>(scenesReportSchema, () => ({
  version: SCENES_REPORT_VERSION,
  updatedAt: EPOCH,
  shots: [],
}));

function reportFile(projectDir: string): string {
  return inProject(projectDir, FILES.scenesReport);
}

export async function readScenesReport(
  projectDir: string,
): Promise<Result<ScenesReport, StageError>> {
  const read = await reports.read(reportFile(projectDir));
  return read.ok ? read : err(stageError('io', `${FILES.scenesReport}: ${read.error.message}`));
}

/**
 * Applies `change` to the records (keyed by shot id) and keeps only storyboard shots, in
 * storyboard order.
 */
export async function updateScenesReport(
  projectDir: string,
  order: readonly string[],
  now: Date,
  change: (records: Map<string, ShotBuildRecord>) => void,
): Promise<Result<ScenesReport, StageError>> {
  const written = await reports.update(reportFile(projectDir), (current) => {
    const records = new Map(current.shots.map((entry) => [entry.shotId, entry]));
    change(records);
    return {
      version: SCENES_REPORT_VERSION,
      updatedAt: now.toISOString(),
      shots: order.flatMap((id) => {
        const entry = records.get(id);
        return entry === undefined ? [] : [entry];
      }),
    };
  });
  return written.ok
    ? ok(written.value)
    : err(stageError('io', `${FILES.scenesReport}: ${written.error.message}`));
}

/**
 * Stores a finished shot: report record, autocommit "Scene sNN <verb> ✓/⚠/✗" of the shot's scene
 * file only (shots build in parallel: another shot's work in progress must not land in this
 * commit, or reverting it would undo the wrong shot), shot event.
 */
export async function saveShotRecord(
  job: SceneJob,
  shot: StoryboardShot,
  record: ShotBuildRecord,
  verb: string,
  commit = true,
): Promise<Result<void, StageError>> {
  const { ctx } = job;
  const order = job.shots.map((entry) => entry.id);
  const written = await updateScenesReport(ctx.projectDir, order, ctx.now(), (records) => {
    records.set(record.shotId, record);
  });
  if (!written.ok) return written;
  if (commit) await ctx.commit(commitSubject(shot, record.status, verb), [shot.scene]);
  ctx.shot(shot.id, 'finished', record.status);
  return ok(undefined);
}
