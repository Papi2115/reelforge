/**
 * Coarse check of a Grim Ink project module written by the c-cam-build turn (PLAN.md#14.11):
 * `kit-ext/people/<id>.js` exports `person` with this id, a `torso`, a `head` and its one
 * `signatureGag` (PLAN.md#14.15: required of every built person);
 * `kit-ext/places/<id>.js` exports `place` with this id and a `draw`; no import, no obvious
 * non-determinism. The real checks are the engine's ink-module lint, the kit's contract and the
 * people validators (the stage's QA).
 */
import { issue, report, type ValidationIssue, type ValidationReport } from './issues.js';

export type InkModuleFolder = 'people' | 'places';

const FORBIDDEN: readonly [string, RegExp][] = [
  ['Date', /\bDate\b/],
  ['Math.random', /Math\s*\.\s*random/],
  ['performance.now', /\bperformance\s*\./],
  ['requestAnimationFrame', /\brequestAnimationFrame\b/],
  ['timers', /\bset(?:Timeout|Interval)\b/],
  ['fetch', /\bfetch\s*\(/],
  ['import/require', /^\s*import\s|\brequire\s*\(/m],
];

const FUNCTIONS: Readonly<Record<InkModuleFolder, readonly string[]>> = {
  people: ['torso', 'head'],
  places: ['draw'],
};

/** A person's `signatureGag: { kind, note }` field. */
const SIGNATURE_GAG = /\bsignatureGag\s*:/;

export function validateInkModuleSource(
  source: string,
  folder: InkModuleFolder,
  id: string,
): ValidationReport<{ readonly lines: number }> {
  const binding = folder === 'people' ? 'person' : 'place';
  const issues: ValidationIssue[] = [];
  if (!new RegExp(`^export\\s+const\\s+${binding}\\s*=`, 'm').test(source)) {
    issues.push(issue('error', 'ink-export', `missing export const ${binding}`));
  }
  if (!source.includes(`id: '${id}'`) && !source.includes(`id: "${id}"`)) {
    issues.push(issue('error', 'ink-id', `${binding}.id is not "${id}"`));
  }
  for (const name of FUNCTIONS[folder]) {
    if (!new RegExp(`\\b${name}\\s*\\(`).test(source)) {
      issues.push(issue('error', 'ink-function', `missing ${name}(g, ink, …)`));
    }
  }
  if (folder === 'people' && !SIGNATURE_GAG.test(source)) {
    issues.push(
      issue(
        'error',
        'ink-signature-gag',
        "missing signatureGag: { kind, note } (the person's one recurring tic, a kind from reelforge kit-docs people)",
      ),
    );
  }
  for (const [what, regex] of FORBIDDEN) {
    if (regex.test(source)) issues.push(issue('error', 'ink-forbidden', `uses ${what}`));
  }
  return report({ lines: source.split('\n').length }, issues);
}
