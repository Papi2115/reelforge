/** Lint diagnostics for scene modules: rule ids, shape, ordering and text formatting. */
import type { AnyNode } from 'acorn';

export const LINT_RULES = [
  'parse-error',
  'no-wall-clock',
  'no-random',
  'no-timers',
  'no-network',
  'no-import',
  'no-eval',
  'no-node',
  'no-host-globals',
  'no-storage',
  'no-css-animation',
  'no-dynamic-global-member',
  'scene-contract',
  'no-module-state-in-update',
  'no-incremental-update',
  'camera-api',
  'prop-contract',
  'no-module-state-in-prop',
  'lettering-options',
  'kit-page-not-added',
] as const;
export type LintRule = (typeof LINT_RULES)[number];

export type LintSeverity = 'error' | 'warning';

export interface LintDiagnostic {
  readonly rule: LintRule;
  /** `error` blocks loading the scene; `warning` is advice the author should read. */
  readonly severity: LintSeverity;
  /** 1-based line. */
  readonly line: number;
  /** 1-based column. */
  readonly column: number;
  /** What is wrong and why it matters for deterministic rendering. */
  readonly message: string;
  /** How to fix it, phrased as an instruction. */
  readonly fix: string;
}

/** Records a diagnostic at the start of `node`. */
export type Report = (
  node: AnyNode,
  details: {
    readonly rule: LintRule;
    readonly message: string;
    readonly fix: string;
    readonly severity?: LintSeverity;
  },
) => void;

export function compareDiagnostics(first: LintDiagnostic, second: LintDiagnostic): number {
  return (
    first.line - second.line ||
    first.column - second.column ||
    first.rule.localeCompare(second.rule) ||
    first.message.localeCompare(second.message)
  );
}

/** Sorted, without exact duplicates (same rule, position and message). */
export function normalizeDiagnostics(diagnostics: readonly LintDiagnostic[]): LintDiagnostic[] {
  const seen = new Set<string>();
  const result: LintDiagnostic[] = [];
  for (const diagnostic of [...diagnostics].sort(compareDiagnostics)) {
    const key = `${diagnostic.rule}:${String(diagnostic.line)}:${String(diagnostic.column)}:${diagnostic.message}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(diagnostic);
  }
  return result;
}

export function hasErrors(diagnostics: readonly LintDiagnostic[]): boolean {
  return diagnostics.some((diagnostic) => diagnostic.severity === 'error');
}

/** `file:line:col  error  rule  message` + an indented `fix:` line, one block per diagnostic. */
export function formatDiagnostics(file: string, diagnostics: readonly LintDiagnostic[]): string {
  return diagnostics
    .map(
      (diagnostic) =>
        `${file}:${String(diagnostic.line)}:${String(diagnostic.column)}  ${diagnostic.severity}  ${diagnostic.rule}  ${diagnostic.message}\n    fix: ${diagnostic.fix}`,
    )
    .join('\n');
}
