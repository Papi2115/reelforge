/**
 * `kit.fx.flatShapes`: flat vector-style shapes (circle, rect, pill, triangle, diamond, hexagon,
 * star, plus, ring) and strokes (line, arrow) rasterised pixel-exact, entering on cues (pop,
 * scale, slide, drop, spin, wipe), idling, morphing into other shapes on cues (outline blended
 * by radial profile, colour by ordered dither) and leaving. Flat drop shadows, centred labels.
 */
import { z } from 'zod';
import {
  boardParams,
  defineBoard,
  type BoardContext,
  type BoardContent,
  type Box,
} from './board.js';
import {
  morphRing,
  placeRings,
  radialProfile,
  shapeRings,
  SHAPE_KINDS,
  type ShapeKind,
} from './geometry.js';
import { motionFields, motionPose, resolveMotion, type Pose } from './motion.js';
import { bayerOn, type Pixel, type Point, type Raster } from './raster.js';
import { drawText, fitScale } from './text.js';
import { easeInOutCubic, ramp, whenParam } from './timing.js';

const STROKES = ['line', 'arrow'] as const;
const KINDS = [...SHAPE_KINDS, ...STROKES] as const;
type Kind = (typeof KINDS)[number];

const point = z.tuple([z.number(), z.number()]);

const morphKey = z.object({
  at: whenParam.describe('When the morph starts (seconds or phrase)'),
  kind: z.enum(SHAPE_KINDS).optional(),
  x: z.number().optional(),
  y: z.number().optional(),
  w: z.number().positive().optional(),
  h: z.number().positive().optional(),
  round: z.number().min(0).optional(),
  rotation: z.number().optional(),
  color: z.string().optional(),
});

const shapeItem = z.object({
  kind: z
    .enum(KINDS)
    .default('circle')
    .describe(`Shape: ${KINDS.join(', ')}`),
  x: z.number().default(320).describe('Centre x in 640x360-frame pixels'),
  y: z.number().default(180).describe('Centre y in 640x360-frame pixels'),
  w: z.number().positive().default(80).describe('Width in pixels'),
  h: z.number().positive().optional().describe('Height (default = w)'),
  round: z.number().min(0).default(0).describe('Corner radius of rects'),
  rotation: z.number().default(0).describe('Degrees, clockwise'),
  thickness: z.number().min(1).default(8).describe('Band of rings, pen of lines/arrows'),
  points: z.array(point).min(2).optional().describe('line/arrow: path in frame pixels'),
  color: z.string().optional().describe('Role or palette name (default: accents in turn)'),
  shadow: z.boolean().default(true).describe('Flat drop shadow'),
  label: z.string().max(12).default('').describe('Text centred on the shape'),
  labelColor: z.string().default('light').describe('Label colour'),
  morph: z
    .array(morphKey)
    .max(6)
    .default([])
    .describe('Morph keys: { at, kind?, x?, y?, w?, h?, round?, rotation?, color? }'),
  ...motionFields,
});

const shapesParams = z
  .object({
    shapes: z.array(shapeItem).min(1).max(12).describe('Shapes, drawn in order (max ~6 on screen)'),
    start: z.number().default(0.3).describe('First entrance when a shape has no `at` (s)'),
    stagger: z.number().min(0).default(0.2).describe('Seconds between default entrances'),
    morphTime: z.number().min(0.05).max(3).default(0.5).describe('Length of each morph (s)'),
  })
  .extend(boardParams('solid'));

type ShapesParams = z.output<typeof shapesParams>;
type ShapeItem = ShapesParams['shapes'][number];

interface State {
  readonly kind: Kind;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly round: number;
  readonly rotation: number;
  readonly color: Pixel;
}

interface Key {
  readonly at: number;
  readonly state: State;
}

const lerp = (a: number, b: number, k: number): number => a + (b - a) * k;

/** Geometry and colour(s) of a shape at time t: one state, or a blend between two. */
function stateAt(base: State, keys: readonly Key[], t: number, morphTime: number) {
  let from = base;
  for (const key of keys) {
    if (t < key.at) break;
    const k = easeInOutCubic(ramp(t, key.at, morphTime));
    if (k >= 1) {
      from = key.state;
      continue;
    }
    return { from, to: key.state, k };
  }
  return { from, to: from, k: 0 };
}

function paintFill(
  raster: Raster,
  rings: readonly (readonly Point[])[],
  from: Pixel,
  to: Pixel,
  k: number,
): void {
  raster.polygon(rings, from);
  if (k > 0 && to !== from) raster.polygon(rings, to, (x, y) => bayerOn(x, y, k));
}

function paintStroke(
  raster: Raster,
  item: ShapeItem,
  color: Pixel,
  pose: Pose,
  context: BoardContext,
) {
  const points = (
    item.points ?? [
      [item.x - item.w / 2, item.y],
      [item.x + item.w / 2, item.y],
    ]
  ).map(([x, y]) => [context.px(x) + pose.dx, context.px(y) + pose.dy] as const);
  const pen = Math.max(1, context.px(item.thickness));
  raster.polyline(points, color, { width: pen, progress: pose.reveal });
  const tip = points.at(-1);
  const before = points.at(-2);
  if (item.kind !== 'arrow' || pose.reveal < 1 || tip === undefined || before === undefined) return;
  const angle = Math.atan2(tip[1] - before[1], tip[0] - before[0]);
  const head = pen * 3;
  const wing = (side: number): Point => [
    tip[0] - Math.cos(angle) * head + Math.cos(angle + (side * Math.PI) / 2) * head * 0.7,
    tip[1] - Math.sin(angle) * head + Math.sin(angle + (side * Math.PI) / 2) * head * 0.7,
  ];
  raster.polygon(
    [[[tip[0] + Math.cos(angle) * pen, tip[1] + Math.sin(angle) * pen], wing(1), wing(-1)]],
    color,
  );
}

