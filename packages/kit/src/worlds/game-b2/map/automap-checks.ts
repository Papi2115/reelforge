/**
 * Readability checks of an automap plan (real run Game B2 2: a 15-cell level at scale 14 left the
 * map a small island on a ~85 % black frame, and the shot ended on it): the drawn rooms span at
 * least half the frame's width or height, and a map held to the end of its shot sits over the
 * frozen level, never over black. Errors say what to change. Pure.
 */
import { SCREEN_H, SCREEN_W } from '../view/output.js';
import type { AutomapPlan } from './automap-plan.js';
import { MAX_SCALE } from './automap-spec.js';

/** The drawn rooms span at least this share of the frame's width or of its height. */
export const MIN_MAP_SPAN = 0.5;

/** Width and height (px at the plan's scale) of the box around every drawn room. */
export function mapSpan(plan: AutomapPlan): { readonly w: number; readonly h: number } {
  const boxes = plan.rooms.flatMap((room) => {
    const box = plan.geometry.rooms[room.room];
    return box === undefined ? [] : [box];
  });
  if (boxes.length === 0) return { w: 0, h: 0 };
  const cells = {
    w: Math.max(...boxes.map((box) => box.x1)) - Math.min(...boxes.map((box) => box.x0)),
    h: Math.max(...boxes.map((box) => box.y1)) - Math.min(...boxes.map((box) => box.y0)),
  };
  return { w: cells.w * plan.scale, h: cells.h * plan.scale };
}

/** Fails when the map is a small island in the frame (see MIN_MAP_SPAN). */
export function checkMapSpan(plan: AutomapPlan, fail: (message: string) => never): void {
  const { w, h } = mapSpan(plan);
  if (w === 0 || w >= SCREEN_W * MIN_MAP_SPAN || h >= SCREEN_H * MIN_MAP_SPAN) return;
  const cellsW = w / plan.scale;
  const cellsH = h / plan.scale;
  const needed = Math.ceil(
    Math.min((SCREEN_W * MIN_MAP_SPAN) / cellsW, (SCREEN_H * MIN_MAP_SPAN) / cellsH),
  );
  const fix =
    needed <= MAX_SCALE
      ? `raise scale to ${String(needed)} (max ${String(MAX_SCALE)})`
      : `the level is too small for a map: give it more rooms of the route, or raise scale to ${String(MAX_SCALE)} and list more rooms`;
  fail(
    `automap: the rooms span only ${String(Math.round(w))} x ${String(Math.round(h))} px of the 640 x 360 frame (a small island on black); they must span at least half its width or height: ${fix}`,
  );
}

/** Fails when the shot would end on a map over black (`exit: 'cut'` held to the shot's end). */
export function checkMapEnding(
  plan: AutomapPlan,
  duration: number | undefined,
  fail: (message: string) => never,
): void {
  if (duration === undefined || plan.backdrop !== 'void' || plan.exit !== 'cut') return;
  if (plan.until < duration - 0.05) return;
  fail(
    "automap: the map stays up to the end of the shot over a black screen (the film would end or cut on black); give it backdrop: 'freeze' (the level held dimmed behind it) or exit: 'fold' (back into the minimap)",
  );
}
