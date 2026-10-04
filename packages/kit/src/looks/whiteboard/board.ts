/**
 * Whiteboard boards: every template of the look is a raster repainted for each t (surface,
 * scheduled marks, hand, eraser) and shown 1:1 on a screen-space quad like the blueprint boards:
 * no depth write, camera-independent, palette colours only, through the shared post pass. Voxel
 * objects, ctx.text and ctx.annotate draw on top; `stroke(i)` / `point(name)` give annotation
 * targets and `strokeTime(i)` the times the narration and SFX can sync to.
 */
import { z } from 'zod';
import { emptyBounds } from '../../env/shared.js';
import { KitError } from '../../errors.js';
import { asFx, type FxObject } from '../../fx/shared.js';
import { createKitObject } from '../../object.js';
import { defineEnv, defineFx, type KitDefinition, type KitTools } from '../../registry.js';
import { Raster } from '../blueprint/raster.js';
import { anchorParam, createResolver, whenParam } from '../blueprint/timing.js';
import { createDrawing } from './drawing.js';
import { createQuad } from './quad.js';
import { boundsOf, centerOf, type Box, type Point } from './geometry.js';
import { createMark, shapeCost, type Mark } from './marks.js';
import { eraserSprite, penSprite } from './sprites.js';
import { paintSurface } from './surface.js';
import { createTheme } from './theme.js';
import { scheduleMarks } from './timing.js';
import { createTools, type Drawing, type WhiteboardContext } from './tools.js';

const unit = z.number().min(0).max(1);

/** Params every whiteboard template shares. */
export const boardParams = {
  size: z
    .tuple([z.int().min(32).max(3840), z.int().min(18).max(2160)])
    .default([640, 360])
    .describe('Frame size in pixels: pass [ctx.shot.width, ctx.shot.height]'),
  region: z
    .tuple([unit, unit, unit, unit])
    .default([0, 0, 1, 1])
    .describe(
      'Part of the frame [x, y, w, h] (0..1) the board covers; positions are 640x360-frame pixels from its corner',
    ),
  board: z.boolean().default(true).describe('Draw the board surface; false = transparent overlay'),
  frame: z.boolean().default(true).describe('Aluminium frame and wall around the board'),
  tray: z.boolean().default(true).describe('Marker tray (markers, eraser) along the bottom'),
  grid: z.enum(['none', 'dots', 'lines']).default('none').describe('Faint grid on the board'),
  title: z.string().max(40).default('').describe('Heading written by hand top left, underlined'),
  pen: z
    .enum(['hand', 'marker', 'none'])
    .default('hand')
    .describe('What draws: a hand holding a marker, a bare marker, or nothing'),
  color: z
    .string()
    .default('black')
    .describe('Default ink: black, blue, red, green (or a palette name)'),
  width: z.int().min(1).max(4).default(2).describe('Marker width in 640x360-frame pixels'),
  wobble: z.number().min(0).max(3).default(1).describe('Hand wobble in pixels (0 = ruled lines)'),
  speed: z
    .number()
    .min(60)
    .max(2000)
    .default(380)
    .describe('Drawing speed, 640x360-frame pixels per second (auto-timed strokes)'),
  start: whenParam.default(0.3).describe('When drawing starts (seconds or phrase)'),
  gap: z.number().min(0).max(3).default(0.15).describe('Pause between auto-timed strokes (s)'),
  erase: z
    .array(
      z.object({
        at: whenParam.describe('When the eraser starts wiping'),
        duration: z.number().min(0.2).max(4).default(0.9),
        direction: z.enum(['right', 'left', 'down']).default('right'),
      }),
    )
    .max(4)
    .default([])
    .describe(
      'Eraser passes: wipe everything drawn before them (later strokes draw on the clean board)',
    ),
  seed: z
    .int()
    .min(0)
    .optional()
    .describe('Seed of the hand wobble and board grain (default: from the shot)'),
  layer: z.int().min(0).max(9).default(0).describe('Draw order among boards (higher = on top)'),
  anchor: anchorParam,
} as const;

export type BoardParams = z.output<z.ZodObject<typeof boardParams>>;

/** An annotation target: a point/region of the frame (0..1), as ctx.annotate takes it. */
export interface ScreenTarget {
  readonly screen: readonly [number, number];
  readonly size?: readonly [number, number];
}

