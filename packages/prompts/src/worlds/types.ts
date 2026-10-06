/**
 * What a world says in the stage prompts (PLAN.md#13.6, ADR-029). The storyboard, scene-build,
 * scene-fix and critic prompts keep the voxel text in `{{^world}}…{{/world}}` sections and render
 * these instead when the stage passes a world's variables; every other project gets the prompts
 * byte for byte as before.
 */
export interface WorldPromptText {
  /** Storyboard, first line: "the director/storyboard artist for <film>". */
  readonly film: string;
  /** Storyboard: what the world is and what never appears in it. */
  readonly brief: string;
  /** Storyboard: the "Rolls and looks" lines (A/B/C with the world's looks and an example). */
  readonly rolls: string;
  /** Storyboard (tension map on): rolls and looks by tension. */
  readonly tensionLooks: string;
  /** Storyboard: the look rhythm sentence. */
  readonly rhythm: string;
  /** What every look of the world shares (a phrase without a final full stop). */
  readonly shared: string;
  /** Storyboard: how a non-cut `transitionIn` is written in this world. */
  readonly transitionIn: string;
  /** Storyboard: the camera rules of the world's looks. */
  readonly camera: string;
  /** Storyboard (pattern interrupts on): the interrupt example and the kinds of this world. */
  readonly interrupts: string;
  /** Storyboard: how annotations are drawn in this world. */
  readonly marks: string;
  /** Scene-build: how the annotation plan is implemented. */
  readonly annotate: string;
  /** Scene-build: the motion rule (replaces "Camera always moving."). */
  readonly motion: string;
  /** Scene-build: step 4 (what to do when the kit has no prop). */
  readonly missing: string;
  /** The world's craft brief (QUALITY.md §9, ≤ 1.5 KB): scene-build and scene-fix. */
  readonly craftBrief: string;
  /** Critic: "a strict visual QA reviewer for <medium> video frames". */
  readonly criticMedium: string;
  /** Critic: the style line's parenthesis. */
  readonly criticStyle: string;
  /** Critic: the vibe check paragraph. */
  readonly vibe: string;
  /** Critic: the world's craft checklist (focal point, traces, slop tells). */
  readonly checklist: string;
  /** Script (surprise beats on): what a surprise is in this world (replaces the voxel example). */
  readonly surprise: string;
  /**
   * The world's moment catalog (worlds/variety.ts): a closed list the storyboard plans per shot
   * (`worldMoment`), the scene builds with the exact API and the critic looks for. `plain` is
   * the absence of a moment and is not listed.
   */
  readonly moments: readonly WorldMomentOption[];
}

/** One planned page moment of a world (storyboard `worldMoment`). */
export interface WorldMomentOption {
  /** Kebab-case id the storyboard writes, e.g. `popup`. */
  readonly id: string;
  /** A breakthrough showpiece (counted by the quota, spaced, at least two kinds). */
  readonly breakthrough: boolean;
  /** The looks that host it (the shot must be in one of them); empty = any look. */
  readonly looks: readonly string[];
  /** Storyboard: "use when the narration …" (plain words, no full stop). */
  readonly useWhen: string;
  /** Scene-build / scene-fix: the exact call and its caps. */
  readonly build: string;
  /** Critic: what must be visible in the frames once it has started. */
  readonly visible: string;
  /** The page-native transition style the shot must open with (e.g. a torn-out page). */
  readonly transition?: string;
}

/** A page-native transition of a world, as the storyboard prompt and validator see it. */
export interface WorldTransitionOption {
  readonly id: string;
  /** Plain transition type of the style (its fallback). */
  readonly type: string;
  /** The style's own length, seconds. */
  readonly duration: number;
  readonly description: string;
}
