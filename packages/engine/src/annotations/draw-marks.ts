/** Marks on things: underline, highlight (marker bar behind), badge (number/check/cross), spotlight. */
import { EngineError } from '../errors.js';
import { hashString } from '../rng.js';
import { drawBlock, uniformLooks } from '../text/draw.js';
import { DISPLAY_FONT } from '../text/font-display.js';
import type { Glyph } from '../text/font.js';
import { inkBox, layoutText } from '../text/layout.js';
import type { Paint, Rgb8, TextSurface } from '../text/surface.js';
import type { PixelRect } from '../text/types.js';
import { strokeStyle, px, EMPTY_RECT, type AnnotationDraw, type AnnotationEnv } from './env.js';
import { CHECK_GLYPH, CROSS_GLYPH } from './glyphs.js';
import type { ParsedBadge, ParsedHighlight, ParsedSpotlight, ParsedUnderline } from './options.js';
import { centredRect } from './placement.js';
import { fillDisc, grow, pathPixels, strokePaths, wipePaint, type Point } from './raster.js';
import type { ResolvedTarget } from './targets.js';
import { wave } from './timing.js';

function boundsOf(target: ResolvedTarget, env: AnnotationEnv, fallbackShare: number): PixelRect {
  if (target.rect) return target.rect;
  const size = Math.round(px(env, fallbackShare));
  return centredRect(target, size, size);
}

function jitter(seed: number, index: number, amplitude: number): number {
  return Math.round(((hashString(String(index), seed) / 0xffffffff) * 2 - 1) * amplitude);
}

export function drawUnderline(env: AnnotationEnv, options: ParsedUnderline): AnnotationDraw {
  const target = env.target(options.target, 'target');
  const rect = boundsOf(target, env, 0.12);
  const style = strokeStyle(env, options.thickness);
  const y = rect.y + rect.h + options.gap + Math.floor(style.thickness / 2);
  const left = rect.x;
  const right = rect.x + rect.w - 1;
  let paths: Point[][];
  if (options.style === 'scribble') {
    const step = 6;
    const count = Math.max(2, Math.ceil((right - left) / step));
    const forward = Array.from({ length: count + 1 }, (_unused, index) => ({
      x: left + (index * (right - left)) / count,
      y: y + jitter(env.seed, index, 1.5),
    }));
    const back = Array.from({ length: count + 1 }, (_unused, index) => ({
      x: right - (index * (right - left)) / count,
      y: y + 3 + jitter(env.seed, index + 1000, 1.5),
    }));
    paths = [[...forward, ...back]];
  } else {
    paths = [
      [
        { x: left, y },
        { x: right, y },
      ],
    ];
    if (options.style === 'double') {
      const second = y + style.thickness + 2;
      paths.push([
        { x: left, y: second },
        { x: right, y: second },
      ]);
    }
  }
  const extent = grow({ x: left, y: y - 2, w: right - left + 1, h: 10 }, style.thickness + 1);
  const result = { box: EMPTY_RECT, extent };
  if (!env.phase.visible) return result;
  const paint = wipePaint(env.paint, extent, env.phase.wipe, env.height);
  strokePaths(
    env.surface,
    paths.map((path) => pathPixels(path)),
    { ...style, paint },
    env.phase.draw,
  );
  return result;
}

export function drawHighlight(env: AnnotationEnv, options: ParsedHighlight): AnnotationDraw {
  const target = env.target(options.target, 'target');
  const rect = grow(boundsOf(target, env, 0.12), options.padding);
  const result = { box: EMPTY_RECT, extent: rect };
  if (!env.phase.visible) return result;
  const share = Math.min(env.phase.wipe, env.phase.draw);
  const paint: Paint = { ...wipePaint(env.paint, rect, share, env.height), under: true };
  env.surface.fillRect(rect, env.color, paint);
  return result;
}

function drawGlyphCentred(
  surface: TextSurface,
  glyph: Glyph,
  centre: Point,
  scale: number,
  color: Rgb8,
  paint: Paint,
): void {
  const x = Math.round(centre.x - (glyph.width * scale) / 2);
  const y = Math.round(centre.y - (glyph.height * scale) / 2);
  surface.drawGlyph(glyph, x, y, scale, color, paint);
}

