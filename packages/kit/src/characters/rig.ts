/**
 * Skeleton of the character pack (ADR-024), as on the concept page: a body group (squash and
 * walk yaw) holding hips -> torso -> neck / shoulders -> elbows and hip joints -> knees, plus
 * per-character extra joints (tail, ears, scarf, antenna, eyes, tuft). Positions are in voxels of
 * `unit`; every joint rotates in YXZ order. `applyPose` sets every joint absolutely from a Pose.
 */
import type * as THREE from 'three';
import type { KitTools } from '../registry.js';
import type { Vec3 } from '../types.js';
import type { Pose } from './clips.js';
import { meshShape, type ShapeSet } from './shape.js';

export interface BodySpec {
  /** World size of one voxel. */
  readonly unit: number;
  /** Hip height (voxels). */
  readonly leg: number;
  readonly thigh: number;
  readonly hipX: number;
  readonly shoulderX: number;
  readonly shoulderY: number;
  readonly upper: number;
  /** Forearm length (default: upper). */
  readonly fore?: number | undefined;
  readonly neckY: number;
}

/** [name, parent, x, y, z] in voxels. */
export type JointDef = readonly [string, string, number, number, number];

export const BASE_JOINTS = [
  'hips',
  'torso',
  'neck',
  'shL',
  'elL',
  'shR',
  'elR',
  'hipL',
  'knL',
  'hipR',
  'knR',
] as const;

export type BaseJoint = (typeof BASE_JOINTS)[number];

export interface Rig {
  /** Squash/stretch and walk yaw; child of the character object. */
  readonly body: THREE.Group;
  readonly joints: Readonly<Record<BaseJoint, THREE.Group>> & Readonly<Record<string, THREE.Group>>;
  readonly spec: BodySpec;
}

function humanJoints(spec: BodySpec): JointDef[] {
  return [
    ['hips', '', 0, spec.leg, 0],
    ['torso', 'hips', 0, 0, 0],
    ['neck', 'torso', 0, spec.neckY, 0],
    ['shL', 'torso', spec.shoulderX, spec.shoulderY, 0],
    ['elL', 'shL', 0, -spec.upper, 0],
    ['shR', 'torso', -spec.shoulderX, spec.shoulderY, 0],
    ['elR', 'shR', 0, -spec.upper, 0],
    ['hipL', 'hips', spec.hipX, 0, 0],
    ['knL', 'hipL', 0, -spec.thigh, 0],
    ['hipR', 'hips', -spec.hipX, 0, 0],
    ['knR', 'hipR', 0, -spec.thigh, 0],
  ];
}

/** Builds the joints and meshes every shape of `shapes` onto its joint. */
export function buildRig(
  tools: KitTools,
  spec: BodySpec,
  shapes: ShapeSet,
  extra: readonly JointDef[] = [],
  materials: Readonly<Record<string, THREE.Material>> = {},
): Rig {
  const { three } = tools;
  const body = new three.Group();
  body.name = 'body';
  const joints: Record<string, THREE.Group> = {};
  for (const [name, parent, x, y, z] of [...humanJoints(spec), ...extra]) {
    const joint = new three.Group();
    joint.name = name;
    joint.rotation.order = 'YXZ';
    joint.position.set(x * spec.unit, y * spec.unit, z * spec.unit);
    (parent === '' ? body : (joints[parent] ?? body)).add(joint);
    joints[name] = joint;
  }
  for (const [name, shape] of shapes.map) {
    const mesh = meshShape(tools, shape, materials);
    const joint = joints[name];
    if (!mesh || !joint) continue;
    // Body meshes (not face features, rays or alerts) define the character's bounds.
    mesh.userData['bodyPart'] = true;
    joint.add(mesh);
  }
  return { body, joints: joints as Rig['joints'], spec };
}

export function applyPose(rig: Rig, pose: Pose): void {
  const { joints, spec, body } = rig;
  const u = spec.unit;
  joints.hips.position.y = (spec.leg + pose.hipY) * u;
  joints.hips.rotation.set(pose.pelvisX, pose.pelvisY, pose.pelvisZ);
  joints.torso.rotation.set(pose.spineX, pose.spineY, pose.spineZ);
  joints.neck.rotation.set(pose.headX, pose.headY, pose.headZ);
  const lift = (spec.shoulderY + 0.8 * pose.shrug) * u;
  joints.shL.position.y = lift;
  joints.shR.position.y = lift;
  joints.shL.rotation.set(pose.armLX, pose.armLY, pose.armLZ);
  joints.shR.rotation.set(pose.armRX, pose.armRY, pose.armRZ);
  joints.elL.rotation.set(pose.elbowL, 0, 0);
  joints.elR.rotation.set(pose.elbowR, 0, 0);
  joints.hipL.rotation.set(pose.legLX, 0, pose.legLZ);
  joints.hipR.rotation.set(pose.legRX, 0, pose.legRZ);
  joints.knL.rotation.set(pose.kneeL, 0, 0);
  joints.knR.rotation.set(pose.kneeR, 0, 0);
  body.scale.set(1 - pose.squash * 0.5, 1 + pose.squash, 1 - pose.squash * 0.5);
}

/**
 * Position of `point` (voxels, in `node`'s space) in the space of `owner` (an ancestor), from the
 * local transforms only (no world matrices needed).
 */
export function pointIn(
  three: KitTools['three'],
  owner: THREE.Object3D,
  node: THREE.Object3D,
  point: Vec3,
  unit: number,
): THREE.Vector3 {
  const result = new three.Vector3(point[0] * unit, point[1] * unit, point[2] * unit);
  let current: THREE.Object3D | null = node;
  while (current !== null && current !== owner) {
    current.updateMatrix();
    result.applyMatrix4(current.matrix);
    current = current.parent;
  }
  return result;
}
