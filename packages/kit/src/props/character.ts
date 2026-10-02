/**
 * `kit.props.character`: the articulated voxel humanoid (24 voxels = 2 units tall), the hero in
 * the orange hoodie by default, plus NPC variants. Joints are kit groups posed from pure
 * clips: `pose(name, t)`, `walk(t, speed)`, `point(target)`, `animate({ clip, from })(t)`,
 * `blend(a, b, k)` and `mix(lower, upper)`; `hold(object)` puts a prop in a hand.
 */
import type * as THREE from 'three';
import { z } from 'zod';
import { KitError } from '../errors.js';
import { createKitObject, isKitObject, type KitObject } from '../object.js';
import { defineProp, type KitTools } from '../registry.js';
import type { Vec3 } from '../types.js';
import {
  ACCESSORIES,
  CHARACTER_VARIANTS,
  characterParts,
  HAIR_STYLES,
  HATS,
  SKIN_TONES,
  VARIANT_DEFAULTS,
  type LookSpec,
} from './character-look.js';
import {
  aimRightArm,
  blendPoses,
  CLIP_NAMES,
  clipPose,
  isPose,
  mixPoses,
  SIT_HIP_VOXELS,
  smoothstep,
  standPose,
  walkPose,
  type Pose,
} from './character-poses.js';
import {
  applyPose,
  CHARACTER_VOXEL,
  createJoints,
  HAND_POINT,
  jointPoint,
  PARTS,
  type Joints,
} from './character-rig.js';
import { amountArg, asProp, colorField, finiteArg, scaleParam } from './shared.js';

export const characterParams = z.object({
  variant: z
    .enum(CHARACTER_VARIANTS)
    .default('hero')
    .describe(
      'Outfit: hero (orange hoodie), hoodie (teal), suit (tie), hacker (dark hood up), officer (uniform, peaked cap)',
    ),
  pose: z
    .enum(CLIP_NAMES)
    .default('stand')
    .describe('Clip that update(t) plays (stand = idle breathing; walk = walking in place)'),
  hair: z.enum(HAIR_STYLES).optional().describe('Hair style (default: per variant)'),
  hat: z.enum(HATS).optional().describe('Headwear; hood = hood up (default: per variant)'),
  skin: z.enum(SKIN_TONES).default('pale').describe('Skin tone'),
  accessories: z
    .array(z.enum(ACCESSORIES))
    .max(ACCESSORIES.length)
    .default([])
    .describe('Any of backpack, headphones, glasses'),
  outfit: colorField('the main garment (hoodie, jacket, uniform)'),
  hairColor: colorField('the hair'),
  scale: scaleParam,
});

const animateOptions = z.object({
  clip: z.enum(CLIP_NAMES),
  from: z.number().default(0),
  speed: z.number().default(1),
  fadeIn: z.number().min(0).default(0),
  target: z.unknown().optional(),
});

type PoseInput = string | Pose;

export interface CharacterMethods {
  pose(name: string, t?: number): void;
  poseAt(name: string, t?: number): Pose;
  blend(a: PoseInput, b: PoseInput, k: number, t?: number): void;
  mix(lower: PoseInput, upper: PoseInput, t?: number): void;
  animate(options: z.input<typeof animateOptions>): (t: number) => void;
  walk(t: number, speed?: number): number;
  point(target: unknown, amount?: number, t?: number): void;
  /** `hand` is 'left' or 'right' (checked at run time: scenes are untyped JS). */
  hold<T extends KitObject>(object: T, hand?: string, align?: string): T;
}

/** A world point from a kit object (its centre), an Object3D or [x, y, z]. */
function targetPoint(three: typeof THREE, target: unknown): THREE.Vector3 {
  if (isKitObject(target)) {
    target.updateWorldMatrix(true, false);
    return target.localToWorld(target.anchor('center'));
  }
  if (Array.isArray(target) && target.length === 3 && target.every(Number.isFinite)) {
    const [x, y, z] = target as [number, number, number];
    return new three.Vector3(x, y, z);
  }
  throw new KitError(
    'invalid-params',
    'character.point(target): target must be a kit object or a world point [x, y, z]',
  );
}

