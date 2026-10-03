/**
 * Final review (PLAN.md#11.5): the quiet pass after "Scenes built", without any click. Code first
 * (sync report, lint, 3-frame renders, blank/cards/safe area, phone legibility) for every shot,
 * then ONE batched Haiku critic turn over the contact sheets of all shots, then at most one Opus
 * `scene-fix` per shot with confirmed findings (code findings and the critic's suspects) and a
 * re-QA. Locked shots are checked and reported only. Results: the scenes report (latest status
 * per shot) and `.reelforge/final-review.json`; nothing is committed per shot (the stage makes one
 * commit, "Final review: fixed N shots").
 */
import { ok, type Result } from '@reelforge/claude-bridge';
import {
  FINAL_REVIEW_VERSION,
  finalReviewSchema,
  type FinalReview,
  type FinalReviewShot,
  type QaFinding,
  type ShotBuildRecord,
  type StoryboardShot,
  type SyncReport,
} from '@reelforge/shared';
import { writeProjectJson } from '../files.js';
import { FILES } from '../paths.js';
import type { StageError } from '../types.js';
import { finding, fixableFindings, formatFinding } from './checks.js';
import { checkShot, findingsStatus, legibilityCheck } from './final-checks.js';
import type { SceneJob } from './job.js';
import { readScenesReport, updateScenesReport } from './report.js';
import { SHEET_ROWS, triage } from './review.js';
import { runShotJobs } from './run-shots.js';
import { writeContactSheet, type SheetShot } from './sheet.js';
import { refineShot } from './shot-job.js';
import { syncReport } from './sync-report.js';

/** Work items of the final review's fixes in pipeline.json. */
export const FINAL_REVIEW_QUEUE = 'scenes-final-review';
/** Fix turns per shot in the automatic pass. */
const AUTO_FIX_ITERATIONS = 1;
/** Build findings the review cannot check again (kept as they are). */
const CARRIED_SOURCES = new Set<QaFinding['source']>(['missing-prop']);

export interface FinalReviewOutcome {
  readonly review: FinalReview;
  readonly sheets: readonly string[];
  readonly sync: SyncReport | undefined;
}

interface Checked {
  readonly findings: Map<string, QaFinding[]>;
  readonly rows: SheetShot[];
}

const percentOf = (done: number, total: number): number =>
  Math.round(5 + (55 * done) / Math.max(1, total));

async function checkAll(
  job: SceneJob,
  sync: SyncReport | undefined,
): Promise<Result<Checked, StageError>> {
  const findings = new Map<string, QaFinding[]>();
  const rows: SheetShot[] = [];
  const total = job.shots.length;
  for (const [index, shot] of job.shots.entries()) {
    job.ctx.step(`Reviewing… ${String(index + 1)}/${String(total)}`, percentOf(index, total));
    const checked = await checkShot(
      job,
      shot,
      sync?.shots.find((entry) => entry.shotId === shot.id),
    );
    if (!checked.ok) return checked;
    findings.set(shot.id, [...checked.value.findings]);
    if (checked.value.row !== undefined) rows.push(checked.value.row);
  }
  return ok({ findings, rows });
}

async function writeSheets(
  job: SceneJob,
  rows: readonly SheetShot[],
): Promise<Result<string[], StageError>> {
  const sheets: string[] = [];
  for (let start = 0; start < rows.length; start += SHEET_ROWS) {
    const file = `${FILES.qaFramesDir}/final/sheet-${String(start / SHEET_ROWS + 1)}.png`;
    const written = await writeContactSheet(
      job.ctx.projectDir,
      file,
      'Final review - one row per shot - t = local shot time',
      rows.slice(start, start + SHEET_ROWS),
    );
    if (!written.ok) return written;
    sheets.push(written.value);
  }
  return ok(sheets);
}

/** The batched critic: suspects become `critic` findings of their shots. */
async function critic(
  job: SceneJob,
  checked: Checked,
  sheets: readonly string[],
  notes: string[],
): Promise<Result<void, StageError>> {
  if (!job.settings.critic || !job.ctx.hasClaude || sheets.length === 0) return ok(undefined);
  job.ctx.step('Final review: frame critic', 62);
  const looked = new Set(checked.rows.map((row) => row.shotId));
  const shots = job.shots.filter((shot) => looked.has(shot.id));
  const suspects = await triage(job, shots, sheets, notes);
  if (!suspects.ok) return suspects;
  for (const suspect of suspects.value) {
    const list = checked.findings.get(suspect.shot);
    list?.push(finding('critic', 'error', `the frame critic flagged it: ${suspect.reason}`));
  }
  return ok(undefined);
}

/** Frame width the shot was checked at (the legibility rule scales with it). */
function renderWidth(checked: Checked, shotId: string): number {
  const render = checked.rows.find((row) => row.shotId === shotId)?.render;
  return render?.ok === true ? render.width : 640;
}

function fixRequest(shot: StoryboardShot): string {
  return `Final review of shot ${shot.id} (\`${shot.scene}\`): make every finding below go away with the smallest change. Keep what the shot must communicate: ${shot.intent}`;
}

