/**
 * The character object of the pack (ADR-024): wraps a built rig (mascot, cast member, role,
 * mannequin) as a kit object whose `update(t)` evaluates its cues (pose, expression, walkTo,
 * lookAt) as a pure function of t, drives the face, blink and secondary motion and moves the
 * anchors (head, face, hand, handL, handR, prop, feet) with the pose.
 */
import type * as THREE from 'three';
import { KitError } from '../errors.js';
import { createKitObject, isKitObject, type KitObject } from '../object.js';
import { asProp, finiteArg, type PropObject } from '../props/shared.js';
import type { KitTools } from '../registry.js';
import type { Vec3 } from '../types.js';
import type { CharacterBuild } from './build.js';
import {
  EXPRESSIONS,
  isExpression,
  isPoseName,
  POSES,
  type Expression,
  type PoseName,
} from './clips.js';
import { blinkAt } from './expressions.js';
import { stringHash } from './math.js';
import { applyPose, pointIn } from './rig.js';
import {
  evaluatePose,
  expressionAt,
  hipVelocity,
  insertCue,
  lookWeight,
  walkState,
  type ExpressionCue,
  type LookCue,
  type PoseCue,
  type WalkSegment,
} from './timeline.js';

export interface CueOptions {
  /** Scene seconds, or an anchor from ctx.anchor(...) (its .t). Default 0. */
  readonly at?: unknown;
}

export interface WalkOptions extends CueOptions {
  /** Units per second (default 0.8). */
  readonly speed?: unknown;
  /** Pose after arriving (default 'calm'). */
  readonly then?: unknown;
}

export interface LookOptions extends CueOptions {
  /** Look away again at this time (default: keep looking). */
  readonly until?: unknown;
}

export interface CharacterMethods {
  pose(name: string, options?: CueOptions): CharacterObject;
  expression(name: string, options?: CueOptions): CharacterObject;
  walkTo(point: unknown, options?: WalkOptions): CharacterObject;
  lookAt(target: unknown, options?: LookOptions): CharacterObject;
  /** Seconds when the last queued walk arrives (0 without walks). */
  walkEnd(): number;
}

export type CharacterObject = PropObject & CharacterMethods;

export interface CharacterSettings {
  readonly kitType: string;
  readonly pose: PoseName;
  readonly expression: Expression | 'auto';
  readonly energy?: number | undefined;
  readonly scale: number;
  readonly seed: number;
}

const DEFAULT_SPEED = 0.8;

function timeArg(call: string, value: unknown, fallback: number): number {
  if (value === undefined) return fallback;
  if (typeof value === 'object' && value !== null && 't' in value) {
    return finiteArg(call, value.t);
  }
  return finiteArg(call, value);
}

function pointArg(
  three: KitTools['three'],
  call: string,
  value: unknown,
): THREE.Vector3 | KitObject {
  if (isKitObject(value)) return value;
  if (Array.isArray(value) && value.length === 3 && value.every(Number.isFinite)) {
    const [x, y, z] = value as [number, number, number];
    return new three.Vector3(x, y, z);
  }
  throw new KitError('invalid-params', `${call}: expected a kit object or a point [x, y, z]`);
}

/** Static local bounds of the body meshes at the rest pose (anchors top/center/front...). */
function restBounds(
  three: KitTools['three'],
  object: KitObject,
  build: CharacterBuild,
): THREE.Box3 {
  const box = new three.Box3();
  object.updateMatrixWorld(true);
  build.rig.body.traverse((node) => {
    if (node.userData['bodyPart'] === true) box.expandByObject(node);
  });
  return box;
}

