/** Determinism lint for scene modules (PLAN.md#2.6). */
export { runLintCli, LINT_USAGE, type LintCliIo } from './cli.js';
export {
  formatDiagnostics,
  hasErrors,
  LINT_RULES,
  type LintDiagnostic,
  type LintRule,
  type LintSeverity,
} from './diagnostics.js';
export { lintScene, type LintSceneOptions } from './lint-scene.js';
export { lintModule, lintPropModule } from './lint-prop.js';
export { extractPropMeta, type PropMetaResult } from './prop-meta.js';
export { isPropModulePath } from './prop-rules.js';
export {
  describeLintErrors,
  lintManifestKitExtensions,
  lintManifestScenes,
  lintShotScene,
  type SceneLintResult,
} from './manifest.js';
