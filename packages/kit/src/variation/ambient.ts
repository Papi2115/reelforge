/**
 * `ambientVariation`: the deterministic per-shot parameter set of ambient variation (PLAN.md#12.8,
 * ADR-010). A pure function of (seed, shot id, storyboard index, act, roll, budget, scale):
 *
 * - the first two continuous axes with a non-empty range (normally horizon and light turn) step
 *   through seeded permutations by storyboard index, so neighbouring shots always differ in both;
 * - the other axes, the drift direction and the layout variant are hashed from seed + roll + act +
 *   index + shot id;
 * - tone families: each act picks one family member per family (a coherent mood per act and
 *   roll); every shot swaps a `toneShare` of the families to it.
 *
 * Every value is `neutral + (budget value - neutral) * scale`, so scale 0 is exactly the scene as
 * authored and the budget is the range at scale 1.
 */
import { hashedLevel, hash32, steppedLevel, unitHash } from './sequence.js';
import {
  CONTINUOUS_AXES,
  NEUTRAL,
  type AmbientInput,
  type AmbientVariation,
  type ContinuousAxis,
  type LevelAxis,
  type VariationBudget,
} from './types.js';

/** Axes that step through permutations (neighbour guarantee). */
const GUARANTEED_AXES = 2;
/** Layout variants are 1..LAYOUTS (0 = the scene's own layout). */
const LAYOUTS = 9973;

function hasRange(budget: VariationBudget, axis: ContinuousAxis): boolean {
  const [min, max] = budget[axis];
  return max > min;
}

/** The axes whose levels step through permutations (at most two, budget order). */
export function guaranteedAxes(budget: VariationBudget): ContinuousAxis[] {
  return CONTINUOUS_AXES.filter((axis) => hasRange(budget, axis)).slice(0, GUARANTEED_AXES);
}

function axisValue(budget: VariationBudget, axis: ContinuousAxis, level: number, scale: number) {
  const [min, max] = budget[axis];
  const raw = min + ((max - min) * level) / (budget.steps - 1);
  const neutral = NEUTRAL[axis];
  return neutral + (raw - neutral) * scale;
}

function checkInput(input: AmbientInput): number {
  const scale = input.scale ?? 1;
  if (!Number.isFinite(scale) || scale < 0) {
    throw new RangeError(
      `ambientVariation: scale must be a finite number >= 0 (got ${String(scale)})`,
    );
  }
  if (!Number.isInteger(input.actIndex) || input.actIndex < 0) {
    throw new RangeError(`ambientVariation: actIndex must be an integer >= 0`);
  }
  return scale;
}

function toneMap(input: AmbientInput, share: number): Record<string, string> {
  const { seed, budget, shotId, index, actIndex } = input;
  const roll = input.roll ?? '-';
  const tones: Record<string, string> = {};
  for (const family of Object.keys(budget.tones).sort()) {
    const members = budget.tones[family] ?? [];
    if (members.length === 0) continue;
    if (unitHash(`tone:${family}:${String(index)}:${shotId}`, seed) >= share) continue;
    const pick = hash32(`tone:${family}:act:${String(actIndex)}:${roll}`, seed) % members.length;
    const member = members[pick];
    if (member !== undefined && member !== family) tones[family] = member;
  }
  return tones;
}

export function ambientVariation(input: AmbientInput): AmbientVariation {
  const scale = checkInput(input);
  const { seed, budget, shotId, index, actIndex } = input;
  const steps = budget.steps;
  const stepped = new Set<ContinuousAxis>(guaranteedAxes(budget));
  const free = `${input.roll ?? '-'}:${String(actIndex)}:${String(index)}:${shotId}`;
  const levelOf = (axis: LevelAxis): number =>
    axis !== 'drift' && stepped.has(axis)
      ? steppedLevel(seed, `axis:${axis}`, index, steps)
      : hashedLevel(seed, `axis:${axis}:${free}`, steps);
  const levels = Object.fromEntries(
    [...CONTINUOUS_AXES, 'drift' as const].map((axis) => [axis, levelOf(axis)]),
  ) as Record<LevelAxis, number>;
  const value = (axis: ContinuousAxis): number => axisValue(budget, axis, levels[axis], scale);
  const angle = (2 * Math.PI * (levels.drift + 0.5)) / steps;
  const [maxYaw, maxPitch] = budget.cameraDrift;
  return Object.freeze({
    budgetKey: input.budgetKey,
    scale,
    levels: Object.freeze(levels),
    tones: Object.freeze(scale === 0 ? {} : toneMap(input, Math.min(1, budget.toneShare * scale))),
    cell: value('cell'),
    horizon: value('horizon'),
    fade: value('fade'),
    lightAzimuth: value('lightAzimuth'),
    lightElevation: value('lightElevation'),
    debris: value('debris'),
    layout: scale === 0 ? 0 : 1 + (hash32(`layout:${String(index)}:${shotId}`, seed) % LAYOUTS),
    cameraDrift: Object.freeze([
      Math.cos(angle) * maxYaw * scale,
      Math.sin(angle) * maxPitch * scale,
    ] as const),
  });
}

/**
 * How different two shots' parameter sets are: differing axis levels + differing tone swaps +
 * a different layout. Neighbours of one film are always >= 2 apart at scale > 0.
 */
export function variationDistance(first: AmbientVariation, second: AmbientVariation): number {
  const axes = (Object.keys(first.levels) as LevelAxis[]).filter(
    (axis) => first.levels[axis] !== second.levels[axis],
  ).length;
  const families = new Set([...Object.keys(first.tones), ...Object.keys(second.tones)]);
  const tones = [...families].filter((family) => first.tones[family] !== second.tones[family]);
  return axes + tones.length + (first.layout === second.layout ? 0 : 1);
}

/** The colour name an environment uses for `name` in this shot (its family member or itself). */
export function toneOf(variation: AmbientVariation | undefined, name: string): string {
  return variation?.tones[name] ?? name;
}

/** `count` scaled by the debris multiplier (unchanged without variation), at least `minimum`. */
export function debrisCount(
  variation: AmbientVariation | undefined,
  count: number,
  minimum = 0,
): number {
  if (variation === undefined) return count;
  return Math.max(minimum, Math.round(count * variation.debris));
}

/** A seed label with the layout variant appended (unchanged without variation or at layout 0). */
export function layoutLabel(variation: AmbientVariation | undefined, label: string): string {
  return variation === undefined || variation.layout === 0
    ? label
    : `${label}:layout:${String(variation.layout)}`;
}
