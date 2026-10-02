/**
 * `kit.props.crowd`: many voxel people for one batch of draw calls per outfit. Figures share the
 * character's part models: every (outfit, body part) is one InstancedMesh, posed each frame by
 * running a bare template rig through the character clips and copying its joint matrices.
 * Layout, outfits, lanes and gait phases come from `seed` (hashed per figure, so the same seed
 * gives the same crowd in every shot); poses are pure functions of t.
 */
import type * as THREE from 'three';
import { z } from 'zod';
import { hashCell, pickColor } from '../env/shared.js';
import { KitError } from '../errors.js';
import { createKitObject } from '../object.js';
import { defineProp, type KitTools } from '../registry.js';
import type { Vec3 } from '../types.js';
import type { VoxelModel } from '../voxel/model.js';
import {
  CHARACTER_VARIANTS,
  characterParts,
  HAIR_CHAIN,
  HAIR_STYLES,
  OUTFIT_CHAINS,
  VARIANT_DEFAULTS,
  type Accessory,
  type CharacterVariant,
  type Hat,
  type LookSpec,
} from './character-look.js';
import { cheerPose, standPose, walkPose, type Pose } from './character-poses.js';
import { applyPose, CHARACTER_VOXEL, createJoints, PARTS } from './character-rig.js';
import { asProp, DARK, scaleParam, seedParam } from './shared.js';

export const crowdParams = z.object({
  count: z.number().int().min(1).max(400).default(40).describe('Number of people'),
  area: z
    .tuple([z.number().positive().max(200), z.number().positive().max(200)])
    .default([10, 6])
    .describe('Width (x) and depth (z) in units, centred on the crowd; ~1 unit per person'),
  seed: seedParam,
  spread: z
    .number()
    .min(0)
    .max(1)
    .default(0.7)
    .describe('0 = neat rows (audience, queue) .. 1 = loose placement'),
  walking: z
    .number()
    .min(0)
    .max(1)
    .default(0.25)
    .describe('Share of rows that walk sideways in lanes (wrapping at the area edges)'),
  speed: z.number().min(0).max(4).default(1.2).describe('Walking speed in units/s'),
  facing: z
    .enum(['camera', 'random', 'center'])
    .default('camera')
    .describe('Standing people face the camera (+z), random directions or the centre'),
  cheer: z
    .number()
    .min(0)
    .max(1)
    .default(0)
    .describe('Share of standing people cheering with raised arms'),
  variants: z
    .array(z.enum(CHARACTER_VARIANTS))
    .min(1)
    .default(['hoodie', 'suit'])
    .describe('Outfits to draw from (see character.variant)'),
  looks: z
    .number()
    .int()
    .min(1)
    .max(12)
    .default(6)
    .describe('Distinct outfits/hair combinations (each costs 10 draw calls)'),
  scale: scaleParam,
});

type CrowdParams = z.output<typeof crowdParams>;

interface Figure {
  readonly look: number;
  readonly slot: number;
  readonly x: number;
  readonly z: number;
  readonly yaw: number;
  /** Walking lane: direction (+1/-1) and speed; 0 = standing. */
  readonly lane: number;
  readonly cheer: boolean;
  readonly phase: number;
}

/** Hair colours that stay clear of the hero's orange in every style. */
const HAIR_COLORS = [
  HAIR_CHAIN,
  HAIR_CHAIN,
  DARK,
  ['slateGrey', 'ash', 'brown', 'textDim'],
  ['cream', 'bone', 'sand', 'heroTrim'],
] as const;
const OUTFITS = Object.values(OUTFIT_CHAINS);

/** Seeded 0..1 per (figure or row, salt). */
function roll(seed: number, index: number, salt: number): number {
  return hashCell(index, salt, 77, seed);
}

function choose<T>(items: readonly T[], value: number): T {
  const item = items[Math.min(items.length - 1, Math.floor(value * items.length))];
  if (item === undefined) throw new KitError('invalid-params', 'crowd: empty choice');
  return item;
}

function crowdLooks(tools: KitTools, params: CrowdParams, seed: number): LookSpec[] {
  return Array.from({ length: params.looks }, (_, index) => {
    const r = (salt: number) => roll(seed, index, 100 + salt);
    const variant: CharacterVariant = choose(params.variants, r(0));
    const accessories: Accessory[] = [];
    if (r(1) < 0.25) accessories.push('backpack');
    if (r(2) < 0.15) accessories.push('glasses');
    if (r(3) < 0.1) accessories.push('headphones');
    const hats: readonly Hat[] = ['none', 'none', 'none', 'none', 'cap', 'beanie'];
    const plain = variant === 'hoodie' || variant === 'hero';
    return {
      variant,
      hair: choose(HAIR_STYLES, r(4)),
      hat: plain ? choose(hats, r(5)) : VARIANT_DEFAULTS[variant].hat,
      skin: r(6) < 0.3 ? 'warm' : 'pale',
      accessories,
      outfit: variant === 'hoodie' ? pickColor(tools.palette, choose(OUTFITS, r(7))) : undefined,
      hairColor: pickColor(tools.palette, choose(HAIR_COLORS, r(8))),
    };
  });
}

