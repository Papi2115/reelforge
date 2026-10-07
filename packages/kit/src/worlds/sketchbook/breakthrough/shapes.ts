/**
 * Small shape helpers of the breakthrough scenes (pop-up card, accordion strip): capsules (arms,
 * tabs, fingers) and timed marks from stroke recipes.
 */
import type { StrokeRecipe } from '../draw/doodles.js';
import { strokeMark, type Mark, type ToolName } from '../draw/marks.js';
import type { Pts, Xform } from '../draw/paths.js';

const flat: Xform = (u, v) => [u, v];

/** A capsule from (u0, v0) to (u1, v1) with radius r, through `f` (default: as is). */
export function capsule(
  u0: number,
  v0: number,
  u1: number,
  v1: number,
  r: number,
  f: Xform = flat,
): Pts {
  const out: Pts = [];
  const length = Math.hypot(u1 - u0, v1 - v0) || 1;
  const au = (u1 - u0) / length;
  const av = (v1 - v0) / length;
  const arc = (cu: number, cv: number, from: number): void => {
    for (let i = 0; i <= 10; i += 1) {
      const a = from + (i / 10) * Math.PI;
      const c = Math.cos(a);
      const s = Math.sin(a);
      out.push(...f(cu + (au * c - av * s) * r, cv + (av * c + au * s) * r));
    }
  };
  arc(u0, v0, Math.PI / 2);
  arc(u1, v1, -Math.PI / 2);
  return out;
}

export interface RecipeTiming {
  readonly tool: ToolName;
  readonly t0: number;
  readonly seed: number;
  readonly width?: number;
  readonly held?: boolean;
  readonly fps?: number;
  /** Duration of the first stroke (the rest keep their own). */
  readonly dur?: number;
}

/** Stroke recipes (arrow, loop, sun, ...) as timed marks played one after another. */
export function recipeMarks(recipes: readonly StrokeRecipe[], timing: RecipeTiming): Mark[] {
  let t = timing.t0;
  return recipes.map((recipe, index) => {
    if (index > 0) t += recipe.gap;
    const mark = strokeMark(recipe.pts, {
      tool: timing.tool,
      width: timing.width,
      t0: t,
      dur: recipe.dur ?? (index === 0 ? timing.dur : undefined),
      seed: timing.seed + recipe.seed,
      corners: recipe.corners ?? null,
      held: timing.held ?? false,
      fps: timing.fps ?? 12,
      smooth: recipe.smooth,
      ease: recipe.ease,
      boil: recipe.boil,
    });
    t = mark.t0 + mark.dur;
    return mark;
  });
}
