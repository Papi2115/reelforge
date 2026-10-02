/** Text formatting shared by the commands: compact, line-oriented, easy for an LLM to parse. */
import type { Problem } from './project/files.js';

/** Seconds with two decimals and a unit: `2.50s`. */
export function seconds(value: number): string {
  return `${value.toFixed(2)}s`;
}

/** `2.50–4.20s` */
export function timeRange(from: number, to: number): string {
  return `${from.toFixed(2)}–${to.toFixed(2)}s`;
}

/** Signed offset: `+0.04s` / `-0.20s`. */
export function signedSeconds(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  return `${rounded >= 0 ? '+' : '-'}${Math.abs(rounded).toFixed(2)}s`;
}

export function plural(count: number, noun: string): string {
  return `${String(count)} ${noun}${count === 1 ? '' : 's'}`;
}

export function indent(text: string, prefix = '  '): string {
  return text
    .split('\n')
    .map((line) => (line === '' ? line : `${prefix}${line}`))
    .join('\n');
}

/** `error   storyboard.json shots[1].t1: t1 must be > t0` + an indented `fix:` line. */
export function formatProblem(problem: Problem): string {
  const where = problem.at === '' ? problem.file : `${problem.file} ${problem.at}`;
  return `${problem.severity.padEnd(7)} ${where}: ${problem.message}\n        fix: ${problem.fix}`;
}

export function countBySeverity(problems: readonly Problem[]): {
  errors: number;
  warnings: number;
} {
  const errors = problems.filter((problem) => problem.severity === 'error').length;
  return { errors, warnings: problems.length - errors };
}

/** Last line of most commands: what the outcome means and what to do next. */
export function verdictLine(problemCount: number, next: string): string {
  return problemCount === 0
    ? 'result: ok'
    : `result: ${plural(problemCount, 'problem')} found; ${next}`;
}
