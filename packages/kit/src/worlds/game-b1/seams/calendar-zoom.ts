/**
 * The calendar zoom (the showcase's shot 2 -> 3 match cut, "masterful", docs/worlds/DECISIONS.md):
 * the room camera pushes into the wall calendar until its page stands where the next place's
 * page will stand, then the whole frame is redrawn line by line, interlaced like a 2600 kernel
 * painting a new screen, as the TV picture of the next place. The calendar page is the one thing
 * that stays (same place, same size); everything around it changes cleanly. Without the redraw
 * the shot ends on the calendar and the world transition `game-b1-scanline-wipe` (or the
 * zoom-through link `game-b1-calendar-zoom`) carries it into the next shot.
 */
import { dith, type IndexCanvas } from '../core/canvas.js';
import { EASES, lerp, seg } from '../core/math.js';
import { C } from '../palette.js';
import { VIEWS, type View } from '../room/view.js';
import { UNIT_X, UNIT_Y } from '../tv/painter.js';
import type { ScreenModel } from '../screen/model.js';

export interface ZoomPlan {
  readonly at: number;
  /** The camera rests on the calendar. */
  readonly end: number;
  /** The redraw is done and the frame is the TV picture; undefined = no redraw. */
  readonly wipeEnd: number | undefined;
}

/** The wall calendar in room units (living-room.ts draws it at 166, 22, 34 x 48). */
const CALENDAR = { x: 166, y: 22, w: 34, h: 48 } as const;

/** Where the calendar page stands in TV units once the camera has landed (x, y, w, h). */
export function calendarLanding(): { x: number; y: number; w: number; h: number } {
  const v = VIEWS.calendar;
  const px = (x: number) => 320 + (x - v.fx) * v.s;
  const py = (y: number) => 180 + (y - v.fy) * v.s;
  return {
    x: Math.round(px(CALENDAR.x) / UNIT_X),
    y: Math.round(py(CALENDAR.y) / UNIT_Y),
    w: Math.round((CALENDAR.w * v.s) / UNIT_X),
    h: Math.round((CALENDAR.h * v.s) / UNIT_Y),
  };
}

/** The camera with the zoom: before `at` the shot's own camera, then the push, then the page. */
export function zoomView(plan: ZoomPlan, t: number, camera: (t: number) => View): View {
  if (t <= plan.at) return camera(t);
  if (plan.wipeEnd !== undefined && t >= plan.wipeEnd) return VIEWS.tv;
  const from = camera(plan.at);
  const to = VIEWS.calendar;
  const u = EASES.inOut(seg(t, plan.at, plan.end));
  return {
    fx: lerp(from.fx, to.fx, u),
    fy: lerp(from.fy, to.fy, u),
    s: lerp(from.s, to.s, u),
    inTv: lerp(from.inTv, 0, u),
  };
}

/**
 * Interlaced redraw: even rows top-down first, then the odd ones; rows not drawn yet keep
 * `under`; a dithered cream beam marks the front.
 */
export function scanWipe(frame: IndexCanvas, under: IndexCanvas, k: number): void {
  const { w, h } = frame;
  const pass = k < 0.5 ? 0 : 1;
  const front = Math.floor(((k < 0.5 ? k : k - 0.5) / 0.5) * h);
  for (let y = 0; y < h; y += 1) {
    const even = y % 2 === 0;
    const drawn = (even && (pass === 1 || y < front)) || (!even && pass === 1 && y < front);
    const row = y * w;
    if (!drawn) frame.d.set(under.d.subarray(row, row + w), row);
    if (y === front || y === front + 1)
      for (let x = 0; x < w; x += 1) if (dith(x, y, 0.6)) frame.d[row + x] = C.CREAM;
  }
}

/** Paints the redraw when t is inside it; false = not redrawing (the model paints as usual). */
export function paintZoomWipe(model: ScreenModel, plan: ZoomPlan, t: number): boolean {
  const { wipeEnd } = plan;
  if (wipeEnd === undefined || t < plan.end || t >= wipeEnd) return false;
  model.paintView(plan.end, VIEWS.calendar);
  const under = model.spare;
  under.d.set(model.frame.d);
  model.paintView(t, VIEWS.tv);
  scanWipe(model.frame, under, seg(t, plan.end, wipeEnd));
  return true;
}