interface EntryInfo {
  readonly name: string | undefined;
  readonly marks: readonly Mark[];
  readonly box: Box;
  readonly points: Readonly<Record<string, Point>>;
  readonly globals: Readonly<Record<string, Point>>;
}

/** A prepared board without Three (unit tests use it directly). */
export interface PreparedWhiteboard {
  readonly raster: Raster;
  readonly context: WhiteboardContext;
  readonly marks: readonly Mark[];
  readonly render: (t: number) => void;
  readonly stroke: (index: number) => ScreenTarget;
  readonly point: (name: string) => ScreenTarget;
  readonly strokeTime: (index: number) => { readonly t: number; readonly tEnd: number };
  readonly doneAt: () => number;
}

function sideNames(box: Box): Record<string, Point> {
  const [cx, cy] = centerOf(box);
  return {
    center: [cx, cy],
    top: [cx, box.y],
    bottom: [cx, box.y + box.height],
    left: [box.x, cy],
    right: [box.x + box.width, cy],
  };
}

export function prepareWhiteboard(
  palette: KitTools['palette'],
  params: BoardParams,
  seed: number,
  call: string,
  setup: (context: WhiteboardContext) => Drawing,
): PreparedWhiteboard {
  const width = Math.max(1, Math.round(params.size[0] * params.region[2]));
  const height = Math.max(1, Math.round(params.size[1] * params.region[3]));
  const raster = new Raster(width, height);
  const s = params.size[0] / 640;
  const theme = createTheme(palette);
  const surface = paintSurface(raster, theme, {
    s,
    frame: params.board && params.frame,
    tray: params.tray,
    grid: params.grid,
    seed,
  });
  if (!params.board) raster.clear();
  const snapshot = raster.snapshot(0, 0, width, height);
  const resolve = createResolver(params.anchor, call);
  const context = createTools({
    theme,
    s,
    seed,
    params,
    raster,
    area: surface.area,
    board: surface.board,
    resolve,
    call,
  });
  const drawing = setup(context);
  const entries = [...context.titleEntries(), ...drawing.entries];
  const items = entries.flatMap((entry) => entry.items);
  const start = resolve(params.start, 0.3);
  const slots = scheduleMarks(
    items.map((item) => ({
      cost: shapeCost(item.shape),
      at: item.at,
      duration: item.duration,
      gap: item.gap,
    })),
    { start, gap: params.gap, speed: params.speed * s, resolve },
  );
  const marks = items.map((item, index) => {
    const slot = slots[index] ?? { start, duration: 1 };
    return createMark(item.shape, slot.start, slot.duration);
  });
  let cursor = 0;
  const infos: EntryInfo[] = entries.map((entry) => {
    const own = marks.slice(cursor, cursor + entry.items.length);
    cursor += entry.items.length;
    const box = boundsOf(
      own.map((mark) => [
        [mark.bounds.x, mark.bounds.y],
        [mark.bounds.x + mark.bounds.width, mark.bounds.y + mark.bounds.height],
      ]),
    );
    const first = own[0]?.paths[0]?.[0];
    const last = own.at(-1)?.paths.at(-1)?.at(-1);
    return {
      name: entry.name,
      marks: own,
      box,
      points: {
        ...sideNames(box),
        ...(first ? { start: first } : {}),
        ...(last ? { end: last } : {}),
        ...entry.points,
      },
      globals: entry.globals ?? {},
    };
  });
  const titleCount = context.titleEntries().length;
  const content = infos.slice(titleCount);
  const erases = params.erase.map((pass) => ({
    start: resolve(pass.at, 0),
    duration: pass.duration,
    direction: pass.direction,
  }));
  const renderer = createDrawing({
    raster,
    theme,
    s,
    seed,
    surface: snapshot,
    board: surface.board,
    marks,
    erases,
    pen: params.pen,
    penSprite: penSprite(params.pen, s),
    eraserSprite: eraserSprite(s),
  });
  const toScreen = (point: Point): readonly [number, number] => [
    params.region[0] + point[0] / params.size[0],
    params.region[1] + point[1] / params.size[1],
  ];
  const entryAt = (index: number, method: string): EntryInfo => {
    const info = content[index];
    if (!info) {
      throw new KitError(
        'invalid-params',
        `${call}.${method}(${String(index)}): there are ${String(content.length)} strokes (0..${String(content.length - 1)})`,
      );
    }
    return info;
  };
  const named = new Map<string, Point>();
  infos.forEach((info, index) => {
    for (const [key, point] of Object.entries(info.globals)) named.set(key, point);
    const prefix =
      info.name ?? (index >= titleCount ? `stroke:${String(index - titleCount)}` : undefined);
    if (!prefix) return;
    for (const [key, point] of Object.entries(info.points)) {
      named.set(key === 'center' ? prefix : `${prefix}.${key}`, point);
    }
  });
  return {
    raster,
    context,
    marks,
    render: (t) => {
      renderer.render(t);
    },
    stroke: (index) => {
      const { box } = entryAt(index, 'stroke');
      return {
        screen: toScreen(centerOf(box)),
        size: [box.width / params.size[0], box.height / params.size[1]],
      };
    },
    point: (name) => {
      if (name === 'pen') {
        const head = renderer.head();
        return { screen: toScreen(head ?? [width / 2, height / 2]) };
      }
      const point = named.get(name);
      if (!point) {
        const names = [...named.keys()].slice(0, 24).join(', ');
        throw new KitError(
          'invalid-params',
          `${call}.point("${name}"): unknown point; available: pen, ${names}`,
        );
      }
      return { screen: toScreen(point) };
    },
    strokeTime: (index) => {
      const { marks: own } = entryAt(index, 'strokeTime');
      const t = Math.min(...own.map((mark) => mark.start));
      const tEnd = Math.max(...own.map((mark) => mark.start + mark.duration));
      return { t, tEnd };
    },
    doneAt: () => Math.max(start, ...marks.map((mark) => mark.start + mark.duration)),
  };
}

