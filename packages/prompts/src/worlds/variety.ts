/**
 * Variety rules of a world film (real run Sketchbook 1: no pop-up, no strip, a boring film): the
 * numbers of the quota and variety checks (validators/world-variety.ts) and of the storyboard
 * prompt, in one place. Tunable; docs/worlds/README.md ("Variety") and QUALITY.md list them.
 * Real films are minutes long: on average one breakthrough per ~50 s, never a gimmick.
 */
export interface WorldVarietyRules {
  /** Films shorter than this need no breakthrough, s. */
  readonly breakthroughFromS: number;
  /** Films from `breakthroughFromS` up to this need exactly one at least, s. */
  readonly breakthroughShortFilmS: number;
  /** Longer films need at least max(1, floor(duration / this)), s. */
  readonly breakthroughFloorEveryS: number;
  /** The prompt's target: about one breakthrough per this many seconds. */
  readonly breakthroughTargetEveryS: number;
  /** At most ceil(duration / this) breakthroughs, s (never a gimmick). */
  readonly breakthroughCeilingEveryS: number;
  /** At least this many distinct breakthrough kinds once the floor is 2 or more. */
  readonly distinctBreakthroughKinds: number;
  /** Two breakthroughs at least this many shots apart (2 = never adjacent). */
  readonly breakthroughGapShots: number;
  /** The same moment kind at most once per this many seconds. */
  readonly momentRepeatS: number;
  /** One look at most this many shots in a row. */
  readonly maxLookRun: number;
  /** One moment (or plain) in one roll at most this many shots in a row. */
  readonly maxMomentRun: number;
  /** Distinct page transitions a film needs (named `style`s; continuity links do not count). */
  readonly minDistinctTransitions: number;
  /** ...in films at least this long, s. */
  readonly distinctTransitionsFromS: number;
  /**
   * Continuity links (the world's signature cut; real run Sketchbook 2 planned none): films at
   * least this long need one when the project has links on, s.
   */
  readonly continuityFromS: number;
  /** ...and at least max(1, floor(duration / this)), s (the prompt asks for ~1 per 45 s). */
  readonly continuityFloorEveryS: number;
}

export const WORLD_VARIETY_RULES: WorldVarietyRules = {
  breakthroughFromS: 25,
  breakthroughShortFilmS: 45,
  breakthroughFloorEveryS: 60,
  breakthroughTargetEveryS: 50,
  breakthroughCeilingEveryS: 35,
  distinctBreakthroughKinds: 2,
  breakthroughGapShots: 2,
  momentRepeatS: 90,
  maxLookRun: 2,
  maxMomentRun: 2,
  minDistinctTransitions: 3,
  distinctTransitionsFromS: 25,
  continuityFromS: 45,
  continuityFloorEveryS: 60,
};

/**
 * Test drivers only (StageSettings.worldQuotaOverride): a short test film may ask for more
 * breakthroughs than its length would (e.g. both a pop-up and a strip in a 50 s film).
 */
export interface WorldQuotaOverride {
  readonly minBreakthroughs: number;
}

export interface BreakthroughQuota {
  /** At least this many breakthroughs (error below). */
  readonly min: number;
  /** At most this many (error above). */
  readonly max: number;
  /** At least this many distinct breakthrough kinds. */
  readonly kinds: number;
}

/** The breakthrough quota of a film of `durationS` (an override raises the floor). */
export function breakthroughQuota(
  durationS: number,
  override?: WorldQuotaOverride,
  rules: WorldVarietyRules = WORLD_VARIETY_RULES,
): BreakthroughQuota {
  const natural =
    durationS < rules.breakthroughFromS
      ? 0
      : durationS < rules.breakthroughShortFilmS
        ? 1
        : Math.max(1, Math.floor(durationS / rules.breakthroughFloorEveryS));
  const min = Math.max(natural, override?.minBreakthroughs ?? 0);
  const max = Math.max(min, Math.ceil(durationS / rules.breakthroughCeilingEveryS));
  return { min, max, kinds: min >= 2 ? rules.distinctBreakthroughKinds : Math.min(min, 1) };
}

/** Continuity links a world film of `durationS` needs at least (links on). */
export function continuityQuota(
  durationS: number,
  rules: WorldVarietyRules = WORLD_VARIETY_RULES,
): number {
  if (durationS < rules.continuityFromS) return 0;
  return Math.max(1, Math.floor(durationS / rules.continuityFloorEveryS));
}