function issues(error: z.ZodError): string {
  return error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ');
}

function lookOf(params: z.output<typeof characterParams>): LookSpec {
  const defaults = VARIANT_DEFAULTS[params.variant];
  return {
    variant: params.variant,
    hair: params.hair ?? defaults.hair,
    hat: params.hat ?? defaults.hat,
    skin: params.skin,
    accessories: params.accessories,
    outfit: params.outfit,
    hairColor: params.hairColor,
  };
}

function buildRig(tools: KitTools, look: LookSpec): Joints<KitObject> {
  const parts = characterParts(tools, look);
  const joints = createJoints(() => tools.voxel.group());
  for (const [part, joint] of PARTS) {
    const { model, pivot } = parts[part];
    joints[joint].add(tools.voxel.mesh(model, { voxelSize: CHARACTER_VOXEL, pivot }));
  }
  const hand: Vec3 = [
    HAND_POINT[0] * CHARACTER_VOXEL,
    HAND_POINT[1] * CHARACTER_VOXEL,
    HAND_POINT[2] * CHARACTER_VOXEL,
  ];
  joints.elbowL.setAnchor('hand', hand);
  joints.elbowR.setAnchor('hand', hand);
  return joints;
}

export const character = defineProp({
  name: 'character',
  description:
    'Articulated voxel person, 2 units tall, facing +z: the hero in the orange hoodie or an NPC (hoodie, suit, hacker, officer) with hair, hats and accessories. Pure poses: pose(name, t) for stand/walk/sit/point/wave/typing/think/shrug/cheer, walk(t, speed), point(target), animate({ clip, from })(t), blend/mix; hold(prop) puts a prop in a hand. Sit on a kit chair with character.on(bench, { at: "seat", align: "seat" }).',
  params: characterParams,
  anchors: {
    bottom: 'between the feet (fixed, whatever the pose)',
    seat: 'where the hips touch a seat in the sit/typing poses (align it with a bench "seat")',
    head: 'top of the head (follows the pose)',
    face: 'front of the face (follows the pose)',
    handL: 'left hand (follows the pose)',
    handR: 'right hand (follows the pose)',
  },
  methods: {
    'update(t)': 'plays the `pose` param clip at t (call every frame)',
    'pose(name, t)': 'applies clip `name` at local time t (stand, walk, sit, point, ...)',
    'poseAt(name, t)': 'the pose record of a clip, for blend/mix',
    'blend(a, b, k, t)': 'pose between a and b (clip names or poseAt records), k 0..1',
    'mix(lower, upper, t)':
      'legs/hips of `lower`, torso/arms/head of `upper`, e.g. mix("sit", "wave", t)',
    'animate({ clip, from, speed, fadeIn, target })':
      'returns (t) => void playing `clip` from scene time `from` (speed = playback rate; fadeIn s from stand; target for point)',
    'walk(t, speed)':
      'walking gait at speed units/s (default 1.2; > 3 runs); returns the distance t * speed to move it by',
    'point(target, amount, t)':
      'aims the right arm at a kit object or world [x, y, z]; amount 0..1 raises the arm',
    'hold(object, hand, align)':
      "parents a prop to the 'right'/'left' hand (its `align` anchor, default 'top', at the palm)",
  },
  build(params, tools) {
    const object = createKitObject(tools.three, { kitType: 'character' });
    object.scale.setScalar(params.scale);
    const joints = buildRig(tools, lookOf(params));
    object.add(joints.hips);
    const v = CHARACTER_VOXEL;
    const seat = (SIT_HIP_VOXELS - 1.5) * v;
    object.setAnchor('bottom', [0, 0, 0]).setAnchor('seat', [0, seat, 0]);
    const toVec = (point: THREE.Vector3): Vec3 => [point.x, point.y, point.z];
    const set = (next: Pose): void => {
      applyPose(joints, next);
      object.setAnchor('head', toVec(jointPoint(tools.three, joints, 'neck', [0, 6, 0])));
      object.setAnchor('face', toVec(jointPoint(tools.three, joints, 'neck', [0, 3, 3])));
      object.setAnchor('handL', toVec(jointPoint(tools.three, joints, 'elbowL', HAND_POINT)));
      object.setAnchor('handR', toVec(jointPoint(tools.three, joints, 'elbowR', HAND_POINT)));
    };
    const poseAt = (name: string, t = 0): Pose =>
      clipPose('character.pose(name)', name, finiteArg('character.pose(t)', t));
    const resolve = (call: string, input: PoseInput, t: number): Pose => {
      if (isPose(input)) return input;
      if (typeof input === 'string') return clipPose(call, input, t);
      throw new KitError('invalid-params', `${call}: expected a clip name or a poseAt() record`);
    };
    /** Pointing pose at local time `local` aimed at `target` (the arm rises in 0.35 s). */
    const aimed = (target: unknown, local: number): Pose => {
      const base = standPose(local);
      applyPose(joints, { ...base, spineY: 0.18 });
      const shoulder = jointPoint(tools.three, joints, 'shoulderR', [0, 0, 0]);
      object.updateWorldMatrix(true, false);
      const goal = object.worldToLocal(targetPoint(tools.three, target)).sub(shoulder);
      const pointing = aimRightArm({ ...base, spineY: 0.18 }, [goal.x, goal.y, goal.z]);
      return blendPoses(base, pointing, smoothstep(0, 0.35, local));
    };
    const methods: CharacterMethods = {
      pose(name, t = 0) {
        set(poseAt(name, t));
      },
      poseAt,
      blend(a, b, k, t = 0) {
        const time = finiteArg('character.blend(t)', t);
        const amount = amountArg('character.blend(k)', k);
        set(
          blendPoses(
            resolve('character.blend(a)', a, time),
            resolve('character.blend(b)', b, time),
            amount,
          ),
        );
      },
      mix(lower, upper, t = 0) {
        const time = finiteArg('character.mix(t)', t);
        set(
          mixPoses(
            resolve('character.mix(lower)', lower, time),
            resolve('character.mix(upper)', upper, time),
          ),
        );
      },
      animate(options) {
        const parsed = animateOptions.safeParse(options);
        if (!parsed.success) {
          throw new KitError('invalid-params', `character.animate(): ${issues(parsed.error)}`);
        }
        const { clip, from, speed, fadeIn, target } = parsed.data;
        return (t) => {
          const time = finiteArg('character.animate()(t)', t);
          const local = Math.max(0, (time - from) * speed);
          const pose =
            clip === 'point' && target !== undefined
              ? aimed(target, local)
              : clipPose('character.animate()', clip, local);
          const k = fadeIn > 0 ? smoothstep(0, 1, (time - from) / fadeIn) : time >= from ? 1 : 0;
          set(k >= 1 ? pose : blendPoses(standPose(time), pose, k));
        };
      },
      walk(t, speed = 1.2) {
        const time = finiteArg('character.walk(t)', t);
        const pace = finiteArg('character.walk(speed)', speed);
        set(walkPose(time * pace, pace, time));
        return time * pace;
      },
      point(target, amount = 1, t = 0) {
        const time = finiteArg('character.point(t)', t);
        const k = amountArg('character.point(amount)', amount);
        set(blendPoses(standPose(time), aimed(target, 1), k));
      },
      hold(prop, hand = 'right', align = 'top') {
        if (!isKitObject(prop)) {
          throw new KitError(
            'invalid-surface',
            'character.hold(object): object must be a kit object',
          );
        }
        if (hand !== 'left' && hand !== 'right') {
          throw new KitError(
            'invalid-params',
            "character.hold(object, hand): hand is 'left' or 'right'",
          );
        }
        return prop.on(hand === 'left' ? joints.elbowL : joints.elbowR, { at: 'hand', align });
      },
    };
    const clip = params.pose;
    set(poseAt(clip, 0));
    return asProp(object, methods, (t) => {
      set(poseAt(clip, t));
    });
  },
});
