/**
 * Floating things for backdrops: `kit.env.floatingCubes` (instanced voxel cubes) and the shard
 * cloud of `kit.env.void`. Every floater has a seeded spec and is posed absolutely from t
 * (slow orbit around the y axis, bobbing, tumbling), so seeking is exact in both directions.
 */
import type * as THREE from 'three';
import { z } from 'zod';
import { createKitObject } from '../object.js';
import { defineEnv, type KitTools } from '../registry.js';
import type { KitRng, Vec3 } from '../types.js';
import type { VoxelColor } from '../voxel/model.js';
import { asEnv, colorOf, type EnvObject } from './shared.js';

export interface Floater {
  readonly angle: number;
  /** Elliptic orbit radii (x, z) and height. */
  readonly radiusX: number;
  readonly radiusZ: number;
  readonly height: number;
  readonly phase: number;
  readonly spin: Vec3;
  readonly tilt: Vec3;
  readonly size: number;
}

export interface FloaterMotion {
  /** Orbit speed around the y axis (rad/s). */
  readonly drift: number;
  /** Bob amplitude (units). */
  readonly bob: number;
}

export interface FloaterPose {
  readonly position: Vec3;
  readonly rotation: Vec3;
}

export interface FloaterArea {
  /** [diameter x, height, diameter z] of the elliptic cylinder the floaters fill. */
  readonly area: Vec3;
  /** Keep-out radius around the y axis (units), e.g. for the scene's subject. */
  readonly clear: number;
  readonly size: readonly [number, number];
  /** Max tumble speed (rad/s). */
  readonly spin: number;
}

/** Seeded floater specs filling an elliptic cylinder (y from 0 to area[1]). */
export function scatterFloaters(rng: KitRng, count: number, options: FloaterArea): Floater[] {
  const [ax, ay, az] = options.area;
  const inner = Math.min(0.95, options.clear / (Math.min(ax, az) / 2));
  return Array.from({ length: count }, () => {
    const radius = Math.sqrt(rng.range(inner * inner, 1));
    const spin = (): number => rng.range(-options.spin, options.spin);
    return {
      angle: rng.range(0, Math.PI * 2),
      radiusX: (radius * ax) / 2,
      radiusZ: (radius * az) / 2,
      height: rng.range(0, ay),
      phase: rng.range(0, Math.PI * 2),
      spin: [spin(), spin(), spin()],
      tilt: [rng.range(0, Math.PI), rng.range(0, Math.PI), 0],
      size: rng.range(options.size[0], options.size[1]),
    };
  });
}

/** Pose of a floater at time t (pure). */
export function floaterPose(floater: Floater, motion: FloaterMotion, t: number): FloaterPose {
  const angle = floater.angle + motion.drift * t;
  const [sx, sy, sz] = floater.spin;
  const [tx, ty, tz] = floater.tilt;
  return {
    position: [
      Math.cos(angle) * floater.radiusX,
      floater.height + motion.bob * Math.sin(t * 1.3 + floater.phase),
      Math.sin(angle) * floater.radiusZ,
    ],
    rotation: [tx + sx * t, ty + sy * t, tz + sz * t],
  };
}

const tuple3 = z.tuple([z.number().positive(), z.number().positive(), z.number().positive()]);

export const floatingCubesParams = z.object({
  count: z.number().int().min(1).max(500).default(24).describe('Number of cubes'),
  seed: z.number().int().default(0).describe('Layout variant (same seed = same layout)'),
  area: tuple3
    .default([10, 5, 10])
    .describe('[diameter x, height, diameter z] in units; cubes float from y = 0 up to height'),
  clear: z.number().min(0).default(0).describe('Keep-out radius around the y axis in units'),
  size: z
    .tuple([z.number().positive(), z.number().positive()])
    .default([0.15, 0.5])
    .describe('[min, max] cube edge in units'),
  colors: z
    .array(z.string())
    .min(1)
    .max(16)
    .default(['accent1', 'accent2', 'accent4', 'heroTrim'])
    .describe('Palette names the cubes are drawn from'),
  glow: z.number().min(0).max(1).default(0.25).describe('Share of unlit (glowing) cubes'),
  drift: z.number().default(0.08).describe('Orbit speed around the y axis in rad/s'),
  bob: z.number().min(0).default(0.25).describe('Bobbing amplitude in units'),
  spin: z.number().min(0).default(0.9).describe('Max tumble speed in rad/s'),
});

