/**
 * Horizontal view of the timeline (PLAN.md#6.5): zoom (pixels per second) and scroll offset over
 * a lane of `width` CSS pixels. Pure; every function returns a clamped view.
 */

export interface TimelineView {
  /** Timeline length (s). */
  readonly duration: number;
  /** Lane width (CSS px). */
  readonly width: number;
  readonly pxPerSecond: number;
  /** Content pixels scrolled out on the left. */
  readonly scrollX: number;
}

/** Highest zoom: a 30 fps frame is ~27 px wide. */
export const MAX_PX_PER_SECOND = 800;
/** One +/- step multiplies the zoom by this. */
export const ZOOM_STEP = 1.5;

/** Zoom at which the whole timeline fills the lane. */
export function fitPxPerSecond(duration: number, width: number): number {
  if (!(duration > 0) || !(width > 0)) return 1;
  return Math.min(width / duration, MAX_PX_PER_SECOND);
}

export function contentWidth(view: TimelineView): number {
  return Math.max(view.width, view.duration * view.pxPerSecond);
}

/** Clamps zoom (fit..max) and scroll (0..content end). */
export function clampView(view: TimelineView): TimelineView {
  const pxPerSecond = Math.min(
    Math.max(view.pxPerSecond, fitPxPerSecond(view.duration, view.width)),
    MAX_PX_PER_SECOND,
  );
  const zoomed = { ...view, pxPerSecond };
  const maxScroll = Math.max(0, contentWidth(zoomed) - view.width);
  const scrollX = Math.min(
    Math.max(Number.isFinite(view.scrollX) ? view.scrollX : 0, 0),
    maxScroll,
  );
  return { ...zoomed, scrollX };
}

/** The whole timeline in view. */
export function fitView(duration: number, width: number): TimelineView {
  return { duration, width, pxPerSecond: fitPxPerSecond(duration, width), scrollX: 0 };
}

export function timeToX(view: TimelineView, t: number): number {
  return t * view.pxPerSecond - view.scrollX;
}

/** Time under lane position `x`, clamped to the timeline. */
export function xToTime(view: TimelineView, x: number): number {
  if (!(view.pxPerSecond > 0)) return 0;
  return Math.min(Math.max((x + view.scrollX) / view.pxPerSecond, 0), view.duration);
}

/** Visible time window. */
export function visibleRange(view: TimelineView): { readonly from: number; readonly to: number } {
  const from = view.scrollX / view.pxPerSecond;
  return { from, to: from + view.width / view.pxPerSecond };
}

/** Multiplies the zoom by `factor`, keeping the time under lane position `anchorX` in place. */
export function zoomAround(view: TimelineView, factor: number, anchorX: number): TimelineView {
  const anchorT = (anchorX + view.scrollX) / view.pxPerSecond;
  const zoomed = clampView({ ...view, pxPerSecond: view.pxPerSecond * factor });
  return clampView({ ...zoomed, scrollX: anchorT * zoomed.pxPerSecond - anchorX });
}

/** Resized or re-timed lane: keeps the zoom (or fits, when the view showed everything). */
export function resizeView(view: TimelineView, duration: number, width: number): TimelineView {
  const wasFit = view.pxPerSecond <= fitPxPerSecond(view.duration, view.width) + 1e-9;
  if (wasFit) return fitView(duration, width);
  return clampView({ ...view, duration, width });
}

/** Scrolls so that `t` is visible (page-wise: `t` lands near the left edge when it was off). */
export function followTime(view: TimelineView, t: number): TimelineView {
  const x = timeToX(view, t);
  if (x >= 0 && x <= view.width) return view;
  return clampView({ ...view, scrollX: t * view.pxPerSecond - view.width * 0.1 });
}