function drawBadgeValue(
  env: AnnotationEnv,
  value: ParsedBadge['value'],
  centre: Point,
  scale: number,
  color: Rgb8,
  paint: Paint,
): void {
  if (value === 'check' || value === 'cross') {
    drawGlyphCentred(
      env.surface,
      value === 'check' ? CHECK_GLYPH : CROSS_GLYPH,
      centre,
      scale,
      color,
      paint,
    );
    return;
  }
  const layout = layoutText(String(value), DISPLAY_FONT);
  const ink = inkBox(layout, 'left', scale, 0, 0);
  const left = Math.round(centre.x - ink.w / 2) - ink.x;
  const top = Math.round(centre.y - ink.h / 2) - ink.y;
  const looks = uniformLooks(layout, { dx: 0, dy: 0, scale, color }, Infinity);
  drawBlock(env.surface, { layout, align: 'left', scale, left, top }, looks, paint);
}

function badgeCentre(env: AnnotationEnv, options: ParsedBadge): Point {
  if (options.target) {
    const target = env.target(options.target, 'target');
    return { x: target.x + options.nudge[0], y: target.y + options.nudge[1] };
  }
  if (options.pos) {
    return {
      x: options.pos[0] * env.width + options.nudge[0],
      y: options.pos[1] * env.height + options.nudge[1],
    };
  }
  throw new EngineError(
    'invalid-annotation-options',
    'ctx.annotate.badge(): give a target (what it marks) or pos ([x, y], 0..1 of the frame)',
  );
}

export function drawBadge(env: AnnotationEnv, options: ParsedBadge): AnnotationDraw {
  const centre = badgeCentre(env, options);
  const cap = DISPLAY_FONT.capHeight;
  const glyphScale =
    options.size === undefined
      ? env.labelScale
      : Math.max(1, Math.floor((px(env, options.size) * 0.62) / cap));
  // Odd diameters keep the number centred on a pixel.
  const base =
    options.size === undefined
      ? Math.round((cap * glyphScale) / 0.6) | 1
      : Math.max(9, Math.round(px(env, options.size)) | 1);
  const pulse = options.pulse ? Math.round(2 * wave(env.phase, 1.2)) : 0;
  const size = Math.max(0, Math.round((base + pulse) * env.phase.pop));
  const restBox = grow(centredRect(centre, base, base), 1);
  const result = { box: restBox, extent: grow(restBox, 2), textScale: glyphScale };
  if (!env.phase.visible || size < 3) return result;
  const paint = wipePaint(env.paint, restBox, env.phase.wipe, env.height);
  const rect = centredRect(centre, size, size);
  const dark = env.outline ?? env.resolveColor('outline', 'outline');
  const ink =
    options.textColor === undefined
      ? options.shape === 'none'
        ? env.color
        : dark
      : env.resolveColor(options.textColor, 'textColor');
  if (options.shape === 'circle') {
    if (env.outline) fillDisc(env.surface, grow(rect, 1), env.outline, paint);
    fillDisc(env.surface, rect, env.color, paint);
  } else if (options.shape === 'square') {
    if (env.outline) env.surface.fillRect(grow(rect, 1), env.outline, paint);
    env.surface.fillRect(rect, env.color, paint);
  }
  if (env.phase.pop < 0.8) return result;
  const value = options.value;
  if (options.shape === 'none' && env.outline) {
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      drawBadgeValue(
        env,
        value,
        { x: centre.x + dx, y: centre.y + dy },
        glyphScale + 1,
        env.outline,
        paint,
      );
    }
  }
  drawBadgeValue(
    env,
    value,
    centre,
    options.shape === 'none' ? glyphScale + 1 : glyphScale,
    ink,
    paint,
  );
  return result;
}

interface SpotShape {
  readonly centre: Point;
  /** Circle radius, or half sizes of the rect. */
  readonly rx: number;
  readonly ry: number;
  readonly circle: boolean;
}

