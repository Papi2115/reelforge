/**
 * Pixel-art raster primitives of the annotation layer, drawn into the text surface: shapes become
 * ordered, 8-connected "pixel-perfect" paths (no L-shaped double pixels), so a draw-on animation
 * is a prefix of the path and strokes stay crisp at every thickness. Pure geometry, no state.
 */
import type { Paint, Rgb8, TextSurface } from '../text/surface.js';
import type { PixelRect } from '../text/types.js';

export interface Point {
  readonly x: number;
  readonly y: number;
}

/** Integer pixels of the segment a-b (Bresenham), both ends included. */
function linePixels(a: Point, b: Point, into: Point[]): void {
  let x = Math.round(a.x);
  let y = Math.round(a.y);
  const x1 = Math.round(b.x);
  const y1 = Math.round(b.y);
  const dx = Math.abs(x1 - x);
  const dy = -Math.abs(y1 - y);
  const sx = x < x1 ? 1 : -1;
  const sy = y < y1 ? 1 : -1;
  let error = dx + dy;
  for (;;) {
    const last = into.at(-1);
    if (!last || last.x !== x || last.y !== y) into.push({ x, y });
    if (x === x1 && y === y1) return;
    const doubled = 2 * error;
    if (doubled >= dy) {
      error += dy;
      x += sx;
    }
    if (doubled <= dx) {
      error += dx;
      y += sy;
    }
  }
}

/** Drops the corner pixel of every L-shaped step, the classic pixel-art line clean-up. */
function pixelPerfect(pixels: readonly Point[]): Point[] {
  const out: Point[] = [];
  for (const pixel of pixels) {
    const previous = out.at(-1);
    const beforePrevious = out.at(-2);
    if (
      previous &&
      beforePrevious &&
      (beforePrevious.x === previous.x || beforePrevious.y === previous.y) &&
      (pixel.x === previous.x || pixel.y === previous.y) &&
      beforePrevious.x !== pixel.x &&
      beforePrevious.y !== pixel.y
    ) {
      out.pop();
    }
    out.push(pixel);
  }
  return out;
}

/** Ordered pixels of a polyline (closed: back to the first point). */
export function pathPixels(points: readonly Point[], closed = false): Point[] {
  const pixels: Point[] = [];
  const list = closed && points.length > 2 ? [...points, points[0] as Point] : points;
  for (let index = 1; index < list.length; index += 1) {
    linePixels(list[index - 1] as Point, list[index] as Point, pixels);
  }
  if (list.length === 1 && list[0]) linePixels(list[0], list[0], pixels);
  return pixelPerfect(pixels);
}

/** Samples a parametric curve (u in 0..1) densely enough for a connected pixel path. */
export function sampleCurve(curve: (u: number) => Point, approxLength: number): Point[] {
  const steps = Math.max(8, Math.ceil(approxLength / 2));
  return Array.from({ length: steps + 1 }, (_unused, index) => curve(index / steps));
}

export function quadratic(a: Point, control: Point, b: Point): (u: number) => Point {
  return (u) => {
    const v = 1 - u;
    return {
      x: v * v * a.x + 2 * v * u * control.x + u * u * b.x,
      y: v * v * a.y + 2 * v * u * control.y + u * u * b.y,
    };
  };
}

/** Ellipse outline starting at the top, clockwise on screen. */
export function ellipsePoints(center: Point, rx: number, ry: number): Point[] {
  const perimeter = 2 * Math.PI * Math.sqrt((rx * rx + ry * ry) / 2);
  const steps = Math.max(16, Math.ceil(perimeter / 1.5));
  return Array.from({ length: steps }, (_unused, index) => {
    const angle = -Math.PI / 2 + (index / steps) * 2 * Math.PI;
    return { x: center.x + rx * Math.cos(angle), y: center.y + ry * Math.sin(angle) };
  });
}

/** Rounded rectangle outline (corner radius in pixels), from the top middle, clockwise. */
export function roundedRectPoints(rect: PixelRect, radius: number): Point[] {
  const r = Math.max(0, Math.min(radius, rect.w / 2, rect.h / 2));
  const left = rect.x;
  const top = rect.y;
  const right = rect.x + rect.w - 1;
  const bottom = rect.y + rect.h - 1;
  const corner = (cx: number, cy: number, from: number): Point[] =>
    r === 0
      ? [{ x: cx, y: cy }]
      : Array.from({ length: 5 }, (_unused, index) => {
          const angle = from + (index / 4) * (Math.PI / 2);
          return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
        });
  const middle = { x: (left + right) / 2, y: top };
  return [
    middle,
    ...corner(r === 0 ? right : right - r, r === 0 ? top : top + r, -Math.PI / 2),
    ...corner(r === 0 ? right : right - r, r === 0 ? bottom : bottom - r, 0),
    ...corner(r === 0 ? left : left + r, r === 0 ? bottom : bottom - r, Math.PI / 2),
    ...corner(r === 0 ? left : left + r, r === 0 ? top : top + r, Math.PI),
    middle,
  ];
}

export interface StrokeStyle {
  readonly color: Rgb8;
  readonly thickness: number;
  /** Rim colour drawn 1 px around the stroke first. */
  readonly outline: Rgb8 | undefined;
  readonly paint: Paint;
  /** Draw `dash` pixels, skip `dash` pixels. */
  readonly dash?: number | undefined;
}

function brush(surface: TextSurface, pixel: Point, size: number, color: Rgb8, paint: Paint): void {
  const offset = Math.floor((size - 1) / 2);
  surface.fillRect({ x: pixel.x - offset, y: pixel.y - offset, w: size, h: size }, color, paint);
}

export type StrokePass = 'outline' | 'fill' | 'both';

