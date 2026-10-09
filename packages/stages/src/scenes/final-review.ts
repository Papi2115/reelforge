/**
 * Final review (PLAN.md#11.5): the quiet pass after "Scenes built", without any click. Code first
 * (sync report, lint, 3-frame renders, blank/cards/safe area, phone legibility) for every shot,
 * then ONE batched Haiku critic turn over the contact sheets of all shots, then at most one Opus
 * `scene-fix` per shot with confirmed findings (code findings and the critic's suspects) and a
 * re-QA. Locked shots and a short's end card are checked and reported only. Results: the scenes
 * report (latest status per shot) and `.reelforge/final-review.json`; nothing is committed per
 * shot (the stage makes one commit, "Final review: fixed N shots").
 */
import { ok, type Result } from '@reelforge/claude-bridge';
import {
  FINAL_REVIEW_VERSION,
  finalReviewSchema,
  isEndCardShot,
  type FinalReview,
  type QaFinding,
  type StoryboardShot,
  type SyncReport,
} from '@reelforge/shared';
import { continuityReviewNotes } from '../continuity.js';
import { shotEntry } from '../slop/comic-flow.js';
import { finalReviewDramaturgy } from '../dramaturgy.js';
import { readProjectText, writeProjectJson } from '../files.js';
import { FILES } from '../paths.js';
import type { StageError } from '../types.js';
import { finding, fixableFindings, formatFinding } from './checks.js';
import { checkShot, FINAL_CRITIC_PREFIX, legibilityCheck } from './final-checks.js';
import { counts, entryOf, mergeIntoReport } from './final-review-entries.js';
import type { SceneJob } from './job.js';
import { readScenesReport } from './report.js';
import { SHEET_ROWS, triage } from './review.js';
import { runShotJobs } from './run-shots.js';
import { writeContactSheet, type SheetShot } from './sheet.js';
import { refineShot } from './shot-job.js';
import { syncReport } from './sync-report.js';
import { reviewRepetitions } from '../repetition/stage.js';
import {
  breakthroughSpecs,
  repeatedBreakthroughFindings,
  type ShotBreakthroughs,
} from '../slop/breakthrough-intent.js';
import { sameCompositionFindings } from '../slop/guards.js';
import { popupSpecs, repeatedPopupFindings, type ShotPopups } from '../slop/popup-intent.js';
import { parseScene } from '../slop/source-text.js';
import type { ShotProgram } from '../slop/world-labels.js';

/** Work items of the final review's fixes in pipeline.json. */
export const FINAL_REVIEW_QUEUE = 'scenes-final-review';
/** Fix turns per shot in the automatic pass. */
const AUTO_FIX_ITERATIONS = 1;

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
  if (job.antiSlop !== undefined) {
    addSameComposition(job, findings, rows);
    const repeated = await addRepeatedPopups(job, findings);
    if (!repeated.ok) return repeated;
  }
  return ok({ findings, rows });
}

/**
 * Pop-up originality guard: a pop-up, or a world breakthrough with an intent (Comic: flashback,
 * spread), repeating an earlier one's intent or mechanism (⚠); and the world's film checks (Game B1:
 * number-only monotony).
 */
async function addRepeatedPopups(
  job: SceneJob,
  findings: Map<string, QaFinding[]>,
): Promise<Result<void, StageError>> {
  const shots: ShotPopups[] = [];
  const breakthroughs: ShotBreakthroughs[] = [];
  const programs: ShotProgram[] = [];
  const kinds = job.antiSlop?.spec?.breakthroughs ?? {};
  for (const shot of job.shots) {
    const text = await readProjectText(job.ctx.projectDir, shot.scene);
    if (!text.ok) return text;
    const program = text.value === undefined ? undefined : parseScene(text.value);
    if (program === undefined) continue;
    shots.push({ shotId: shot.id, popups: popupSpecs(program) });
    breakthroughs.push({ shotId: shot.id, specs: breakthroughSpecs(program, kinds) });
    programs.push({ shotId: shot.id, program, entry: shotEntry(shot) });
  }
  const film = job.antiSlop?.spec?.filmChecks?.(programs) ?? new Map<string, QaFinding[]>();
  for (const found of [
    repeatedPopupFindings(shots),
    repeatedBreakthroughFindings(breakthroughs),
    film,
  ]) {
    for (const [shotId, entries] of found) findings.get(shotId)?.push(...entries);
  }
  return ok(undefined);
}

/** Same-composition guard (PLAN.md#13.7): each shot's last review frame against its predecessor's. */
function addSameComposition(
  job: SceneJob,
  findings: Map<string, QaFinding[]>,
  rows: readonly SheetShot[],
): void {
  const keys = job.shots.map((shot) => {
    const render = rows.find((row) => row.shotId === shot.id)?.render;
    return { shot, frame: render?.ok === true ? render.frames.at(-1) : undefined };
  });
  for (const [shotId, found] of sameCompositionFindings(keys)) {
    findings.get(shotId)?.push(...found);
  }
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
  // A short's end card (PLAN.md#13.18) is the app's: the critic is not asked about it.
  const shots = job.shots.filter((shot) => looked.has(shot.id) && !isEndCardShot(shot));
  const suspects = await triage(job, shots, sheets, notes);
  if (!suspects.ok) return suspects;
  for (const suspect of suspects.value) {
    const list = checked.findings.get(suspect.shot);
    list?.push(finding('critic', 'error', `${FINAL_CRITIC_PREFIX}${suspect.reason}`));
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

/**
 * Confirmed findings worth a fix turn; with faster checks (ADR-027) a shot whose only errors are
 * legibility hints gets none (they stay ⚠ in the report).
 */
export function needsFinalFix(
  job: Pick<SceneJob, 'settings'>,
  findings: readonly QaFinding[],
): boolean {
  const errors = fixableFindings(findings);
  if (job.settings.skipLegibilityOnlyFixes !== true) return errors.length > 0;
  return errors.some((entry) => entry.source !== 'legibility');
}

/** One fix turn + re-QA per unlocked shot with confirmed findings; returns the fixed ids. */
async function fixShots(
  job: SceneJob,
  checked: Checked,
  notes: string[],
): Promise<Result<readonly string[], StageError>> {
  const targets = job.shots.filter(
    (shot) =>
      !job.locked.has(shot.id) &&
      !isEndCardShot(shot) && // a short's end card: its findings stay in the report
      needsFinalFix(job, checked.findings.get(shot.id) ?? []),
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
  // Pattern interrupts realised in the frames, open-loop warnings (PLAN.md#12.25-12.26).
  const { project } = ctx.snapshot;
  if (project.status === 'ok') {
    const drama = await finalReviewDramaturgy(
      ctx.projectDir,
      ctx.now(),
      project.value,
      job.shots,
      job.words,
    );
    if (!drama.ok) return drama;
    notes.push(...drama.value);
  }
  // Continuity links (PLAN.md#13.2): planned vs rendered; no links = no line.
  notes.push(...continuityReviewNotes(job.shots, entries));
  // Film-level repetition control (PLAN.md#12.23): read-only analysis, its count as a note.
  notes.push(...(await reviewRepetitions(ctx.projectDir, ctx.snapshot.project)));
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
