/**
 * Skeleton of the voxel character (PLAN.md#3.3): eleven joints (hips, torso, neck, shoulders,
 * elbows, hip joints, knees) as nested Object3Ds, posed from a Pose record. The character uses
 * kit groups as joints (bounds follow the pose); the crowd poses a bare template rig and copies
 * the joint matrices into instanced part meshes.
 */
import type * as THREE from 'three';
import type { Vec3 } from '../types.js';
import { LEG_VOXELS, type Pose } from './character-poses.js';

/** One voxel of the character (24 voxels = 2 units, the hero's height). */
export const CHARACTER_VOXEL = 1 / 12;
/** Height of a standing character in units (without hats or hair tufts). */
export const CHARACTER_HEIGHT = 24 * CHARACTER_VOXEL;

export const JOINTS = [
  'hips',
  'torso',
  'neck',
  'shoulderL',
  'elbowL',
  'shoulderR',
  'elbowR',
  'hipL',
  'kneeL',
  'hipR',
  'kneeR',
] as const;

export type JointName = (typeof JOINTS)[number];

interface JointLayout {
  readonly parent: JointName | null;
  /** Rest position relative to the parent joint, in voxels. */
  readonly offset: Vec3;
}

/** Shoulder joint: 1 voxel below the top of the 7-voxel torso, arms outside its 6-voxel width. */
const SHOULDER: Vec3 = [4, 6, 0];

export const JOINT_LAYOUT: Readonly<Record<JointName, JointLayout>> = {
  hips: { parent: null, offset: [0, LEG_VOXELS, 0] },
  torso: { parent: 'hips', offset: [0, 0, 0] },
  neck: { parent: 'torso', offset: [0, 7, 0] },
  shoulderL: { parent: 'torso', offset: SHOULDER },
  elbowL: { parent: 'shoulderL', offset: [0, -3, 0] },
  shoulderR: { parent: 'torso', offset: [-SHOULDER[0], SHOULDER[1], SHOULDER[2]] },
  elbowR: { parent: 'shoulderR', offset: [0, -3, 0] },
  hipL: { parent: 'hips', offset: [1.5, 0, 0] },
  kneeL: { parent: 'hipL', offset: [0, -4, 0] },
  hipR: { parent: 'hips', offset: [-1.5, 0, 0] },
  kneeR: { parent: 'hipR', offset: [0, -4, 0] },
};

/** Body parts: which joint carries them (L/R limbs share one model). */
export const PARTS = [
  ['torso', 'torso'],
  ['head', 'neck'],
  ['upperArm', 'shoulderL'],
  ['upperArm', 'shoulderR'],
  ['forearm', 'elbowL'],
  ['forearm', 'elbowR'],
  ['thigh', 'hipL'],
  ['thigh', 'hipR'],
  ['shin', 'kneeL'],
  ['shin', 'kneeR'],
] as const;

export type PartName = (typeof PARTS)[number][0];

/** Where a held object sits in a forearm joint's space (the palm), in voxels. */
export const HAND_POINT: Vec3 = [0, -3.5, 0];

export type Joints<T extends THREE.Object3D> = Readonly<Record<JointName, T>>;

/** Builds the joint hierarchy with `make` and returns the joints; hips is the root joint. */
export function createJoints<T extends THREE.Object3D>(make: () => T): Joints<T> {
  const joints = {} as Record<JointName, T>;
  for (const name of JOINTS) {
    const joint = make();
    joint.name = name;
    joint.rotation.order = 'YXZ';
    const { parent, offset } = JOINT_LAYOUT[name];
    joint.position.set(
      offset[0] * CHARACTER_VOXEL,
      offset[1] * CHARACTER_VOXEL,
      offset[2] * CHARACTER_VOXEL,
    );
    joints[name] = joint;
    if (parent !== null) joints[parent].add(joint);
  }
  return joints;
}

/** Sets every joint from `pose` (absolute: the same pose always gives the same transforms). */
export function applyPose(joints: Joints<THREE.Object3D>, pose: Pose): void {
  const v = CHARACTER_VOXEL;
  joints.hips.position.set(0, (LEG_VOXELS + pose.hipY) * v, pose.hipZ * v);
  joints.hips.rotation.set(pose.pelvisX, pose.pelvisY, pose.pelvisZ);
  joints.torso.rotation.set(pose.spineX, pose.spineY, pose.spineZ);
  joints.neck.rotation.set(pose.headX, pose.headY, pose.headZ);
  const lift = (SHOULDER[1] + 0.8 * pose.shrug) * v;
  joints.shoulderL.position.y = lift;
  joints.shoulderR.position.y = lift;
  joints.shoulderL.rotation.set(pose.armLX, pose.armLY, pose.armLZ);
  joints.shoulderR.rotation.set(pose.armRX, pose.armRY, pose.armRZ);
  joints.elbowL.rotation.set(pose.elbowL, 0, 0);
  joints.elbowR.rotation.set(pose.elbowR, 0, 0);
  joints.hipL.rotation.set(pose.legLX, 0, pose.legLZ);
  joints.hipR.rotation.set(pose.legRX, 0, pose.legRZ);
  joints.kneeL.rotation.set(pose.kneeL, 0, 0);
  joints.kneeR.rotation.set(pose.kneeR, 0, 0);
}

/**
 * Position of `point` (voxels, in `joint`'s space) in the space of the rig's owner (the parent
 * of the hips), from the joints' local transforms; no world matrices needed.
 */
export function jointPoint(
  three: typeof THREE,
  joints: Joints<THREE.Object3D>,
  joint: JointName,
  point: Vec3,
): THREE.Vector3 {
  const result = new three.Vector3(
    point[0] * CHARACTER_VOXEL,
    point[1] * CHARACTER_VOXEL,
    point[2] * CHARACTER_VOXEL,
  );
  let name: JointName | null = joint;
  while (name !== null) {
    const node = joints[name];
    node.updateMatrix();
    result.applyMatrix4(node.matrix);
    name = JOINT_LAYOUT[name].parent;
  }
  return result;
}
