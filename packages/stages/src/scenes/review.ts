/**
 * Whole-video review (PLAN.md#7.6), the "Whole video" chat chips as named modes:
 * - `fix-what-looks-wrong`: 3 frames per shot → contact sheets → code checks + Haiku triage
 *   (suspect shots) → Sonnet fix plan (`{shot, change}`) → Opus scene-fix per shot → re-QA;
 * - `phone-legibility`: text-size check by code (scale ≥ 2, glyphs ≥ N px at 640 wide) + card
 *   checks → Opus fixes for the shots with findings → re-QA;
 * - `sync-check`: the sync report (#7.7) → fixes for shots with events off by > 150 ms → re-QA
 *   → the report again.
 * Fixed shots are stored in the scenes report and autocommitted ("Scene s03 fixed ✓").
 */
import { lintScene } from '@reelforge/engine';
import { ok, type Result } from '@reelforge/claude-bridge';
import { validatePlanReply, validateTriageReply } from '@reelforge/prompts';
import type { QaFinding, ShotSync, StoryboardShot, SyncReport } from '@reelforge/shared';
import { readProjectText } from '../files.js';
import { FILES } from '../paths.js';
import { render } from '../stages/repair.js';
import type { ReviewMode, StageError } from '../types.js';
import { cardFindings, formatFinding, lintFindings } from './checks.js';
import { programmaticCritique } from './critic.js';
import type { SceneJob } from './job.js';
import { REVIEW_QUEUE } from './queue.js';
import { runShotJobs } from './run-shots.js';
import { writeContactSheet, type SheetShot } from './sheet.js';
import { legibilityFindings } from './source-checks.js';
import { refineShot } from './shot-job.js';
import { renderShot } from './render.js';
import { syncFindings } from './sync.js';
import { syncReport } from './sync-report.js';

/** The chip texts (what the user clicked). */
export const REVIEW_REQUESTS: Readonly<Record<ReviewMode, string>> = {
  'fix-what-looks-wrong': 'Review the whole video and fix what looks wrong.',
  'phone-legibility': 'Make all on-screen text easier to read on a phone.',
  'sync-check': 'Check every visual lands on its spoken word.',
};

/** Rows per contact sheet of the review (one row per shot). */
const SHEET_ROWS = 8;

export interface ReviewSuspect {
  readonly shot: string;
  readonly reason: string;
}

export interface ReviewOutcome {
  readonly mode: ReviewMode;
  readonly suspects: readonly ReviewSuspect[];
  readonly fixed: readonly string[];
  readonly sheets: readonly string[];
  readonly sync: SyncReport | undefined;
  readonly notes: readonly string[];
}

/** 3 frames spread over the shot (local seconds). */
export function reviewTimes(duration: number): number[] {
  return [1 / 6, 1 / 2, 5 / 6].map((share) => Math.round(share * duration * 1000) / 1000);
}

interface Looked {
  readonly sheets: string[];
  readonly suspects: ReviewSuspect[];
  readonly findings: string[];
}

async function lookAtShots(
  job: SceneJob,
  shots: readonly StoryboardShot[],
): Promise<Result<Looked, StageError>> {
  const { ctx } = job;
  const rows: SheetShot[] = [];
  const suspects: ReviewSuspect[] = [];
  const findings: string[] = [];
  for (const shot of shots) {
    ctx.step(`Review: rendering ${shot.id}`);
    const times = reviewTimes(shot.t1 - shot.t0);
    const source = await readProjectText(ctx.projectDir, shot.scene);
    if (!source.ok) return source;
    const lint = lintFindings(lintScene(source.value ?? '', { filename: shot.scene }), shot.scene);
    const rendered = await renderShot(
      job.frames,
      { projectDir: ctx.projectDir, shotId: shot.id, times, cards: true },
      ctx.signal,
    );
    if (!rendered.ok) return rendered;
    const shotRender = rendered.value;
    rows.push({ shotId: shot.id, times, render: shotRender });
    const code: QaFinding[] = shotRender.ok ? [...lint, ...programmaticCritique(shotRender)] : lint;
    const reasons = shotRender.ok ? code.map(formatFinding) : [`fails: ${shotRender.error}`];
    if (reasons.length > 0) {
      suspects.push({ shot: shot.id, reason: reasons[0] ?? '' });
      findings.push(...reasons.map((reason) => `${shot.id}: ${reason}`));
    }
  }
  const sheets: string[] = [];
  for (let start = 0; start < rows.length; start += SHEET_ROWS) {
    const file = `${FILES.qaFramesDir}/review/sheet-${String(start / SHEET_ROWS + 1)}.png`;
    const written = await writeContactSheet(
      ctx.projectDir,
      file,
      'Whole video review - one row per shot - t = local shot time',
      rows.slice(start, start + SHEET_ROWS),
    );
    if (!written.ok) return written;
    sheets.push(written.value);
  }
  return ok({ sheets, suspects, findings });
}

