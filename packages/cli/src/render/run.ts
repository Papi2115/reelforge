/**
 * Shared flow of the rendering commands (frames, contact-sheet, render-shot, anchors): lint every
 * scene first (errors block that shot), render the rest in one browser, and turn the results into
 * a flat list of issues (blank frames, card QA, console errors, load failures).
 */
import {
  cardProblems,
  formatCardDiagnostics,
  formatDiagnostics,
  hasErrors,
  lintScene,
} from '@reelforge/engine';
import type { LintDiagnostic } from '@reelforge/engine';
import { UsageError } from '../errors.js';
import { plural, seconds } from '../format.js';
import type { RenderSetup, ShotPlan } from '../project/shots.js';
import {
  blankFrameNote,
  openRenderSession,
  type RenderOptions,
  type ShotRender,
} from './session.js';

export interface RenderJob {
  readonly plan: ShotPlan;
  /** Local shot times. */
  readonly times: readonly number[];
}

export interface ShotOutcome {
  readonly plan: ShotPlan;
  readonly lint: readonly LintDiagnostic[];
  /** Absent when lint errors blocked rendering. */
  readonly render: ShotRender | undefined;
}

export async function renderShots(
  setup: RenderSetup,
  jobs: readonly RenderJob[],
  options: Pick<RenderOptions, 'cards'>,
): Promise<ShotOutcome[]> {
  const linted = jobs.map((job) => ({
    job,
    lint: lintScene(job.plan.source, { filename: job.plan.file }),
  }));
  if (linted.every(({ lint }) => hasErrors(lint))) {
    return linted.map(({ job, lint }) => ({ plan: job.plan, lint, render: undefined }));
  }
  const session = await openRenderSession(setup);
  try {
    const outcomes: ShotOutcome[] = [];
    for (const { job, lint } of linted) {
      const render = hasErrors(lint)
        ? undefined
        : await session.render(job.plan, { times: job.times, cards: options.cards });
      outcomes.push({ plan: job.plan, lint, render });
    }
    return outcomes;
  } finally {
    await session.close();
  }
}

/** Shot length in seconds. */
export function shotDuration(plan: ShotPlan): number {
  return plan.t1 - plan.t0;
}

/** Last renderable local time: one frame before the shot ends. */
export function lastFrameTime(plan: ShotPlan, fps: number): number {
  return Math.max(0, Math.floor((shotDuration(plan) - 1 / fps) * 100) / 100);
}

/** `count` local times spread over the shot (segment centres), rounded to 0.01 s. */
export function spreadTimes(plan: ShotPlan, count: number): number[] {
  const duration = shotDuration(plan);
  return Array.from(
    { length: count },
    (_, index) => Math.round((((index + 0.5) * duration) / count) * 100) / 100,
  );
}

/** Rejects local times outside the shot with the valid range in the message. */
export function assertTimesInShot(plan: ShotPlan, times: readonly number[], fps: number): void {
  const duration = shotDuration(plan);
  const outside = times.find((t) => t >= duration);
  if (outside === undefined) return;
  throw new UsageError(
    `--at ${String(outside)}: shot ${plan.id} is ${seconds(duration)} long; use local shot times from 0 to ${String(lastFrameTime(plan, fps))}`,
  );
}

export interface ShotIssue {
  readonly kind: 'lint' | 'load' | 'blank-frame' | 'card' | 'console';
  readonly message: string;
}

export function shotIssues(outcome: ShotOutcome): ShotIssue[] {
  const lintErrors = outcome.lint.filter((diagnostic) => diagnostic.severity === 'error');
  const issues: ShotIssue[] = lintErrors.length
    ? [
        {
          kind: 'lint',
          message: `${plural(lintErrors.length, 'lint error')} in ${outcome.plan.file} (not rendered):\n${formatDiagnostics(outcome.plan.file, lintErrors)}`,
        },
      ]
    : [];
  const render = outcome.render;
  if (!render) return issues;
  for (const error of render.errors) issues.push({ kind: 'console', message: error });
  if (!render.ok) return [...issues, { kind: 'load', message: render.error }];
  for (const frame of render.frames) {
    const note = blankFrameNote(frame.stats);
    if (note) issues.push({ kind: 'blank-frame', message: `t=${seconds(frame.t)} ${note}` });
  }
  // Info records (annotations landing on their phrase) are not problems.
  for (const card of cardProblems(render.cards)) {
    issues.push({ kind: 'card', message: formatCardDiagnostics([card]) });
  }
  return issues;
}

/** The QA block printed under a rendered shot. */
export function formatQa(outcome: ShotOutcome, issues: readonly ShotIssue[]): string {
  const lines: string[] = [];
  const of = (kind: ShotIssue['kind']): ShotIssue[] =>
    issues.filter((issue) => issue.kind === kind);
  const render = outcome.render;
  if (render?.ok) {
    const cards = of('card');
    lines.push(
      cards.length === 0
        ? 'text cards: ok (no overlaps, all inside the safe area; annotation targets on screen)'
        : `text cards: ${plural(cards.length, 'problem')}`,
      ...cards.map((issue) => `  ${issue.message}`),
    );
  }
  const consoleErrors = of('console');
  if (render) {
    lines.push(
      consoleErrors.length === 0
        ? 'console errors: none'
        : `console errors: ${String(consoleErrors.length)}`,
      ...consoleErrors.map((issue) => `  ${issue.message}`),
    );
  }
  for (const issue of [...of('lint'), ...of('load')]) {
    lines.push(issue.kind === 'load' ? `scene failed: ${issue.message}` : issue.message);
  }
  const warnings = outcome.lint.filter((diagnostic) => diagnostic.severity === 'warning');
  if (warnings.length > 0) {
    lines.push(
      `lint: ${plural(warnings.length, 'warning')}`,
      formatDiagnostics(outcome.plan.file, warnings),
    );
  }
  return lines.join('\n');
}
