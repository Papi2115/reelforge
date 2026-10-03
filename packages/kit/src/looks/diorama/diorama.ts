/**
 * Assembly of a diorama environment: the canvas mesh (one greedy mesh), glow quads, movers
 * (cars, walkers, smoke: own small meshes posed from t), the light rig and the base shadow, as
 * one kit object with update(t), camera(options) (the iso preset) and part(name) (movers, for
 * annotations).
 */
import type * as THREE from 'three';
import { z } from 'zod';
import { asEnv, type EnvObject } from '../../env/shared.js';
import { KitError } from '../../errors.js';
import { createKitObject, isKitObject, type KitObject } from '../../object.js';
import type { KitTools } from '../../registry.js';
import type { Vec3 } from '../../types.js';
import type { VoxelColor } from '../../voxel/model.js';
import { idlePan, isoCameraPose, type IsoCameraPose } from './camera.js';
import { BASE, OVERHANG, type DioramaCanvas, type GlowCell } from './canvas.js';
import { createGlowQuads } from './glow.js';
import { createBacking, createBaseShadow, createRig } from './stage.js';
import { DIORAMA_VOXEL } from './tiles.js';
import { BASE_MATERIALS, TIMES_OF_DAY, type TimeOfDay } from './tones.js';

/** Params every diorama shares. */
export const commonParams = {
  seed: z.number().int().default(0).describe('Layout variant (same seed = same diorama)'),
  accent: z
    .string()
    .default('accent1')
    .describe('Palette name of the accent: screens, LEDs, highlights (one accent per shot)'),
  density: z
    .number()
    .min(0)
    .max(1)
    .default(0.7)
    .describe('Share of optional props (plants, extra desks, parked cars, ...)'),
  time: z
    .enum(TIMES_OF_DAY)
    .default('day')
    .describe('day | dusk (warm low sun, lamps on) | night (cool, windows/lamps/screens glow)'),
  base: z.enum(BASE_MATERIALS).optional().describe('Slab under the floor (default per diorama)'),
  lights: z
    .boolean()
    .default(true)
    .describe('Own iso light rig for the time of day (do not add kit.env.lights as well)'),
  shadow: z.boolean().default(true).describe('Dithered shadow under the floating platform'),
};

export const cameraOptions = z
  .object({
    t: z.number().default(0).describe('Shot time (drives the idle pan)'),
    zoom: z.number().min(0.25).max(8).default(1),
    focus: z
      .union([z.string(), z.tuple([z.number(), z.number(), z.number()])])
      .optional()
      .describe('Anchor name or local point to centre'),
    azimuth: z.number().min(-180).max(360).optional(),
    elevation: z.number().min(10).max(80).optional(),
    fov: z.number().min(4).max(40).optional(),
    screen: z.tuple([z.number().int().positive(), z.number().int().positive()]).optional(),
    offset: z.tuple([z.number(), z.number()]).optional(),
    drift: z.number().min(0).max(40).default(6).describe('Idle pan amplitude in pixels'),
    margin: z.number().min(0).max(0.4).optional(),
  })
  .strict();

export type CameraOptions = z.input<typeof cameraOptions>;

/** A moving part: its own kit object, posed absolutely from t. */
export interface Mover {
  readonly name: string;
  readonly object: KitObject;
  pose(t: number): void;
}

export interface GlowLayer {
  readonly cells: readonly GlowCell[];
  readonly colors: readonly VoxelColor[];
  /** Writes the colour number of every cell for time t. */
  pose(t: number, out: Uint8Array): void;
}

export interface DioramaMethods {
  /**
   * Iso camera pose framing this diorama, for ctx.camera.set(): long lens, pixel-snapped,
   * idle pan by t. Options: { t, zoom, focus, offset, drift, azimuth, elevation, fov, screen }.
   */
  camera(options?: CameraOptions): IsoCameraPose;
  /** A moving part by name (e.g. 'car0', 'walker1') for annotations. */
  part(name: string): KitObject;
}

export type DioramaObject = EnvObject & DioramaMethods;

export interface DioramaSpec<Kind extends string> {
  readonly kitType: string;
  readonly canvas: DioramaCanvas<Kind>;
  readonly time: TimeOfDay;
  readonly lights: boolean;
  readonly shadow: boolean;
  readonly glow?: GlowLayer | undefined;
  readonly movers?: readonly Mover[] | undefined;
  /** Colour seen through hairline cracks of the floor (its main floor colour). */
  readonly backing: VoxelColor;
}