/** One fix turn + re-QA per unlocked shot with confirmed findings; returns the fixed ids. */
async function fixShots(
  job: SceneJob,
  checked: Checked,
  notes: string[],
): Promise<Result<readonly string[], StageError>> {
  const targets = job.shots.filter(
    (shot) =>
      !job.locked.has(shot.id) && fixableFindings(checked.findings.get(shot.id) ?? []).length > 0,
  );
  if (targets.length === 0) return ok([]);
  if (!job.ctx.hasClaude) {
    notes.push('Claude is not connected: the findings were not fixed');
    return ok([]);
  }
  job.ctx.step(`Final review: fixing ${String(targets.length)} of ${String(job.shots.length)}`, 70);
  const fixJob: SceneJob = {
    ...job,
    settings: { ...job.settings, maxFixIterations: AUTO_FIX_ITERATIONS },
  };
  const ran = await runShotJobs(fixJob, {
    queue: FINAL_REVIEW_QUEUE,
    shots: targets,
    resume: false,
    verb: 'reviewed',
    commit: false,
    work: (shot) =>
      refineShot(fixJob, shot, {
        label: 'final',
        request: fixRequest(shot),
        requestFindings: fixableFindings(checked.findings.get(shot.id) ?? []),
        extraChecks: legibilityCheck(job, shot, renderWidth(checked, shot.id)),
      }),
  });
  return ran.ok ? ok(ran.value.ran) : ran;
}

function entryOf(
  job: SceneJob,
  shot: StoryboardShot,
  found: readonly QaFinding[],
  record: ShotBuildRecord | undefined,
  fixed: boolean,
  sync: SyncReport | undefined,
): FinalReviewShot {
  const locked = job.locked.has(shot.id);
  const findings =
    fixed && record !== undefined
      ? record.findings
      : [
          ...found,
          ...(record?.findings ?? []).filter((entry) => CARRIED_SOURCES.has(entry.source)),
        ];
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
async function mergeIntoReport(
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

function counts(entries: readonly FinalReviewShot[]): FinalReview['counts'] {
  const count = (test: (entry: FinalReviewShot) => boolean): number => entries.filter(test).length;
  return {
    ok: count((entry) => entry.status === 'ok'),
    warning: count((entry) => entry.status === 'warning'),
    failed: count((entry) => entry.status === 'failed'),
    locked: count((entry) => entry.locked),
    fixed: count((entry) => entry.autoFixed),
  };
}

export async function finalReview(
  job: SceneJob,
  trigger: FinalReview['trigger'],
): Promise<Result<FinalReviewOutcome, StageError>> {
  const { ctx } = job;
  const startedAt = ctx.now().toISOString();
  const notes: string[] = [];
  let sync: SyncReport | undefined;
  if (job.words === undefined) {
    notes.push('no timed words yet: sync was not checked');
  } else {
    ctx.step('Final review: sync check', 2);
    const report = await syncReport({
      projectDir: ctx.projectDir,
      frames: job.frames,
      signal: ctx.signal,
      now: () => ctx.now(),
    });
    if (!report.ok) return report;
    sync = report.value;
  }
  const checked = await checkAll(job, sync);
  if (!checked.ok) return checked;
  const sheets = await writeSheets(job, checked.value.rows);
  if (!sheets.ok) return sheets;
  const judged = await critic(job, checked.value, sheets.value, notes);
  if (!judged.ok) return judged;
  const fixed = await fixShots(job, checked.value, notes);
  if (!fixed.ok) return fixed;
  const report = await readScenesReport(ctx.projectDir);
  if (!report.ok) return report;
  const records = new Map(report.value.shots.map((record) => [record.shotId, record]));
  const fixedIds = new Set(fixed.value);
  const entries = job.shots.map((shot) =>
    entryOf(
      job,
      shot,
      checked.value.findings.get(shot.id) ?? [],
      records.get(shot.id),
      fixedIds.has(shot.id),
      sync,
    ),
  );
  const merged = await mergeIntoReport(job, entries);
  if (!merged.ok) return merged;
  const review: FinalReview = {
    version: FINAL_REVIEW_VERSION,
    trigger,
    startedAt,
    finishedAt: ctx.now().toISOString(),
    shots: entries,
    counts: counts(entries),
    notes,
  };
  const written = await writeProjectJson(
    ctx.projectDir,
    FILES.finalReview,
    finalReviewSchema,
    review,
  );
  if (!written.ok) return written;
  return ok({ review: written.value, sheets: sheets.value, sync });
}

/** "s03 ⚠: [legibility] …" lines of the shots left with findings. */
export function finalReviewWarnings(review: FinalReview): string[] {
  return review.shots
    .filter((entry) => entry.status !== 'ok')
    .map(
      (entry) =>
        `${entry.shotId} ${entry.status === 'failed' ? '✗' : '⚠'}${entry.locked ? ' (locked)' : ''}: ${entry.findings.map(formatFinding).join(' | ')}`,
    );
}
