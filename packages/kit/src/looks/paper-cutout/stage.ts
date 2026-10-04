/**
 * `kit.env.paperStage`: a multiplane paper set. Depth layers sit at fixed distances in front of a
 * camera preset (`stage.camera({ t })`), each with its own world size of one frame pixel, so a
 * sprite on any layer is drawn 1:1 in frame pixels. Every frame the stage projects each piece's
 * world position through the camera actually used (the preset pan, `ctx.camera.parallax`, the
 * ambient drift), pastes the sprites back to front at whole pixels with their drop shadows
 * (compositor.ts) and shows the result on a clip-space quad (no depth write: never outlined, the
 * shared post pass still dithers and palette-snaps it). Near layers move more than far ones: real
 * parallax, crisp pixels. Voxel objects, ctx.text and ctx.annotate draw on top.
 */
import type * as THREE from 'three';
import { z } from 'zod';
import { KitError } from '../../errors.js';
import { createKitObject, type KitObject } from '../../object.js';
import { defineEnv, type KitTools } from '../../registry.js';
import type { Vec3 } from '../../types.js';
import { createColors } from './colors.js';
import { createCompositor, LIGHTS, shadowShape, type PlacedSprite } from './compositor.js';
import { HILL_KINDS, seedParam } from './landscape.js';
import { notAPiece, pieceModel, stopMotion, type PieceModel, type PiecePose } from './piece.js';
import { createQuad } from './quad.js';
import { scenery, SCENERIES } from './scenery.js';
import { backdropBase, backdropModel, BACKDROPS, celestialModel } from './sky.js';

/** Camera preset: distance to the middle layer, vertical fov. */
export const STAGE_DISTANCE = 10;
export const STAGE_FOV = 30;
/** Layer the camera pan is measured on (0 = backdrop sheet ... 5 = nearest). */
export const MID_LAYER = 3;
export const MAX_LAYER = 5;
const LAYER_GAP = 1.2;
const DEG = Math.PI / 180;
/** Idle sway period of the camera drift (s). */
const DRIFT_PERIOD = 16;

const unit = z.number().min(0).max(2);

export const stageParams = z.object({
  size: z
    .tuple([z.int().min(32).max(3840), z.int().min(18).max(2160)])
    .default([640, 360])
    .describe('Frame size in pixels: pass [ctx.shot.width, ctx.shot.height]'),
  backdrop: z.enum(BACKDROPS).default('dusk').describe('Sky sheet (kraft/paper = plain sheet)'),
  scenery: z
    .enum(SCENERIES)
    .default('hills')
    .describe('Built-in depth strips: hills, city skyline, or none (add your own pieces)'),
  layers: z.int().min(1).max(4).default(3).describe('Number of built-in scenery strips'),
  hills: z.enum(HILL_KINDS).default('rolling').describe('Ridge shape of built-in hills'),
  sky: z.boolean().default(true).describe('Sun (day/dusk), moon and stars (night), clouds (day)'),
  horizon: z.number().min(0.3).max(0.85).default(0.6).describe('Horizon height (0..1 from top)'),
  fps: z.int().min(4).max(24).default(8).describe('Stop-motion cadence of moving pieces (8 or 12)'),
  wobble: unit.default(1).describe('Hand-placed jitter of moving pieces (0 = none)'),
  shadow: unit.default(1).describe('Drop shadow length (0 = none, 2 = long)'),
  light: z
    .enum(LIGHTS)
    .default('low')
    .describe(
      "'low': shadows rise above each layer (landscapes); 'high': they fall down-right (walls)",
    ),
  parallax: unit.default(1).describe('Depth between layers (0 = flat, 2 = deep)'),
  drift: z.number().min(0).max(40).default(10).describe('Idle camera sway in px (0 = still)'),
  seed: seedParam,
});

export type StageParams = z.output<typeof stageParams>;

export interface StageCameraOptions {
  readonly t: number;
  /** Lateral camera travel in pixels of the middle layer (+ = right; near layers move more). */
  readonly pan?: number | undefined;
  /** Vertical travel in pixels (+ = up). */
  readonly rise?: number | undefined;
  /** Idle sway amplitude in pixels (default: the stage's `drift`). */
  readonly drift?: number | undefined;
}

export interface StagePose {
  readonly position: Vec3;
  readonly target: Vec3;
  readonly fov: number;
}

/** Placement of a piece: depth layer and origin in 640x360 reference pixels. */
export interface Placement {
  readonly layer?: number | undefined;
  readonly x?: number | undefined;
  readonly y?: number | undefined;
}

export interface PaperStageMethods {
  /** Poses every piece for local time t (stop-motion clock): call it every frame. */
  update(t: number): void;
  /** Camera preset pose for `ctx.camera.set()` (lateral pan only, pixel-snapped). */
  camera(options: StageCameraOptions): StagePose;
  /** Adds a paper piece on a layer (1 far .. 5 near; 0 = pasted on the sky sheet). */
  place<T extends KitObject>(piece: T, placement?: Placement): T;
  /** World point of frame pixel (x, y) (640x360 reference) on a layer, e.g. to place voxel props. */
  point(layer: number, x: number, y: number): Vec3;
}

