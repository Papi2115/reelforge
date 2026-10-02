/**
 * `kit.fx.shardExplosion`: a burst of voxel shards from a point at time `at` - ballistic flight
 * under gravity, tumbling, resting on the floor, shrinking away at the end of their life, with
 * an optional flash. Every shard is posed absolutely from t (closed-form physics).
 */
import type * as THREE from 'three';
import { z } from 'zod';
import { createKitObject } from '../object.js';
import { defineFx, type KitTools } from '../registry.js';
import type { KitRng, Vec3 } from '../types.js';
import { colorOf } from '../env/shared.js';
import { asFx, clamp01, timeParam, vec2Param, vec3Param } from './shared.js';

export const shardExplosionParams = z.object({
  origin: vec3Param.default([0, 0.5, 0]).describe('Burst centre [x, y, z] in units'),
  at: timeParam.default(0).describe('Local time of the burst (e.g. ctx.anchor("boom").t)'),
  count: z.number().int().min(1).max(600).default(70).describe('Number of shards'),
  seed: z.number().int().default(0).describe('Variant (same seed = same burst)'),
  direction: vec3Param.default([0, 1, 0]).describe('Main burst direction'),
  spread: z
    .number()
    .min(0)
    .max(1)
    .default(0.6)
    .describe('Cone width: 0 = all along direction, 0.5 = hemisphere, 1 = full sphere'),
  speed: vec2Param.default([2.5, 6]).describe('[min, max] launch speed in units/s'),
  gravity: z.number().min(0).default(9).describe('Downward acceleration in units/s^2'),
  floor: z
    .number()
    .nullable()
    .default(0)
    .describe('Ground height (y) where shards come to rest; null = they fall forever'),
  life: vec2Param.default([1.4, 2.4]).describe('[min, max] seconds until a shard is gone'),
  size: vec2Param.default([0.08, 0.22]).describe('[min, max] shard edge in units'),
  colors: z
    .array(z.string())
    .min(1)
    .max(16)
    .default(['hero', 'accent2', 'heroTrim', 'accent1'])
    .describe('Palette names the shards are drawn from'),
  glow: z.number().min(0).max(1).default(0.35).describe('Share of unlit (glowing) shards'),
  spin: z.number().min(0).default(12).describe('Max tumble speed in rad/s'),
  flash: z.boolean().default(true).describe('Bright spark flash at the origin for 0.2 s'),
});

export type ShardExplosionParams = z.output<typeof shardExplosionParams>;

export interface Shard {
  /** Launch velocity (units/s). */
  readonly velocity: Vec3;
  readonly life: number;
  readonly size: number;
  readonly spin: Vec3;
  readonly tilt: Vec3;
  readonly color: string;
  readonly glow: boolean;
}

export interface ShardState {
  /** Offset from the origin. */
  readonly position: Vec3;
  readonly rotation: Vec3;
  /** Edge length (0 = hidden). */
  readonly scale: number;
}

/** Share of a shard's life spent shrinking away at the end. */
const FADE_SHARE = 0.35;
const FLASH_TIME = 0.2;

function normalize([x, y, z]: Vec3): Vec3 {
  const length = Math.hypot(x, y, z);
  return length > 1e-9 ? [x / length, y / length, z / length] : [0, 1, 0];
}

/** Random unit vector inside a cone of half-angle spread * 180 degrees around `axis`. */
export function coneDirection(rng: KitRng, axis: Vec3, spread: number): Vec3 {
  const [ax, ay, az] = normalize(axis);
  const cosMax = Math.cos(spread * Math.PI);
  const cos = rng.range(cosMax, 1);
  const sin = Math.sqrt(Math.max(0, 1 - cos * cos));
  const phi = rng.range(0, Math.PI * 2);
  // Orthonormal basis (u, v) perpendicular to the axis.
  const helper: Vec3 = Math.abs(ay) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  const u = normalize([
    helper[1] * az - helper[2] * ay,
    helper[2] * ax - helper[0] * az,
    helper[0] * ay - helper[1] * ax,
  ]);
  const v: Vec3 = [ay * u[2] - az * u[1], az * u[0] - ax * u[2], ax * u[1] - ay * u[0]];
  const a = Math.cos(phi) * sin;
  const b = Math.sin(phi) * sin;
  return [
    ax * cos + u[0] * a + v[0] * b,
    ay * cos + u[1] * a + v[1] * b,
    az * cos + u[2] * a + v[2] * b,
  ];
}

/** Seeded shard specs of a burst. */
export function scatterShards(rng: KitRng, params: ShardExplosionParams): Shard[] {
  return Array.from({ length: params.count }, () => {
    const direction = coneDirection(rng, params.direction, params.spread);
    const speed = rng.range(params.speed[0], params.speed[1]);
    const spin = (): number => rng.range(-params.spin, params.spin);
    return {
      velocity: [direction[0] * speed, direction[1] * speed, direction[2] * speed],
      life: rng.range(params.life[0], params.life[1]),
      size: rng.range(params.size[0], params.size[1]),
      spin: [spin(), spin(), spin()],
      tilt: [rng.range(0, Math.PI), rng.range(0, Math.PI), 0],
      color: rng.pick(params.colors),
      glow: rng() < params.glow,
    };
  });
}

