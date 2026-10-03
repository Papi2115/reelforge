/** Label annotations: callout (framed box with a pointer tail) and pin (label on a leader line). */
import { fontByName } from '../text/cards.js';
import type { Paint, Rgb8, TextSurface } from '../text/surface.js';
import type { PixelRect } from '../text/types.js';
import { px, EMPTY_RECT, type AnnotationDraw, type AnnotationEnv } from './env.js';
import { drawLabel, measureLabel, popRect, type LabelGeometry } from './label.js';
import type { ParsedCallout, ParsedPin } from './options.js';
import {
  AUTO_SIDES,
  SIDE_DIRECTIONS,
  bestSpot,
  centredRect,
  clampInto,
  labelAt,
  nearestEdgePoint,
  type Direction,
} from './placement.js';
import {
  grow,
  pathPixels,
  pointsRect,
  strokePaths,
  unionRects,
  wipePaint,
  type Point,
} from './raster.js';
import type { ResolvedTarget } from './targets.js';

/** Plate with cut corners (`inset` px per corner, 0 = square). */
function fillPlate(
  surface: TextSurface,
  rect: PixelRect,
  inset: number,
  color: Rgb8,
  paint: Paint,
): void {
  for (let row = 0; row < rect.h; row += 1) {
    const cut = Math.max(0, inset - row, inset - (rect.h - 1 - row));
    if (rect.w - 2 * cut > 0)
      surface.fillRect(
        { x: rect.x + cut, y: rect.y + row, w: rect.w - 2 * cut, h: 1 },
        color,
        paint,
      );
  }
}

function dot(env: AnnotationEnv, point: Point, paint: Paint): void {
  const x = Math.round(point.x) - 1;
  const y = Math.round(point.y) - 1;
  if (env.outline) env.surface.fillRect({ x: x - 1, y: y - 1, w: 5, h: 5 }, env.outline, paint);
  env.surface.fillRect({ x, y, w: 3, h: 3 }, env.color, paint);
}

/** Candidate label rects around a point, in `sides` preference order. */
function candidates(
  point: Point,
  sides: readonly string[],
  distance: number,
  w: number,
  h: number,
): { rect: PixelRect; dir: Direction }[] {
  return sides.map((side) => {
    const dir = SIDE_DIRECTIONS[side] ?? { dx: 1, dy: 0 };
    return { rect: labelAt(point, dir, distance, w, h), dir };
  });
}

interface CalloutLayout {
  readonly body: LabelGeometry;
  readonly title: LabelGeometry | undefined;
  readonly w: number;
  readonly h: number;
}

function calloutLayout(env: AnnotationEnv, options: ParsedCallout): CalloutLayout {
  const scale = options.scale ?? env.labelScale;
  const maxWidth = options.maxWidth * env.width;
  const pad = { x: 5, y: 4 };
  const body = measureLabel(options.text, fontByName(options.font), scale, maxWidth, pad);
  const title =
    options.title === undefined
      ? undefined
      : measureLabel(options.title, fontByName('display'), scale, maxWidth, { x: 5, y: 3 });
  const w = Math.max(body.w, title?.w ?? 0);
  return { body, title, w: w + 2, h: body.h + (title?.h ?? 0) + 2 };
}

export function drawCallout(env: AnnotationEnv, options: ParsedCallout): AnnotationDraw {
  const layout = calloutLayout(env, options);
  const target = options.target ? env.target(options.target, 'target') : undefined;
  let box: PixelRect;
  if (options.pos) {
    box = centredRect(
      { x: options.pos[0] * env.width, y: options.pos[1] * env.height },
      layout.w,
      layout.h,
    );
  } else if (target) {
    const around = candidates(target, AUTO_SIDES, px(env, 0.1), layout.w, layout.h);
    const avoid = [...env.occupied, target.bounds ?? centredRect(target, 12, 12)];
    box =
      around[
        bestSpot(
          around.map((spot) => spot.rect),
          env.safeArea,
          avoid,
        )
      ]?.rect ??
      around[0]?.rect ??
      centredRect(target, layout.w, layout.h);
  } else {
    box = centredRect({ x: env.width / 2, y: env.height * 0.3 }, layout.w, layout.h);
  }
  box = clampInto(box, grow(env.safeArea, -1));
  const tailEnd = target && options.tail ? nearestEdgePoint(box, target) : undefined;
  const tail = tailEnd && target ? pathPixels([tailEnd, target]) : undefined;
  const tailRect = tailEnd && target ? pointsRect([tailEnd, target], 4) : EMPTY_RECT;
  const extent = unionRects([grow(box, 1), tailRect]);
  const result = { box: grow(box, 1), extent, textScale: layout.body.scale };
  if (!env.phase.visible) return result;
  const paint = wipePaint(env.paint, extent, env.phase.wipe, env.height);
  const inset = options.corner === 'square' ? 0 : options.corner === 'round' ? 1 : 3;
  if (tail && target) {
    const style = {
      color: env.color,
      thickness: Math.max(1, env.stroke - 1),
      outline: env.outline,
      paint,
    };
    strokePaths(env.surface, [tail], style, Math.min(1, env.phase.draw * 1.5));
    if (env.phase.draw >= 1) dot(env, target, paint);
  }
  const plate = popRect(box, env.phase.pop);
  if (plate.w <= 2 || plate.h <= 2) return result;
  if (env.outline) fillPlate(env.surface, grow(plate, 1), inset + 1, env.outline, paint);
  fillPlate(env.surface, plate, inset, env.color, paint);
  const inner = grow(plate, -1);
  const plateColor = options.plate === false ? undefined : env.resolveColor(options.plate, 'plate');
  const titleH = layout.title ? Math.round(layout.title.h * env.phase.pop) : 0;
  if (plateColor)
    fillPlate(
      env.surface,
      { ...inner, y: inner.y + titleH, h: inner.h - titleH },
      Math.max(0, inset - 1),
      plateColor,
      paint,
    );
  if (env.phase.pop < 0.85) return result;
  const text = env.resolveColor(options.textColor, 'textColor');
  const dark = env.outline ?? env.resolveColor('outline', 'outline');
  if (layout.title) {
    const titleRect = { x: box.x + 1, y: box.y + 1, w: layout.title.w, h: layout.title.h };
    drawLabel(
      env.surface,
      layout.title,
      titleRect,
      { text: dark, plate: undefined, rim: undefined },
      paint,
    );
  }
  const bodyRect = {
    x: box.x + 1,
    y: box.y + 1 + (layout.title?.h ?? 0),
    w: layout.body.w,
    h: layout.body.h,
  };
  drawLabel(
    env.surface,
    layout.body,
    bodyRect,
    { text, plate: undefined, rim: plateColor ? undefined : env.outline },
    paint,
  );
  return result;
}

