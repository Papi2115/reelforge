/**
 * Flat-2d boards: every template of the look is a raster (raster.ts) repainted for each t and
 * shown on a screen-space quad. The quad ignores the camera (clip-space vertices) and writes no
 * depth, so a board is a pixel-exact 2D layer: one raster pixel per low-res frame pixel when
 * `size` is the shot size, palette-snapped and dithered by the shared post pass like every look.
 * Boards stack by `layer`; `overlay: true` draws over voxel objects (lower thirds on 3D shots).
 * Each board names screen anchors (`board.target(name)` -> an annotate target).
 */
import type * as THREE from 'three';
import { z } from 'zod';
import { emptyBounds } from '../../env/shared.js';
import { KitError } from '../../errors.js';
import { asFx, type FxObject } from '../../fx/shared.js';
import { createKitObject } from '../../object.js';
import { defineFx, type KitDefinition, type KitTools } from '../../registry.js';
import { Raster } from './raster.js';
import { createStagePainter, driftParam, stagePatternParam, type StagePattern } from './stage.js';
import { createTheme, toneParam, type Theme } from './theme.js';
import { anchorParam, createResolver, type Resolver } from './timing.js';

/** Boards draw after the sky (-3), stars and neon grid floor (-2), before scene objects. */
const BOARD_RENDER_ORDER = -1.5;
/** Overlay boards draw after every opaque scene object. */
const OVERLAY_RENDER_ORDER = 50;

const unit = z.number().min(0).max(1);

/** Params every flat-2d board shares; `pattern` is the template's default background. */
export function boardParams(pattern: StagePattern) {
  return {
    size: z
      .tuple([z.int().min(32).max(3840), z.int().min(18).max(2160)])
      .default([640, 360])
      .describe('Frame size in pixels: pass [ctx.shot.width, ctx.shot.height]'),
    region: z
      .tuple([unit, unit, unit, unit])
      .default([0, 0, 1, 1])
      .describe(
        'Part of the frame [x, y, width, height] (0..1 from the top left) the board covers; positions are 640x360-frame pixels from its corner',
      ),
    tone: toneParam,
    stage: stagePatternParam(pattern),
    drift: driftParam,
    layer: z.int().min(0).max(9).default(0).describe('Draw order among boards (higher = on top)'),
    overlay: z
      .boolean()
      .default(false)
      .describe('Draw over voxel objects too (lower thirds, captions on a 3D shot)'),
    anchor: anchorParam,
  } as const;
}

type BoardShape = ReturnType<typeof boardParams>;
export type BoardParams = z.output<z.ZodObject<BoardShape>>;

/** A rectangle in raster pixels. */
export interface Box {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** What a template's setup receives. */
export interface BoardContext {
  readonly theme: Theme;
  /** Raster pixels per 640x360-frame pixel. */
  readonly s: number;
  readonly width: number;
  readonly height: number;
  readonly resolve: Resolver;
  /** Scales a reference length (640x360-frame pixels) to raster pixels. */
  readonly px: (value: number) => number;
  /** Integer text scale for a reference scale (at least 1). */
  readonly textScale: (reference: number) => number;
  /** `kit.fx.<name>()`, for error messages. */
  readonly call: string;
}

/** Paints the template's content for time t over the stage. */
export type Painter = (raster: Raster, t: number) => void;

export interface BoardContent {
  readonly paint: Painter;
  /** Named rest positions of the content (raster pixels), for annotations. */
  readonly anchors?: Readonly<Record<string, Box>> | undefined;
}

/** An annotate target: a point (0..1 of the frame) and the size of the thing there. */
export interface ScreenTarget {
  readonly screen: readonly [number, number];
  readonly size: readonly [number, number];
}

export interface BoardMethods {
  /** `{ screen, size }` of a named anchor, for ctx.annotate targets. */
  target(name: string): ScreenTarget;
  targetNames(): string[];
}

export type BoardObject = FxObject & BoardMethods;

const VERTEX = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

const FRAGMENT = /* glsl */ `
uniform sampler2D map;
varying vec2 vUv;
void main() {
  vec4 texel = texture2D(map, vec2(vUv.x, 1.0 - vUv.y));
  if (texel.a < 0.5) discard;
  gl_FragColor = vec4(texel.rgb, 1.0);
}`;

function regionGeometry(three: KitTools['three'], region: BoardParams['region']) {
  const [x, y, width, height] = region;
  const left = x * 2 - 1;
  const right = (x + width) * 2 - 1;
  const top = 1 - y * 2;
  const bottom = 1 - (y + height) * 2;
  const geometry = new three.BufferGeometry();
  geometry.setAttribute(
    'position',
    new three.BufferAttribute(
      new Float32Array([left, bottom, 0, right, bottom, 0, right, top, 0, left, top, 0]),
      3,
    ),
  );
  geometry.setAttribute(
    'uv',
    new three.BufferAttribute(new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]), 2),
  );
  geometry.setIndex([0, 1, 2, 0, 2, 3]);
  return geometry;
}