export type FloatingCubesParams = z.output<typeof floatingCubesParams>;

/** Builds the cube cloud (also used by kit.env.void). */
export function buildFloatingCubes(params: FloatingCubesParams, tools: KitTools): EnvObject {
  const rng = tools.rng.fork(`seed:${String(params.seed)}`);
  const floaters = scatterFloaters(rng, params.count, {
    area: params.area,
    clear: params.clear,
    size: params.size,
    spin: params.spin,
  });
  const palette: VoxelColor[] = [
    ...params.colors,
    ...params.colors.map((color) => ({ color, glow: true })),
  ];
  const cells = floaters.map((_, index) => {
    const glow = rng() < params.glow ? params.colors.length : 0;
    return [index * 2, 0, 0, 1 + glow + rng.int(0, params.colors.length - 1)] as const;
  });
  const model = tools.voxel.fromGrid({ voxels: cells }, palette);
  const cubes = tools.voxel.mesh(model, {
    mode: 'instanced',
    voxelSize: 1,
    pivot: 'corner',
    ao: 0,
  });
  const order = Array.from({ length: cubes.instanceCount }, (_, index) => {
    const [x] = cubes.instanceCell(index);
    return { index, floater: floaters[x / 2], home: cubes.gridToLocal(cubes.instanceCell(index)) };
  });
  const object = createKitObject(tools.three, { kitType: 'floatingCubes' });
  object.add(cubes);
  const motion: FloaterMotion = { drift: params.drift, bob: params.bob };
  const pose = (t: number): void => {
    for (const { index, floater, home } of order) {
      if (!floater) continue;
      const { position, rotation } = floaterPose(floater, motion, t);
      cubes.setVoxelTransform(index, {
        offset: [
          position[0] - home.x - 0.5,
          position[1] - home.y - 0.5,
          position[2] - home.z - 0.5,
        ],
        rotation,
        scale: floater.size,
      });
    }
  };
  pose(0);
  return asEnv(object, pose);
}

export const floatingCubes = defineEnv({
  name: 'floatingCubes',
  description:
    'Seeded cloud of small cubes (some glowing) slowly orbiting, bobbing and tumbling - the floating voxel debris of the reference style. Call cubes.update(t) every frame.',
  params: floatingCubesParams,
  build: buildFloatingCubes,
});

export interface ShardOptions {
  readonly count: number;
  readonly colors: readonly string[];
  readonly area: FloaterArea;
  readonly motion: FloaterMotion;
}

/** Instanced flat-shaded crystal shards (stretched octahedra) posed from t. */
export function buildShards(
  tools: KitTools,
  rng: KitRng,
  options: ShardOptions,
): { mesh: THREE.InstancedMesh; pose(t: number): void } {
  const { three } = tools;
  const floaters = scatterFloaters(rng, options.count, options.area);
  const stretch = floaters.map(() => rng.range(2.2, 4));
  const geometry = tools.track(new three.OctahedronGeometry(0.5, 0));
  const mesh = new three.InstancedMesh(geometry, tools.materials().instancedLit, options.count);
  mesh.name = 'shards';
  mesh.frustumCulled = false;
  floaters.forEach((_, index) => {
    mesh.setColorAt(index, colorOf(tools, rng.pick(options.colors)));
  });
  const matrix = new three.Matrix4();
  const position = new three.Vector3();
  const quaternion = new three.Quaternion();
  const euler = new three.Euler();
  const scale = new three.Vector3();
  const pose = (t: number): void => {
    floaters.forEach((floater, index) => {
      const state = floaterPose(floater, options.motion, t);
      position.set(...state.position);
      quaternion.setFromEuler(euler.set(...state.rotation));
      const width = floater.size;
      scale.set(width, width * (stretch[index] ?? 3), width);
      mesh.setMatrixAt(index, matrix.compose(position, quaternion, scale));
    });
    mesh.instanceMatrix.needsUpdate = true;
  };
  pose(0);
  return { mesh, pose };
}
