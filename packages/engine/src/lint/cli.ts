/**
 * `reelforge lint <scene.js>...` (PLAN.md#5.6): lints scene files and prints diagnostics for a
 * human or the runtime Claude. I/O is injected so the command is testable and platform-neutral.
 * Exit codes: 0 = no errors (warnings allowed), 1 = lint errors, 2 = usage or read failure.
 */
import { describeError } from '../errors.js';
import { formatDiagnostics, type LintDiagnostic } from './diagnostics.js';
import { lintScene } from './lint-scene.js';

export interface LintCliIo {
  readFile(file: string): Promise<string>;
  stdout(text: string): void;
  stderr(text: string): void;
}

export const LINT_USAGE = `usage: reelforge lint [--json] <scene.js>...
Checks scene modules for non-deterministic APIs and scene-contract problems.
  --json   print [{ "file", "diagnostics": [{ rule, severity, line, column, message, fix }] }]
Exit code: 0 no errors, 1 lint errors, 2 usage or read failure.`;

interface FileResult {
  readonly file: string;
  readonly diagnostics: readonly LintDiagnostic[];
}

function count(results: readonly FileResult[], severity: 'error' | 'warning'): number {
  return results.reduce(
    (total, result) =>
      total + result.diagnostics.filter((item) => item.severity === severity).length,
    0,
  );
}

export async function runLintCli(args: readonly string[], io: LintCliIo): Promise<number> {
  const files = args.filter((arg) => arg !== '--' && !arg.startsWith('--'));
  const flags = args.filter((arg) => arg !== '--' && arg.startsWith('--'));
  const unknown = flags.filter((flag) => flag !== '--json' && flag !== '--help');
  if (flags.includes('--help')) {
    io.stdout(`${LINT_USAGE}\n`);
    return 0;
  }
  if (unknown.length > 0 || files.length === 0) {
    const reason =
      unknown.length > 0 ? `unknown option ${unknown.join(', ')}` : 'no scene files given';
    io.stderr(`reelforge lint: ${reason}\n${LINT_USAGE}\n`);
    return 2;
  }
  const results: FileResult[] = [];
  for (const file of files) {
    let source: string;
    try {
      source = await io.readFile(file);
    } catch (error) {
      io.stderr(`reelforge lint: cannot read ${file}: ${describeError(error)}\n`);
      return 2;
    }
    results.push({ file, diagnostics: lintScene(source, { filename: file }) });
  }
  const errors = count(results, 'error');
  if (flags.includes('--json')) {
    io.stdout(`${JSON.stringify(results, null, 2)}\n`);
  } else {
    for (const result of results) {
      if (result.diagnostics.length > 0)
        io.stdout(`${formatDiagnostics(result.file, result.diagnostics)}\n`);
    }
    const warnings = count(results, 'warning');
    io.stdout(
      `${String(files.length)} file(s): ${String(errors)} error(s), ${String(warnings)} warning(s)\n`,
    );
  }
  return errors > 0 ? 1 : 0;
}
