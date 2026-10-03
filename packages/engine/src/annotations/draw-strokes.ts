/** Stroke annotations: arrow and ring (draw-on along their paths). */
import { strokeStyle, px, EMPTY_RECT, type AnnotationDraw, type AnnotationEnv } from './env.js';
import { drawLabel } from './label.js';
import type { ParsedArrow, ParsedRing } from './options.js';
import { clampInto, labelAt, snappedDirection, type Direction } from './placement.js';
import {
  ellipsePoints,
  fillTriangleWithRim,
  grow,
  pathPixels,
  pointsRect,
  quadratic,
  roundedRectPoints,
  sampleCurve,
  strokePaths,
  unionRects,
  visiblePixels,
  wipePaint,
  type Point,
  type StrokeStyle,
} from './raster.js';
import { add, head, labelColors, labelFor, unit } from './stroke-kit.js';
import type { ResolvedTarget } from './targets.js';
import { wave } from './timing.js';

/** Where a segment from `outside` towards the centre of `rect` enters it (slab clipping). */
function rectEntry(
  rect: { x: number; y: number; w: number; h: number },
  outside: Point,
  inside: Point,
): Point {
  const dx = inside.x - outside.x;
  const dy = inside.y - outside.y;
  let t0 = 0;
  for (const [p, q] of [
    [-dx, outside.x - rect.x],
    [dx, rect.x + rect.w - outside.x],
    [-dy, outside.y - rect.y],
    [dy, rect.y + rect.h - outside.y],
  ] as const) {
    if (p === 0) continue;
    const r = q / p;
    if (p < 0) t0 = Math.max(t0, r);
  }
  return { x: outside.x + dx * t0, y: outside.y + dy * t0 };
}

export function drawArrow(env: AnnotationEnv, options: ParsedArrow): AnnotationDraw {
  const target = env.target(options.target, 'target');
  const centre = { x: env.width / 2, y: env.height / 2 };
  const fallback: Direction = { dx: -Math.SQRT1_2, dy: -Math.SQRT1_2 };
  const away = snappedDirection(target, centre, fallback);
  const tail = options.from
    ? env.target(options.from, 'from')
    : add(target, { x: away.dx, y: away.dy }, px(env, options.length));
  let tip: Point = target;
  if (
    target.kind === 'object' &&
    target.rect &&
    options.target.kind === 'object' &&
    options.target.anchor === undefined
  ) {
    tip = rectEntry(target.rect, tail, target);
  }
  const towardTail = unit(tip, tail);
  const bounce = options.bounce ? Math.round(2 * wave(env.phase, 1.4)) : 0;
  tip = add(tip, towardTail, options.gap + bounce);
  const start = add(tail, towardTail, bounce);
  const length = Math.hypot(tip.x - start.x, tip.y - start.y);
  let points: Point[];
  let control = start;
  if (options.curve === 'curved') {
    const normal = { x: -towardTail.y, y: towardTail.x };
    control = add(
      { x: (start.x + tip.x) / 2, y: (start.y + tip.y) / 2 },
      normal,
      options.bend * length,
    );
    points = sampleCurve(quadratic(start, control, tip), length * 1.3);
  } else if (options.curve === 'elbow') {
    const corner =
      Math.abs(tip.x - start.x) >= Math.abs(tip.y - start.y)
        ? { x: tip.x, y: start.y }
        : { x: start.x, y: tip.y };
    control = corner;
    points = [start, corner, tip];
  } else {
    points = [start, tip];
  }
  const path = pathPixels(points);
  const style = strokeStyle(env, options.thickness);
  const headSize = 4 + 3 * style.thickness;
  const label = options.text === undefined ? undefined : labelFor(env, options.text, options);
  const labelRect =
    label &&
    clampInto(
      labelAt(tail, { dx: towardTail.x, dy: towardTail.y }, 4, label.w, label.h),
      grow(env.safeArea, -1),
    );
  const extent = unionRects([pointsRect(points, headSize + 2), labelRect ?? EMPTY_RECT]);
  const result = {
    box: labelRect ? grow(labelRect, 1) : EMPTY_RECT,
    extent,
    textScale: label?.scale,
  };
  if (!env.phase.visible) return result;
  const paint = wipePaint(env.paint, extent, env.phase.wipe, env.height);
  const drawn = { ...style, paint };
  const shown = visiblePixels(path, env.phase.draw);
  const end = shown.at(-1);
  const before = shown.at(-Math.min(shown.length, headSize + 1));
  const direction =
    end && before && (end.x !== before.x || end.y !== before.y)
      ? unit(before, end)
      : unit(control, tip);
  const headPoint = end ?? tip;
  const triangle = head(headPoint, direction, headSize);
  const trimmed =
    options.head === 'triangle'
      ? Math.max(0, shown.length - Math.floor(headSize / 2))
      : shown.length;
  const body = [shown.slice(0, trimmed)];
  const open = options.head === 'open' ? [pathPixels([triangle[1], headPoint, triangle[2]])] : [];
  for (const pass of ['outline', 'fill'] as const) {
    strokePaths(env.surface, [...body, ...open], drawn, 1, pass);
    if (options.head === 'triangle' && end) fillTriangleWithRim(env.surface, triangle, drawn, pass);
  }
  if (label && labelRect)
    drawLabel(env.surface, label, labelRect, labelColors(env, options), paint);
  return result;
}

function ringPoints(
  options: ParsedRing,
  target: ResolvedTarget,
  env: AnnotationEnv,
  grow: number,
): Point[] {
  const centre = target.rect
    ? { x: target.rect.x + target.rect.w / 2, y: target.rect.y + target.rect.h / 2 }
    : target;
  if (options.shape === 'rect') {
    const w = options.size
      ? px(env, options.size[0])
      : (target.rect?.w ?? px(env, 0.1)) + 2 * options.padding;
    const h = options.size
      ? px(env, options.size[1])
      : (target.rect?.h ?? px(env, 0.1)) + 2 * options.padding;
    const rect = {
      x: Math.round(centre.x - w / 2) - grow,
      y: Math.round(centre.y - h / 2) - grow,
      w: Math.round(w) + 2 * grow,
      h: Math.round(h) + 2 * grow,
    };
    return roundedRectPoints(rect, 3);
  }
  if (options.radius !== undefined) {
    const radius = px(env, options.radius) + grow;
    return ellipsePoints(centre, radius, radius);
  }
  const rx = target.rect ? (target.rect.w / 2) * 1.3 + options.padding : px(env, 0.06);
  const ry = target.rect ? (target.rect.h / 2) * 1.35 + options.padding : px(env, 0.06);
  return ellipsePoints(centre, rx + grow, ry + grow);
}

export function drawRing(env: AnnotationEnv, options: ParsedRing): AnnotationDraw {
  const target = env.target(options.target, 'target');
  const grow = options.pulse ? Math.round(2 * wave(env.phase, 1.2)) : 0;
  const points = ringPoints(options, target, env, grow);
  const style: StrokeStyle = {
    ...strokeStyle(env, options.thickness),
    dash: options.dashed ? 4 : undefined,
  };
  const extent = pointsRect(points, style.thickness + 2);
  const result = { box: EMPTY_RECT, extent };
  if (!env.phase.visible) return result;
  const paint = wipePaint(env.paint, extent, env.phase.wipe, env.height);
  strokePaths(env.surface, [pathPixels(points, true)], { ...style, paint }, env.phase.draw);
  return result;
}
