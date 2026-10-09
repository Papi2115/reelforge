/**
 * One shot of "Scenes built" (PLAN.md#7.4, §4.4): the scene-build turn (Opus, fresh session),
 * missing props (built as project props in kit-ext → the shot is built again with them; a prop
 * that cannot be built leaves a fallback and ⚠), then QA rounds by code and scene-fix turns with
 * the findings, at most `maxFixIterations`. The result is ✓ (clean), ⚠ (findings left, missing
 * props) or ✗ (lint/runtime error persisted, no scene).
 * `refineShot` is the same verify/fix loop, used by the whole-video review. A short's end card
 * never gets a fix turn here, whoever asks (PLAN.md#13.18).
 */
import { ok, type Result } from '@reelforge/claude-bridge';
import { parseMissing, sceneCharacterVars } from '@reelforge/prompts';
import {
  isEndCardShot,
  SHOT_STATUS_SYMBOLS,
  type QaFinding,
  type ShotBuildRecord,
  type ShotBuildStatus,
  normalizePropName,
  type StoryboardShot,
} from '@reelforge/shared';
import { sceneContinuityVars } from '../continuity.js';
import { sceneDramaturgyVars } from '../dramaturgy.js';
import { readProjectText } from '../files.js';
import { sceneLookVars } from '../looks.js';
import { sceneShortPromptVars } from '../shorts/scene-checks.js';
import { fixWorldPromptVars, sceneWorldPromptVars } from '../worlds.js';
import { projectPropNames } from '../props/builder.js';
import { provideSceneRoles } from '../roles/scene-roles.js';
import { render } from '../stages/repair.js';
import type { StageError } from '../types.js';
import { fatalFindings, finding, fixableFindings, formatFinding } from './checks.js';
import type { SceneJob } from './job.js';
import { closingQuestion, questionFinding } from './fix-reply.js';
import { qaRound, type QaResult } from './qa.js';
import { researchExcerpt, shotFocus } from './research-excerpt.js';
import { shotAssetVars } from './shot-assets.js';
import { unknownKitCalls } from './source-checks.js';
import { missingPropsOutcome } from './tools.js';
import { variantFixHint, variantTag, variantVars, type ShotVariantBrief } from './variant-brief.js';

/** Turn failures that end the shot (✗) instead of the whole stage. */
const SHOT_LEVEL_FAILURES = new Set<StageError['kind']>(['claude', 'validation', 'invalid-input']);

export type { ShotVariantBrief } from './variant-brief.js';

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

/** The shot as the build prompt shows it: annotation plan and asset needs go in their sections. */
function shotForPrompt(shot: StoryboardShot): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(shot).filter(
      ([key]) =>
        key !== 'annotations' &&
        key !== 'assetNeeds' &&
        key !== 'interrupt' &&
        key !== 'continuity',
    ),
  );
}

/** The storyboard's annotation plan as hint lines (PLAN.md#11.8); undefined when there is none. */
export function annotationPlanText(shot: StoryboardShot): string | undefined {
  const plans = shot.annotations ?? [];
  if (plans.length === 0) return undefined;
  return plans
    .map((plan) => {
      const target = plan.target === undefined ? '' : ` on ${plan.target}`;
      const text = plan.text === undefined ? '' : `, text "${plan.text}"`;
      return `- "${plan.phrase}" (${plan.reason}): ${plan.kind}${target}${text}`;
    })
    .join('\n');
}

