/**
 * C-CAM character validators (PLAN.md#14.13): the c-plus suite
 * (`docs/concepts/styles7/20-cplus-engine/js/validate*.js`) ported onto the C-CAM rig. A pure,
 * deterministic function of the character and the options: same input -> same report.
 *
 * Categories: anchors (shoulders vs torso and chin, face anchors on the head), head (head and
 * figure connectivity on a CPU raster, jaw shut and open), tangle (palms in the head, arms across
 * the face, reach, elbow flips), contact (handshakes, palms on objects). Rules, severities and
 * thresholds: registry.ts and thresholds.ts. A CLI / QA hook comes with PLAN.md#14.11.
 *
 * Public API: `validateCharacter`, `RULES`, `RuleSpec`, `ruleSpec`, `THRESHOLDS`,
 * `VALIDATE_YAWS`, `TEST_POSES`, `TEST_SWEEPS`, `SWEEP_FRAMES`, `RULE_CODES` and the types of
 * types.ts.
 */
import type { Character } from '../draw/character.js';
import { createContext, type Collector } from './context.js';
import { RULES, type RuleSpec } from './registry.js';
import type { RuleCode, Severity, ValidateOptions, ValidationReport } from './types.js';

export { RULES, ruleSpec, type RuleSpec } from './registry.js';
export { THRESHOLDS, VALIDATE_YAWS, TEST_POSES, TEST_SWEEPS, SWEEP_FRAMES } from './thresholds.js';
export {
  RULE_CODES,
  type Finding,
  type PoseCase,
  type SweepCase,
  type RuleCategory,
  type RuleCode,
  type RuleKind,
  type Severity,
  type ValidateOptions,
  type ValidationReport,
} from './types.js';

function selected(options: ValidateOptions): readonly RuleSpec[] {
  const only = options.rules;
  return RULES.filter(
    (r) =>
      (only === undefined || only.includes(r.code)) &&
      (options.raster !== false || r.kind !== 'raster'),
  );
}

/** Runs the selected rules on the character; `ok` = no error findings. */
export function validateCharacter(
  character: Character,
  options: ValidateOptions = {},
): ValidationReport {
  const collector: Collector = { findings: [], checks: {}, metrics: {} };
  let current: { code: RuleCode; severity: Severity } = {
    code: 'shoulder-outside-torso',
    severity: 'error',
  };
  const ctx = createContext(character, options, collector, () => current);
  for (const rule of selected(options)) {
    current = { code: rule.code, severity: rule.severity };
    rule.run(ctx);
  }
  return {
    ok: collector.findings.every((f) => f.severity !== 'error'),
    findings: collector.findings,
    checks: collector.checks,
    metrics: collector.metrics,
  };
}