export function createCharacter(
  tools: KitTools,
  build: CharacterBuild,
  settings: CharacterSettings,
): CharacterObject {
  const { three } = tools;
  const { rig } = build;
  // Filled once the rig is posed (below); fixed afterwards, so placement does not follow poses.
  const bounds = new three.Box3();
  const object = createKitObject(three, { kitType: settings.kitType, bounds: () => bounds });
  object.add(rig.body);
  const energy = settings.energy ?? build.energy;
  const personality = {
    energy,
    lag: 0.05 + 0.1 * energy,
    phase: (stringHash(build.id) % 97) / 9.7 + settings.seed * 0.37,
    longArms: build.longArms === true,
  };
  let poses: PoseCue[] = [{ at: 0, pose: settings.pose, auto: false }];
  let expressions: ExpressionCue[] = [{ at: 0, expression: settings.expression }];
  const walks: WalkSegment[] = [];
  let looks: LookCue[] = [];
  const restFace = pointIn(three, object, rig.joints.neck, build.faceAt, rig.spec.unit);
  const u = rig.spec.unit;
  const toVec = (point: THREE.Vector3): Vec3 => [point.x, point.y, point.z];
  const anchor = (name: string, node: THREE.Object3D | undefined, point: Vec3): void => {
    if (node) object.setAnchor(name, toVec(pointIn(three, object, node, point, u)));
  };

  const lookOffset = (
    t: number,
    bodyYaw: number,
    spineYaw: number,
  ): { yaw: number; pitch: number } => {
    let yaw = 0;
    let pitch = 0;
    for (const cue of looks) {
      const weight = lookWeight(cue, t);
      if (weight <= 0) continue;
      const target = pointArg(three, 'lookAt', cue.target);
      let local: THREE.Vector3;
      if (target instanceof three.Vector3) {
        local = target.clone();
      } else {
        target.updateWorldMatrix(true, false);
        local = target.localToWorld(target.anchor('center'));
      }
      object.updateWorldMatrix(true, false);
      object.worldToLocal(local);
      const d = local.sub(restFace);
      const turn = Math.atan2(d.x, d.z) - bodyYaw - spineYaw;
      yaw += weight * Math.max(-1.2, Math.min(1.2, Math.atan2(Math.sin(turn), Math.cos(turn))));
      pitch += weight * Math.max(-0.6, Math.min(0.6, Math.atan2(d.y, Math.hypot(d.x, d.z))));
    }
    return { yaw, pitch };
  };

  const pose = (t: number): void => {
    const frame = evaluatePose(poses, t, personality);
    const walk = walkState(walks, t, object.rotation.y);
    if (walk.position) object.position.set(walk.position[0], object.position.y, walk.position[1]);
    rig.body.rotation.y = walk.yaw;
    const look =
      looks.length > 0
        ? lookOffset(t, walk.yaw, frame.pose.spineY + frame.pose.pelvisY)
        : { yaw: 0, pitch: 0 };
    const posed = {
      ...frame.pose,
      headY: frame.pose.headY + look.yaw,
      headX: frame.pose.headX - look.pitch,
    };
    applyPose(rig, posed);
    const global = t + personality.phase;
    const blink = blinkAt(global, personality.phase);
    const expression = expressionAt(expressions, t, frame.expression);
    build.face?.update(expression, global, blink);
    if (build.blinkEyes) build.blinkEyes.scale.y = blink;
    build.secondary?.({
      pose: posed,
      time: global,
      velocity: hipVelocity(poses, t, personality, posed.hipY),
      expression,
    });
    const shin = rig.spec.leg - rig.spec.thigh;
    anchor('head', rig.joints.neck, build.headTop);
    anchor('face', rig.joints.neck, build.faceAt);
    anchor('handL', rig.joints.elL, build.hand);
    anchor('handR', rig.joints.elR, build.hand);
    const holding = build.held ? rig.joints[build.held.joint] : undefined;
    const handJoint = holding?.parent === rig.joints.elL ? rig.joints.elL : rig.joints.elR;
    anchor('hand', handJoint, build.hand);
    if (holding && build.held) anchor('prop', holding, build.held.point);
    else anchor('prop', handJoint, build.hand);
    const footL = pointIn(three, object, rig.joints.knL, [0, -shin, 0], u);
    const footR = pointIn(three, object, rig.joints.knR, [0, -shin, 0], u);
    object.setAnchor('feet', toVec(footL.add(footR).multiplyScalar(0.5)));
  };

  pose(0);
  bounds.copy(restBounds(three, object, build));
  object.setAnchor('bottom', [0, 0, 0]);
  object.scale.setScalar(settings.scale);
  const call = (method: string): string => `${settings.kitType}.${method}`;
  // Cues set during playback would make a frame depend on the seek history: build() only.
  let playing = false;
  const cueing = (method: string): void => {
    if (!playing) return;
    throw new KitError(
      'kit-outside-build',
      `${call(method)} was called after update(); set every cue in build() (at: the time it starts)`,
    );
  };
  const methods: CharacterMethods = {
    pose(name, options = {}) {
      cueing('pose()');
      if (!isPoseName(name)) {
        throw new KitError(
          'invalid-params',
          `${call('pose')}: unknown pose "${name}" (${POSES.join(', ')})`,
        );
      }
      poses = insertCue(poses, {
        at: timeArg(call('pose'), options.at, 0),
        pose: name,
        auto: false,
      });
      return character;
    },
    expression(name, options = {}) {
      cueing('expression()');
      if (name !== 'auto' && !isExpression(name)) {
        throw new KitError(
          'invalid-params',
          `${call('expression')}: unknown expression "${name}" (auto, ${EXPRESSIONS.join(', ')})`,
        );
      }
      expressions = insertCue(expressions, {
        at: timeArg(call('expression'), options.at, 0),
        expression: name,
      });
      return character;
    },
    walkTo(point, options = {}) {
      cueing('walkTo()');
      const target = pointArg(three, call('walkTo'), point);
      if (!(target instanceof three.Vector3)) {
        throw new KitError(
          'invalid-params',
          `${call('walkTo')}: expected a point [x, y, z] in the parent's space`,
        );
      }
      const previous = walks.at(-1);
      const from: [number, number] = previous
        ? [previous.to[0], previous.to[1]]
        : [object.position.x, object.position.z];
      const start = Math.max(
        previous?.end ?? -Infinity,
        timeArg(call('walkTo'), options.at, previous?.end ?? 0),
      );
      const speed =
        options.speed === undefined ? DEFAULT_SPEED : finiteArg(call('walkTo'), options.speed);
      if (!(speed > 0))
        throw new KitError('invalid-params', `${call('walkTo')}: speed must be > 0`);
      const then = options.then ?? 'calm';
      if (!isPoseName(then))
        throw new KitError(
          'invalid-params',
          `${call('walkTo')}: then must be a pose (${POSES.join(', ')})`,
        );
      const end = start + Math.hypot(target.x - from[0], target.z - from[1]) / speed;
      walks.push({ start, end, from, to: [target.x, target.z] });
      const yieldsAt = (at: number): boolean => poses.some((cue) => cue.at === at && !cue.auto);
      poses = insertCue(poses, { at: start, pose: 'walk', auto: true }, yieldsAt(start));
      poses = insertCue(poses, { at: end, pose: then, auto: true }, yieldsAt(end));
      return character;
    },
    lookAt(target, options = {}) {
      cueing('lookAt()');
      pointArg(three, call('lookAt'), target);
      const at = timeArg(call('lookAt'), options.at, 0);
      const until =
        options.until === undefined ? undefined : timeArg(call('lookAt'), options.until, 0);
      looks = insertCue(looks, { at, until, target });
      return character;
    },
    walkEnd: () => walks.at(-1)?.end ?? 0,
  };
  const character: CharacterObject = asProp(object, methods, (t) => {
    playing = true;
    pose(t);
  });
  return character;
}