function spotShape(
  env: AnnotationEnv,
  options: ParsedSpotlight,
  target: ResolvedTarget,
): SpotShape {
  const centre = target.rect
    ? { x: target.rect.x + target.rect.w / 2, y: target.rect.y + target.rect.h / 2 }
    : target;
  if (options.shape === 'rect') {
    const w = options.size
      ? px(env, options.size[0])
      : (target.rect?.w ?? px(env, 0.25)) + 2 * options.padding;
    const h = options.size
      ? px(env, options.size[1])
      : (target.rect?.h ?? px(env, 0.25)) + 2 * options.padding;
    return { centre, rx: w / 2, ry: h / 2, circle: false };
  }
  const radius =
    options.radius === undefined
      ? target.rect
        ? Math.hypot(target.rect.w, target.rect.h) / 2 + options.padding
        : px(env, 0.15)
      : px(env, options.radius);
  return { centre, rx: radius, ry: radius, circle: true };
}

/** Distance (px) of a pixel centre outside the shape; <= 0 inside. */
function outside(shape: SpotShape, x: number, y: number): number {
  const dx = x + 0.5 - shape.centre.x;
  const dy = y + 0.5 - shape.centre.y;
  if (shape.circle) return Math.hypot(dx, dy) - shape.rx;
  const ox = Math.abs(dx) - shape.rx;
  const oy = Math.abs(dy) - shape.ry;
  return ox > 0 && oy > 0 ? Math.hypot(ox, oy) : Math.max(ox, oy);
}

/** Pixels of row y safely inside the shape (1 px margin), [from, to]; empty when none. */
function insideSpan(shape: SpotShape, y: number): readonly [number, number] {
  const dy = y + 0.5 - shape.centre.y;
  const half = shape.circle
    ? Math.sqrt(Math.max(0, shape.rx * shape.rx - dy * dy))
    : Math.abs(dy) < shape.ry
      ? shape.rx
      : 0;
  if (half <= 1) return [Infinity, -Infinity];
  return [Math.ceil(shape.centre.x - half) + 1, Math.floor(shape.centre.x + half) - 1];
}

export function drawSpotlight(env: AnnotationEnv, options: ParsedSpotlight): AnnotationDraw {
  const target = env.target(options.target, 'target');
  const rest = spotShape(env, options, target);
  const extent = { x: 0, y: 0, w: env.width, h: env.height };
  const result = { box: EMPTY_RECT, extent };
  if (!env.phase.visible) return result;
  const iris = (1 - env.phase.draw) * Math.hypot(env.width, env.height);
  const shape = { ...rest, rx: rest.rx + iris, ry: rest.ry + iris };
  const feather = Math.max(1, px(env, options.feather));
  const dim = options.dim * env.paint.opacity;
  const full: Paint = { opacity: dim, under: true };
  const x0 = Math.max(0, Math.floor(shape.centre.x - shape.rx - feather));
  const x1 = Math.min(env.width, Math.ceil(shape.centre.x + shape.rx + feather));
  const y0 = Math.max(0, Math.floor(shape.centre.y - shape.ry - feather));
  const y1 = Math.min(env.height, Math.ceil(shape.centre.y + shape.ry + feather));
  const { surface, width, height } = env;
  if (x0 >= x1 || y0 >= y1) {
    surface.fillRect(extent, env.color, full);
    return result;
  }
  surface.fillRect({ x: 0, y: 0, w: width, h: y0 }, env.color, full);
  surface.fillRect({ x: 0, y: y1, w: width, h: height - y1 }, env.color, full);
  surface.fillRect({ x: 0, y: y0, w: x0, h: y1 - y0 }, env.color, full);
  surface.fillRect({ x: x1, y: y0, w: width - x1, h: y1 - y0 }, env.color, full);
  for (let y = y0; y < y1; y += 1) {
    const [skipFrom, skipTo] = insideSpan(shape, y);
    for (let x = x0; x < x1; x += 1) {
      if (x >= skipFrom && x <= skipTo) {
        x = skipTo;
        continue;
      }
      const distance = outside(shape, x, y);
      if (distance <= 0) continue;
      surface.plot(x, y, env.color, dim * Math.min(1, distance / feather), true);
    }
  }
  return result;
}
