/**
 * Transition pace of a world whose pages flow into each other (Comic, Papi after real run Comic 3:
 * "the transitions feel dry"; the showcase linked 9 of its 10 shots with a page-native transition,
 * the film had 4 non-cut transitions and 1 link in 12 shots). A world with a pace gets a looser
 * non-cut budget and denser continuity links than the defaults (one per 20 s, one per 45 s), still
 * capped against a flood, never the same transition twice in a row, and the `dry-run` check
 * (validators/world-pace.ts). Absent = the defaults (every other world, every other project).
 */
export interface WorldPace {
  /** The rhythm check's non-cut cap: about one per this many seconds (min. 3 in any film). */
  readonly transitionEveryS: number;
  /** Continuity links: about one per this many seconds (spacing warning and budget). */
  readonly continuityEveryS: number;
  /** This many plain cuts in a row with no link and no flowing page is a dry run. */
  readonly dryCutRun: number;
  /**
   * Storyboard: when to use which of the world's transitions (topic-neutral, one sentence per
   * group, no final full stop).
   */
  readonly guide: string;
}

/** Continuity links a film of `durationS` may have at a pace of one per `everyS` seconds. */
export function paceContinuityBudget(durationS: number, everyS: number): number {
  return Math.max(1, Math.floor(durationS / everyS));
}
