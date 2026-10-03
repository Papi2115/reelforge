/** Span annotations between two targets: bracket and dimension line (drawn from the middle out). */
import { strokeStyle, px, EMPTY_RECT, type AnnotationDraw, type AnnotationEnv } from './env.js';
import { drawLabel } from './label.js';
import type { ParsedBracket, ParsedDimension } from './options.js';
import { clampInto, labelAt } from './placement.js';
import {
  fillTriangleWithRim,
  grow,
  pathPixels,
  pointsRect,
  quadratic,
  sampleCurve,
  strokePaths,
  unionRects,
  wipePaint,
  type Point,
} from './raster.js';
import { add, head, labelColors, labelFor, unit } from './stroke-kit.js';
import type { ResolvedTarget } from './targets.js';

interface Span {
  readonly start: Point;
  readonly end: Point;
  /** Unit normal pointing away from the measured things. */
  readonly normal: Point;
}

/** Span between two targets; two whole objects span their projected bounds. */
function spanOf(
  env: AnnotationEnv,
  from: ResolvedTarget,
  to: ResolvedTarget,
  wholeObjects: boolean,
  flip: boolean,
): Span {
  const horizontal = Math.abs(to.x - from.x) >= Math.abs(to.y - from.y);
  const sign = flip ? -1 : 1;
  if (wholeObjects && from.rect && to.rect) {
    const both = unionRects([from.rect, to.rect]);
    if (horizontal) {
      const above = !flip;
      const y = above ? both.y : both.y + both.h;
      return {
        start: { x: both.x, y },
        end: { x: both.x + both.w, y },
        normal: { x: 0, y: above ? -1 : 1 },
      };
    }
    const right = both.x + both.w / 2 > env.width / 2 !== flip;
    const x = right ? both.x + both.w : both.x;
    return {
      start: { x, y: both.y },
      end: { x, y: both.y + both.h },
      normal: { x: right ? 1 : -1, y: 0 },
    };
  }
  const along = unit(from, to);
  let normal = { x: -along.y, y: along.x };
  const mid = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
  const outward = horizontal ? normal.y < 0 : (mid.x - env.width / 2) * normal.x >= 0;
  if (!outward) normal = { x: -normal.x, y: -normal.y };
  return { start: from, end: to, normal: { x: normal.x * sign, y: normal.y * sign } };
}

function isWholeObject(spec: ParsedBracket['from']): boolean {
  return spec.kind === 'object' && spec.anchor === undefined;
}

function bracketHalves(
  span: Span,
  depth: number,
  curly: boolean,
): { tip: Point; halves: Point[][] } {
  const length = Math.hypot(span.end.x - span.start.x, span.end.y - span.start.y);
  const along = unit(span.start, span.end);
  const at = (u: number, v: number): Point => add(add(span.start, along, u), span.normal, v);
  const half = length / 2;
  const tip = at(half, depth);
  if (!curly) {
    const shoulder = depth * 0.6;
    return {
      tip,
      halves: [
        [at(half, shoulder), at(0, shoulder), at(0, 0)],
        [at(half, shoulder), at(length, shoulder), at(length, 0)],
        [at(half, shoulder), tip],
      ],
    };
  }
  const q = Math.min(depth * 0.7, length * 0.15);
  const side = (sign: 1 | -1): Point[] => {
    const u = (value: number): number => half + sign * value;
    const near = sampleCurve(
      quadratic(at(half, depth), at(half, depth / 2), at(u(q), depth / 2)),
      q * 2,
    );
    const far = sampleCurve(
      quadratic(at(u(half - q), depth / 2), at(u(half), depth / 2), at(u(half), 0)),
      q * 2,
    );
    return [...near, ...far];
  };
  return { tip, halves: [side(-1), side(1)] };
}