function mergeSuspects(...lists: (readonly ReviewSuspect[])[]): ReviewSuspect[] {
  const merged = new Map<string, string[]>();
  for (const suspect of lists.flat()) {
    merged.set(suspect.shot, [...(merged.get(suspect.shot) ?? []), suspect.reason]);
  }
  return [...merged].map(([shot, reasons]) => ({ shot, reason: reasons.join('; ') }));
}

async function triage(
  job: SceneJob,
  shots: readonly StoryboardShot[],
  sheets: readonly string[],
  notes: string[],
): Promise<Result<ReviewSuspect[], StageError>> {
  const prompt = render('review-triage', {
    imagePaths: sheets.join(', '),
    shots: shots.map((shot) => ({ id: shot.id, intent: shot.intent })),
    styleId: job.styleId,
  });
  if (!prompt.ok) return prompt;
  const turn = await job.ctx.claude({
    prompt: 'review-triage',
    text: prompt.value,
    purpose: 'qa',
    newSession: true,
    label: 'review triage',
    commit: false,
    detached: true,
  });
  if (!turn.ok) return turn;
  const reply = validateTriageReply(turn.value.reply, { shotIds: shots.map((shot) => shot.id) });
  if (reply.value === undefined) {
    notes.push('the triage reply was not valid JSON; only the code checks were used');
    return ok([]);
  }
  return ok(reply.value.suspects);
}

async function plan(
  job: SceneJob,
  suspects: readonly ReviewSuspect[],
  findings: readonly string[],
  notes: string[],
): Promise<Result<Map<string, string>, StageError>> {
  const prompt = render('review-plan', {
    request: REVIEW_REQUESTS['fix-what-looks-wrong'],
    suspects,
    ...(findings.length === 0 ? {} : { findings: findings.join('\n') }),
  });
  if (!prompt.ok) return prompt;
  const turn = await job.ctx.claude({
    prompt: 'review-plan',
    text: prompt.value,
    purpose: 'main',
    newSession: true,
    label: 'review plan',
    commit: false,
    detached: true,
  });
  if (!turn.ok) return turn;
  const reply = validatePlanReply(turn.value.reply, { shotIds: job.shots.map((shot) => shot.id) });
  if (reply.value === undefined) {
    notes.push('the fix plan was not valid JSON; each suspect gets its reason as the fix request');
    return ok(new Map(suspects.map((suspect) => [suspect.shot, `Fix: ${suspect.reason}`])));
  }
  return ok(new Map(reply.value.fixes.map((fix) => [fix.shot, fix.change])));
}

async function fixShots(
  job: SceneJob,
  label: string,
  requests: ReadonlyMap<string, { request: string; findings: readonly QaFinding[] }>,
  extraChecks?: (source: string, shot: StoryboardShot) => QaFinding[],
): Promise<Result<string[], StageError>> {
  const shots = job.shots.filter((shot) => requests.has(shot.id));
  const ran = await runShotJobs(job, {
    queue: REVIEW_QUEUE,
    shots,
    resume: false,
    verb: 'fixed',
    work: (shot) => {
      const entry = requests.get(shot.id);
      return refineShot(job, shot, {
        label,
        request: entry?.request,
        requestFindings: entry?.findings ?? [],
        extraChecks: extraChecks === undefined ? undefined : (source) => extraChecks(source, shot),
      });
    },
  });
  return ran.ok ? ok([...ran.value.ran]) : ran;
}

async function fixWhatLooksWrong(
  job: SceneJob,
  shots: readonly StoryboardShot[],
): Promise<Result<ReviewOutcome, StageError>> {
  const notes: string[] = [];
  const looked = await lookAtShots(job, shots);
  if (!looked.ok) return looked;
  job.ctx.step('Review: triage');
  const flagged = await triage(job, shots, looked.value.sheets, notes);
  if (!flagged.ok) return flagged;
  const suspects = mergeSuspects(looked.value.suspects, flagged.value);
  const base = {
    mode: 'fix-what-looks-wrong' as const,
    suspects,
    sheets: looked.value.sheets,
    sync: undefined,
  };
  if (suspects.length === 0) return ok({ ...base, fixed: [], notes });
  job.ctx.step('Review: planning fixes');
  const changes = await plan(job, suspects, looked.value.findings, notes);
  if (!changes.ok) return changes;
  const requests = new Map(
    [...changes.value].map(([shot, change]) => [shot, { request: change, findings: [] }]),
  );
  const fixed = await fixShots(job, 'review', requests);
  return fixed.ok ? ok({ ...base, fixed: fixed.value, notes }) : fixed;
}

