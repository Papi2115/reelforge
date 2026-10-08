/**
 * The room camera of the Game B1 world. The living room is drawn in square "room units" (320 x
 * 180 at the default zoom 2 = one unit is 2 x 2 px); a view = the room point at the frame centre
 * (fx, fy), the zoom s (px per unit) and `inTv` (0..1): how far the camera has gone INTO the TV
 * (1 = the TV picture fills the frame, the room is gone). Camera keys interpolate linearly with an
 * ease per leg, like the showcase's push-in; the pen maps room units to px for the current view.
 */
import type { IndexCanvas } from '../core/canvas.js';
import { EASES, type EaseId, seg } from '../core/math.js';
import type { Lut } from '../palette.js';

export interface View {
  readonly fx: number;
  readonly fy: number;
  readonly s: number;
  readonly inTv: number;
}

/** The TV's glass in room units (the cabinet stands at 22, 44). */
export const TV_GLASS = { x: 34, y: 56, w: 70, h: 52 } as const;

export const VIEWS = {
  /** The whole living room. */
  room: { fx: 160, fy: 90, s: 2, inTv: 0 },
  /** Inside the TV: its picture fills the frame. */
  tv: {
    fx: TV_GLASS.x + TV_GLASS.w / 2,
    fy: TV_GLASS.y + TV_GLASS.h / 2,
    s: 360 / TV_GLASS.h,
    inTv: 1,
  },
  /** Pushed in on the wall calendar (it lands where a calendar boss stands on the TV). */
  calendar: { fx: 154.07, fy: 47.2, s: 184 / 34, inTv: 0 },
  /** On the console and the floor in front of the TV. */
  console: { fx: 92, fy: 138, s: 4, inTv: 0 },
} as const satisfies Record<string, View>;

export type ViewName = keyof typeof VIEWS;
export const VIEW_NAMES = Object.keys(VIEWS) as readonly ViewName[];

export interface CameraKey {
  readonly at: number;
  readonly view: View;
  readonly ease: EaseId;
}

/** The view at t: before the first key = its view, after the last = the last view. */
export function viewAt(keys: readonly CameraKey[], t: number, fallback: View): View {
  const first = keys[0];
  if (first === undefined) return fallback;
  if (t <= first.at) return first.view;
  for (let i = 1; i < keys.length; i += 1) {
    const b = keys[i];
    const a = keys[i - 1];
    if (a === undefined || b === undefined || t >= b.at) continue;
    const u = EASES[b.ease](seg(t, a.at, b.at));
    return {
      fx: a.view.fx + (b.view.fx - a.view.fx) * u,
      fy: a.view.fy + (b.view.fy - a.view.fy) * u,
      s: a.view.s + (b.view.s - a.view.s) * u,
      inTv: a.view.inTv + (b.view.inTv - a.view.inTv) * u,
    };
  }
  return keys[keys.length - 1]?.view ?? fallback;
}

/** Room-unit drawing on the frame canvas through the current view. */
export class RoomPen {
  ox = 0;
  oy = 0;
  s = 2;

  constructor(readonly cv: IndexCanvas) {}

  set(view: View, shake: { x: number; y: number } = { x: 0, y: 0 }): void {
    this.s = view.s;
    this.ox = 320 - view.fx * view.s + shake.x;
    this.oy = 180 - view.fy * view.s + shake.y;
  }

  X(x: number): number {
    return Math.round(this.ox + x * this.s);
  }

  Y(y: number): number {
    return Math.round(this.oy + y * this.s);
  }

  /** The px rect of a room-unit rect. */
  box(x: number, y: number, w: number, h: number): [number, number, number, number] {
    const x0 = this.X(x);
    const y0 = this.Y(y);
    return [x0, y0, this.X(x + w) - x0, this.Y(y + h) - y0];
  }

  rr(x: number, y: number, w: number, h: number, c: number): void {
    this.cv.rect(...this.box(x, y, w, h), c);
  }

  rd(x: number, y: number, w: number, h: number, c: number, level: number): void {
    this.cv.dither(...this.box(x, y, w, h), c, level);
  }

  rmap(x: number, y: number, w: number, h: number, table: Lut, level?: number): void {
    this.cv.remap(...this.box(x, y, w, h), table, level);
  }

  rpoly(pts: readonly number[], c: number, table?: Lut): void {
    this.cv.poly(
      pts.map((v, i) => (i % 2 === 1 ? this.oy + v * this.s : this.ox + v * this.s)),
      c,
      table,
    );
  }

  rline(x0: number, y0: number, x1: number, y1: number, c: number, brush = 1): void {
    this.cv.line(
      this.ox + x0 * this.s,
      this.oy + y0 * this.s,
      this.ox + x1 * this.s,
      this.oy + y1 * this.s,
      c,
      Math.max(1, Math.round((brush * this.s) / 2)),
    );
  }

  rell(cx: number, cy: number, rx: number, ry: number, c: number): void {
    this.cv.ellipse(this.ox + cx * this.s, this.oy + cy * this.s, rx * this.s, ry * this.s, c);
  }
}
