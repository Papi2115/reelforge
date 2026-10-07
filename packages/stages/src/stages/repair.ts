/**
 * Validate -> one automatic repair turn -> validate again: the pattern every Claude stage uses for
 * its output files. The repair turn resumes the stage's session and gets the exact issues.
 */
import { err, ok, type Result } from '@reelforge/claude-bridge';
import { renderPrompt, type PromptId, type ValidationIssue } from '@reelforge/prompts';
import type { TemplateVars } from '@reelforge/prompts';
import type { SessionPurpose } from '@reelforge/shared';
import { stageError, type StageContext, type StageError } from '../types.js';
import { activeWorld, worldScope } from '../worlds.js';

export function formatIssue(issue: ValidationIssue): string {
  return `${issue.code}: ${issue.message}${issue.path === undefined ? '' : ` (at ${issue.path})`}`;
}

export function errorLines(issues: readonly ValidationIssue[]): string[] {
  return issues.filter((issue) => issue.severity === 'error').map(formatIssue);
}

export function warningLines(issues: readonly ValidationIssue[]): string[] {
  return issues.filter((issue) => issue.severity === 'warning').map(formatIssue);
}

/** Closes every unattended fix turn (real run Game B2 1: a fix turn ended with a question). */
export const NO_QUESTIONS =
  'Never ask the user a question; decide, apply the fix and finish with the report.';

/** `noQuestions`: projects in a world (built-in styles keep the text as it was). */
export function repairPrompt(
  file: string,
  problems: readonly string[],
  noQuestions = false,
): string {
  const close = noQuestions ? ` ${NO_QUESTIONS}` : '';
  return [
    `The file \`${file}\` you wrote does not pass the app's checks:`,
    ...problems.map((problem) => `- ${problem}`),
    '',
    `Fix \`${file}\` in place following the original rules of this task. Change nothing else, then reply with one line saying what you fixed.${close}`,
  ].join('\n');
}

/** The project is in a world: its fix and repair turns get `NO_QUESTIONS`. */
export function inWorld(ctx: Pick<StageContext, 'snapshot' | 'settings'>): boolean {
  const { project } = ctx.snapshot;
  if (project.status !== 'ok') return false;
  return activeWorld(project.value.style, worldScope(ctx.settings)) !== undefined;
}

export function render(id: PromptId, vars: TemplateVars): Result<string, StageError> {
  const rendered = renderPrompt(id, vars);
  if (rendered.ok) return rendered;
  const detail = JSON.stringify(rendered.error);
  return err(stageError('invalid-input', `cannot render the ${id} prompt: ${detail}`));
}

/** A check of a stage output: `problems` = error lines (empty = valid). */
export interface OutputCheck<T> {
  readonly value: T | undefined;
  readonly problems: readonly string[];
  readonly warnings: readonly string[];
}

export interface RepairLoop<T> {
  readonly ctx: StageContext;
  readonly prompt: PromptId;
  readonly purpose: SessionPurpose;
  /** File named in the repair prompt. */
  readonly file: string;
  readonly label: string;
  readonly check: () => Promise<OutputCheck<T>>;
}

export interface Repaired<T> {
  readonly value: T | undefined;
  readonly problems: readonly string[];
  readonly warnings: readonly string[];
  readonly repairs: number;
}

/** Checks the output; on problems runs ONE repair turn and checks again. */
export async function checkWithRepair<T>(
  loop: RepairLoop<T>,
): Promise<Result<Repaired<T>, StageError>> {
  const first = await loop.check();
  if (first.problems.length === 0) return ok({ ...first, repairs: 0 });
  loop.ctx.step(`Repairing ${loop.file}`);
  const turn = await loop.ctx.claude({
    prompt: loop.prompt,
    text: repairPrompt(loop.file, first.problems, inWorld(loop.ctx)),
    purpose: loop.purpose,
    newSession: false,
    label: `${loop.label} repair`,
  });
  if (!turn.ok) return turn;
  const second = await loop.check();
  return ok({ ...second, repairs: 1 });
}
