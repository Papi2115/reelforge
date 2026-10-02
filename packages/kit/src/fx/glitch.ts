/**
 * `kit.fx.glitch`: digital glitch of an object (or model) - bursts in which voxel slices jump
 * sideways, voxels drop out and two glowing colour ghosts split left/right (chromatic split).
 * Bursts come from a hash of the time slot, so any t is posed without history.
 */
import { z } from 'zod';
import { defineFx, type KitTools } from '../registry.js';
import type { VoxelObject } from '../voxel/mesh.js';
import type { VoxelModel } from '../voxel/model.js';
import { buildReplica, sourceParams, type ReplicaPart } from './replica.js';
import { asLevelFx, noise1, seedOf, timeParam } from './shared.js';

export const glitchParams = z.object({
  ...sourceParams,
  start: timeParam.default(0).describe('Local time the glitching starts'),
  end: z.number().optional().describe('Local time it stops (default: never)'),
  intensity: z.number().min(0).max(1).default(0.8).describe('Strength of the bursts 0..1'),
  rate: z.number().positive().default(8).describe('Burst slots per second'),
  density: z
    .number()
    .min(0)
    .max(1)
    .default(0.45)
    .describe('Share of slots that glitch (1 = constant glitch)'),
  shift: z.number().min(0).default(0.25).describe('Max sideways jump of a slice in units'),
  ghosts: z
    .tuple([z.string(), z.string()])
    .nullable()
    .default(['accent1', 'accent2'])
    .describe('Colours of the left/right ghost copies (null = no colour split)'),
  seed: z.number().int().default(0).describe('Variant of the burst pattern'),
});

/** Slice height in voxels (slices jump together). */
const SLICE = 2;

/**
 * Glitch level at time t: `intensity` inside a glitching slot of the active window, else 0.
 * Pure: depends only on t and the params.
 */
export function glitchLevel(
  t: number,
  options: {
    readonly start: number;
    readonly end?: number | undefined;
    readonly intensity: number;
    readonly rate: number;
    readonly density: number;
  },
  seed: number,
): number {
  if (t < options.start || t >= (options.end ?? Infinity)) return 0;
  const slot = Math.floor(t * options.rate);
  return noise1(slot, 11, seed) < options.density ? options.intensity : 0;
}

function ghostModel(model: VoxelModel, color: string): VoxelModel {
  return { ...model, palette: model.palette.map(() => ({ color, glow: true })) };
}

interface Ghosts {
  readonly left: VoxelObject;
  readonly right: VoxelObject;
}

function buildGhosts(
  tools: KitTools,
  part: ReplicaPart,
  colors: readonly [string, string],
): Ghosts {
  const make = (color: string): VoxelObject => {
    const origin = part.mesh.gridToLocal([0, 0, 0]);
    const ghost = tools.voxel.mesh(ghostModel(part.model, color), {
      voxelSize: part.mesh.voxelSize,
      pivot: [
        -origin.x / part.mesh.voxelSize,
        -origin.y / part.mesh.voxelSize,
        -origin.z / part.mesh.voxelSize,
      ],
      ao: 0,
      mode: 'greedy',
    });
    ghost.visible = false;
    part.mesh.add(ghost);
    return ghost;
  };
  return { left: make(colors[0]), right: make(colors[1]) };
}

export const glitch = defineFx({
  name: 'glitch',
  description:
    'Digital glitch bursts on an object or model: slices jump sideways, voxels drop out, glowing colour ghosts split left/right. Replaces the object in place. fx.update(t) every frame; fx.update(t, level) forces the strength (e.g. 1 while a hit lands).',
  params: glitchParams,
  build(params, tools) {
    const replica = buildReplica(tools, 'glitch', params, 0.45);
    const seed = seedOf(tools.rng.fork(`seed:${String(params.seed)}`));
    const ghosts = params.ghosts
      ? replica.parts.map((part) =>
          buildGhosts(tools, part, params.ghosts ?? ['accent1', 'accent2']),
        )
      : [];
    let displaced = true;
    return asLevelFx(replica.root, (t, override) => {
      const level = override ?? glitchLevel(t, params, seed);
      // Sub-slots vary the pattern inside a burst.
      const sub = Math.floor(t * params.rate * 3);
      ghosts.forEach(({ left, right }, index) => {
        const part = replica.parts[index];
        const unit = params.shift / Math.max(1e-6, part?.mesh.scale.x ?? 1);
        const split = level * unit * (0.25 + 0.35 * noise1(sub, 21, seed));
        left.visible = level > 0;
        right.visible = level > 0;
        left.position.set(-split, 0, -0.01);
        right.position.set(split, 0, -0.01);
      });
      if (level <= 0 && !displaced) return;
      displaced = level > 0;
      for (const part of replica.parts) {
        const unit = params.shift / Math.max(1e-6, part.mesh.scale.x);
        part.cells.forEach((cell, index) => {
          if (level <= 0) {
            part.mesh.setVoxelTransform(index, {});
            return;
          }
          const slice = Math.floor(cell[1] / SLICE);
          const jumps = noise1(slice, sub, seed) < 0.35 * level + 0.1;
          const offset = jumps ? (noise1(slice, sub + 7, seed) * 2 - 1) * level * unit : 0;
          const drop = noise1(index, sub + 13, seed) < 0.08 * level;
          part.mesh.setVoxelTransform(index, { offset: [offset, 0, 0], scale: drop ? 0 : 1 });
        });
      }
    });
  },
});