interface PinPlacement {
  readonly elbow: Point;
  readonly attach: Point;
  readonly rect: PixelRect;
}

function pinPlacement(
  env: AnnotationEnv,
  options: ParsedPin,
  target: ResolvedTarget,
  label: LabelGeometry,
): PinPlacement {
  const length = px(env, options.length);
  const sides = options.side === 'auto' ? AUTO_SIDES : [options.side];
  const spots = sides.map((side) => {
    const dir = SIDE_DIRECTIONS[side] ?? { dx: 1, dy: 0 };
    const elbow = { x: target.x + dir.dx * length, y: target.y + dir.dy * length };
    const sideways = Math.abs(dir.dx) > 0.3 ? { dx: Math.sign(dir.dx), dy: 0 } : dir;
    const rect = labelAt(elbow, sideways, Math.abs(dir.dx) > 0.3 ? 4 : 1, label.w, label.h);
    const attach =
      Math.abs(dir.dx) > 0.3 ? { x: elbow.x + Math.sign(dir.dx) * 4, y: elbow.y } : elbow;
    return { elbow, attach, rect };
  });
  // Keep the label off the whole target object (an anchor only names the point it marks).
  const avoid = [...env.occupied, target.bounds ?? centredRect(target, 10, 10)];
  const chosen =
    spots[
      bestSpot(
        spots.map((spot) => spot.rect),
        env.safeArea,
        avoid,
      )
    ] ?? spots[0];
  if (!chosen)
    return { elbow: target, attach: target, rect: centredRect(target, label.w, label.h) };
  const rect = clampInto(chosen.rect, grow(env.safeArea, -1));
  const shift = { x: rect.x - chosen.rect.x, y: rect.y - chosen.rect.y };
  return {
    elbow: { x: chosen.elbow.x + shift.x, y: chosen.elbow.y + shift.y },
    attach: { x: chosen.attach.x + shift.x, y: chosen.attach.y + shift.y },
    rect,
  };
}

export function drawPin(env: AnnotationEnv, options: ParsedPin): AnnotationDraw {
  const target = env.target(options.target, 'target', options.occlude);
  const label = measureLabel(
    options.text,
    fontByName(options.font),
    options.scale ?? env.labelScale,
    env.safeArea.w * 0.45,
  );
  const place = pinPlacement(env, options, target, label);
  const leader = pathPixels([target, place.elbow, place.attach]);
  const extent = unionRects([
    grow(place.rect, 1),
    pointsRect([target, place.elbow, place.attach], 3),
  ]);
  const hidden = options.occlude && target.occluded === true;
  const result = { box: grow(place.rect, 1), extent, textScale: label.scale, hidden };
  if (!env.phase.visible || hidden) return result;
  const paint = wipePaint(env.paint, extent, env.phase.wipe, env.height);
  const thickness = options.thickness ?? Math.max(1, env.stroke - 1);
  const leaderShare = Math.min(1, env.phase.draw / 0.6);
  const labelPop = Math.min(env.phase.pop, Math.max(0, (env.phase.draw - 0.6) / 0.4));
  strokePaths(
    env.surface,
    [leader],
    { color: env.color, thickness, outline: env.outline, paint },
    leaderShare,
  );
  dot(env, target, paint);
  if (labelPop <= 0) return result;
  const colors = {
    text: env.resolveColor(options.textColor, 'textColor'),
    plate: options.plate === false ? undefined : env.resolveColor(options.plate, 'plate'),
    rim: env.outline,
    bar: env.color,
  };
  drawLabel(env.surface, label, place.rect, colors, paint, labelPop);
  return result;
}