/** The first `share` of a pixel path (dashes applied). */
export function visiblePixels(path: readonly Point[], share: number, dash?: number): Point[] {
  const count = Math.round(path.length * Math.min(1, Math.max(0, share)));
  return path
    .slice(0, count)
    .filter((_pixel, index) => dash === undefined || Math.floor(index / dash) % 2 === 0);
}

/**
 * Draws the first `share` of the pixel paths: the outline pass under all of them, then the fill
 * (`pass` draws only one of them, so several shapes can share one outline layer).
 */
export function strokePaths(
  surface: TextSurface,
  paths: readonly (readonly Point[])[],
  style: StrokeStyle,
  share = 1,
  pass: StrokePass = 'both',
): void {
  const visible = paths.map((path) => visiblePixels(path, share, style.dash));
  if (style.outline && pass !== 'fill') {
    for (const path of visible) {
      for (const pixel of path)
        brush(surface, pixel, style.thickness + 2, style.outline, style.paint);
    }
  }
  if (pass === 'outline') return;
  for (const path of visible) {
    for (const pixel of path) brush(surface, pixel, style.thickness, style.color, style.paint);
  }
}

/** A filled triangle with an optional 1 px rim (rim pass first, like strokes). */
export function fillTriangleWithRim(
  surface: TextSurface,
  corners: readonly [Point, Point, Point],
  style: StrokeStyle,
  pass: StrokePass = 'both',
): void {
  if (style.outline && pass !== 'fill') {
    const cx = (corners[0].x + corners[1].x + corners[2].x) / 3;
    const cy = (corners[0].y + corners[1].y + corners[2].y) / 3;
    const push = (corner: Point): Point => {
      const dx = corner.x - cx;
      const dy = corner.y - cy;
      const length = Math.hypot(dx, dy) || 1;
      return { x: corner.x + (dx / length) * 2, y: corner.y + (dy / length) * 2 };
    };
    const grown = [push(corners[0]), push(corners[1]), push(corners[2])] as const;
    fillTriangle(surface, grown, style.outline, style.paint);
  }
  if (pass !== 'outline') fillTriangle(surface, corners, style.color, style.paint);
}

function edge(a: Point, b: Point, x: number, y: number): number {
  return (b.x - a.x) * (y - a.y) - (b.y - a.y) * (x - a.x);
}

/** Filled triangle (pixel centres inside, either winding). */
export function fillTriangle(
  surface: TextSurface,
  corners: readonly [Point, Point, Point],
  color: Rgb8,
  paint: Paint,
): void {
  const [a, b, c] = corners;
  const area = edge(a, b, c.x, c.y);
  if (area === 0) return;
  const sign = Math.sign(area);
  const x0 = Math.floor(Math.min(a.x, b.x, c.x));
  const x1 = Math.ceil(Math.max(a.x, b.x, c.x));
  const y0 = Math.floor(Math.min(a.y, b.y, c.y));
  const y1 = Math.ceil(Math.max(a.y, b.y, c.y));
  for (let y = y0; y <= y1; y += 1) {
    for (let x = x0; x <= x1; x += 1) {
      const px = x + 0.5;
      const py = y + 0.5;
      if (
        sign * edge(a, b, px, py) >= 0 &&
        sign * edge(b, c, px, py) >= 0 &&
        sign * edge(c, a, px, py) >= 0
      ) {
        surface.fillRect({ x, y, w: 1, h: 1 }, color, paint);
      }
    }
  }
}

/** Filled disc of `diameter` pixels whose top-left bounding pixel is (x, y). */
export function fillDisc(surface: TextSurface, box: PixelRect, color: Rgb8, paint: Paint): void {
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  const rx = box.w / 2;
  const ry = box.h / 2;
  for (let y = box.y; y < box.y + box.h; y += 1) {
    const dy = (y + 0.5 - cy) / ry;
    const half = rx * Math.sqrt(Math.max(0, 1 - dy * dy));
    const left = Math.round(cx - half);
    const right = Math.round(cx + half);
    if (right > left) surface.fillRect({ x: left, y, w: right - left, h: 1 }, color, paint);
  }
}

export function grow(rect: PixelRect, by: number): PixelRect {
  return { x: rect.x - by, y: rect.y - by, w: rect.w + 2 * by, h: rect.h + 2 * by };
}

export function unionRects(rects: readonly PixelRect[]): PixelRect {
  const real = rects.filter((rect) => rect.w > 0 && rect.h > 0);
  if (real.length === 0) return { x: 0, y: 0, w: 0, h: 0 };
  const x = Math.min(...real.map((rect) => rect.x));
  const y = Math.min(...real.map((rect) => rect.y));
  const right = Math.max(...real.map((rect) => rect.x + rect.w));
  const bottom = Math.max(...real.map((rect) => rect.y + rect.h));
  return { x, y, w: right - x, h: bottom - y };
}

/** Bounding rect of points, grown by `pad` pixels. */
export function pointsRect(points: readonly Point[], pad = 0): PixelRect {
  if (points.length === 0) return { x: 0, y: 0, w: 0, h: 0 };
  const x0 = Math.floor(Math.min(...points.map((point) => point.x))) - pad;
  const y0 = Math.floor(Math.min(...points.map((point) => point.y))) - pad;
  const x1 = Math.ceil(Math.max(...points.map((point) => point.x))) + 1 + pad;
  const y1 = Math.ceil(Math.max(...points.map((point) => point.y))) + 1 + pad;
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

/** Paint clipped to the left `wipe` share of `extent` (wipe animation). */
export function wipePaint(paint: Paint, extent: PixelRect, wipe: number, height: number): Paint {
  if (wipe >= 1) return paint;
  return { ...paint, clip: { x: extent.x, y: 0, w: Math.round(extent.w * wipe), h: height } };
}
