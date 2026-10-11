/**
 * Lint of project prop modules (`kit-ext/props/<name>.js`, PLAN.md#7.4): the same forbidden-API
 * rules as scenes (a prop runs inside scene builds, so it must be just as deterministic), the
 * prop contract instead of the scene contract, and no module state written by functions.
 * `lintModule` picks the mode from the path.
 */
import { checkProgram } from './checker.js';
import { collectExports } from './contract-rules.js';
import { normalizeDiagnostics, type LintDiagnostic } from './diagnostics.js';
import { inkModuleKindOfPath, lintInkModule } from './lint-ink-module.js';
import { collectingReport, lintScene, parseScene, type LintSceneOptions } from './lint-scene.js';
import { checkModuleStateWrites, checkPropContract, isPropModulePath } from './prop-rules.js';
import { analyzeScopes } from './scope.js';

export function lintPropModule(source: string, options: LintSceneOptions): LintDiagnostic[] {
  const program = parseScene(source, options.filename);
  if (!('type' in program)) return [program];
  const diagnostics: LintDiagnostic[] = [];
  const report = collectingReport(diagnostics);
  const tree = analyzeScopes(program);
  checkPropContract(program, collectExports(program, tree), options.filename, report);
  checkProgram(program, { source, report, tree, updateFunction: undefined });
  checkModuleStateWrites(program, tree, report);
  return normalizeDiagnostics(diagnostics);
}

/**
 * Scene or project module lint, by path: `kit-ext/props/*.js` are props, `kit-ext/people|places/*.js`
 * Grim Ink people / places (PLAN.md#14.8), everything else scenes.
 */
export function lintModule(source: string, options: LintSceneOptions): LintDiagnostic[] {
  if (isPropModulePath(options.filename)) return lintPropModule(source, options);
  const ink = inkModuleKindOfPath(options.filename);
  return ink === undefined ? lintScene(source, options) : lintInkModule(source, options, ink);
}