function createQuad(tools: KitTools, raster: Raster, params: BoardParams) {
  const { three } = tools;
  const texture = tools.track(
    new three.DataTexture(
      raster.data,
      raster.width,
      raster.height,
      three.RGBAFormat,
      three.UnsignedByteType,
    ),
  );
  texture.minFilter = three.NearestFilter;
  texture.magFilter = three.NearestFilter;
  texture.generateMipmaps = false;
  const material = tools.track(
    new three.ShaderMaterial({
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      uniforms: { map: { value: texture } },
      depthTest: false,
      depthWrite: false,
    }),
  );
  const mesh: THREE.Mesh = new three.Mesh(
    tools.track(regionGeometry(three, params.region)),
    material,
  );
  mesh.name = 'flatBoard';
  mesh.frustumCulled = false;
  mesh.renderOrder =
    (params.overlay ? OVERLAY_RENDER_ORDER : BOARD_RENDER_ORDER) + params.layer * 0.01;
  // A screen-space quad has no place in the world: never pick or raycast it.
  mesh.raycast = () => undefined;
  return { mesh, texture };
}

/** Raster, context and content of a board, without Three (unit tests use it directly). */
export interface PreparedBoard {
  readonly raster: Raster;
  readonly context: BoardContext;
  readonly anchors: Readonly<Record<string, Box>>;
  /** Repaints stage and content for time t. */
  render(t: number): void;
}

export function prepareBoard(
  palette: KitTools['palette'],
  params: BoardParams,
  call: string,
  setup: (context: BoardContext) => BoardContent,
): PreparedBoard {
  const width = Math.max(1, Math.round(params.size[0] * params.region[2]));
  const height = Math.max(1, Math.round(params.size[1] * params.region[3]));
  const raster = new Raster(width, height);
  const s = params.size[0] / 640;
  const context: BoardContext = {
    theme: createTheme(palette, params.tone),
    s,
    width,
    height,
    resolve: createResolver(params.anchor, call),
    px: (value) => Math.round(value * s),
    textScale: (reference) => Math.max(1, Math.round(reference * s)),
    call,
  };
  const content = setup(context);
  const stage = createStagePainter(width, height, {
    pattern: params.stage,
    drift: params.drift,
    s,
  });
  return {
    raster,
    context,
    anchors: content.anchors ?? {},
    render(t) {
      raster.clear();
      stage(raster, context.theme, t);
      content.paint(raster, t);
    },
  };
}

/** Converts a raster box into an annotate target (shares of the whole frame). */
export function boxTarget(box: Box, params: Pick<BoardParams, 'size' | 'region'>): ScreenTarget {
  const [frameWidth, frameHeight] = params.size;
  const left = params.region[0] * frameWidth + box.x;
  const top = params.region[1] * frameHeight + box.y;
  return {
    screen: [(left + box.width / 2) / frameWidth, (top + box.height / 2) / frameHeight],
    size: [box.width / frameWidth, box.height / frameHeight],
  };
}

/** Builds the board object of a template: raster, quad, stage, update(t), target(name). */
export function createBoard(
  tools: KitTools,
  kitType: string,
  params: BoardParams,
  setup: (context: BoardContext) => BoardContent,
  namespace: 'fx' | 'env' = 'fx',
): BoardObject {
  const call = `kit.${namespace}.${kitType}()`;
  const board = prepareBoard(tools.palette, params, call, setup);
  const { mesh, texture } = createQuad(tools, board.raster, params);
  const object = createKitObject(tools.three, { kitType, bounds: emptyBounds(tools) });
  object.add(mesh);
  const fx = asFx(object, (t) => {
    board.render(t);
    texture.needsUpdate = true;
  });
  const names = Object.keys(board.anchors);
  return Object.assign(fx, {
    target(name: string): ScreenTarget {
      const box = board.anchors[name];
      if (box === undefined) {
        throw new KitError(
          'invalid-anchor',
          `${call}.target("${name}"): no such anchor (anchors: ${names.join(', ') || 'none'})`,
        );
      }
      return boxTarget(box, params);
    },
    targetNames: () => [...names],
  });
}

/** Template definition: params (own + board params), a setup that returns the content. */
export function defineBoard<
  const Name extends string,
  Params extends z.ZodType<BoardParams>,
>(spec: {
  readonly name: Name;
  readonly description: string;
  readonly params: Params;
  /** Target names, for the docs (e.g. 'item:<i> (each item), title'). */
  readonly targets: string;
  readonly methods?: Readonly<Record<string, string>>;
  readonly setup: (params: z.output<Params>, context: BoardContext) => BoardContent;
}): KitDefinition<Name, Params, BoardObject> {
  return defineFx({
    name: spec.name,
    description: spec.description,
    params: spec.params,
    methods: boardMethods(spec.targets, spec.methods),
    build: (parsed, tools) =>
      createBoard(tools, spec.name, parsed, (context) => spec.setup(parsed, context)),
  });
}

/** The methods every board documents: update(t) and target(name) with its names. */
export function boardMethods(
  targets: string,
  extra: Readonly<Record<string, string>> = {},
): Readonly<Record<string, string>> {
  return {
    'update(t)': 'Repaints the board for local time t: call it every frame',
    'target(name)': `ctx.annotate target { screen, size } of a named part at rest: ${targets}`,
    ...extra,
  };
}
