/**
 * Determinism lint for scene modules (PLAN.md#2.6, CLAUDE.md §3.2): parses the scene source and
 * reports forbidden APIs, contract violations and state carried between update() calls.
 * Pure (no I/O), so it runs in Node, in the app and in the browser alike.
 */
import { parse, type Program } from 'acorn';
import { checkProgram } from './checker.js';
import { checkContract, collectExports, resolveFunction } from './contract-rules.js';
import { normalizeDiagnostics, type LintDiagnostic, type Report } from './diagnostics.js';
import { analyzeScopes } from './scope.js';

export interface LintSceneOptions {
  /** Path used in messages and node locations (e.g. `scenes/s01_intro.js`); not read from disk. */
  readonly filename: string;
}

const SYNTAX_FIX =
  'Fix the JavaScript syntax. Scenes are plain ES modules: no TypeScript types, no JSX, no imports.';

function syntaxErrorPosition(error: unknown): { line: number; column: number } {
  if (typeof error === 'object' && error !== null && 'loc' in error) {
    const loc: unknown = error.loc;
    if (typeof loc === 'object' && loc !== null && 'line' in loc && 'column' in loc) {
      const { line, column } = loc;
      if (typeof line === 'number' && typeof column === 'number')
        return { line, column: column + 1 };
    }
  }
  return { line: 1, column: 1 };
}

export function parseScene(source: string, filename: string): Program | LintDiagnostic {
  try {
    return parse(source, {
      ecmaVersion: 'latest',
      sourceType: 'module',
      locations: true,
      sourceFile: filename,
    });
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error;
    return {
      rule: 'parse-error',
      severity: 'error',
      ...syntaxErrorPosition(error),
      message: `${filename} is not valid JavaScript: ${error.message}.`,
      fix: SYNTAX_FIX,
    };
  }
}

/** A Report that collects diagnostics at the start of each node. */
export function collectingReport(diagnostics: LintDiagnostic[]): Report {
  return (node, details) => {
    diagnostics.push({
      rule: details.rule,
      severity: details.severity ?? 'error',
      line: node.loc?.start.line ?? 1,
      column: (node.loc?.start.column ?? 0) + 1,
      message: details.message,
      fix: details.fix,
    });
  };
}

/** Lints one scene module source. Diagnostics are sorted by position. */
export function lintScene(source: string, options: LintSceneOptions): LintDiagnostic[] {
  const program = parseScene(source, options.filename);
  if (!('type' in program)) return [program];
  const diagnostics: LintDiagnostic[] = [];
  const report = collectingReport(diagnostics);
  const tree = analyzeScopes(program);
  const exports = collectExports(program, tree);
  checkContract(program, exports, tree, report);
  checkProgram(program, {
    source,
    report,
    tree,
    updateFunction: resolveFunction(exports.named.get('update')?.value, tree),
  });
  return normalizeDiagnostics(diagnostics);
}