function layout(params: CrowdParams, seed: number): Figure[] {
  const [width, depth] = params.area;
  const columns = Math.max(1, Math.round(Math.sqrt((params.count * width) / depth)));
  const rows = Math.ceil(params.count / columns);
  const [cellX, cellZ] = [width / columns, depth / rows];
  const slots = new Array<number>(params.looks).fill(0);
  return Array.from({ length: params.count }, (_, index) => {
    const row = Math.floor(index / columns);
    const inRow = Math.min(columns, params.count - row * columns);
    const column = (index % columns) + (columns - inRow) / 2;
    const r = (salt: number) => roll(seed, index, salt);
    const walking = roll(seed, row, 1) < params.walking;
    const jitter = params.spread * 0.4;
    const x = -width / 2 + (column + 0.5 + (r(2) - 0.5) * 2 * jitter) * cellX;
    const z = -depth / 2 + (row + 0.5 + (r(3) - 0.5) * 2 * jitter * (walking ? 0.2 : 1)) * cellZ;
    const direction = roll(seed, row, 4) < 0.5 ? 1 : -1;
    const laneSpeed = params.speed * (0.85 + 0.3 * roll(seed, row, 5));
    const facing =
      params.facing === 'random'
        ? r(6) * Math.PI * 2
        : params.facing === 'center'
          ? Math.atan2(-x, -z) + (r(6) - 0.5) * 0.4
          : (r(6) - 0.5) * 0.9;
    const look = Math.min(params.looks - 1, Math.floor(r(7) * params.looks));
    const slot = slots[look] ?? 0;
    slots[look] = slot + 1;
    return {
      look,
      slot,
      x,
      z,
      yaw: walking ? (direction * Math.PI) / 2 : facing,
      lane: walking ? direction * laneSpeed : 0,
      cheer: !walking && r(8) < params.cheer,
      phase: r(9) * 10,
    };
  });
}

function wrap(value: number, width: number): number {
  return ((((value + width / 2) % width) + width) % width) - width / 2;
}

function figurePose(figure: Figure, t: number): Pose {
  if (figure.lane !== 0) {
    const pace = Math.abs(figure.lane);
    return walkPose(t * pace + figure.phase, pace, t + figure.phase);
  }
  if (figure.cheer) return cheerPose(t + figure.phase);
  const idle = standPose(t + figure.phase);
  return { ...idle, headY: idle.headY + 0.35 * Math.sin(0.4 * t + figure.phase) };
}

/** The greedy geometry of one part model (the voxel object itself is not kept). */
function partGeometry(tools: KitTools, model: VoxelModel, pivot: Vec3): THREE.BufferGeometry {
  const object = tools.voxel.mesh(model, { voxelSize: CHARACTER_VOXEL, pivot, mode: 'greedy' });
  const mesh = object.children.find((child): child is THREE.Mesh => 'geometry' in child);
  if (!mesh) throw new KitError('invalid-model', 'crowd: part mesh without geometry');
  return mesh.geometry;
}

export const crowd = defineProp({
  name: 'crowd',
  description:
    'Crowd of voxel people (up to 400, cheap: one instanced batch per outfit and body part) in an area: idle people glancing around, sideways walking lanes, optional cheering. Seeded layout and outfits; call crowd.update(t) every frame. Put the hero (kit.props.character) in front.',
  params: crowdParams,
  methods: { 'update(t)': 'poses every person for time t (walkers move along their lane)' },
  build(params, tools) {
    const { three } = tools;
    const seed = Math.imul(params.seed, 0x9e3779b1) >>> 0;
    const looks = crowdLooks(tools, params, seed);
    const figures = layout(params, seed);
    const counts = looks.map((_, look) => figures.filter((figure) => figure.look === look).length);
    const materials = tools.materials();
    const geometries: THREE.BufferGeometry[] = [];
    const batches = looks.map((look, index) => {
      const parts = characterParts(tools, look);
      return PARTS.map(([part]) => {
        const geometry = partGeometry(tools, parts[part].model, parts[part].pivot);
        geometries.push(geometry);
        const mesh = new three.InstancedMesh(
          geometry,
          [materials.lit, materials.glow],
          counts[index] ?? 0,
        );
        mesh.frustumCulled = false;
        return mesh;
      });
    });
    const [width, depth] = params.area;
    const box = new three.Box3(
      new three.Vector3(-width / 2 - 0.5, 0, -depth / 2 - 0.5),
      new three.Vector3(width / 2 + 0.5, 2.2, depth / 2 + 0.5),
    );
    const object = createKitObject(three, {
      kitType: 'crowd',
      bounds: () => box,
      resources: geometries,
    });
    object.scale.setScalar(params.scale);
    for (const batch of batches) object.add(...batch.filter((mesh) => mesh.count > 0));
    const root = new three.Object3D();
    const joints = createJoints(() => new three.Object3D());
    root.add(joints.hips);
    const pose = (t: number): void => {
      for (const figure of figures) {
        const x = figure.lane === 0 ? figure.x : wrap(figure.x + figure.lane * t, width);
        root.position.set(x, 0, figure.z);
        root.rotation.set(0, figure.yaw, 0);
        applyPose(joints, figurePose(figure, t));
        root.updateMatrixWorld(true);
        const batch = batches[figure.look] ?? [];
        PARTS.forEach(([, joint], index) => {
          batch[index]?.setMatrixAt(figure.slot, joints[joint].matrixWorld);
        });
      }
      for (const batch of batches) {
        for (const mesh of batch) mesh.instanceMatrix.needsUpdate = true;
      }
    };
    pose(0);
    return asProp(object, {}, pose);
  },
});