function setupShapes(params: ShapesParams, context: BoardContext): BoardContent {
  const { theme, px, resolve } = context;
  const anchors: Record<string, Box> = {};
  const items = params.shapes.map((item, index) => {
    const color = theme.color(item.color ?? seriesRole(index));
    const base: State = {
      kind: item.kind,
      x: item.x,
      y: item.y,
      w: item.w,
      h: item.h ?? item.w,
      round: item.round,
      rotation: item.rotation,
      color,
    };
    let previous = base;
    const keys = item.morph
      .map((key) => ({ key, at: resolve(key.at, 0) }))
      .sort((a, b) => a.at - b.at)
      .map(({ key, at }) => {
        const state: State = {
          kind: key.kind ?? (isStroke(previous.kind) ? 'circle' : previous.kind),
          x: key.x ?? previous.x,
          y: key.y ?? previous.y,
          w: key.w ?? previous.w,
          h: key.h ?? key.w ?? previous.h,
          round: key.round ?? previous.round,
          rotation: key.rotation ?? previous.rotation,
          color: key.color === undefined ? previous.color : theme.color(key.color),
        };
        previous = state;
        return { at, state };
      });
    const box = {
      x: px(base.x - base.w / 2),
      y: px(base.y - base.h / 2),
      width: px(base.w),
      height: px(base.h),
    };
    anchors[`shape:${String(index)}`] = box;
    const motion = resolveMotion(item, index, resolve, {
      at: params.start + index * params.stagger,
      enter: isStroke(item.kind) ? 'wipe' : 'pop',
      duration: isStroke(item.kind) ? 0.6 : 0.4,
      distance: px(70),
    });
    return { item, base, keys, motion };
  });
  return {
    anchors,
    paint: (raster, t) => {
      for (const { item, base, keys, motion } of items) {
        const pose = motionPose(t, motion);
        if (!pose.visible) continue;
        raster.faded(pose.level, () => {
          if (isStroke(item.kind)) {
            if (item.shadow) paintStroke(raster, item, theme.shade, shifted(pose, px(4)), context);
            paintStroke(raster, item, base.color, pose, context);
            return;
          }
          paintShape(raster, context, item, stateAt(base, keys, t, params.morphTime), pose);
        });
      }
    },
  };
}

function shifted(pose: Pose, by: number): Pose {
  return { ...pose, dx: pose.dx + by, dy: pose.dy + by };
}

function isStroke(kind: Kind): kind is (typeof STROKES)[number] {
  return (STROKES as readonly string[]).includes(kind);
}

function seriesRole(index: number): string {
  return ['primary', 'secondary', 'tertiary', 'good', 'gold'][index % 5] ?? 'primary';
}

function ringsOf(context: BoardContext, item: ShapeItem, from: State, to: State, k: number) {
  const size = (state: State) => ({
    w: context.px(lerp(from.w, state.w, k)),
    h: context.px(lerp(from.h, state.h, k)),
    round: context.px(lerp(from.round, state.round, k)),
    thickness: context.px(item.thickness),
  });
  const fromKind = from.kind as ShapeKind;
  const toKind = to.kind as ShapeKind;
  if (k === 0 || fromKind === toKind) return shapeRings(fromKind, size(to));
  return [morphRing(radialProfile(fromKind, size(to)), radialProfile(toKind, size(to)), k)];
}

function paintShape(
  raster: Raster,
  context: BoardContext,
  item: ShapeItem,
  { from, to, k }: { from: State; to: State; k: number },
  pose: Pose,
): void {
  const { theme, px } = context;
  const cx = px(lerp(from.x, to.x, k)) + Math.round(pose.dx);
  const cy = px(lerp(from.y, to.y, k)) + Math.round(pose.dy);
  const rotation = lerp(from.rotation, to.rotation, k) + pose.rotation;
  const rings = ringsOf(context, item, from, to, k);
  const shadow = px(5);
  const reveal = (draw: () => void): void => {
    if (pose.reveal >= 1) {
      draw();
      return;
    }
    const half = px(Math.max(from.w, to.w)) * pose.scale;
    raster.clipped(cx - half, 0, half * 2 * pose.reveal + shadow, raster.height, draw);
  };
  reveal(() => {
    if (item.shadow) {
      raster.polygon(
        placeRings(rings, cx + shadow, cy + shadow, pose.scale, rotation),
        theme.shade,
      );
    }
    paintFill(raster, placeRings(rings, cx, cy, pose.scale, rotation), from.color, to.color, k);
    if (item.label.length > 0)
      paintLabel(raster, context, item, cx, cy, px(to.w) * pose.scale, pose.scale);
  });
}

function paintLabel(
  raster: Raster,
  context: BoardContext,
  item: ShapeItem,
  cx: number,
  cy: number,
  width: number,
  zoom: number,
): void {
  const scale = fitScale(item.label, width * 0.7, context.textScale(5), true);
  drawText(raster, [item.label], cx, cy, {
    scale,
    color: context.theme.color(item.labelColor),
    bold: true,
    align: 'center',
    valign: 'middle',
    zoom,
  });
}

export const flatShapes = defineBoard({
  name: 'flatShapes',
  description:
    'Flat motion-graphics shapes (circle, rect, pill, triangle, diamond, hexagon, star, plus, ring, line, arrow) with flat shadows and labels; pop/scale/slide/drop/spin/wipe in on cues, idle (float, pulse, spin, wobble), morph into other shapes, colours and positions on cues. Full-frame 2D board: call update(t) every frame.',
  params: shapesParams,
  targets: 'shape:<i> (each shape in order, at its first position)',
  setup: (params, context) => setupShapes(params, context),
});