export function drawBracket(env: AnnotationEnv, options: ParsedBracket): AnnotationDraw {
  const from = env.target(options.from, 'from');
  const to = env.target(options.to, 'to');
  const whole = isWholeObject(options.from) && isWholeObject(options.to);
  const base = spanOf(env, from, to, whole, options.flip);
  const offset = px(env, options.offset);
  const span = {
    ...base,
    start: add(base.start, base.normal, offset),
    end: add(base.end, base.normal, offset),
  };
  const { tip, halves } = bracketHalves(span, px(env, options.depth), options.style === 'curly');
  const style = strokeStyle(env, options.thickness);
  const label = options.text === undefined ? undefined : labelFor(env, options.text, options);
  const labelRect =
    label &&
    clampInto(
      labelAt(tip, { dx: span.normal.x, dy: span.normal.y }, 3, label.w, label.h),
      grow(env.safeArea, -1),
    );
  const extent = unionRects([
    pointsRect(halves.flat(), style.thickness + 2),
    labelRect ?? EMPTY_RECT,
  ]);
  const result = {
    box: labelRect ? grow(labelRect, 1) : EMPTY_RECT,
    extent,
    textScale: label?.scale,
  };
  if (!env.phase.visible) return result;
  const paint = wipePaint(env.paint, extent, env.phase.wipe, env.height);
  strokePaths(
    env.surface,
    halves.map((half) => pathPixels(half)),
    { ...style, paint },
    env.phase.draw,
  );
  if (label && labelRect && env.phase.draw >= 0.6)
    drawLabel(env.surface, label, labelRect, labelColors(env, options), paint);
  return result;
}

export function drawDimension(env: AnnotationEnv, options: ParsedDimension): AnnotationDraw {
  const from = env.target(options.from, 'from');
  const to = env.target(options.to, 'to');
  const whole = isWholeObject(options.from) && isWholeObject(options.to);
  const span = spanOf(env, from, to, whole, options.flip);
  const offset = px(env, options.offset);
  const a = add(span.start, span.normal, offset);
  const b = add(span.end, span.normal, offset);
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const along = unit(a, b);
  const thickness = options.thickness ?? Math.max(1, env.stroke - 1);
  const style = strokeStyle(env, thickness);
  const tick = 3 + thickness * 2;
  const extensions = [
    [add(span.start, span.normal, 3), add(a, span.normal, 3)],
    [add(span.end, span.normal, 3), add(b, span.normal, 3)],
  ];
  const ticks =
    options.ends === 'ticks'
      ? [
          [add(a, span.normal, -tick / 2), add(a, span.normal, tick / 2)],
          [add(b, span.normal, -tick / 2), add(b, span.normal, tick / 2)],
        ]
      : [];
  const label = labelFor(env, options.text, options);
  const labelRect = clampInto(
    {
      x: Math.round(mid.x - label.w / 2),
      y: Math.round(mid.y - label.h / 2),
      w: label.w,
      h: label.h,
    },
    grow(env.safeArea, -1),
  );
  const all = [a, b, ...extensions.flat(), ...ticks.flat()];
  const extent = unionRects([pointsRect(all, tick), labelRect]);
  const result = { box: grow(labelRect, 1), extent, textScale: label.scale };
  if (!env.phase.visible) return result;
  const paint = wipePaint(env.paint, extent, env.phase.wipe, env.height);
  const drawn = { ...style, paint };
  const halves = [pathPixels([mid, a]), pathPixels([mid, b])];
  const done = env.phase.draw >= 0.95;
  for (const pass of ['outline', 'fill'] as const) {
    strokePaths(env.surface, halves, drawn, env.phase.draw, pass);
    if (!done) continue;
    strokePaths(
      env.surface,
      [...extensions, ...ticks].map((segment) => pathPixels(segment)),
      { ...drawn, thickness: 1 },
      1,
      pass,
    );
    if (options.ends === 'arrows') {
      fillTriangleWithRim(env.surface, head(a, { x: -along.x, y: -along.y }, tick), drawn, pass);
      fillTriangleWithRim(env.surface, head(b, along, tick), drawn, pass);
    }
  }
  if (env.phase.draw >= 0.5)
    drawLabel(env.surface, label, labelRect, labelColors(env, options), paint);
  return result;
}
