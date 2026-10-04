/**
 * Asset needs of a storyboard (PLAN.md#12.10): ids unique in the film (they become asset ids),
 * at most `maxAssetNeeds` in total (warning: the Assets stage only looks for the first ones), and
 * none at all when asset research is off (warning: they are ignored).
 */
import {
  DEFAULT_MAX_ASSET_NEEDS,
  storyboardAssetNeeds,
  type StoryboardShot,
} from '@reelforge/shared';
import { issue, type ValidationIssue } from './issues.js';

export interface AssetNeedRules {
  /** Research mode is on (absent = off: needs are not expected). */
  readonly research: boolean;
  readonly maxAssetNeeds: number;
}

export function checkAssetNeeds(
  shots: readonly StoryboardShot[],
  rules: Partial<AssetNeedRules> = {},
): ValidationIssue[] {
  const needs = storyboardAssetNeeds(shots);
  if (needs.length === 0) return [];
  const issues: ValidationIssue[] = [];
  if (rules.research !== true) {
    issues.push(
      issue(
        'warning',
        'asset-needs-off',
        `${String(needs.length)} asset needs, but asset research is off for this project: they are ignored`,
      ),
    );
  }
  const max = rules.maxAssetNeeds ?? DEFAULT_MAX_ASSET_NEEDS;
  if (needs.length > max) {
    issues.push(
      issue(
        'warning',
        'asset-needs-count',
        `${String(needs.length)} asset needs, at most ${String(max)} per film: only the first ${String(max)} are looked for`,
      ),
    );
  }
  const seen = new Set<string>();
  for (const { shotId, need } of needs) {
    if (seen.has(need.id)) {
      issues.push(
        issue('error', 'asset-need-id', `asset need id "${need.id}" is used twice (${shotId})`),
      );
    }
    seen.add(need.id);
  }
  return issues;
}
