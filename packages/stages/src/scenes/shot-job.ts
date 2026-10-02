/**
 * One shot of "Scenes built" (PLAN.md#7.4, §4.4): the scene-build turn (Opus, fresh session),
 * missing props (the handler decides: kit extended → build again, else ⚠), then QA rounds by
 * code and scene-fix turns with the findings, at most `maxFixIterations`. The result is ✓ (clean),
 * ⚠ (findings left, missing props) or ✗ (lint/runtime error persisted, no scene).
 * `refineShot` is the same verify/fix loop, used by the whole-video review.
 */
import { ok, type Result } from '@reelforge/claude-bridge';
import { parseMissing } from '@reelforge/prompts';
import {
  SHOT_STATUS_SYMBOLS,
  type QaFinding,
  type ShotBuildRecord,
  type ShotBuildStatus,
  type StoryboardShot,
} from '@reelforge/shared';
import { readProjectText } from '../files.js';
import { render } from '../stages/repair.js';
import type { StageError } from '../types.js';
import { fatalFindings, finding, fixableFindings, formatFinding } from './checks.js';
import type { SceneJob } from './job.js';
import { qaRound, type QaResult } from './qa.js';
import { unknownKitNames } from './source-checks.js';

/** Turn failures that end the shot (✗) instead of the whole stage. */
const SHOT_LEVEL_FAILURES = new Set<StageError['kind']>(['claude', 'validation', 'invalid-input']);

function shotWords(
  job: SceneJob,
  shot: StoryboardShot,
): { text: string; t: number; tEnd: number }[] {
  return (job.words?.words ?? [])
    .filter((word) => word.t >= shot.t0 && word.t < shot.t1)
    .map((word) => ({ text: word.text, t: word.t, tEnd: word.tEnd }));
}

function neighbours(job: SceneJob, shot: StoryboardShot): object[] {
  const index = job.shots.findIndex((candidate) => candidate.id === shot.id);
  return [job.shots[index - 1], job.shots[index + 1]].flatMap((candidate) =>
    candidate === undefined
      ? []
      : [{ id: candidate.id, treatment: candidate.treatment, intent: candidate.intent }],
  );
}

/** The build turn's reply, or a ✗ finding when the turn failed for this shot only. */
async function buildTurn(
  job: SceneJob,
  shot: StoryboardShot,
): Promise<Result<{ reply: string } | { failure: QaFinding }, StageError>> {
  const prompt = render('scene-build', {
    shotId: shot.id,
    shotScene: shot.scene,
    shotJson: shot,
    shotWords: shotWords(job, shot),
    neighbours: neighbours(job, shot),
    styleId: job.styleId,
  });
  if (!prompt.ok) return prompt;
  const turn = await job.ctx.claude({
    prompt: 'scene-build',
    text: prompt.value,
    purpose: 'main',
    newSession: true,
    label: `scene-build ${shot.id}`,
    commit: false,
    resumeAfterLimit: false,
  });
  if (turn.ok) return ok({ reply: turn.value.reply });
  if (!SHOT_LEVEL_FAILURES.has(turn.error.kind)) return turn;
  return ok({ failure: finding('claude', 'error', turn.error.message, { fatal: true }) });
}

export function fixRequest(shot: StoryboardShot, iteration: number, max: number): string {
  return `QA fix ${String(iteration)}/${String(max)} for shot ${shot.id} (\`${shot.scene}\`): make every finding below go away. Keep what the shot must communicate: ${shot.intent}`;
}

async function fixTurn(
  job: SceneJob,
  shot: StoryboardShot,
  request: string,
  findings: readonly QaFinding[],
  label: string,
): Promise<Result<string | undefined, StageError>> {
  const prompt = render('scene-fix', {
    scope: 'Shot',
    shotIds: shot.id,
    request,
    ...(findings.length === 0 ? {} : { critic: findings.map(formatFinding).join('\n') }),
  });
  if (!prompt.ok) return prompt;
  const turn = await job.ctx.claude({
    prompt: 'scene-fix',
    text: prompt.value,
    purpose: 'main',
    newSession: true,
    label,
    commit: false,
    resumeAfterLimit: false,
  });
  if (turn.ok) return ok(undefined);
  return SHOT_LEVEL_FAILURES.has(turn.error.kind) ? ok(turn.error.message) : turn;
}

export interface RefineOptions {
  /** QA sheet label prefix (`build`, `review`). */
  readonly label: string;
  /** A first fix turn with this request (review), counted as a fix iteration. */
  readonly request?: string | undefined;
  /** Findings sent with that first request. */
  readonly requestFindings?: readonly QaFinding[];
  readonly missingProps?: readonly string[];
  readonly notes?: readonly string[];
  /** Extra code checks per round (e.g. phone legibility). */
  readonly extraChecks?: ((source: string) => QaFinding[]) | undefined;
}

