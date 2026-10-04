/**
 * The one place a cue's recipe is chosen among a slot's candidates (pure, deterministic). A
 * single candidate is returned as is (the voxel rule table always has one, so voxel films keep
 * their exact cues); several are drawn by weight from a hash of the cue's salt, skipping the
 * recipes in the recent `history` when another candidate is left. PLAN.md#12.23 (repetition
 * control) plugs in by passing a real history; until then the director passes `NO_HISTORY`.
 */
import { hashSeed, type SfxRecipe } from '@reelforge/pipeline';
import type { PaletteChoice, PaletteSlot } from './types.js';

/** How many of the most recent recipes a pick avoids. */
export const RECENT_RECIPES = 2;
export const NO_HISTORY: readonly SfxRecipe[] = [];

export interface RecipePickRequest {
  readonly candidates: PaletteSlot;
  /** Stable per cue (shot id, event index, ...), so the same film gets the same picks. */
  readonly salt: string;
  /** Recipes picked before this cue, most recent last. */
  readonly history: readonly SfxRecipe[];
}

export function pickRecipe(request: RecipePickRequest): PaletteChoice | undefined {
  const { candidates } = request;
  if (candidates.length <= 1) return candidates[0];
  const recent = new Set(request.history.slice(-RECENT_RECIPES));
  const fresh = candidates.filter((candidate) => !recent.has(candidate.recipe));
  const pool = fresh.length > 0 ? fresh : candidates;
  const weight = (candidate: PaletteChoice): number => Math.max(0, candidate.weight ?? 1);
  const total = pool.reduce((sum, candidate) => sum + weight(candidate), 0);
  if (total <= 0) return pool[0];
  let target = (hashSeed(`${request.salt}|pick`) / 4_294_967_296) * total;
  for (const candidate of pool) {
    target -= weight(candidate);
    if (target < 0) return candidate;
  }
  return pool.at(-1);
}