export type PaperStage = KitObject & PaperStageMethods;

/** Depth geometry of a stage (pure, unit-tested). */
export interface StageGeometry {
  readonly width: number;
  readonly height: number;
  /** z of a layer (the middle layer at 0, nearer layers positive). */
  depth(layer: number): number;
  /** World size of one frame pixel on a layer at the preset camera. */
  pixel(layer: number): number;
  /** Stage-local point of frame pixel (x, y) on a layer at the preset camera. */
  point(layer: number, x: number, y: number): Vec3;
  camera(pan: number, rise: number): StagePose;
}

export function stageGeometry(width: number, height: number, parallax: number): StageGeometry {
  const gap = LAYER_GAP * parallax;
  const depth = (layer: number): number => (layer - MID_LAYER) * gap;
  const pixel = (layer: number): number =>
    (2 * (STAGE_DISTANCE - depth(layer)) * Math.tan((STAGE_FOV / 2) * DEG)) / height;
  return {
    width,
    height,
    depth,
    pixel,
    point: (layer, x, y) => {
      const size = pixel(layer);
      return [(x - width / 2) * size, (height / 2 - y) * size, depth(layer)];
    },
    camera: (pan, rise) => {
      const size = pixel(MID_LAYER);
      const x = Math.round(pan) * size;
      const y = Math.round(rise) * size;
      return { position: [x, y, STAGE_DISTANCE], target: [x, y, 0], fov: STAGE_FOV };
    },
  };
}

interface Entry {
  readonly piece: KitObject;
  readonly layer: number;
  readonly x: number;
  readonly y: number;
  readonly pose: (t: number) => PiecePose;
  current: PiecePose;
}

/** Internals of a stage for unit tests: composite for a camera without a renderer. */
export interface StageInternals {
  compose(camera: THREE.Camera): boolean;
  readonly frame: Uint8Array;
  readonly width: number;
  readonly height: number;
}

const INTERNALS = new WeakMap<object, StageInternals>();

export function stageInternals(stage: object): StageInternals | undefined {
  return INTERNALS.get(stage);
}

