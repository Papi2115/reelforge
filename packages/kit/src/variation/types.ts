/**
 * Types of ambient variation (PLAN.md#12.8, ADR-010). The budget mirrors the zod schema of
 * `@reelforge/shared` (`variationBudgetSchema`; the kit has no shared dependency, the engine
 * passes the parsed budget in, so TypeScript checks that both shapes agree).
 */

export type AxisRange = readonly [number, number];

export interface VariationBudget {
  /** Palette families: swatch -> other swatches of its family it may become (closest first). */
  readonly tones: Readonly<Record<string, readonly string[]>>;
  /** Share of the tone families swapped in one shot (at scale 1). */
  readonly toneShare: number;
  /** Levels of every continuous axis. */
  readonly steps: number;
  readonly cell: AxisRange;
  readonly horizon: AxisRange;
  readonly fade: AxisRange;
  readonly lightAzimuth: AxisRange;
  readonly lightElevation: AxisRange;
  readonly debris: AxisRange;
  /** Max camera drift over a shot: [yaw, pitch] in degrees. */
  readonly cameraDrift: readonly [number, number];
}

/**
 * Continuous axes, in the order the neighbour guarantee picks from: the first two with a
 * non-empty range step through seeded permutations, so neighbouring shots always differ in both.
 */
export const CONTINUOUS_AXES = [
  'horizon',
  'lightAzimuth',
  'cell',
  'fade',
  'debris',
  'lightElevation',
] as const;
export type ContinuousAxis = (typeof CONTINUOUS_AXES)[number];

/** The scene's own value of every axis (multipliers 1, offsets 0). */
export const NEUTRAL: Readonly<Record<ContinuousAxis, number>> = {
  horizon: 0,
  lightAzimuth: 0,
  cell: 1,
  fade: 1,
  debris: 1,
  lightElevation: 0,
};

export type LevelAxis = ContinuousAxis | 'drift';

export interface AmbientInput {
  /** Variation seed (the project seed). */
  readonly seed: number;
  readonly shotId: string;
  /** 0-based position of the shot in the storyboard. */
  readonly index: number;
  /** 0-based act (a new act starts at every non-cut transition). */
  readonly actIndex: number;
  /** A/B/C roll, when the storyboard gives one. */
  readonly roll?: string | undefined;
  /** Key of the budget (the look's `variationBudget`). */
  readonly budgetKey: string;
  readonly budget: VariationBudget;
  /** Budget multiplier (default 1; 0 = no variation). */
  readonly scale?: number | undefined;
  /**
   * The shot's tension 0..1 (tension map, PLAN.md#12.22). Above TENSION_DARKEN_FROM a growing
   * share of the tone families takes the darker member from `darker`.
   */
  readonly tension?: number | undefined;
  /** Family -> its closest darker member (the engine derives it from the style palette). */
  readonly darker?: Readonly<Record<string, string>> | undefined;
}

/** Parameters of one shot: what environments apply (ctx.kit) and scenes may read (ctx.ambient). */
export interface AmbientVariation {
  readonly budgetKey: string;
  readonly scale: number;
  /** Level (0..steps-1) per axis: what neighbouring shots are compared by. */
  readonly levels: Readonly<Record<LevelAxis, number>>;
  /** Swatch -> swatch of the same family, for environment colours the scene did not set. */
  readonly tones: Readonly<Record<string, string>>;
  /** Grid cell multiplier. */
  readonly cell: number;
  /** Sky horizon/top elevation offset. */
  readonly horizon: number;
  /** Grid fade distance multiplier. */
  readonly fade: number;
  /** Light rig turn (degrees). */
  readonly lightAzimuth: number;
  /** Light elevation offset (degrees). */
  readonly lightElevation: number;
  /** Debris and star count multiplier. */
  readonly debris: number;
  /** Layout variant added to seeded backdrops (0 = the scene's own layout). */
  readonly layout: number;
  /** Camera drift at the end of the shot, [yaw, pitch] degrees (the start is the opposite). */
  readonly cameraDrift: readonly [number, number];
  /** The shot's tension 0..1 when the project has a tension map (absent otherwise). */
  readonly tension?: number;
}