/** Backing plane depth under the floor top (inside the 1-voxel floor layer). */
const BACKING_DEPTH = 0.04;

function issues(error: z.ZodError): string {
  return error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ');
}

function worldBounds(object: KitObject, local: THREE.Box3): { min: Vec3; max: Vec3 } {
  object.updateWorldMatrix(true, false);
  const box = local.clone().applyMatrix4(object.matrixWorld);
  return { min: [box.min.x, box.min.y, box.min.z], max: [box.max.x, box.max.y, box.max.z] };
}

export interface AssembledDiorama {
  readonly diorama: DioramaObject;
  /** Re-poses the glow and movers at the last update(t) time (after a state hook changed). */
  readonly repaint: () => void;
}

export function assembleDiorama<Kind extends string>(
  tools: KitTools,
  spec: DioramaSpec<Kind>,
): AssembledDiorama {
  const { canvas } = spec;
  const platform = tools.voxel.mesh(canvas.sketch.model(tools.voxel), {
    voxelSize: DIORAMA_VOXEL,
    pivot: canvas.pivot,
  });
  platform.name = `${spec.kitType}.platform`;
  const object = createKitObject(tools.three, {
    kitType: spec.kitType,
    bounds: () => platform.bounds(),
    anchors: { floor: [0, 0, 0], ...canvas.localAnchors() },
  });
  object.add(platform);
  const [sx, , sz] = canvas.size;
  const floorWidth = (sx - 2 * OVERHANG) * DIORAMA_VOXEL;
  const floorDepth = (sz - 2 * OVERHANG) * DIORAMA_VOXEL;
  const backing = createBacking(tools, floorWidth, floorDepth, spec.backing);
  backing.position.y = -BACKING_DEPTH;
  object.add(backing);
  const toLocal = (point: Vec3): Vec3 => canvas.toLocal(point);
  const glow = spec.glow;
  const quads =
    glow && glow.cells.length > 0
      ? createGlowQuads(tools, `${spec.kitType}.glow`, glow.cells, glow.colors, toLocal)
      : undefined;
  if (quads) object.add(quads.mesh);
  const states = new Uint8Array(quads?.count ?? 0);
  const movers = spec.movers ?? [];
  for (const mover of movers) object.add(mover.object);
  if (spec.lights) object.add(createRig(tools, spec.time));
  if (spec.shadow) {
    const width = sx * DIORAMA_VOXEL;
    const depth = sz * DIORAMA_VOXEL;
    const soft = 1.2;
    const shadow = createBaseShadow(tools, width + 2 * soft, depth + 2 * soft, soft);
    shadow.position.set(0.4, -BASE * DIORAMA_VOXEL - 1, 0.5);
    object.add(shadow);
  }
  let lastT = 0;
  const pose = (t: number): void => {
    lastT = t;
    if (glow && quads) {
      glow.pose(t, states);
      quads.paint(states);
    }
    for (const mover of movers) mover.pose(t);
  };
  pose(0);
  const env = asEnv(object, pose);
  const methods: DioramaMethods = {
    camera(options = {}) {
      const parsed = cameraOptions.safeParse(options);
      if (!parsed.success) {
        throw new KitError(
          'invalid-params',
          `${spec.kitType}.camera(options): ${issues(parsed.error)}`,
        );
      }
      const input = parsed.data;
      const bounds = worldBounds(env, platform.bounds());
      let focus: Vec3 | undefined;
      if (input.focus !== undefined) {
        const local =
          typeof input.focus === 'string'
            ? env.anchor(input.focus)
            : new tools.three.Vector3(...input.focus);
        const world = env.localToWorld(local);
        focus = [world.x, world.y, world.z];
      }
      return isoCameraPose({
        bounds,
        focus,
        zoom: input.zoom,
        azimuth: input.azimuth,
        elevation: input.elevation,
        fov: input.fov,
        screen: input.screen,
        offset: input.offset,
        margin: input.margin,
        pan: idlePan(input.t, input.drift),
      });
    },
    part(name) {
      const found = movers.find((mover) => mover.name === name);
      if (found && isKitObject(found.object)) return found.object;
      throw new KitError(
        'invalid-anchor',
        `${spec.kitType}.part("${name}"): no such part (available: ${movers.map((mover) => mover.name).join(', ') || 'none'})`,
      );
    },
  };
  const repaint = (): void => {
    pose(lastT);
  };
  return { diorama: Object.assign(env, methods), repaint };
}