function buildStage(params: StageParams, tools: KitTools): PaperStage {
  const { three } = tools;
  const [width, height] = params.size;
  const s = width / 640;
  const seed = params.seed ?? tools.rng.int(0, 99_999);
  const colors = createColors(tools.palette);
  const geometry = stageGeometry(width, height, params.parallax);
  // Covers pans of +-60 px (+ drift) on the nearest layer at any parallax.
  const margin = Math.round(s * (16 + 70 * (1 + 0.5 * params.parallax)));
  const clock = stopMotion(params.fps, params.wobble, seed);
  const compositor = createCompositor(
    width,
    height,
    colors,
    shadowShape(params.shadow, s, params.light),
  );
  const base = backdropBase(colors, params.backdrop);
  const rgba = new Uint8Array(width * height * 4);
  const quad = createQuad(tools, rgba, width, height);
  const entries: Entry[] = [];
  const object = createKitObject(three, {
    kitType: 'paperStage',
    bounds: () => {
      const [x0, y0, z0] = geometry.point(MID_LAYER, 0, height);
      const [x1, y1] = geometry.point(MID_LAYER, width, 0);
      return new three.Box3(new three.Vector3(x0, y0, z0), new three.Vector3(x1, y1, z0));
    },
  });
  object.add(quad.mesh);

  const bindPiece = (piece: KitObject, model: PieceModel, placement: Placement): void => {
    const layer = placement.layer ?? model.placement.layer;
    const x = (placement.x ?? model.placement.x) * s;
    const y = (placement.y ?? model.placement.y) * s;
    const pose = model.bind({
      colors,
      s,
      width,
      height,
      margin,
      clock,
      seed: seed + entries.length * 101,
      originX: x,
      originY: y,
      below: Math.max(8, Math.ceil(height - y + margin)),
    });
    entries.push({ piece, layer, x, y, pose, current: pose(0) });
    if (piece.parent !== object) object.add(piece);
  };

  const place = <T extends KitObject>(piece: T, placement: Placement = {}): T => {
    const model = pieceModel(piece);
    if (model === undefined) notAPiece('paperStage.place(piece)');
    if (entries.some((entry) => entry.piece === piece)) {
      throw new KitError(
        'invalid-params',
        'paperStage.place(piece): this piece is already on the stage; create one piece per place() call',
      );
    }
    const layer = placement.layer ?? model.placement.layer;
    if (!Number.isInteger(layer) || layer < 0 || layer > MAX_LAYER) {
      throw new KitError(
        'invalid-params',
        `paperStage.place(piece, { layer }): layer must be an integer 0..5 (got ${String(layer)})`,
      );
    }
    bindPiece(piece, model, placement);
    return piece;
  };

  const internal = (model: PieceModel): void => {
    bindPiece(createKitObject(three, { kitType: model.kitType }), model, {});
  };
  const horizon = params.horizon * 360;
  internal(backdropModel(params.backdrop, horizon, seed));
  if (params.sky) internal(celestialModel(params.backdrop, horizon, seed));
  for (const model of scenery(params, horizon, seed)) internal(model);

  /** Layer of a part or anchor: parts of a near piece never come closer than the nearest layer. */
  const layerOf = (entry: Entry, offset: number): number =>
    Math.min(MAX_LAYER, Math.max(0, entry.layer + offset));
  const anchorPoint = (entry: Entry, layer: number, x: number, y: number): Vec3 =>
    geometry.point(layerOf(entry, layer), entry.x + x, entry.y + y);

  const update = (t: number): void => {
    for (const entry of entries) {
      entry.current = entry.pose(t);
      for (const [name, anchor] of Object.entries(entry.current.anchors)) {
        entry.piece.setAnchor(name, anchorPoint(entry, anchor.layer ?? 0, anchor.x, anchor.y));
      }
    }
  };

  const projected = new three.Vector3();
  let lastKey = '';
  const compose = (camera: THREE.Camera): boolean => {
    const placed: PlacedSprite[] = [];
    const keys: number[] = [];
    for (const entry of entries) {
      entry.piece.updateMatrixWorld();
      for (const part of entry.current.parts) {
        const layer = layerOf(entry, part.layer ?? 0);
        projected.set(...geometry.point(layer, entry.x + part.x, entry.y + part.y));
        entry.piece.localToWorld(projected).project(camera);
        const x = Math.round(((projected.x + 1) / 2) * width - part.pivot[0]);
        const y = Math.round(((1 - projected.y) / 2) * height - part.pivot[1]);
        placed.push({ sprite: part.sprite, x, y, layer, shadow: part.shadow });
        keys.push(spriteId(part.sprite), x, y);
      }
    }
    const key = keys.join(',');
    if (key === lastKey) return false;
    lastKey = key;
    compositor.compose(base, placed);
    compositor.writeRgba(rgba);
    quad.texture.needsUpdate = true;
    return true;
  };
  quad.mesh.onBeforeRender = (_renderer, _scene, camera) => {
    compose(camera);
  };
  INTERNALS.set(object, { compose, frame: compositor.data, width, height });

  const camera = (options: StageCameraOptions): StagePose => {
    const amplitude = options.drift ?? params.drift;
    const sway = amplitude * Math.sin((2 * Math.PI * options.t) / DRIFT_PERIOD);
    return geometry.camera((options.pan ?? 0) + sway, options.rise ?? 0);
  };

  const stage = Object.assign(object, {
    update: (t: number) => {
      if (!Number.isFinite(t)) {
        throw new KitError(
          'invalid-params',
          `paperStage.update(t): t must be a finite time in seconds (got ${String(t)})`,
        );
      }
      update(t);
    },
    camera,
    place,
    point: (layer: number, x: number, y: number) => geometry.point(layer, x * s, y * s),
  });
  stage.setAnchor('horizon', geometry.point(MID_LAYER, width / 2, horizon * s));
  for (let layer = 1; layer <= MAX_LAYER; layer += 1) {
    stage.setAnchor(`layer${String(layer)}`, geometry.point(layer, width / 2, horizon * s));
  }
  update(0);
  return stage;
}

const SPRITE_IDS = new WeakMap<object, number>();
let nextSpriteId = 1;

function spriteId(sprite: object): number {
  let id = SPRITE_IDS.get(sprite);
  if (id === undefined) {
    id = nextSpriteId;
    nextSpriteId += 1;
    SPRITE_IDS.set(sprite, id);
  }
  return id;
}

export const paperStage = defineEnv({
  name: 'paperStage',
  description:
    'Paper cut-out set: a torn-paper sky sheet and depth layers of hills or a city skyline, soft dithered drop shadows, real parallax under its camera preset and a stop-motion clock for the pieces you place on it.',
  params: stageParams,
  anchors: {
    horizon: 'Centre of the horizon on the middle layer',
    'layer<n>': 'Horizon centre on layer n (1 far .. 5 near)',
  },
  methods: {
    'update(t)': 'Poses all pieces for local time t: call it every frame',
    'camera({ t, pan?, rise?, drift? })':
      'Camera preset pose: ctx.camera.set(stage.camera({ t })) every frame; pan/rise in px of the middle layer',
    'place(piece, { layer?, x?, y? })':
      'Adds a kit.props.paper* piece on a layer (1 far .. 5 near, 0 = on the sky); x, y in 640x360 px',
    'point(layer, x, y)': 'World point of a frame pixel on a layer (place voxel props, aim marks)',
  },
  build: (params, tools) => buildStage(params, tools),
});