function statusOf(findings: readonly QaFinding[]): ShotBuildStatus {
  if (fatalFindings(findings).length > 0) return 'failed';
  return findings.length > 0 ? 'warning' : 'ok';
}

function missingPropFindings(names: readonly string[]): QaFinding[] {
  return names.map((name) =>
    finding(
      'missing-prop',
      'warning',
      `missing prop: ${name} (the kit has no "${name}"; the shot uses what exists. Extending the kit is a repo change, not a project edit)`,
    ),
  );
}

function record(
  job: SceneJob,
  shot: StoryboardShot,
  qa: QaResult | undefined,
  fixes: number,
  options: RefineOptions,
  extraFindings: readonly QaFinding[] = [],
): ShotBuildRecord {
  const missing = options.missingProps ?? [];
  const findings = [...extraFindings, ...(qa?.findings ?? []), ...missingPropFindings(missing)];
  return {
    shotId: shot.id,
    scene: shot.scene,
    status: statusOf(findings),
    findings,
    fixIterations: fixes,
    missingProps: [...missing],
    critic: [...(qa?.verdicts ?? [])],
    ...(qa?.sheet === undefined ? {} : { contactSheet: qa.sheet }),
    notes: [...(options.notes ?? []), ...(qa?.notes ?? [])],
    updatedAt: job.ctx.now().toISOString(),
  };
}

/** (Optional request turn) → QA → fix with the findings → QA …, ≤ maxFixIterations turns. */
export async function refineShot(
  job: SceneJob,
  shot: StoryboardShot,
  options: RefineOptions,
): Promise<Result<ShotBuildRecord, StageError>> {
  const max = job.settings.maxFixIterations;
  const notes = [...(options.notes ?? [])];
  let fixes = 0;
  if (options.request !== undefined && max > 0) {
    fixes += 1;
    const failed = await fixTurn(
      job,
      shot,
      options.request,
      options.requestFindings ?? [],
      `${options.label} ${shot.id}`,
    );
    if (!failed.ok) return failed;
    if (failed.value !== undefined) notes.push(`fix turn failed: ${failed.value}`);
  }
  for (let round = 0; ; round += 1) {
    job.ctx.step(`${shot.id}: QA ${options.label} round ${String(round + 1)}`);
    const qa = await qaRound(job, shot, `${options.label}-r${String(round)}`, options.extraChecks);
    if (!qa.ok) return qa;
    const errors = fixableFindings(qa.value.findings);
    if (errors.length === 0 || fixes >= max) {
      return ok(record(job, shot, qa.value, fixes, { ...options, notes }));
    }
    fixes += 1;
    const request = fixRequest(shot, fixes, max);
    const failed = await fixTurn(
      job,
      shot,
      request,
      errors,
      `scene-fix ${shot.id} ${String(fixes)}`,
    );
    if (!failed.ok) return failed;
    if (failed.value !== undefined) {
      notes.push(`fix turn failed: ${failed.value}`);
      return ok(record(job, shot, qa.value, fixes, { ...options, notes }));
    }
  }
}

/** Props named on the reply's `MISSING:` line or called but absent from the kit. */
async function missingProps(job: SceneJob, shot: StoryboardShot, reply: string): Promise<string[]> {
  const source = await readProjectText(job.ctx.projectDir, shot.scene);
  const called =
    source.ok && source.value !== undefined ? unknownKitNames(source.value, job.kitNames) : [];
  return [...new Set([...parseMissing(reply), ...called])];
}

export async function buildShot(
  job: SceneJob,
  shot: StoryboardShot,
): Promise<Result<ShotBuildRecord, StageError>> {
  job.ctx.step(`${shot.id}: building the scene`);
  let built = await buildTurn(job, shot);
  if (!built.ok) return built;
  if ('failure' in built.value) {
    return ok(record(job, shot, undefined, 0, { label: 'build' }, [built.value.failure]));
  }
  let missing = await missingProps(job, shot, built.value.reply);
  const notes: string[] = [];
  if (missing.length > 0) {
    const decision = await job.onMissingProps(missing, shot);
    notes.push(`missing props ${missing.join(', ')}: kit extension ${decision}`);
    if (decision === 'added') {
      built = await buildTurn(job, shot);
      if (!built.ok) return built;
      if ('failure' in built.value) {
        return ok(
          record(job, shot, undefined, 0, { label: 'build', notes }, [built.value.failure]),
        );
      }
      missing = await missingProps(job, shot, built.value.reply);
    }
  }
  return refineShot(job, shot, { label: 'build', missingProps: missing, notes });
}

export function commitSubject(
  shot: StoryboardShot,
  status: ShotBuildStatus,
  verb = 'built',
): string {
  return `Scene ${shot.id} ${verb} ${SHOT_STATUS_SYMBOLS[status]}`;
}
