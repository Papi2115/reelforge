/**
 * Storyboard prompt variables of the project's shots-per-minute range (ADR-027): no range adds
 * none (the prompt renders byte for byte as before 2.3.6); a range turns on the `{{#shotRange}}`
 * section with the numbers derived from it.
 */
import {
  expectedShots,
  filmClock,
  formatShotRange,
  shotRangeRules,
  type ShotsPerMinute,
} from '@reelforge/shared';

export function storyboardShotRangeVars(
  range: ShotsPerMinute | undefined,
  durationS: number,
): Readonly<Record<string, string | number>> {
  if (range === undefined) return {};
  const rules = shotRangeRules(range);
  const shots = expectedShots(range, durationS);
  return {
    shotRange: formatShotRange(range),
    rangeShots:
      shots.min === shots.max ? String(shots.min) : `${String(shots.min)}–${String(shots.max)}`,
    rangeClock: filmClock(durationS),
    rangeMinShotS: rules.minShotS,
    rangeMaxShotS: rules.maxShotS,
    rangeTypicalMinS: rules.typicalMinShotS,
    rangeTypicalMaxS: rules.typicalMaxShotS,
    rangeLongSentenceS: rules.longSentenceS,
    rangePatternS: rules.maxPatternS,
    rangeCalmS: rules.tempo.calmS,
    rangePeakS: rules.tempo.peakS,
  };
}
