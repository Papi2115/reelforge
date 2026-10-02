/**
 * `kit.fx.dissolve`: an object (or model) dissolves voxel by voxel - out (voxels drift away,
 * tumble and shrink) or in (they fly in and settle) - as a front sweeping in a direction.
 */
import type * as THREE from 'three';
import { z } from 'zod';
import { defineFx } from '../registry.js';
import type { Vec3 } from '../types.js';
import { buildReplica, sourceParams, type ReplicaPart } from './replica.js';
import {
  asLevelFx,
  clamp01,
  EASES,
  easeParam,
  noise1,
  progress,
  seedOf,
  timeParam,
} from './shared.js';

export const DISSOLVE_DIRECTIONS = ['up', 'down', 'left', 'right', 'random', 'radial'] as const;
export type DissolveDirection = (typeof DISSOLVE_DIRECTIONS)[number];

export const dissolveParams = z.object({
  ...sourceParams,
  mode: z
    .enum(['out', 'in'])
    .default('out')
    .describe("'out' = the object breaks up and disappears, 'in' = it assembles from voxels"),
  start: timeParam.default(0).describe('Local time the dissolve starts'),
  end: timeParam.default(1.5).describe('Local time the dissolve is complete'),
  direction: z
    .enum(DISSOLVE_DIRECTIONS)
    .default('up')
    .describe('Where the front travels: up = bottom voxels go first, radial = from the centre out'),
  jitter: z
    .number()
    .min(0)
    .max(1)
    .default(0.35)
    .describe('Randomness of the front (0 = clean sweep, 1 = fully random)'),
  drift: z.number().min(0).default(1.2).describe('How far voxels fly (units) while dissolving'),
  ease: easeParam.default('linear'),
  seed: z.number().int().default(0).describe('Variant of the voxel order and drift'),
});

/** Share of the progress one voxel takes to leave (or arrive). */
export const VOXEL_WINDOW = 0.3;

/** Phase 0..1 of a voxel with front order `order` (0..1) at overall progress `p`. */
export function dissolvePhase(order: number, p: number, window = VOXEL_WINDOW): number {
  return clamp01((p - order * (1 - window)) / window);
}

/** Front order of a position (normalized 0..1 per axis inside the bounds) for a direction. */
export function frontOrder(direction: DissolveDirection, unit: Vec3, random: number): number {
  const [x, y, z] = unit;
  switch (direction) {
    case 'up':
      return y;
    case 'down':
      return 1 - y;
    case 'left':
      return 1 - x;
    case 'right':
      return x;
    case 'radial':
      return clamp01(Math.hypot(x - 0.5, y - 0.5, z - 0.5) / 0.866);
    case 'random':
      return random;
  }
}

interface VoxelPlan {
  readonly part: ReplicaPart;
  readonly index: number;
  readonly order: number;
  readonly drift: Vec3;
  readonly spin: Vec3;
}

function localPositions(part: ReplicaPart): THREE.Vector3[] {
  part.mesh.updateMatrix();
  return part.cells.map((cell) =>
    part.mesh
      .gridToLocal([cell[0] + 0.5, cell[1] + 0.5, cell[2] + 0.5])
      .applyMatrix4(part.mesh.matrix),
  );
}

export const dissolve = defineFx({
  name: 'dissolve',
  description:
    "Voxel dissolve of an object or model by progress between start and end: 'out' breaks it into drifting, shrinking voxels along a sweeping front, 'in' assembles it. Replaces the object in place. fx.update(t) every frame; fx.update(t, p) forces progress p (0..1).",
  params: dissolveParams,
  build(params, tools) {
    const replica = buildReplica(tools, 'dissolve', params, 0.3);
    const seed = seedOf(tools.rng.fork(`seed:${String(params.seed)}`));
    const positions = replica.parts.map(localPositions);
    const all = positions.flat();
    const min = all.reduce(
      (acc, point) => acc.min(point),
      all[0]?.clone() ?? new tools.three.Vector3(),
    );
    const max = all.reduce(
      (acc, point) => acc.max(point),
      all[0]?.clone() ?? new tools.three.Vector3(),
    );
    const span = max.clone().sub(min);
    const unit = (value: number, axis: 'x' | 'y' | 'z'): number =>
      span[axis] > 1e-9 ? (value - min[axis]) / span[axis] : 0.5;
    const plans: VoxelPlan[] = [];
    replica.parts.forEach((part, partIndex) => {
      positions[partIndex]?.forEach((point, index) => {
        const key = plans.length;
        const random = noise1(key, 1, seed);
        const along = frontOrder(
          params.direction,
          [unit(point.x, 'x'), unit(point.y, 'y'), unit(point.z, 'z')],
          random,
        );
        const order = (1 - params.jitter) * along + params.jitter * random;
        const angle = noise1(key, 2, seed) * Math.PI * 2;
        const lift = 0.4 + noise1(key, 3, seed);
        const reach = params.drift / Math.max(1e-6, part.mesh.scale.x);
        plans.push({
          part,
          index,
          order,
          drift: [Math.cos(angle) * reach * 0.6, lift * reach, Math.sin(angle) * reach * 0.6],
          spin: [noise1(key, 4, seed) * 6 - 3, noise1(key, 5, seed) * 6 - 3, 0],
        });
      });
    });
    return asLevelFx(replica.root, (t, level) => {
      const p = level ?? EASES[params.ease](progress(t, params.start, params.end));
      for (const plan of plans) {
        const phase = dissolvePhase(plan.order, p);
        const k = params.mode === 'out' ? phase : 1 - phase;
        const travel = k * k;
        plan.part.mesh.setVoxelTransform(plan.index, {
          offset: [plan.drift[0] * travel, plan.drift[1] * travel, plan.drift[2] * travel],
          rotation: [plan.spin[0] * k, plan.spin[1] * k, 0],
          scale: 1 - k,
        });
      }
    });
  },
});