/** The build turn's reply, or a ✗ finding when the turn failed for this shot only. */
async function buildTurn(
  job: SceneJob,
  shot: StoryboardShot,
  newProps: readonly string[] = [],
  variant?: ShotVariantBrief,
): Promise<Result<{ reply: string } | { failure: QaFinding }, StageError>> {
  const prompt = render('scene-build', {
    shotId: shot.id,
    shotScene: shot.scene,
    shotJson: shotForPrompt(shot),
    shotWords: shotWords(job, shot),
    neighbours: neighbours(job, shot),
    styleId: job.styleId,
    ...sceneLookVars(job.lookMode, shot, job.looks),
    // A world's wording and craft brief (PLAN.md#13.6); built-in styles: nothing.
    ...sceneWorldPromptVars(job.world, shot),
    annotationPlan: annotationPlanText(shot),
    ...sceneDramaturgyVars(job.dramaturgy, job.shots, shot),
    ...sceneContinuityVars(job.shots, shot),
    ...sceneCharacterVars(job.characters, shot),
    ...shotAssetVars(shot, job.research, job.assets),
    ...(newProps.length === 0
      ? {}
      : { newProps: newProps.map((name) => `kit.props.${name}`).join(', ') }),
    ...variantVars(variant),
    ...sceneShortPromptVars(job.short), // a short's retention rules (PLAN.md#13.18)
    // Taste profile (PLAN.md#12.13), not for variants: they must stay genuinely different.
    ...(variant === undefined ? { tasteProfile: job.ctx.taste?.profile() } : {}),
  });
  if (!prompt.ok) return prompt;
  const turn = await job.ctx.claude({
    prompt: 'scene-build',
    text: prompt.value,
    purpose: 'main',
    newSession: true,
    label: `scene-build ${shot.id}${variantTag(variant)}`,
    commit: false,
    detached: true,
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
): Promise<Result<{ failure?: string; question?: string }, StageError>> {
  const prompt = render('scene-fix', {
    scope: 'Shot',
    shotIds: shot.id,
    request,
    ...(findings.length === 0 ? {} : { critic: findings.map(formatFinding).join('\n') }),
    // Facts come from the research notes, not a contradicting intent (real run Comic 1).
    research: researchExcerpt(job.researchNotes, shotFocus(shot, job.words)),
    // A fix keeps the shot's continuity link intact (PLAN.md#13.2); no link = the v1 text.
    ...sceneContinuityVars(job.shots, shot),
    // ...and its world's craft (PLAN.md#13.6); built-in styles: nothing.
    ...fixWorldPromptVars(job.world, shot, job.looks),
    // Nobody answers an unattended fix turn (real run Game B2 1); built-in styles: as before.
    ...(job.world === undefined ? {} : { noQuestions: true }),
  });
  if (!prompt.ok) return prompt;
  const turn = await job.ctx.claude({
    prompt: 'scene-fix',
    text: prompt.value,
    purpose: 'main',
    newSession: true,
    label,
    commit: false,
    detached: true,
  });
  if (turn.ok) {
    const question = closingQuestion(turn.value.reply);
    return ok(question === undefined ? {} : { question });
  }
  return SHOT_LEVEL_FAILURES.has(turn.error.kind) ? ok({ failure: turn.error.message }) : turn;
}

export interface RefineOptions {
  /** QA sheet label prefix (`build`, `review`). */
  readonly label: string;
  /** A first fix turn with this request (review), counted as a fix iteration. */
  readonly request?: string | undefined;
  /** Findings sent with that first request. */
  readonly requestFindings?: readonly QaFinding[];
  readonly missingProps?: readonly string[];
  /** Project props built for this shot (kit-ext). */
  readonly builtProps?: readonly string[];
  readonly notes?: readonly string[];
  /** Extra code checks per round (e.g. phone legibility). */
  readonly extraChecks?: ((source: string) => QaFinding[]) | undefined;
  /** Appended to every QA fix request (a variant: which file to edit). */
  readonly fixHint?: string | undefined;
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
      `missing prop: ${name} (the kit has no "${name}" and it could not be built as a project prop; the shot uses what exists)`,
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
    ...(options.builtProps === undefined || options.builtProps.length === 0
      ? {}
      : { builtProps: [...options.builtProps] }),
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
  // A short's end card (PLAN.md#13.18) is the app's: QA by code only, never a fix turn.
  const max = isEndCardShot(shot) ? 0 : job.settings.maxFixIterations;
  const notes = [...(options.notes ?? [])];
  const asked: QaFinding[] = [];
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
    if (failed.value.failure !== undefined) notes.push(`fix turn failed: ${failed.value.failure}`);
    if (failed.value.question !== undefined) asked.push(questionFinding(failed.value.question));
  }
  for (let round = 0; ; round += 1) {
    job.ctx.step(`${shot.id}: QA ${options.label} round ${String(round + 1)}`);
    const qa = await qaRound(job, shot, `${options.label}-r${String(round)}`, options.extraChecks);
    if (!qa.ok) return qa;
    const errors = fixableFindings(qa.value.findings);
    if (errors.length === 0 || fixes >= max) {
      return ok(record(job, shot, qa.value, fixes, { ...options, notes }, asked));
    }
    fixes += 1;
    const hint = options.fixHint === undefined ? '' : ` ${options.fixHint}`;
    const request = `${fixRequest(shot, fixes, max)}${hint}`;
    const tag = options.fixHint === undefined ? '' : `${options.label} `;
    const failed = await fixTurn(
      job,
      shot,
      request,
      errors,
      `scene-fix ${shot.id} ${tag}${String(fixes)}`,
    );
    if (!failed.ok) return failed;
    if (failed.value.question !== undefined) asked.push(questionFinding(failed.value.question));
    if (failed.value.failure !== undefined) {
      notes.push(`fix turn failed: ${failed.value.failure}`);
      return ok(record(job, shot, qa.value, fixes, { ...options, notes }, asked));
    }
  }
}

/**
 * Props named on the reply's `MISSING:` line or called as `kit.<kind>.X` but neither in the kit
 * nor in the project's kit-ext (environments/effects cannot be built: they stay as reported).
 */
async function missingProps(job: SceneJob, shot: StoryboardShot, reply: string): Promise<string[]> {
  const source = await readProjectText(job.ctx.projectDir, shot.scene);
  const project = await projectPropNames(job.ctx.projectDir);
  const kit = { ...job.kitNames, props: new Set([...job.kitNames.props, ...project]) };
  const called =
    source.ok && source.value !== undefined
      ? unknownKitCalls(source.value, kit).map((call) => call.name)
      : [];
  const named = parseMissing(reply).filter(
    (name) => !kit.props.has(name) && !kit.props.has(normalizePropName(name) ?? name),
  );
  return [...new Set([...named, ...called])];
}

/** Builds the missing props (or asks the custom handler): built kit names and failed names. */
async function provideProps(
  job: SceneJob,
  shot: StoryboardShot,
  names: readonly string[],
): Promise<Result<{ built: readonly string[]; failed: readonly string[] }, StageError>> {
  if (job.onMissingProps !== undefined) {
    return ok(missingPropsOutcome(names, await job.onMissingProps(names, shot)));
  }
  job.ctx.step(`${shot.id}: building props ${names.join(', ')}`);
  return job.props.ensureNames(names, shot);
}

/** Builds a shot (or, with `variant`, one alternative version into `shot.scene`) and QA's it. */
export async function buildShot(
  job: SceneJob,
  shot: StoryboardShot,
  variant?: ShotVariantBrief,
): Promise<Result<ShotBuildRecord, StageError>> {
  const label = variant === undefined ? 'build' : `v${String(variant.index)}-build`;
  const fixHint = variant === undefined ? undefined : variantFixHint(shot, variant);
  job.ctx.step(
    variant === undefined
      ? `${shot.id}: building the scene`
      : `${shot.id}: building variant ${String(variant.index)} (${variant.direction.label})`,
  );
  let built = await buildTurn(job, shot, [], variant);
  if (!built.ok) return built;
  if ('failure' in built.value) {
    return ok(record(job, shot, undefined, 0, { label }, [built.value.failure]));
  }
  let missing = await missingProps(job, shot, built.value.reply);
  const notes: string[] = [];
  let builtProps: readonly string[] = [];
  if (missing.length > 0) {
    const provided = await provideProps(job, shot, missing);
    if (!provided.ok) return provided;
    builtProps = provided.value.built;
    const failed = provided.value.failed;
    notes.push(
      `missing props ${missing.join(', ')}: built ${builtProps.join(', ') || 'none'}${failed.length > 0 ? `, could not build ${failed.join(', ')}` : ''}`,
    );
    if (builtProps.length > 0) {
      built = await buildTurn(job, shot, builtProps, variant);
      if (!built.ok) return built;
      if ('failure' in built.value) {
        const options = { label, notes, builtProps };
        return ok(record(job, shot, undefined, 0, options, [built.value.failure]));
      }
      // A prop that could not be built stays missing even when the new reply omits it.
      missing = [...new Set([...failed, ...(await missingProps(job, shot, built.value.reply))])];
    } else {
      missing = [...failed];
    }
  }
  // Roles the scene calls by id that nobody has yet (PLAN.md#12.20): built before its QA.
  const roles = await provideSceneRoles(job, shot);
  if (!roles.ok) return roles;
  notes.push(...roles.value);
  return refineShot(job, shot, { label, missingProps: missing, builtProps, notes, fixHint });
}

export function commitSubject(
  shot: StoryboardShot,
  status: ShotBuildStatus,
  verb = 'built',
): string {
  return `Scene ${shot.id} ${verb} ${SHOT_STATUS_SYMBOLS[status]}`;
}