async function phoneLegibility(
  job: SceneJob,
  shots: readonly StoryboardShot[],
): Promise<Result<ReviewOutcome, StageError>> {
  const { ctx } = job;
  const check = (width: number) => (source: string, shot: StoryboardShot) =>
    legibilityFindings(source, shot.scene, {
      minScale: job.settings.minTextScale,
      minGlyphPx: job.settings.minGlyphPx,
      frameWidth: width,
    });
  const requests = new Map<string, { request: string; findings: readonly QaFinding[] }>();
  let width = 640;
  for (const shot of shots) {
    ctx.step(`Text size: ${shot.id}`);
    const source = await readProjectText(ctx.projectDir, shot.scene);
    if (!source.ok) return source;
    if (source.value === undefined) continue;
    const rendered = await renderShot(
      job.frames,
      { projectDir: ctx.projectDir, shotId: shot.id, times: [], cards: true },
      ctx.signal,
    );
    if (!rendered.ok) return rendered;
    const loaded = rendered.value;
    if (loaded.ok) width = loaded.width;
    const findings = [
      ...check(width)(source.value, shot),
      ...(loaded.ok ? cardFindings(loaded.cards) : []),
    ];
    if (findings.length > 0) {
      requests.set(shot.id, { request: REVIEW_REQUESTS['phone-legibility'], findings });
    }
  }
  const suspects = [...requests].map(([shot, entry]) => ({
    shot,
    reason: entry.findings.map(formatFinding).join('; '),
  }));
  const fixed = await fixShots(job, 'legibility', requests, check(width));
  if (!fixed.ok) return fixed;
  return ok({
    mode: 'phone-legibility',
    suspects,
    fixed: fixed.value,
    sheets: [],
    sync: undefined,
    notes: [],
  });
}

function syncRequests(
  job: SceneJob,
  report: SyncReport,
): Map<string, { request: string; findings: readonly QaFinding[] }> {
  const requests = new Map<string, { request: string; findings: readonly QaFinding[] }>();
  for (const shot of report.shots) {
    const range = job.shots.find((candidate) => candidate.id === shot.shotId);
    if (range === undefined || shot.problems === 0) continue;
    requests.set(shot.shotId, {
      request: `${REVIEW_REQUESTS['sync-check']} Make every event of this shot land within ±${String(report.toleranceMs)} ms of its spoken word.`,
      findings: syncFindings(shot.events, range),
    });
  }
  return requests;
}

async function syncCheck(
  job: SceneJob,
  shots: readonly StoryboardShot[],
): Promise<Result<ReviewOutcome, StageError>> {
  const { ctx } = job;
  const options = {
    projectDir: ctx.projectDir,
    frames: job.frames,
    signal: ctx.signal,
    shots: shots.map((shot) => shot.id),
    now: () => ctx.now(),
  };
  ctx.step('Sync report');
  const first = await syncReport(options);
  if (!first.ok) return first;
  const requests = syncRequests(job, first.value);
  const suspects = first.value.shots
    .filter((shot: ShotSync) => shot.problems > 0)
    .map((shot) => ({
      shot: shot.shotId,
      reason: `${String(shot.problems)} events off their words`,
    }));
  if (requests.size === 0) {
    return ok({
      mode: 'sync-check',
      suspects,
      fixed: [],
      sheets: [],
      sync: first.value,
      notes: [],
    });
  }
  const fixed = await fixShots(job, 'sync', requests);
  if (!fixed.ok) return fixed;
  ctx.step('Sync report (after the fixes)');
  const after = await syncReport(options);
  if (!after.ok) return after;
  return ok({
    mode: 'sync-check',
    suspects,
    fixed: fixed.value,
    sheets: [],
    sync: after.value,
    notes: [],
  });
}

/** Runs one review mode over `shots` (the "Whole video" scope = every storyboard shot). */
export function reviewVideo(
  job: SceneJob,
  mode: ReviewMode,
  shots: readonly StoryboardShot[],
): Promise<Result<ReviewOutcome, StageError>> {
  switch (mode) {
    case 'fix-what-looks-wrong':
      return fixWhatLooksWrong(job, shots);
    case 'phone-legibility':
      return phoneLegibility(job, shots);
    case 'sync-check':
      return syncCheck(job, shots);
  }
}
