import type { QaFinding } from '@reelforge/shared';
import { describe, expect, it } from 'vitest';
import { finding } from './checks.js';
import { FINAL_CRITIC_PREFIX, findingsStatus, reviewedFindings } from './final-checks.js';

const buildCritic = finding('critic', 'error', 'the frame critic says "off-intent": rows unclear');
const missingProp = finding('missing-prop', 'warning', 'prop "tray" is missing');
const lint = finding('lint', 'error', 'Math.random is not allowed');
const oldReview = finding('critic', 'error', `${FINAL_CRITIC_PREFIX}dark first second`);

describe('reviewedFindings', () => {
  it("keeps the build critic's ⚠ and missing props when the review does not fix the shot", () => {
    const record = { findings: [buildCritic, missingProp, lint] };
    const kept = reviewedFindings([], record, false);
    expect(kept).toEqual([buildCritic, missingProp]);
    expect(findingsStatus(kept)).toBe('warning');
  });

  it("drops an earlier review's own critic findings and does not repeat a finding", () => {
    const fresh: QaFinding[] = [buildCritic];
    expect(reviewedFindings(fresh, { findings: [buildCritic, oldReview] }, false)).toEqual([
      buildCritic,
    ]);
  });

  it("takes a fixed shot's new build record as it is", () => {
    expect(reviewedFindings([lint], { findings: [] }, true)).toEqual([]);
    expect(reviewedFindings([lint], undefined, true)).toEqual([lint]);
  });
});