/** Time after launch when a shard reaches `floor` (relative height <= 0); Infinity = never. */
export function impactTime(vy: number, gravity: number, floor: number | null): number {
  if (floor === null || gravity <= 0) return Infinity;
  // floor + 0.5 g t^2 - vy t = 0, positive root (floor <= 0 keeps the discriminant >= vy^2).
  const discriminant = vy * vy - 2 * gravity * Math.min(0, floor);
  return (vy + Math.sqrt(discriminant)) / gravity;
}

/**
 * Pose of a shard `elapsed` seconds after the burst. `floor` is the ground height relative to
 * the origin (null = no ground). Pure and closed-form, so seeking is exact.
 */
export function shardState(
  shard: Shard,
  elapsed: number,
  gravity: number,
  floor: number | null,
): ShardState {
  if (elapsed < 0 || elapsed >= shard.life) {
    return { position: [0, 0, 0], rotation: [0, 0, 0], scale: 0 };
  }
  const flight = Math.min(elapsed, impactTime(shard.velocity[1], gravity, floor));
  const [vx, vy, vz] = shard.velocity;
  const landed = flight < elapsed;
  const y =
    landed && floor !== null ? floor + shard.size / 2 : vy * flight - 0.5 * gravity * flight ** 2;
  const fade = 1 - clamp01((elapsed - shard.life * (1 - FADE_SHARE)) / (shard.life * FADE_SHARE));
  return {
    position: [vx * flight, y, vz * flight],
    rotation: [
      shard.tilt[0] + shard.spin[0] * flight,
      shard.tilt[1] + shard.spin[1] * flight,
      shard.tilt[2] + shard.spin[2] * flight,
    ],
    scale: shard.size * fade,
  };
}

/** Size of the origin flash `elapsed` seconds after the burst (0 = hidden). */
export function flashSize(elapsed: number, maxSize: number): number {
  if (elapsed < 0 || elapsed >= FLASH_TIME) return 0;
  return maxSize * Math.sin((Math.PI * elapsed) / FLASH_TIME);
}

function instanced(
  tools: KitTools,
  material: THREE.Material,
  shards: readonly Shard[],
): THREE.InstancedMesh {
  const geometry = tools.track(new tools.three.BoxGeometry(1, 1, 1));
  const mesh = new tools.three.InstancedMesh(geometry, material, Math.max(1, shards.length));
  mesh.count = shards.length;
  mesh.frustumCulled = false;
  shards.forEach((shard, index) => {
    mesh.setColorAt(index, colorOf(tools, shard.color));
  });
  return mesh;
}

export const shardExplosion = defineFx({
  name: 'shardExplosion',
  description:
    'Burst of voxel shards from a point at time `at`: flash, ballistic flight under gravity, tumbling, landing on the floor and shrinking away. Use for impacts, breaking objects, reveals. Call fx.update(t) every frame.',
  params: shardExplosionParams,
  anchors: { origin: 'burst centre (the object is placed at `origin`)' },
  build(params, tools) {
    const { three } = tools;
    const rng = tools.rng.fork(`seed:${String(params.seed)}`);
    const shards = scatterShards(rng, params);
    const lit = shards.filter((shard) => !shard.glow);
    const glowing = shards.filter((shard) => shard.glow);
    const materials = tools.materials();
    const litMesh = instanced(tools, materials.instancedLit, lit);
    const glowMesh = instanced(tools, materials.instancedGlow, glowing);
    const flash = new three.Mesh(
      tools.track(new three.OctahedronGeometry(0.5, 0)),
      tools.track(new three.MeshBasicMaterial({ color: colorOf(tools, 'heroTrim') })),
    );
    flash.name = 'flash';
    const maxFlash = params.size[1] * 4;
    const object = createKitObject(three, {
      kitType: 'shardExplosion',
      bounds: () =>
        new three.Box3(new three.Vector3(-0.25, -0.25, -0.25), new three.Vector3(0.25, 0.25, 0.25)),
      anchors: { origin: [0, 0, 0] },
    });
    object.position.set(...params.origin);
    object.add(litMesh, glowMesh, flash);
    const floor = params.floor === null ? null : params.floor - params.origin[1];
    const matrix = new three.Matrix4();
    const position = new three.Vector3();
    const quaternion = new three.Quaternion();
    const euler = new three.Euler();
    const scale = new three.Vector3();
    const poseMesh = (mesh: THREE.InstancedMesh, list: readonly Shard[], elapsed: number): void => {
      list.forEach((shard, index) => {
        const state = shardState(shard, elapsed, params.gravity, floor);
        position.set(...state.position);
        quaternion.setFromEuler(euler.set(...state.rotation));
        scale.setScalar(state.scale);
        mesh.setMatrixAt(index, matrix.compose(position, quaternion, scale));
      });
      mesh.instanceMatrix.needsUpdate = true;
    };
    return asFx(object, (t) => {
      const elapsed = t - params.at;
      poseMesh(litMesh, lit, elapsed);
      poseMesh(glowMesh, glowing, elapsed);
      const size = params.flash ? flashSize(elapsed, maxFlash) : 0;
      flash.visible = size > 0;
      flash.scale.setScalar(Math.max(size, 1e-6));
      flash.rotation.set(0.6, 0.8 + elapsed * 4, 0);
    });
  },
});
