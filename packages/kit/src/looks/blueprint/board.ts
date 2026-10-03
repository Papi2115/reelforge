/**
 * Blueprint boards: every template of the look is a raster (raster.ts) repainted for each t and
 * shown on a screen-space quad. The quad ignores the camera (clip-space vertices) and writes no
 * depth, so the board is a pixel-exact 2D backdrop: one raster pixel per low-res frame pixel when
 * `size` is the shot size, untouched by the depth outline and AO, still palette-snapped and
 * dithered by the shared post pass. Voxel objects, ctx.text and ctx.annotate draw on top.
 */
import type * as THREE from 'three';
import { z } from 'zod';
import { emptyBounds } from '../../env/shared.js';
import { asFx, type FxObject } from '../../fx/shared.js';
import { createKitObject } from '../../object.js';
import { defineFx, type KitDefinition, type KitTools } from '../../registry.js';
import { paintPaper, titleBlockParam, type Area } from './paper.js';
import { Raster } from './raster.js';
import { createTheme, type Theme } from './theme.js';
import { anchorParam, createResolver, type Resolver } from './timing.js';

/** Boards draw after the sky (-3), stars and neon grid floor (-2), before scene objects. */
const BOARD_RENDER_ORDER = -1.5;

const unit = z.number().min(0).max(1);

/** Params every blueprint template shares. */
export const boardParams = {
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
  paper: z
    .boolean()
    .default(true)
    .describe('Draw the blueprint sheet (grid, border, rulers); false = transparent overlay'),
  title: z.string().max(40).default('').describe('Heading lettered top left, e.g. "FIG. 2 SALES"'),
  titleBlock: titleBlockParam,
  drift: z
    .tuple([z.number(), z.number()])
    .default([-4, 0])
    .describe('Grid drift in pixels per second (keeps the shot alive); [0, 0] = still'),
  layer: z.int().min(0).max(9).default(0).describe('Draw order among boards (higher = on top)'),
  anchor: anchorParam,
} as const;

export type BoardParams = z.output<z.ZodObject<typeof boardParams>>;

/** What a template's setup receives. */
export interface BoardContext {
  readonly theme: Theme;
  /** Raster pixels per 640x360-frame pixel. */
  readonly s: number;
  /** Raster size. */
  readonly width: number;
  readonly height: number;
  /** Times: seconds or phrases (via the anchor param). */
  readonly resolve: Resolver;
  /** Scales a reference length (640x360-frame pixels) to raster pixels. */
  readonly px: (value: number) => number;
  /** Integer text scale for a reference scale (at least 1). */
  readonly textScale: (reference: number) => number;
}

/** Paints the template's content for time t into the area left by the paper. */
export type Painter = (raster: Raster, t: number, area: Area) => void;

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

/** Clip-space quad of a frame region (top-left origin, 0..1). */
function regionGeometry(
  three: KitTools['three'],
  region: BoardParams['region'],
): THREE.BufferGeometry {
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
  const mesh = new three.Mesh(tools.track(regionGeometry(three, params.region)), material);
  mesh.name = 'blueprintBoard';
  mesh.frustumCulled = false;
  mesh.renderOrder = BOARD_RENDER_ORDER + params.layer * 0.01;
  // A screen-space quad has no place in the world: never pick or raycast it.
  mesh.raycast = () => undefined;
  return { mesh, texture };
}

/** Raster, context and painter of a board, without Three (unit tests use it directly). */
export interface PreparedBoard {
  readonly raster: Raster;
  readonly context: BoardContext;
  /** Repaints paper and content for time t. */
  render(t: number): void;
}

export function prepareBoard(
  palette: KitTools['palette'],
  params: BoardParams,
  call: string,
  setup: (context: BoardContext) => Painter,
): PreparedBoard {
  const width = Math.max(1, Math.round(params.size[0] * params.region[2]));
  const height = Math.max(1, Math.round(params.size[1] * params.region[3]));
  const raster = new Raster(width, height);
  const s = params.size[0] / 640;
  const context: BoardContext = {
    theme: createTheme(palette),
    s,
    width,
    height,
    resolve: createResolver(params.anchor, call),
    px: (value) => Math.round(value * s),
    textScale: (reference) => Math.max(1, Math.round(reference * s)),
  };
  const paint = setup(context);
  const paper = {
    s,
    drift: params.drift,
    heading: params.title,
    titleBlock: params.titleBlock,
    paper: params.paper,
  };
  return {
    raster,
    context,
    render(t) {
      raster.clear();
      paint(raster, t, paintPaper(raster, context.theme, paper, t));
    },
  };
}

/** Builds the board object of a template: raster, quad, paper, and update(t). */
export function createBoard(
  tools: KitTools,
  kitType: string,
  params: BoardParams,
  setup: (context: BoardContext) => Painter,
  namespace: 'fx' | 'env' = 'fx',
): FxObject {
  const board = prepareBoard(tools.palette, params, `kit.${namespace}.${kitType}()`, setup);
  const { mesh, texture } = createQuad(tools, board.raster, params);
  const object = createKitObject(tools.three, { kitType, bounds: emptyBounds(tools) });
  object.add(mesh);
  return asFx(object, (t) => {
    board.render(t);
    texture.needsUpdate = true;
  });
}

/** Template definition: params (own + `boardParams`), a setup that returns the painter. */
export function defineBoard<
  const Name extends string,
  Params extends z.ZodType<BoardParams>,
>(spec: {
  readonly name: Name;
  readonly description: string;
  readonly params: Params;
  readonly methods?: Readonly<Record<string, string>>;
  readonly setup: (params: z.output<Params>, context: BoardContext) => Painter;
}): KitDefinition<Name, Params, FxObject> {
  return defineFx({
    name: spec.name,
    description: spec.description,
    params: spec.params,
    methods: {
      'update(t)': 'Repaints the board for local time t: call it every frame',
      ...spec.methods,
    },
    build: (parsed, tools) =>
      createBoard(tools, spec.name, parsed, (context) => spec.setup(parsed, context)),
  });
}