export const WHITEBOARD_METHODS = {
  'update(t)': 'Repaints the board for local time t: call it every frame',
  'stroke(i)': 'Annotation target { screen, size } of stroke/item i (pass to ctx.annotate)',
  'point(name)':
    "Annotation target of a named point: item ids ('id', 'id.top', 'id.end'...), 'stroke:<i>', 'pen' (the pen tip now)",
  'strokeTime(i)': '{ t, tEnd }: when item i is drawn (sync SFX/annotations)',
  'doneAt()': 'Time the last stroke is finished',
} as const;

export type WhiteboardObject = FxObject &
  Omit<PreparedWhiteboard, 'raster' | 'context' | 'marks' | 'render'>;

/** Builds the board object of a template: raster, quad, surface, marks and update(t). */
export function createWhiteboard(
  tools: KitTools,
  kitType: string,
  params: BoardParams,
  setup: (context: WhiteboardContext) => Drawing,
  namespace: 'fx' | 'env' = 'fx',
): WhiteboardObject {
  const seed = params.seed ?? Math.floor(tools.rng() * 2_147_483_647);
  const board = prepareWhiteboard(
    tools.palette,
    params,
    seed,
    `kit.${namespace}.${kitType}()`,
    setup,
  );
  const { mesh, texture } = createQuad(tools, board.raster, params);
  const object = createKitObject(tools.three, { kitType, bounds: emptyBounds(tools) });
  object.add(mesh);
  const fx = asFx(object, (t) => {
    board.render(t);
    texture.needsUpdate = true;
  });
  return Object.assign(fx, {
    stroke: board.stroke,
    point: board.point,
    strokeTime: board.strokeTime,
    doneAt: board.doneAt,
  });
}

/** Template definition: params (own + `boardParams`), a setup that returns the drawing. */
export function defineWhiteboard<
  const Name extends string,
  Params extends z.ZodType<BoardParams>,
>(spec: {
  readonly name: Name;
  readonly description: string;
  readonly params: Params;
  readonly kind?: 'fx' | 'env';
  readonly setup: (params: z.output<Params>, context: WhiteboardContext) => Drawing;
}): KitDefinition<Name, Params, WhiteboardObject> {
  const definition = {
    name: spec.name,
    description: spec.description,
    params: spec.params,
    methods: WHITEBOARD_METHODS,
    build: (parsed: z.output<Params>, tools: KitTools) =>
      createWhiteboard(
        tools,
        spec.name,
        parsed,
        (context) => spec.setup(parsed, context),
        spec.kind ?? 'fx',
      ),
  };
  return spec.kind === 'env' ? defineEnv(definition) : defineFx(definition);
}
