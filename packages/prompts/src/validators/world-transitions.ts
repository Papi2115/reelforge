/**
 * Transition styles in a world's storyboard (PLAN.md#13.6, ADR-029): a world's style is
 * exclusive, so a named `transitionIn.style` must be one of the world's page-native transitions
 * (continuity links are checked on their own); the built-in transition-kit styles are not offered
 * there. Outside a world the page-native ids stay unknown (`transition-style` of storyboard.ts).
 */
import { worldTransitionRange } from '../worlds/index.js';
import type { WorldTransitionOption } from '../worlds/types.js';
import { issue, type ValidationIssue } from './issues.js';

export function worldTransitionIssues(
  style: string,
  duration: number,
  options: readonly WorldTransitionOption[],
  where: string,
): ValidationIssue[] {
  const known = options.find((option) => option.id === style);
  if (known === undefined) {
    return [
      issue(
        'error',
        'transition-style',
        `transition style "${style}" is not one of this world's: use one of ${options.map((option) => option.id).join(', ')}`,
        `${where}.style`,
      ),
    ];
  }
  const { min, max } = worldTransitionRange(known);
  return duration < min || duration > max
    ? [
        issue(
          'warning',
          'transition-duration',
          `${style} lasts ${String(duration)} s (use ${String(min)}–${String(max)} s)`,
          where,
        ),
      ]
    : [];
}
