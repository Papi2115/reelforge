/**
 * A Grim Ink module in Node for the code checks (PLAN.md#14.11, #14.18): the module source
 * (already through the ink-module lint: no imports, no globals, deterministic) is evaluated in a
 * fresh `node:vm` context (no `require`, no `process`), read through the kit's own contract
 * (`personFromModule` / `placeFromModule`) and, for a person, run through the people validators
 * (`validateCharacter`). Everything runs under one time limit, so a drawing that never returns
 * fails the check instead of hanging. Shared by `reelforge people-preview` and the build step's
 * QA, so a build or fix turn sees exactly the findings the step judges it by.
 */
import { createContext, Script } from 'node:vm';
import {
  personFromModule,
  placeFromModule,
  validateCharacter,
  type InkValidationFinding,
  type InkValidationReport,
} from '@reelforge/kit';
import type { InkModuleKind } from '@reelforge/shared';

/** Time for loading a module and validating it (the validators draw every view and pose). */
export const INK_CHECK_TIMEOUT_MS = 20_000;

export type InkModuleCheck =
  | { readonly ok: true; readonly report: InkValidationReport | undefined }
  | { readonly ok: false; readonly error: string };

const BINDING: Readonly<Record<InkModuleKind, string>> = { people: 'person', places: 'place' };

const describe = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

/** `export const person = …` -> `const person = …`, then the binding as the script's value. */
function scriptOf(source: string, kind: InkModuleKind): string {
  const binding = BINDING[kind];
  const body = source.replace(
    new RegExp(`^(\\s*)export\\s+const\\s+${binding}\\b`, 'm'),
    '$1const ' + binding,
  );
  return `${body}\n;({ ${binding}: typeof ${binding} === 'undefined' ? undefined : ${binding} });\n`;
}

/**
 * Loads `source` as the module `file` and checks it: the contract for both kinds, the validators
 * for a person. A module that does not load, breaks the contract or runs out of time is `ok:
 * false` with the reason; a person's validator findings are in `report`.
 */
export function checkInkModule(
  kind: InkModuleKind,
  file: string,
  source: string,
  timeout: number = INK_CHECK_TIMEOUT_MS,
): InkModuleCheck {
  const sandbox: { run?: () => InkModuleCheck } = {};
  const context = createContext(sandbox, {
    name: file,
    codeGeneration: { strings: false, wasm: false },
  });
  let namespace: unknown;
  try {
    const script = new Script(scriptOf(source, kind), { filename: file });
    namespace = script.runInContext(context, { timeout });
  } catch (error) {
    return { ok: false, error: `${file} failed to load: ${describe(error)}` };
  }
  sandbox.run = (): InkModuleCheck => {
    if (kind === 'places') {
      placeFromModule(namespace, file);
      return { ok: true, report: undefined };
    }
    const person = personFromModule(namespace, file);
    return { ok: true, report: validateCharacter(person.character) };
  };
  try {
    const checked: unknown = new Script('run()', { filename: `${file} (checks)` }).runInContext(
      context,
      { timeout },
    );
    return isCheck(checked) ? checked : { ok: false, error: `${file}: the checks did not finish` };
  } catch (error) {
    return { ok: false, error: describe(error) };
  }
}

function isCheck(value: unknown): value is InkModuleCheck {
  return typeof value === 'object' && value !== null && 'ok' in value;
}

/** Most lines of a validator list (header included): one per rule, errors first. */
export const VALIDATOR_MAX_LINES = 25;

/** One line for every rule: severity, how often, where first, the message and the fix. */
function ruleLine(group: readonly InkValidationFinding[]): string {
  const [first] = group;
  if (first === undefined) return '';
  const where = [
    first.view === null ? undefined : `view ${String(first.view)}`,
    first.pose === null ? undefined : `pose ${first.pose}`,
  ].filter((part) => part !== undefined);
  const count = group.length === 1 ? '' : ` (${String(group.length)} cases)`;
  const level = first.severity === 'error' ? 'ERROR' : 'warn ';
  const at = where.length === 0 ? '' : `, first at ${where.join(', ')}`;
  return `  ${level} ${first.code}${count}${at}: ${first.message}; fix: ${first.fix}`;
}

/** Findings grouped by rule, errors before warnings, in rule order within each. */
function groups(findings: readonly InkValidationFinding[]): InkValidationFinding[][] {
  const byCode = new Map<string, InkValidationFinding[]>();
  for (const finding of findings) {
    byCode.set(finding.code, [...(byCode.get(finding.code) ?? []), finding]);
  }
  const all = [...byCode.values()];
  const errors = all.filter((group) => group[0]?.severity === 'error');
  const warnings = all.filter((group) => group[0]?.severity !== 'error');
  return [...errors, ...warnings];
}

/**
 * The people validators' findings as a compact list (at most VALIDATOR_MAX_LINES lines, one per
 * rule, errors AND warnings with their fix hints). `reelforge people-preview` prints it and the
 * build step hands the very same lines to the fix turn.
 */
export function validatorLines(findings: readonly InkValidationFinding[]): string[] {
  const errors = findings.filter((finding) => finding.severity === 'error').length;
  const warnings = findings.length - errors;
  const header =
    findings.length === 0
      ? 'validators: ok (no findings)'
      : `validators: ${String(errors)} error case(s), ${String(warnings)} warning case(s), by rule:`;
  const rules = groups(findings).map(ruleLine);
  const room = VALIDATOR_MAX_LINES - 1;
  if (rules.length <= room) return [header, ...rules];
  const shown = rules.slice(0, room - 1);
  return [header, ...shown, `  … ${String(rules.length - shown.length)} more rule(s)`];
}
